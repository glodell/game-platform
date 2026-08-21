"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreRun, voidRun } from "@/app/actions/admin";
import { formatRelative, formatScore } from "@/lib/format";
import { FLAG_LABELS, type RunFlag, type RunTrace } from "@/lib/run-trace";
import { Badge } from "./ui";

export type ReviewRun = {
  id: string;
  score: number;
  durationMs: number | null;
  createdAt: string;
  flags: string[];
  voidedAt: string | null;
  voidedReason: string | null;
  trace: RunTrace | null;
  gameTitle: string;
  gameSlug: string;
  scoreUnit: string | null;
  tournamentTitle: string | null;
  playerHandle: string;
  playerName: string;
};

export function RunReview({ runs }: { runs: ReviewRun[] }) {
  const [showClean, setShowClean] = useState(false);
  const flagged = runs.filter((r) => r.flags.length > 0 || r.voidedAt);
  const visible = showClean ? runs : flagged;

  return (
    <section className="mt-12">
      <h2 className="font-black text-lg mb-2">
        기록 검토{" "}
        {flagged.filter((r) => !r.voidedAt).length > 0 && (
          <span className="text-gold tabular-nums">
            {flagged.filter((r) => !r.voidedAt).length}
          </span>
        )}
      </h2>
      <p className="text-sm text-ink-400 mb-4">
        판마다 남는 검증 데이터로 앞뒤가 안 맞는 기록에 서버가 표시를 답니다. 표시는 &ldquo;확실한
        부정&rdquo;이 아니라 &ldquo;사람이 한 번 볼 만하다&rdquo;는 뜻입니다. 무효 처리하면 기록은
        남고 랭킹에서만 빠집니다.
      </p>

      <label className="flex items-center gap-2 text-sm text-ink-400 mb-4 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={showClean}
          onChange={(e) => setShowClean(e.target.checked)}
          className="size-4 accent-neon-500"
        />
        표시 없는 기록도 보기
      </label>

      {visible.length === 0 ? (
        <p className="panel px-5 py-8 text-center text-sm text-ink-400">
          {runs.length === 0
            ? "아직 기록이 없습니다."
            : "표시된 기록이 없습니다. 최근 기록은 모두 정상으로 보입니다."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RunRow({ run }: { run: ReviewRun }) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function act(fn: () => Promise<{ ok: boolean } & ({ message: string } | { error: string })>) {
    startTransition(async () => {
      const res = await fn();
      setResult({ ok: res.ok, text: "message" in res ? res.message : res.error });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <li className={`panel p-4 ${run.voidedAt ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <span className="font-bold tabular-nums">{formatScore(run.score, run.scoreUnit)}</span>
        <Link
          href={`/games/${run.gameSlug}`}
          target="_blank"
          className="text-sm text-ink-300 hover:text-neon-400 transition-colors"
        >
          {run.gameTitle}
        </Link>
        {run.tournamentTitle && <Badge tone="punch">{run.tournamentTitle}</Badge>}
        {run.voidedAt && <Badge tone="neutral">무효</Badge>}
        <span className="text-sm text-ink-400 ml-auto">
          @{run.playerHandle} · {formatRelative(run.createdAt)}
        </span>
      </div>

      {run.flags.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {run.flags.map((flag) => (
            <li key={flag} className="flex items-start gap-2 text-sm">
              <span className="text-gold mt-0.5 shrink-0">⚑</span>
              <span className="text-ink-300">
                {FLAG_LABELS[flag as RunFlag] ?? flag}
              </span>
            </li>
          ))}
        </ul>
      )}

      <TraceDetail run={run} />

      {run.voidedAt ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-400">사유: {run.voidedReason}</p>
          <button
            type="button"
            onClick={() => act(() => restoreRun(run.id))}
            disabled={pending}
            className="text-sm text-ink-400 hover:text-ink-100 transition-colors disabled:opacity-40"
          >
            되돌리기
          </button>
          {result && (
            <span className={`text-sm ${result.ok ? "text-lime-glow" : "text-punch-400"}`}>
              {result.text}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-3">
          {open ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="무효 사유 (본인에게 보이지는 않지만 기록에 남습니다)"
                maxLength={300}
                className="flex-1 min-w-56 rounded-xl bg-ink-900 border border-ink-700 px-3.5 py-2 text-sm outline-none focus:border-neon-400/60 transition-colors"
              />
              <button
                type="button"
                onClick={() => act(() => voidRun(run.id, reason))}
                disabled={pending || !reason.trim()}
                className="rounded-lg bg-punch-500 text-white px-4 py-2 text-sm font-semibold hover:bg-punch-400 transition-colors disabled:opacity-40"
              >
                {pending ? "처리 중…" : "무효 처리"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-ink-400 hover:text-ink-100 transition-colors"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-sm text-punch-400 hover:text-punch-500 transition-colors"
            >
              이 기록 무효 처리
            </button>
          )}
          {result && !result.ok && (
            <span className="block mt-2 text-sm text-punch-400">{result.text}</span>
          )}
        </div>
      )}
    </li>
  );
}

/** 판이 어떻게 흘러갔는지 — 숫자 몇 개와 점수 곡선. */
function TraceDetail({ run }: { run: ReviewRun }) {
  const t = run.trace;
  if (!t) {
    return (
      <p className="mt-3 text-sm text-ink-600">
        검증 데이터가 없습니다 (SDK 를 거치지 않았거나 예전 기록).
      </p>
    );
  }

  const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}초`;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-400">
      <span>입력 {t.inputs}회</span>
      <span>
        플레이 {seconds(t.perfMs)}
        {Math.abs(t.perfMs - t.wallMs) > 500 && (
          <span className="text-gold"> (시계 기준 {seconds(t.wallMs)})</span>
        )}
      </span>
      {t.firstInputMs !== null && <span>첫 입력 {seconds(t.firstInputMs)}</span>}
      {t.hiddenMs > 0 && <span>백그라운드 {seconds(t.hiddenMs)}</span>}
      {t.samples.length >= 2 && <ScoreCurve samples={t.samples} />}
    </div>
  );
}

/** 점수가 계단처럼 올랐는지 절벽처럼 튀었는지만 보면 되므로 아주 작게 그립니다. */
function ScoreCurve({ samples }: { samples: [number, number][] }) {
  const maxT = Math.max(...samples.map((s) => s[0]), 1);
  const maxV = Math.max(...samples.map((s) => s[1]), 1);
  const points = samples
    .map(([t, v]) => `${(t / maxT) * 100},${28 - (v / maxV) * 26}`)
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className="h-7 w-28 shrink-0"
      role="img"
      aria-label="점수 곡선"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        className="text-neon-400"
      />
    </svg>
  );
}
