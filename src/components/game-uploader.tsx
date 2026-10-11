"use client";

import { upload as uploadToBlob } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { finishGameUpload, startGameUpload } from "@/app/actions/game-upload";
import {
  GAME_BUCKET,
  analyzeGameFolder,
  formatBytes,
  gameKeyFrom,
  isJunkPath,
  uploadLimits,
  type FolderAnalysis,
  type GameFile,
  type GameStore,
  type PickedFile,
} from "@/lib/game-files";
import { createClient } from "@/lib/supabase/client";

type Ready = Extract<FolderAnalysis, { ok: true }>;

type Phase =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ready"; folder: Ready }
  | { kind: "uploading"; folder: Ready; doneBytes: number; doneFiles: number }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string; folder?: Ready };

const TICKET_BATCH = 60; // 서버 액션이 한 번에 받는 파일 목록 크기
const PARALLEL = 4; // 동시에 올리는 파일 수
const RETRIES = 2;
const MULTIPART_BYTES = 20 * 1024 * 1024; // Blob: 이보다 큰 파일은 조각내어 올립니다

const STORE_LABEL: Record<GameStore, string> = {
  blob: "Vercel Blob",
  supabase: "Supabase 저장소",
};

/**
 * 게임 폴더 올리기.
 *
 * 폴더를 고르면 브라우저에서 먼저 검사하고(잡파일 제외, 빌드 결과 찾기, 안 뜨는 원인 경고),
 * 파일을 저장소로 바로 올립니다. 다 올라간 뒤에야 게임 경로가 정해지므로 올리다 실패해도
 * 사이트에 반쪽짜리 게임이 보이는 일은 없습니다.
 */
