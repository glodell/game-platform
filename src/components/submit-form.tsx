"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { submitGame } from "@/app/actions/submit-game";
import { FLAG_LABELS, evaluateRun, parseTrace, type RunTrace } from "@/lib/run-trace";
import { GAME_SANDBOX, wrapUserGame } from "@/lib/sandbox";

const STARTER = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>내 게임</title></head>
<body style="display:grid;place-items:center;height:100vh;font-family:system-ui">
  <button id="btn" style="font-size:20px;padding:16px 24px">눌러서 시작</button>
  <script>
    let score = 0, timer = null;
    Arcade.ready(function () {
      btn.onclick = function () {
        Arcade.start();                 // 판 시작
        score = 0;
        btn.textContent = "빨리 눌러!";
        clearTimeout(timer);
        timer = setTimeout(function () {
          Arcade.gameOver(score);       // 판 종료 → 점수 제출
          btn.textContent = "다시 하기 (" + score + "점)";
        }, 5000);
        btn.onclick = function () {
          score++;
          Arcade.progress(score);       // 진행 점수 표시 (선택)
        };
      };
    });
  </script>
</body>
</html>`;

type PreviewRun = {
  score: number;
  durationMs: number;
  progressCalls: number;
  trace: RunTrace | null;
  /** START 를 받은 시각 — 서버가 토큰을 발급하는 시점에 해당합니다. */
  startedAt: number;
};

type CheckState = {
  ready: boolean;
  start: boolean;
  progressed: boolean;
  run: PreviewRun | null;
};

const EMPTY_CHECK: CheckState = { ready: false, start: false, progressed: false, run: null };

type Props = {
  hackathons: { slug: string; title: string }[];
  defaultHackathon: string;
  siteUrl: string;
};

export function SubmitForm({ hackathons, defaultHackathon, siteUrl }: Props) {
  const [html, setHtml] = useState("");
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [previewRound, setPreviewRound] = useState(0);
  const [check, setCheck] = useState<CheckState>(EMPTY_CHECK);
  const [scoringLow, setScoringLow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const startedAtRef = useRef(0);
  const progressRef = useRef(0);
  const router = useRouter();

  /**
   * 미리보기도 실제 플랫폼과 똑같이 게임과 대화합니다.
   *
   * CONFIG 를 돌려주는 게 핵심입니다 — Arcade.ready(콜백) 은 CONFIG 가 와야 콜백을 부릅니다.
   * 예전 미리보기는 이걸 안 보내서, 문서에 적힌 대로 ready() 안에서 시작하는 게임은
   * (바로 아래 예제 코드까지 포함해서) 미리보기에서 버튼조차 안 눌렸습니다.
   *
   * 겸사겸사 오가는 신호를 세어 두면, 제출 전에 SDK 를 제대로 불렀는지 그대로 보여줄 수 있습니다.
   */
  useEffect(() => {
    if (!previewDoc) return;

    function reply(type: string, payload: unknown) {
      previewRef.current?.contentWindow?.postMessage({ source: "arcade-host", type, payload }, "*");
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== previewRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "arcade-game") return;

      switch (data.type) {
        case "READY":
          reply("CONFIG", {
            player: { name: "미리보기", isGuest: true },
            tournament: null,
            canSubmit: false,
          });
          setCheck((c) => (c.ready ? c : { ...c, ready: true }));
          break;

        case "START":
        case "RESTART":
          startedAtRef.current = Date.now();
          progressRef.current = 0;
          setCheck((c) => ({ ...c, start: true, progressed: false, run: null }));
          break;

        case "PROGRESS":
          // 60fps 게임은 초당 60번 옵니다. 세는 건 ref 로 하고 화면은 처음 한 번만 바꿉니다.
          progressRef.current += 1;
          setCheck((c) => (c.progressed ? c : { ...c, progressed: true }));
          break;

        case "GAME_OVER": {
          const durationMs = Number(data.payload?.durationMs) || 0;
          setCheck((c) => ({
            ...c,
            run: {
              score: Number(data.payload?.score) || 0,
              durationMs,
              progressCalls: progressRef.current,
              trace: parseTrace(data.payload?.trace),
              startedAt: startedAtRef.current || Date.now() - durationMs,
            },
          }));
          // 실제 플랫폼처럼 결과를 돌려줘야 onResult() 를 쓴 게임이 멈추지 않습니다.
          reply("SUBMIT_RESULT", { ok: false, reason: "preview" });
          break;
        }
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewDoc, previewRound]);

  function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) {
      setError("파일이 400KB를 넘습니다.");
      return;
    }
    file.text().then((text) => {
      setHtml(text);
      setError(null);
    });
  }

  function preview() {
    if (!html.trim()) {
      setError("먼저 코드를 넣어주세요.");
      return;
    }
    setError(null);
    setCheck(EMPTY_CHECK);
    progressRef.current = 0;
    startedAtRef.current = 0;
    // 같은 코드로 다시 눌러도 iframe 을 새로 띄워 처음부터 점검합니다.
    setPreviewRound((n) => n + 1);
    setPreviewDoc(wrapUserGame(html, siteUrl));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("html", html);
    setError(null);

    startTransition(async () => {
      const result = await submitGame(formData);
      if (result.ok) {
        setDone(result.slug);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <div className="panel p-8 mt-8 text-center">
        <p className="text-2xl mb-3">🎉</p>
        <h2 className="font-black text-xl">제출 완료!</h2>
        <p className="text-sm text-ink-400 mt-2 max-w-md mx-auto">
          운영자 검토가 끝나면 플랫폼에 공개됩니다. 아래 내 제출 목록에서 상태를 확인할 수 있습니다.
        </p>
        <button
          onClick={() => {
            setDone(null);
            setHtml("");
            setPreviewDoc(null);
            setCheck(EMPTY_CHECK);
          }}
          className="mt-6 rounded-lg border border-ink-700 px-5 py-2.5 text-sm font-semibold hover:border-neon-400/50 hover:text-neon-400 transition-colors"
        >
          하나 더 제출하기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 mt-8">
      <Field label="게임 이름" required>
        <input
          name="title"
          required
          maxLength={60}
          placeholder="예: 3초 반응속도 테스트"
          className={inputClass}
        />
      </Field>

      <Field label="한 줄 소개" hint="게임 카드에 표시됩니다">
        <input
          name="tagline"
          maxLength={80}
          placeholder="예: 화면이 초록으로 바뀌는 순간 누르세요"
          className={inputClass}
        />
      </Field>

      <Field label="설명" hint="조작법, 규칙, 만든 계기 등">
        <textarea name="description" rows={3} className={inputClass} />
      </Field>

      <Field label="썸네일 주소" hint="선택 — 비우면 게임 이름으로 만든 그라디언트가 들어갑니다">
        <input
          name="thumbnail_url"
          type="url"
          maxLength={2000}
          placeholder="https://…"
          className={inputClass}
        />
      </Field>

      {hackathons.length > 0 && (
        <Field label="해커톤 참가" hint="접수 중인 해커톤이 있으면 선택하세요">
          <select name="hackathon" defaultValue={defaultHackathon} className={inputClass}>
            <option value="">참가 안 함 (일반 게임으로 제출)</option>
            {hackathons.map((h) => (
              <option key={h.slug} value={h.slug}>
                {h.title}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="순위 기준">
          <select
            name="scoring"
            value={scoringLow ? "low" : "high"}
            onChange={(e) => setScoringLow(e.target.value === "low")}
            className={inputClass}
          >
            <option value="high">점수가 높을수록 좋음</option>
            <option value="low">기록이 낮을수록 좋음 (타임어택)</option>
          </select>
        </Field>
        <Field label="점수 단위">
          <input name="score_unit" defaultValue="점" maxLength={8} className={inputClass} />
        </Field>
      </div>

      <Field
        label="게임 코드 (HTML 한 파일)"
        required
        hint="Arcade.gameOver(점수) 를 호출하면 랭킹에 반영됩니다"
      >
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold hover:border-neon-400/50 transition-colors"
          >
            .html 파일 불러오기
          </button>
          <button
            type="button"
            onClick={() => setHtml(STARTER)}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold hover:border-lime-glow/50 transition-colors"
          >
            예제 코드 넣기
          </button>
          <button
            type="button"
            onClick={preview}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold hover:border-neon-400/50 transition-colors"
          >
            미리보기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".html,text/html"
            onChange={loadFile}
            className="hidden"
          />
        </div>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={14}
          spellCheck={false}
          placeholder="<!doctype html> ..."
          className={`${inputClass} font-mono text-xs leading-relaxed`}
        />
        <p className="text-xs text-ink-600 mt-1.5 tabular-nums">
          {new Blob([html]).size.toLocaleString("ko-KR")} / 400,000 바이트
        </p>
      </Field>

      {previewDoc && (
        <div>
          <p className="text-sm font-semibold mb-2">미리보기</p>
          <iframe
            key={previewRound}
            ref={previewRef}
            title="미리보기"
            srcDoc={previewDoc}
            sandbox={GAME_SANDBOX}
            className="w-full aspect-video rounded-xl border border-ink-700 bg-black"
          />
          <p className="text-xs text-ink-600 mt-2">
            실제 플랫폼과 동일한 샌드박스에서 실행됩니다. 외부 네트워크 요청은 차단되니 필요한 자원은
            코드 안에 포함해 주세요.
          </p>
          <PreviewCheck check={check} scoringLow={scoringLow} siteUrl={siteUrl} />
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-punch-500/40 bg-punch-500/10 px-4 py-3 text-sm text-punch-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-lime-glow text-ink-950 px-6 py-3.5 font-bold hover:brightness-110 transition-all disabled:opacity-50"
      >
        {pending ? "제출하는 중…" : "제출하기"}
      </button>
    </form>
  );
}

/**
 * 미리보기 한 판에서 오간 신호를 그대로 보여줍니다.
 *
 * 여기서 잡아야 하는 제일 흔한 실수는 Arcade.start() 를 빼먹는 것입니다. 그대로 공개되면
 * 그 게임의 모든 기록에 "시작 없이 끝났다" 표시가 붙어 검토 큐가 오탐으로 가득 찹니다.
 * 판이 한 번 끝나기 전까지는 아무것도 지적하지 않습니다 — 아직 안 부른 것과 안 부르는 것은
 * 다르니까요.
 */
function PreviewCheck({
  check,
  scoringLow,
  siteUrl,
}: {
  check: CheckState;
  scoringLow: boolean;
  siteUrl: string;
}) {
  const run = check.run;

  // 크롬은 샌드박스 iframe(오퍼크 오리진)에서 나가는 로컬 주소 요청을 막습니다. 그래서 개발
  // 서버에서는 게임이 SDK 를 아예 못 받아오고, 점검이 영원히 "대기"에서 멈춥니다.
  const localOnly =
    siteUrl.startsWith("http://localhost") || siteUrl.startsWith("http://127.0.0.1");

  const rows = [
    {
      label: "Arcade.ready()",
      ok: check.ready,
      required: true,
      note: null as string | null,
      help: "SDK 를 못 불러왔거나 ready() 를 부르지 않았습니다. 이러면 게임이 플레이어 이름·대회 정보를 받지 못합니다.",
    },
    {
      label: "Arcade.start()",
      ok: check.start,
      required: true,
      note: null,
      help: "판이 시작될 때 불러야 합니다. 빠뜨리면 이 게임의 모든 기록에 표시가 붙어 운영자 검토 큐로 갑니다.",
    },
    {
      label: "Arcade.progress(점수)",
      ok: check.progressed,
      required: false,
      note: run && run.progressCalls > 0 ? `${run.progressCalls.toLocaleString("ko-KR")}회` : null,
      help: "선택입니다. 부르면 화면 위에 실시간 점수가 뜨고, 점수 곡선이 남아 기록 검증이 정확해집니다.",
    },
    {
      label: "Arcade.gameOver(점수)",
      ok: Boolean(run),
      required: true,
      note: run ? `${run.score.toLocaleString("ko-KR")} · ${(run.durationMs / 1000).toFixed(1)}초` : null,
      help: "이걸 불러야 점수가 랭킹에 올라갑니다. 미리보기에서 한 판을 끝까지 해보세요.",
    },
  ];

  // 서버가 쓰는 것과 같은 함수입니다 — 제출하면 붙을 표시가 그대로 나옵니다.
  const flags = run
    ? evaluateRun({
        trace: run.trace,
        score: run.score,
        reportedDurationMs: run.durationMs,
        tokenIssuedAt: run.startedAt,
        scoringLow,
      })
    : [];

  return (
    <div className="mt-3 rounded-xl border border-ink-700 bg-ink-900/60 p-4">
      <p className="text-sm font-semibold">SDK 점검</p>
      <p className="text-xs text-ink-600 mt-1 leading-relaxed">
        위 미리보기에서 한 판을 끝까지 해보세요. 플랫폼이 실제로 받는 신호를 그대로 보여줍니다.
      </p>
      {localOnly && !check.ready && (
        <p className="text-xs text-gold mt-2 leading-relaxed">
          지금은 로컬 서버라 브라우저가 샌드박스 iframe 의 로컬 주소 요청을 막습니다 — 게임이 SDK 를
          받아오지 못해 점검이 진행되지 않습니다. 배포된 사이트에서 확인해 주세요.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {rows.map((r) => {
          const missing = !r.ok && Boolean(run);
          const tone = r.ok
            ? "text-lime-glow"
            : missing
              ? r.required
                ? "text-punch-400"
                : "text-gold"
              : "text-ink-600";
          return (
            <li key={r.label} className="flex items-start gap-2.5 text-sm">
              <span className={`mt-0.5 shrink-0 ${tone}`}>{r.ok ? "✓" : missing ? "⚑" : "·"}</span>
              <div className="min-w-0">
                <code className={r.ok ? "text-ink-200" : "text-ink-400"}>{r.label}</code>
                {r.note && <span className="text-ink-400"> — {r.note}</span>}
                {!r.required && !r.ok && <span className="text-ink-600"> — 선택</span>}
                {missing && <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">{r.help}</p>}
              </div>
            </li>
          );
        })}
      </ul>

      {run && (
        <div className="mt-3 border-t border-ink-800 pt-3 space-y-1.5 text-sm">
          <p className="text-ink-400">
            조작 누름 {run.trace?.inputs ?? 0}회 · 움직임 {run.trace?.moves ?? 0}회
            {run.trace && run.trace.samples.length > 0 && ` · 점수 곡선 표본 ${run.trace.samples.length}개`}
          </p>
          {flags.length === 0 ? (
            <p className="text-lime-glow">이대로면 검증 표시 없이 랭킹에 올라갑니다.</p>
          ) : (
            <>
              <p className="text-gold">이대로 제출하면 이런 표시가 붙어 검토 큐로 갑니다.</p>
              <ul className="space-y-1">
                {flags.map((flag) => (
                  <li key={flag} className="flex items-start gap-2 text-ink-300">
                    <span className="text-gold shrink-0">⚑</span>
                    <span>{FLAG_LABELS[flag]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3 text-sm placeholder:text-ink-600 focus:border-neon-400/60 focus:outline-none";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">
        {label}
        {required && <span className="text-punch-400 ml-1">*</span>}
      </span>
      {hint && <span className="block text-xs text-ink-600 mt-0.5 mb-2">{hint}</span>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </label>
  );
}
