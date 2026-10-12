"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatScore } from "@/lib/format";
import {
  GAME_ALLOW,
  GAME_ALLOW_TRUSTED,
  GAME_SANDBOX,
  GAME_SANDBOX_ISOLATED,
} from "@/lib/sandbox";

type Viewer = { id: string; display_name: string } | null;

type Props = {
  gameId: string;
  title: string;
  scoreUnit: string | null;
  /** source='url' 이면 entryUrl, source='html' 이면 srcDoc 이 채워집니다. */
  entryUrl?: string | null;
  srcDoc?: string | null;
  /** 게임 전용 주소에서 내려주는 폴더 게임 — 자기 오리진을 줍니다 (resolveGameEntry 가 정함). */
  isolated?: boolean;
  viewer: Viewer;
  tournament?: { id: string; title: string; endsAt: string } | null;
  attemptsLeft?: number | null;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; score: number; rank: number | null }
  | { kind: "error"; message: string };

export function GameFrame({
  gameId,
  title,
  scoreUnit,
  entryUrl,
  srcDoc,
  isolated = false,
  viewer,
  tournament,
  attemptsLeft,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [live, setLive] = useState(false);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const [fetchingToken, setFetchingToken] = useState(false);

  const canSubmit = Boolean(viewer) && (attemptsLeft === null || attemptsLeft === undefined || attemptsLeft > 0);

  /** 플레이 시작 직전에 서버에서 1회용 서명 토큰을 받아둡니다. */
  const primeToken = useCallback(async () => {
    if (!canSubmit || tokenRef.current || fetchingToken) return;
    setFetchingToken(true);
    try {
      const res = await fetch("/api/runs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, tournamentId: tournament?.id ?? null }),
      });
      const json = await res.json();
      if (res.ok) tokenRef.current = json.token;
      else setSubmit({ kind: "error", message: json.error ?? "플레이 세션을 열지 못했습니다." });
    } catch {
      setSubmit({ kind: "error", message: "네트워크 오류로 플레이 세션을 열지 못했습니다." });
    } finally {
      setFetchingToken(false);
    }
  }, [canSubmit, fetchingToken, gameId, tournament?.id]);

  const sendConfig = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      {
        source: "arcade-host",
        type: "CONFIG",
        payload: {
          player: {
            name: viewer?.display_name ?? "게스트",
            isGuest: !viewer,
          },
          tournament: tournament
            ? { id: tournament.id, title: tournament.title, endsAt: tournament.endsAt }
            : null,
          canSubmit,
        },
      },
      "*",
    );
  }, [canSubmit, tournament, viewer]);

  const postResult = useCallback((payload: unknown) => {
    frameRef.current?.contentWindow?.postMessage(
      { source: "arcade-host", type: "SUBMIT_RESULT", payload },
      "*",
    );
  }, []);

  const submitScore = useCallback(
    async (
      score: number,
      durationMs: number,
      meta: Record<string, unknown>,
      trace: unknown,
    ) => {
      setLiveScore(score);

      if (!viewer) {
        setSubmit({ kind: "error", message: "로그인하면 이 점수가 랭킹에 올라갑니다." });
        postResult({ ok: false, reason: "guest" });
        return;
      }

      const token = tokenRef.current;
      if (!token) {
        setSubmit({ kind: "error", message: "플레이 세션이 없어 기록을 남기지 못했습니다. 다시 시작해 주세요." });
        postResult({ ok: false, reason: "no_token" });
        return;
      }

      setSubmit({ kind: "sending" });
      tokenRef.current = null; // 1회용

      try {
        const res = await fetch("/api/runs/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, score, durationMs, meta, trace }),
        });
        const json = await res.json();
        if (res.ok) {
          setSubmit({ kind: "done", score, rank: json.rank ?? null });
          postResult({ ok: true, rank: json.rank ?? null, best: json.best });
        } else {
          setSubmit({ kind: "error", message: json.error ?? "기록 저장에 실패했습니다." });
          postResult({ ok: false, reason: json.error });
        }
      } catch {
        setSubmit({ kind: "error", message: "네트워크 오류로 기록을 남기지 못했습니다." });
        postResult({ ok: false, reason: "network" });
      }
    },
    [postResult, viewer],
  );

  /**
   * 전체화면.
   *
   * 브라우저 Fullscreen API 를 먼저 시도하되, 성공 여부와 무관하게 우리 오버레이도 켭니다.
   * iOS사파리는 div 에 대한 requestFullscreen 을 지원하지 않아서, API 만 믿으면
   * 아이폰에서는 전체화면이 아예 안 됩니다. 반대로 오버레이만 쓰면 안드로이드에서
   * 주소창이 남습니다. 둘을 겹쳐야 어디서나 같은 경험이 됩니다.
   *
   * 그래서 나가는 길도 두 개입니다 — X 버튼과 Esc. 네이티브 전체화면에서 브라우저가
   * 알아서 빠져나간 경우(사용자가 Esc 를 눌렀을 때)는 fullscreenchange 로 맞춰줍니다.
   */
  const enterImmersive = useCallback(() => {
    setImmersive(true);
    wrapRef.current?.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {
      // 지원하지 않는 브라우저 — 오버레이만으로 동작합니다.
    });
  }, []);

  const exitImmersive = useCallback(() => {
    setImmersive(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      // 네이티브 전체화면에서 빠져나왔으면 오버레이도 같이 끕니다.
      if (!document.fullscreenElement) setImmersive(false);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!immersive) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") exitImmersive();
    }
    // 네이티브 전체화면이 아닐 때는 브라우저가 Esc 를 처리해주지 않습니다.
    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [exitImmersive, immersive]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "arcade-game") return;

      switch (data.type) {
        case "READY":
          sendConfig();
          void primeToken();
          break;
        case "START":
          setLive(true);
          setSubmit({ kind: "idle" });
          setLiveScore(null);
          void primeToken();
          break;
        case "PROGRESS":
          setLiveScore(Number(data.payload?.score) || 0);
          break;
        case "RESTART":
          setSubmit({ kind: "idle" });
          setLiveScore(null);
          void primeToken();
          break;
        case "GAME_OVER":
          setLive(false);
          void submitScore(
            Number(data.payload?.score) || 0,
            Number(data.payload?.durationMs) || 0,
            (data.payload?.meta as Record<string, unknown>) ?? {},
            data.payload?.trace,
          );
          break;
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [primeToken, sendConfig, submitScore]);

  // 플레이 수 집계 (한 페이지 방문당 1회)
  //
  // 예전에는 브라우저가 Supabase RPC 를 직접 불렀는데, 그러면 누구나 반복 호출로
  // 카운트를 부풀릴 수 있어서 서버 라우트를 거치도록 바꿨습니다.
  // 집계 실패는 플레이에 영향이 없으므로 조용히 넘어갑니다.
  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/games/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId }),
      signal: controller.signal,
    }).catch(() => {});

    return () => controller.abort();
  }, [gameId]);

  const statusBar = (
    <StatusBar
      state={submit}
      scoreUnit={scoreUnit}
      viewer={viewer}
      attemptsLeft={attemptsLeft}
      inTournament={Boolean(tournament)}
    />
  );

  return (
    <div
      ref={wrapRef}
      // 전체화면에서는 브라우저의 확대 동작(두 번 누르기 · 두 손가락 벌리기)을 끕니다. 빠르게
      // 연타하는 게임에서 브라우저가 그걸 확대로 받아들이면 화면 전체가 커졌다 돌아오며 덜컥거립니다.
      // 스크롤(pan)은 남겨 둡니다 — 게임 안에 밀어서 보는 화면이 있을 수 있습니다.
      className={
        immersive ? "fixed inset-0 z-[60] bg-black select-none touch-pan-x touch-pan-y" : "space-y-3"
      }
    >
      <div
        className={
          immersive
            ? "absolute inset-0"
            : // 페이지 안에 놓였을 때는 두 번 누르기 확대만 끕니다 (페이지 자체의 확대는 그대로).
              "relative rounded-2xl overflow-hidden border border-ink-700 bg-black aspect-[4/3] sm:aspect-video touch-manipulation"
        }
      >
        <iframe
          ref={frameRef}
          title={title}
          className="absolute inset-0 size-full"
          // 붙여넣은 HTML(srcdoc)은 이 페이지의 오리진을 물려받으므로 절대 자기 오리진을 주지 않습니다.
          sandbox={isolated && !srcDoc ? GAME_SANDBOX_ISOLATED : GAME_SANDBOX}
          allow={srcDoc ? GAME_ALLOW : GAME_ALLOW_TRUSTED}
          {...(srcDoc ? { srcDoc } : { src: entryUrl ?? "about:blank" })}
        />

        {/*
          게임 위에 겹쳐 놓는 것들은 누를 수 없게 합니다(pointer-events-none). 그대로 두면 그 자리를
          누른 손가락이 게임에 닿지 않아 조작이 씹히고, 이 페이지가 대신 받아 확대 동작으로 처리합니다.
          닫기 버튼만 예외입니다.
        */}
        {live && liveScore !== null && (
          <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-lg bg-ink-950/80 border border-ink-700 px-3 py-1.5 text-sm font-bold tabular-nums backdrop-blur">
            {formatScore(liveScore, scoreUnit)}
          </div>
        )}

        <button
          type="button"
          onClick={immersive ? exitImmersive : enterImmersive}
          aria-label={immersive ? "전체화면 나가기" : "전체화면으로 보기"}
          title={immersive ? "전체화면 나가기 (Esc)" : "전체화면"}
          className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-lg bg-ink-950/80 border border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-600 backdrop-blur transition-colors touch-manipulation"
        >
          {immersive ? <CloseIcon /> : <ExpandIcon />}
        </button>

        {/*
          전체화면의 안내 막대는 판이 진행 중일 때는 숨깁니다. 폰에서는 화면 아래를 거의 다 덮는데,
          거기가 엄지가 가장 자주 닿는 자리입니다. 시작 전 안내와 끝난 뒤 결과만 보여주면 됩니다.
        */}
        {immersive && !live && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
            <div className="mx-auto max-w-2xl">{statusBar}</div>
          </div>
        )}
      </div>

      {!immersive && statusBar}
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function StatusBar({
  state,
  scoreUnit,
  viewer,
  attemptsLeft,
  inTournament,
}: {
  state: SubmitState;
  scoreUnit: string | null;
  viewer: Viewer;
  attemptsLeft?: number | null;
  inTournament: boolean;
}) {
  if (state.kind === "sending") {
    return <Bar tone="neutral">기록을 저장하는 중…</Bar>;
  }

  if (state.kind === "done") {
    return (
      <Bar tone="good">
        <span className="font-bold">{formatScore(state.score, scoreUnit)}</span> 기록 완료
        {state.rank ? (
          <>
            {" "}— 현재 <span className="font-bold text-neon-400">{state.rank}위</span>
          </>
        ) : null}
      </Bar>
    );
  }

  if (state.kind === "error") {
    return <Bar tone="bad">{state.message}</Bar>;
  }

  if (!viewer) {
    return <Bar tone="neutral">지금은 연습 모드입니다. 로그인하면 점수가 랭킹에 올라갑니다.</Bar>;
  }

  if (inTournament && typeof attemptsLeft === "number") {
    return (
      <Bar tone={attemptsLeft > 0 ? "neutral" : "bad"}>
        {attemptsLeft > 0
          ? `남은 도전 ${attemptsLeft}회 — 최고 기록만 랭킹에 반영됩니다.`
          : "도전 횟수를 모두 사용했습니다. 기록은 저장되지 않습니다."}
      </Bar>
    );
  }

  return <Bar tone="neutral">한 판이 끝나면 점수가 자동으로 랭킹에 올라갑니다.</Bar>;
}

function Bar({ tone, children }: { tone: "neutral" | "good" | "bad"; children: React.ReactNode }) {
  const toneClass =
    tone === "good"
      ? "border-lime-glow/40 bg-lime-glow/10 text-lime-glow"
      : tone === "bad"
        ? "border-punch-500/40 bg-punch-500/10 text-punch-400"
        : "border-ink-700 bg-ink-900/60 text-ink-300";
  return (
    <div className={`rounded-xl border px-4 py-2.5 text-sm ${toneClass}`}>{children}</div>
  );
}