export function GameUploader({
  games,
  store,
  onUploaded,
}: {
  /** 파일을 교체할 수 있는 기존 게임 */
  games: { id: string; title: string }[];
  /** 지금 업로드가 가는 저장소 — 받을 수 있는 파일 크기가 저장소마다 다릅니다. */
  store: GameStore;
  /** 새 게임으로 올렸을 때 — 등록 폼의 게임 경로 칸을 채웁니다. */
  onUploaded: (entryUrl: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [targetId, setTargetId] = useState(""); // "" = 새 게임
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const busy = phase.kind === "checking" || phase.kind === "uploading";

  async function check(picked: PickedFile[]) {
    setPhase({ kind: "checking" });
    try {
      const result = await analyzeGameFolder(picked, uploadLimits(store));
      setPhase(result.ok ? { kind: "ready", folder: result } : { kind: "error", message: result.error });
    } catch {
      setPhase({ kind: "error", message: "폴더를 읽지 못했습니다. 다시 골라주세요." });
    }
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []).map((file) => ({
      path: file.webkitRelativePath || file.name,
      file,
    }));
    event.target.value = ""; // 같은 폴더를 다시 골라도 change 가 나게
    if (picked.length > 0) void check(picked);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (busy) return;

    // 항목은 이벤트가 끝나면 못 쓰게 되므로, 기다리기 전에 먼저 꺼내 둡니다.
    const entries = Array.from(event.dataTransfer.items)
      .map((item) => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => Boolean(entry));
    if (entries.length === 0) return;

    setPhase({ kind: "checking" });
    readEntries(entries).then(check, () =>
      setPhase({ kind: "error", message: "폴더를 읽지 못했습니다. 다시 끌어다 놓아주세요." }),
    );
  }

  async function upload(folder: Ready) {
    const key = gameKeyFrom(folder.name);
    const total = Math.max(folder.totalBytes, 1);
    let doneBytes = 0;
    let doneFiles = 0;
    setPhase({ kind: "uploading", folder, doneBytes, doneFiles });

    try {
      const storage = createClient().storage.from(GAME_BUCKET);
      let build: string | undefined;

      for (let i = 0; i < folder.files.length; i += TICKET_BATCH) {
        const batch = folder.files.slice(i, i + TICKET_BATCH);
        const started = await startGameUpload({
          key,
          build,
          files: batch.map((f) => ({ path: f.path, size: f.file.size })),
        });
        if (!started.ok) throw new Error(started.error);
        build = started.build;

        const prefix = `${key}/${build}`;
        const tokens = new Map(started.tickets.map((ticket) => [ticket.path, ticket.token]));
        const queue = [...batch];

        // 어느 저장소로 올릴지는 서버가 정합니다 (화면을 연 뒤에 설정이 바뀌었을 수도 있습니다).
        const toBlob = started.store === "blob";

        async function worker() {
          for (let next = queue.shift(); next; next = queue.shift()) {
            if (toBlob) await putBlob(prefix, next);
            else await putFile(storage, prefix, next, tokens.get(next.path));
            doneBytes += next.file.size;
            doneFiles += 1;
            setPhase({ kind: "uploading", folder, doneBytes: Math.min(doneBytes, total), doneFiles });
          }
        }
        await Promise.all(Array.from({ length: PARALLEL }, worker));
      }

      const finished = await finishGameUpload({ key, build: build!, gameId: targetId || undefined });
      if (!finished.ok) throw new Error(finished.error);

      if (finished.replacedTitle) {
        setPhase({
          kind: "done",
          message: `「${finished.replacedTitle}」의 게임 파일을 새 버전으로 바꿨습니다.`,
        });
        router.refresh();
      } else {
        onUploaded(finished.entryUrl);
        setPhase({
          kind: "done",
          message: "올렸습니다. 아래에 이름 등을 채우고 「게임 등록」을 누르면 사이트에 나옵니다.",
        });
      }
    } catch (cause) {
      setPhase({
        kind: "error",
        folder,
        message: cause instanceof Error ? cause.message : "올리는 중 문제가 생겼습니다.",
      });
    }
  }

  const folder = "folder" in phase ? phase.folder : undefined;

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-4 space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-neon-400 bg-neon-400/10" : "border-ink-700"
        }`}
      >
        <p className="font-semibold">게임 폴더 올리기</p>
        <p className="text-sm text-ink-400 mt-1">
          폴더를 여기에 끌어다 놓거나 아래 버튼으로 고르세요.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-3 rounded-lg bg-ink-100 text-ink-950 px-4 py-2 text-sm font-semibold hover:bg-white transition-colors disabled:opacity-50"
        >
          폴더 선택
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={onPick}
          // 폴더째 고르게 하는 속성 — 표준 타입에는 없어서 이렇게 넣습니다.
          {...({ webkitdirectory: "" } as Record<string, string>)}
        />
        <p className="text-xs text-ink-600 mt-3 leading-relaxed">
          index.html 이 들어 있는 폴더를 통째로 고르면 됩니다. Vite 처럼 빌드가 필요한 프로젝트는
          빌드한 뒤 생기는 dist 폴더를 고르세요. 파일 하나는{" "}
          {formatBytes(uploadLimits(store).maxFileBytes)} 까지 올릴 수 있습니다.
        </p>
        <p className="text-xs text-ink-600 mt-1">저장 위치: {STORE_LABEL[store]}</p>
      </div>

      {phase.kind === "checking" && <p className="text-sm text-ink-400">폴더를 확인하는 중…</p>}

      {folder && (
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-semibold">{folder.name}</span>
            <span className="text-ink-400">
              {" "}
              — 파일 {folder.files.length}개 · {formatBytes(folder.totalBytes)}
            </span>
          </p>
          {folder.notes.map((note) => (
            <p key={note} className="text-ink-400">
              {note}
            </p>
          ))}
          {folder.warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-gold leading-relaxed"
            >
              {warning}
            </p>
          ))}
          {!folder.hasSdk && (
            <p className="text-ink-400 leading-relaxed">
              이 게임은 사이트 SDK 를 쓰지 않아 랭킹 없이 체험만 됩니다.
            </p>
          )}
        </div>
      )}

      {(phase.kind === "ready" || (phase.kind === "error" && phase.folder)) && folder && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            aria-label="올릴 곳"
            className="rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm"
          >
            <option value="">새 게임으로 올리기</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                기존 게임 파일 교체 — {game.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void upload(folder)}
            className="rounded-lg bg-lime-glow text-ink-950 px-4 py-2 text-sm font-bold hover:brightness-110 transition-all"
          >
            {phase.kind === "error" ? "다시 올리기" : "올리기"}
          </button>
        </div>
      )}

      {phase.kind === "uploading" && (
        <div>
          <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
            <div
              className="h-full bg-neon-400 transition-[width]"
              style={{ width: `${percent(phase.doneBytes, phase.folder.totalBytes)}%` }}
            />
          </div>
          <p className="text-sm text-ink-400 mt-2">
            올리는 중… {percent(phase.doneBytes, phase.folder.totalBytes)}% ({phase.doneFiles}/
            {phase.folder.files.length}) — 끝날 때까지 이 창을 닫지 마세요.
          </p>
        </div>
      )}

      {phase.kind === "done" && <p className="text-sm text-lime-glow">{phase.message}</p>}
      {phase.kind === "error" && <p className="text-sm text-punch-400">{phase.message}</p>}
    </div>
  );
}

function percent(done: number, total: number) {
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 100;
}

type Bucket = ReturnType<ReturnType<typeof createClient>["storage"]["from"]>;

/** Vercel Blob 으로 파일 하나를 올립니다. 허가는 /api/game-upload 가 파일마다 내줍니다. */
async function putBlob(prefix: string, file: GameFile) {
  let lastError = "";
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      await uploadToBlob(`${prefix}/${file.path}`, file.file, {
        access: "public",
        handleUploadUrl: "/api/game-upload",
        contentType: file.type,
        multipart: file.file.size > MULTIPART_BYTES,
      });
      return;
    } catch (cause) {
      lastError = cause instanceof Error ? cause.message : String(cause);
    }
  }
  throw new Error(`올리지 못했습니다 (${file.path}): ${lastError}`);
}

/** Supabase 저장소로 파일 하나를 1회용 주소로 올립니다. 네트워크가 잠깐 끊겨도 몇 번 다시 시도합니다. */
async function putFile(storage: Bucket, prefix: string, file: GameFile, token: string | undefined) {
  if (!token) throw new Error(`업로드 주소를 받지 못했습니다: ${file.path}`);

  // 저장소는 올라온 파일(Blob)에 적힌 종류를 그대로 기록합니다. 브라우저가 붙여 준 종류는
  // .glb · .wasm 에서 비어 있거나 OS 마다 달라서, 우리가 확장자로 정한 종류로 다시 감쌉니다.
  // 큰 파일은 저장소 주소에서 바로 내려가므로(예: 큰 .wasm) 여기 기록된 종류가 그대로 쓰입니다.
  const body = file.file.slice(0, file.file.size, file.type);

  let lastError = "";
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const { error } = await storage.uploadToSignedUrl(`${prefix}/${file.path}`, token, body, {
      // 주소에 빌드 번호가 들어 있어 내용이 바뀌지 않으므로 오래 캐시합니다.
      cacheControl: "31536000",
      upsert: true,
    });
    if (!error) return;
    lastError = error.message;
  }
  throw new Error(`올리지 못했습니다 (${file.path}): ${lastError}`);
}

/** 끌어다 놓은 폴더를 훑어 파일을 모읍니다. */
async function readEntries(roots: FileSystemEntry[]): Promise<PickedFile[]> {
  const picked: PickedFile[] = [];

  async function walk(entry: FileSystemEntry) {
    const path = entry.fullPath.replace(/^\/+/, "");
    // node_modules 같은 폴더는 파일이 수만 개라, 들어가기 전에 건너뜁니다.
    if (isJunkPath(path)) return;

    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      picked.push({ path, file });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries 는 한 번에 일부만 돌려주므로 빈 배열이 나올 때까지 부릅니다.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject),
        );
        if (batch.length === 0) break;
        for (const child of batch) await walk(child);
      }
    }
  }

  for (const root of roots) await walk(root);
  return picked;
}
