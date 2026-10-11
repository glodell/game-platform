"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createHackathon,
  createOfficialGame,
  createTournament,
  deleteNote,
  reviewSubmission,
  saveNote,
  setGameThumbnail,
  type AdminResult,
} from "@/app/actions/admin";
import { linkGameFolder } from "@/app/actions/game-upload";
import type { GameStore } from "@/lib/game-files";
import { FEATURES } from "@/lib/site";
import { GameUploader } from "./game-uploader";
import { Badge } from "./ui";

/* ------------------------------------------------------------------ */
/* 제출작 심사                                                          */
/* ------------------------------------------------------------------ */

export function ReviewRow({
  game,
}: {
  game: {
    id: string;
    slug: string;
    title: string;
    tagline: string | null;
    authorHandle: string;
    createdAt: string;
    isHackathonEntry: boolean;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  function decide(decision: "approve" | "reject") {
    startTransition(async () => {
      const res = await reviewSubmission(game.id, decision);
      setResult(res.ok ? res.message : res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <li className="panel p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/games/${game.slug}`}
              target="_blank"
              className="font-bold hover:text-neon-400 transition-colors"
            >
              {game.title}
            </Link>
            {game.isHackathonEntry && <Badge tone="lime">해커톤</Badge>}
          </div>
          {game.tagline && <p className="text-sm text-ink-400 mt-1">{game.tagline}</p>}
          <p className="text-xs text-ink-600 mt-1.5">
            @{game.authorHandle} · {game.createdAt}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <Link
            href={`/games/${game.slug}`}
            target="_blank"
            className="rounded-lg border border-ink-700 px-3 py-2 text-xs font-semibold hover:border-neon-400/50 transition-colors"
          >
            플레이 확인
          </Link>
          <button
            onClick={() => decide("reject")}
            disabled={pending}
            className="rounded-lg border border-punch-500/40 text-punch-400 px-3 py-2 text-xs font-semibold hover:bg-punch-500/10 transition-colors disabled:opacity-50"
          >
            반려
          </button>
          <button
            onClick={() => decide("approve")}
            disabled={pending}
            className="rounded-lg bg-lime-glow text-ink-950 px-3 py-2 text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
          >
            공개
          </button>
        </div>
      </div>
      {result && <p className="text-xs text-ink-400 mt-2">{result}</p>}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* 썸네일 지정                                                          */
/* ------------------------------------------------------------------ */

export type ThumbGame = {
  id: string;
  title: string;
  slug: string;
  thumbnail_url: string | null;
  status: string;
};

export function ThumbnailManager({ games }: { games: ThumbGame[] }) {
  const [query, setQuery] = useState("");
  const filtered = query
    ? games.filter((g) => g.title.toLowerCase().includes(query.toLowerCase()))
    : games;

  return (
    <section className="mt-12">
      <h2 className="font-black text-lg mb-2">썸네일</h2>
      <p className="text-sm text-ink-400 mb-4">
        게임 카드에 쓰이는 이미지입니다. 비워두면 게임 이름으로 만든 그라디언트가 대신 나옵니다.
        가로세로 16:10 을 권장합니다.
      </p>

      {games.length > 6 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="게임 이름으로 찾기"
          className="w-full mb-4 rounded-xl bg-ink-900 border border-ink-700 px-3.5 py-2.5 text-sm outline-none focus:border-neon-400/60 transition-colors"
        />
      )}

      {filtered.length === 0 ? (
        <p className="panel px-5 py-8 text-center text-sm text-ink-400">게임이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((game) => (
            <ThumbnailRow key={game.id} game={game} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ThumbnailRow({ game }: { game: ThumbGame }) {
  const [url, setUrl] = useState(game.thumbnail_url ?? "");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = url.trim() !== (game.thumbnail_url ?? "");

  function save() {
    startTransition(async () => {
      const res = await setGameThumbnail(game.id, url);
      setResult({ ok: res.ok, text: res.ok ? res.message : res.error });
      if (res.ok) router.refresh();
    });
  }

  return (
    <li className="panel p-4 flex flex-wrap items-start gap-4">
      {/* 미리보기는 입력창의 현재 값을 그대로 씁니다 — 저장 전에 확인할 수 있게. */}
      <div className="w-32 shrink-0 aspect-[16/10] rounded-lg overflow-hidden bg-ink-850 border border-ink-800 grid place-items-center">
        {url.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url.trim()} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-2xl opacity-30">🕹️</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/games/${game.slug}`}
            target="_blank"
            className="font-bold hover:text-neon-400 transition-colors"
          >
            {game.title}
          </Link>
          {game.status !== "published" && <Badge tone="gold">{game.status}</Badge>}
        </div>

        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setResult(null);
          }}
          placeholder="https://… 또는 /games/…/thumb.png"
          className="w-full mt-2 rounded-xl bg-ink-900 border border-ink-700 px-3.5 py-2.5 text-sm outline-none focus:border-neon-400/60 transition-colors"
        />

        <div className="flex flex-wrap items-center gap-3 mt-2.5">
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="rounded-lg bg-ink-100 text-ink-950 px-4 py-2 text-sm font-semibold hover:bg-white transition-colors disabled:opacity-40"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
          {url.trim() && (
            <button
              type="button"
              onClick={() => {
                setUrl("");
                setResult(null);
              }}
              disabled={pending}
              className="text-sm text-ink-400 hover:text-ink-100 transition-colors disabled:opacity-40"
            >
              지우기
            </button>
          )}
          {result && (
            <span className={`text-sm ${result.ok ? "text-lime-glow" : "text-punch-400"}`}>
              {result.text}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* 생성 폼 묶음                                                         */
/* ------------------------------------------------------------------ */

type TabKey = "game" | "tournament" | "hackathon";

// 꺼 둔 기능은 개설 폼도 숨깁니다 — 만들어도 방문자에게 보이지 않습니다.
const TABS = [
  { key: "game", label: "게임 등록", on: true },
  { key: "tournament", label: "대회 개설", on: FEATURES.tournaments },
  { key: "hackathon", label: "해커톤 개설", on: FEATURES.hackathons },
].filter((t) => t.on) as { key: TabKey; label: string }[];

export function AdminForms({
  games,
  allGames = games,
  newFolders = [],
  store = "supabase",
}: {
  /** 공개된 게임 (대회를 열 수 있는 대상) */
  games: { id: string; title: string }[];
  /** 아직 공개 전인 것까지 포함한 게임 (파일을 교체할 수 있는 대상) */
  allGames?: { id: string; title: string }[];
  /** 웹 업로드가 가는 저장소 */
  store?: GameStore;
  /** public/g 에 들어 있지만 아직 게임으로 등록하지 않은 폴더 이름 */
  newFolders?: string[];
}) {
  const [tab, setTab] = useState<TabKey>("game");

  return (
    <section className="mt-14">
      {TABS.length > 1 ? (
        <div className="flex gap-1.5 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "bg-ink-100 text-ink-950"
                  : "border border-ink-700 text-ink-400 hover:text-ink-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        <h2 className="font-black text-lg mb-4">{TABS[0].label}</h2>
      )}

      {tab === "game" && <GameForm games={allGames} newFolders={newFolders} store={store} />}
      {tab === "tournament" && <TournamentForm games={games} />}
      {tab === "hackathon" && <HackathonForm />}
    </section>
  );
}

function useAction(action: (fd: FormData) => Promise<AdminResult>) {
  const [state, setState] = useState<AdminResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const res = await action(formData);
      setState(res);
      if (res.ok) {
        form.reset();
        router.refresh();
      }
    });
  }

  return { state, pending, onSubmit };
}

function GameForm({
  games,
  newFolders,
  store,
}: {
  games: { id: string; title: string }[];
  newFolders: string[];
  store: GameStore;
}) {
  const { state, pending, onSubmit } = useAction(createOfficialGame);
  // 폴더를 올리면 이 칸이 자동으로 채워집니다. 직접 적어도 됩니다.
  const [entryUrl, setEntryUrl] = useState("");

  // 등록이 끝나면 폼의 다른 칸처럼 이 칸도 비웁니다.
  useEffect(() => {
    if (state?.ok) setEntryUrl("");
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="panel p-6 space-y-4">
      <p className="text-sm text-ink-400">
        내가 만든 게임을 등록합니다. 파일이 여러 개인 게임(3D 모델 · 그림 포함)은 폴더를 올리고,
        단일 HTML 은 아래에 코드를 그대로 붙여넣어도 됩니다.
      </p>

      <GameUploader games={games} store={store} onUploaded={setEntryUrl} />

      {newFolders.length > 0 && (
        <div className="rounded-xl border border-lime-glow/40 bg-lime-glow/10 px-4 py-3 text-sm text-lime-glow">
          명령어로 넣은 게임 폴더 중 아직 등록하지 않은 것이 있습니다. 새 게임이면 게임 경로 칸에
          그대로 넣고, 이미 있는 게임의 새 위치라면 그 게임에 연결하세요.
          <ul className="mt-2 space-y-2">
            {newFolders.map((folder) => (
              <FolderLink key={folder} folder={folder} games={games} />
            ))}
          </ul>
        </div>
      )}
      {/* 게임 경로 칸의 자동완성 */}
      <datalist id="game-folders">
        {newFolders.map((folder) => (
          <option key={folder} value={`/g/${folder}/index.html`} />
        ))}
      </datalist>

      <Row>
        <Input name="title" label="게임 이름" required />
        <Input name="slug" label="주소 슬러그" placeholder="비우면 자동 생성" />
      </Row>
      <Input name="tagline" label="한 줄 소개" />
      <Textarea name="description" label="설명" rows={3} />
      <Row>
        <Input
          name="entry_url"
          label="게임 경로"
          placeholder="폴더를 올리면 자동으로 채워집니다"
          list="game-folders"
          value={entryUrl}
          onChange={(event) => setEntryUrl(event.target.value)}
        />
        <Input name="thumbnail_url" label="썸네일 URL" placeholder="비우면 자동 생성" />
      </Row>
      <Textarea
        name="html"
        label="또는 HTML 코드 직접 붙여넣기"
        rows={6}
        mono
        placeholder="경로를 적었다면 비워두세요"
      />
      <Row>
        <Select name="scoring" label="순위 기준">
          <option value="high">점수가 높을수록 좋음</option>
          <option value="low">기록이 낮을수록 좋음</option>
        </Select>
        <Input name="score_unit" label="점수 단위" defaultValue="점" />
      </Row>

      <Submit pending={pending} state={state} label="게임 등록" />
    </form>
  );
}

/**
 * 명령어로 넣은 폴더 하나 — 기존 게임에 연결할 수 있습니다.
 *
 * 웹으로 올렸던 게임을 저장소 폴더로 옮길 때, 게임을 새로 등록하면 랭킹 · 댓글이 이어지지
 * 않습니다. 여기서 연결하면 게임은 그대로 두고 파일이 있는 곳만 바뀝니다.
 */
function FolderLink({ folder, games }: { folder: string; games: { id: string; title: string }[] }) {
  const [gameId, setGameId] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function link() {
    const title = games.find((game) => game.id === gameId)?.title ?? "";
    if (!window.confirm(`「${title}」의 게임 파일을 /g/${folder}/ 로 바꿀까요? 바로 반영됩니다.`)) return;
    startTransition(async () => {
      const res = await linkGameFolder(gameId, folder);
      setResult({ ok: res.ok, text: res.ok ? `「${res.title}」에 연결했습니다.` : res.error });
      if (res.ok) router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-2">
      <code className="font-mono text-xs">/g/{folder}/index.html</code>
      {games.length > 0 && (
        <>
          <select
            value={gameId}
            onChange={(event) => setGameId(event.target.value)}
            aria-label={`${folder} 폴더를 연결할 게임`}
            className="rounded-lg border border-ink-700 bg-ink-900/60 px-2 py-1 text-xs text-ink-100"
          >
            <option value="">기존 게임에 연결…</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={link}
            disabled={!gameId || pending}
            className="rounded-lg border border-lime-glow/50 px-2.5 py-1 text-xs font-semibold hover:bg-lime-glow/10 transition-colors disabled:opacity-40"
          >
            {pending ? "연결 중…" : "연결"}
          </button>
        </>
      )}
      {result && (
        <span className={`text-xs ${result.ok ? "text-lime-glow" : "text-punch-400"}`}>
          {result.text}
        </span>
      )}
    </li>
  );
}

function TournamentForm({ games }: { games: { id: string; title: string }[] }) {
  const { state, pending, onSubmit } = useAction(createTournament);

  return (
    <form onSubmit={onSubmit} className="panel p-6 space-y-4">
      <p className="text-sm text-ink-400">
        제한 시간이 있는 랭킹전을 엽니다. 마감 시점의 순위가 최종 결과가 됩니다.
      </p>

      <Row>
        <Input name="title" label="대회 이름" required placeholder="예: 3월 반응속도 챔피언십" />
        <Input name="slug" label="주소 슬러그" placeholder="비우면 자동 생성" />
      </Row>

      <Select name="game_id" label="대상 게임" required>
        <option value="">게임을 선택하세요</option>
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            {g.title}
          </option>
        ))}
      </Select>

      <Textarea name="description" label="대회 설명" rows={3} />

      <Row>
        <Input name="starts_at" label="시작" type="datetime-local" required />
        <Input name="ends_at" label="마감" type="datetime-local" required />
      </Row>

      <Row>
        <Input
          name="max_attempts"
          label="1인 도전 횟수"
          type="number"
          min={1}
          placeholder="비우면 무제한"
        />
        <div />
      </Row>

      <Textarea
        name="prizes"
        label="상품"
        rows={3}
        placeholder={"1등: 치킨 기프티콘\n2등: 커피 기프티콘\n3등: 아이스크림"}
        hint="한 줄에 하나씩. '1등: 상품' 형식"
      />

      <Checkbox name="is_published" label="바로 공개하기" defaultChecked />
      <Submit pending={pending} state={state} label="대회 만들기" />
    </form>
  );
}

function HackathonForm() {
  const { state, pending, onSubmit } = useAction(createHackathon);

  return (
    <form onSubmit={onSubmit} className="panel p-6 space-y-4">
      <p className="text-sm text-ink-400">
        구독자들이 직접 만든 게임을 제출하는 이벤트를 엽니다. 제출된 게임은 검토 후 공개됩니다.
      </p>

      <Row>
        <Input name="title" label="해커톤 이름" required placeholder="예: 1회 바이버후드 해커톤" />
        <Input name="slug" label="주소 슬러그" placeholder="비우면 자동 생성" />
      </Row>

      <Input name="theme" label="주제" placeholder="예: 한 화면 안에서 끝나는 게임" />
      <Textarea name="description" label="설명" rows={3} />
      <Textarea
        name="rules"
        label="참가 규칙"
        rows={4}
        placeholder={"- HTML 파일 하나로 제출\n- 외부 라이브러리 없이\n- 첫 판이 30초 안에 끝날 것"}
      />

      <Row>
        <Input name="starts_at" label="접수 시작" type="datetime-local" required />
        <Input name="submit_ends_at" label="제출 마감" type="datetime-local" required />
      </Row>
      <Input name="vote_ends_at" label="투표 마감" type="datetime-local" />

      <Textarea
        name="prizes"
        label="상품"
        rows={3}
        placeholder={"1등: 10만원 상당 기프티콘\n2등: 5만원\n3등: 3만원"}
        hint="한 줄에 하나씩"
      />

      <Checkbox name="is_published" label="바로 공개하기" defaultChecked />
      <Submit pending={pending} state={state} label="해커톤 열기" />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* 제작 노트                                                            */
/* ------------------------------------------------------------------ */

export type AdminNote = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  cover_url: string | null;
  video_url: string | null;
  game_id: string | null;
  is_published: boolean;
  /** 서버에서 미리 만든 날짜 글자 (공개일, 없으면 작성일) */
  dateLabel: string;
};

export function NotesManager({
  notes,
  games,
  ready,
}: {
  notes: AdminNote[];
  games: { id: string; title: string }[];
  /** notes 테이블이 있는지 — 없으면 supabase/notes.sql 안내를 띄웁니다. */
  ready: boolean;
}) {
  // null: 목록, "new": 새 글, 그 외: 고치는 중인 노트
  const [editing, setEditing] = useState<AdminNote | "new" | null>(null);

  return (
    <section className="mt-14">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="font-black text-lg">제작 노트</h2>
        {editing === null && ready && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="rounded-lg bg-ink-100 text-ink-950 px-4 py-2 text-sm font-semibold hover:bg-white transition-colors"
          >
            새 노트 쓰기
          </button>
        )}
      </div>
      <p className="text-sm text-ink-400 mb-4">
        게임을 어떻게 만들었는지 남기는 글입니다. 비공개로 저장해 두면 운영자만 볼 수 있어서,
        실제 화면에서 확인한 뒤 공개할 수 있습니다.
      </p>

      {!ready ? (
        <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          노트를 저장할 테이블이 아직 없습니다. Supabase SQL Editor 에서{" "}
          <code className="font-mono">supabase/notes.sql</code> 을 한 번 실행하면 여기서 글을 쓸 수
          있습니다.
        </p>
      ) : editing !== null ? (
        <NoteForm
          key={editing === "new" ? "new" : editing.id}
          note={editing === "new" ? null : editing}
          games={games}
          onClose={() => setEditing(null)}
        />
      ) : notes.length === 0 ? (
        <p className="panel px-5 py-8 text-center text-sm text-ink-400">아직 쓴 노트가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} onEdit={() => setEditing(note)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteRow({ note, onEdit }: { note: AdminNote; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function remove() {
    if (!window.confirm(`"${note.title}" 노트를 지울까요? 되돌릴 수 없습니다.`)) return;
    startTransition(async () => {
      const res = await deleteNote(note.id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <li className="panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/notes/${note.slug}`}
              target="_blank"
              className="font-bold hover:text-neon-400 transition-colors"
            >
              {note.title}
            </Link>
            {note.is_published ? <Badge tone="lime">공개</Badge> : <Badge tone="gold">비공개</Badge>}
          </div>
          <p className="text-xs text-ink-600 mt-1.5">{note.dateLabel}</p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            disabled={pending}
            className="rounded-lg border border-ink-700 px-3 py-2 text-xs font-semibold hover:border-neon-400/50 transition-colors disabled:opacity-50"
          >
            수정
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-lg border border-punch-500/40 text-punch-400 px-3 py-2 text-xs font-semibold hover:bg-punch-500/10 transition-colors disabled:opacity-50"
          >
            {pending ? "지우는 중…" : "삭제"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-punch-400 mt-2">{error}</p>}
    </li>
  );
}

function NoteForm({
  note,
  games,
  onClose,
}: {
  note: AdminNote | null;
  games: { id: string; title: string }[];
  onClose: () => void;
}) {
  const [state, setState] = useState<AdminResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveNote(formData);
      setState(res);
      if (res.ok) {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="panel p-6 space-y-4">
      {note && <input type="hidden" name="id" value={note.id} />}

      <Row>
        <Input name="title" label="제목" required defaultValue={note?.title ?? ""} />
        <Input
          name="slug"
          label="주소 슬러그"
          defaultValue={note?.slug ?? ""}
          placeholder="비우면 제목으로 자동 생성"
        />
      </Row>
      <Textarea
        name="summary"
        label="요약"
        rows={2}
        defaultValue={note?.summary ?? ""}
        hint="목록 카드와 검색 결과에 나오는 한두 줄 (300자까지)"
      />
      <Row>
        <Input
          name="video_url"
          label="쇼츠 · 유튜브 주소"
          defaultValue={note?.video_url ?? ""}
          placeholder="https://www.youtube.com/shorts/…"
        />
        <Input
          name="cover_url"
          label="표지 이미지 URL"
          defaultValue={note?.cover_url ?? ""}
          placeholder="비우면 영상 썸네일"
        />
      </Row>
      <Select name="game_id" label="연결할 게임" defaultValue={note?.game_id ?? ""}>
        <option value="">연결 안 함</option>
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            {g.title}
          </option>
        ))}
      </Select>
      <Textarea
        name="body"
        label="본문"
        rows={18}
        mono
        defaultValue={note?.body ?? ""}
        placeholder={"## 어떻게 시작했나\n\n처음 떠올린 아이디어는…\n\n- 막혔던 점\n- 해결한 방법"}
        hint="문단은 빈 줄로 나눕니다. ## 소제목 · - 목록 · **굵게** · [글자](주소) · ``` 코드 ``` 를 쓸 수 있고, 유튜브 주소나 이미지 주소만 한 줄에 적으면 플레이어와 그림으로 들어갑니다."
      />

      <Checkbox name="is_published" label="공개하기" defaultChecked={note?.is_published ?? false} />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-ink-100 text-ink-950 px-5 py-2.5 text-sm font-bold hover:bg-white transition-colors disabled:opacity-50"
        >
          {pending ? "저장 중…" : note ? "수정 저장" : "노트 저장"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="text-sm text-ink-400 hover:text-ink-100 transition-colors disabled:opacity-40"
        >
          취소
        </button>
        {state && !state.ok && <span className="text-sm text-punch-400">{state.error}</span>}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* 폼 프리미티브                                                        */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-2.5 text-sm placeholder:text-ink-600 focus:border-neon-400/60 focus:outline-none";

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-4">{children}</div>;
}

function Label({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold block mb-1.5">
        {label}
        {required && <span className="text-punch-400 ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-ink-600 mt-1">{hint}</span>}
    </label>
  );
}

function Input({
  name,
  label,
  required,
  ...rest
}: { name: string; label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Label label={label} required={required}>
      <input name={name} required={required} className={inputClass} {...rest} />
    </Label>
  );
}

function Textarea({
  name,
  label,
  rows = 3,
  mono,
  hint,
  ...rest
}: {
  name: string;
  label: string;
  rows?: number;
  mono?: boolean;
  hint?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Label label={label} hint={hint}>
      <textarea
        name={name}
        rows={rows}
        spellCheck={false}
        className={`${inputClass} ${mono ? "font-mono text-xs" : ""}`}
        {...rest}
      />
    </Label>
  );
}

function Select({
  name,
  label,
  required,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <Label label={label} required={required}>
      <select name={name} required={required} defaultValue={defaultValue} className={inputClass}>
        {children}
      </select>
    </Label>
  );
}

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 rounded border-ink-700 bg-ink-900 accent-neon-500"
      />
      {label}
    </label>
  );
}

function Submit({
  pending,
  state,
  label,
}: {
  pending: boolean;
  state: AdminResult | null;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-ink-100 text-ink-950 px-5 py-2.5 text-sm font-bold hover:bg-white transition-colors disabled:opacity-50"
      >
        {pending ? "처리 중…" : label}
      </button>
      {state && (
        <span className={`text-sm ${state.ok ? "text-lime-glow" : "text-punch-400"}`}>
          {state.ok ? state.message : state.error}
        </span>
      )}
    </div>
  );
}
