"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatScore } from "@/lib/format";
import { GAME_SANDBOX } from "@/lib/sandbox";

type Viewer = { id: string; display_name: string } | null;

type Props = {
  gameId: string;
  title: string;
  scoreUnit: string | null;
  /** source='url' 이면 entryUrl, source='html' 이면 srcDoc 이 채워집니다. */
  entryUrl?: string | null;
  srcDoc?: string | null;
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
  viewer,
  tournament,
  attemptsLeft,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef<string | null>(null);
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
    async (score: number, durationMs: number, meta: Record<string, unknown>) => {
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
          body: JSON.stringify({ token, score, durationMs, meta }),
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

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden border border-ink-700 bg-black aspect-[4/3] sm:aspect-video">
        <iframe
          ref={frameRef}
          title={title}
          className="absolute inset-0 size-full"
          sandbox={GAME_SANDBOX}
          allow="autoplay; gamepad"
          {...(srcDoc ? { srcDoc } : { src: entryUrl ?? "about:blank" })}
        />

        {live && liveScore !== null && (
          <div className="absolute top-3 left-3 rounded-lg bg-ink-950/80 border border-ink-700 px-3 py-1.5 text-sm font-bold tabular-nums backdrop-blur">
            {formatScore(liveScore, scoreUnit)}
          </div>
        )}
      </div>

      <StatusBar
        state={submit}
        scoreUnit={scoreUnit}
        viewer={viewer}
        attemptsLeft={attemptsLeft}
        inTournament={Boolean(tournament)}
      />
    </div>
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
