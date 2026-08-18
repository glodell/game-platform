"use client";

import { useState, useTransition } from "react";
import { toggleLike } from "@/app/actions/social";
import { formatCompact } from "@/lib/format";

export function LikeButton({
  gameId,
  slug,
  initialLiked,
  initialCount,
  canLike,
}: {
  gameId: string;
  slug: string;
  initialLiked: boolean;
  initialCount: number;
  canLike: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!canLike) {
      setError("로그인하면 좋아요를 남길 수 있습니다.");
      return;
    }
    // 낙관적 업데이트 후 실패하면 되돌립니다.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));
    setError(null);

    startTransition(async () => {
      const result = await toggleLike(gameId, slug);
      if (!result.ok) {
        setLiked(!nextLiked);
        setCount((c) => c + (nextLiked ? -1 : 1));
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={onClick}
        disabled={pending}
        aria-pressed={liked}
        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
          liked
            ? "border-punch-500/50 bg-punch-500/15 text-punch-400"
            : "border-ink-700 bg-ink-900/60 text-ink-300 hover:border-punch-500/40 hover:text-punch-400"
        } disabled:opacity-60`}
      >
        <span className="text-base leading-none">{liked ? "♥" : "♡"}</span>
        <span className="tabular-nums">{formatCompact(count)}</span>
      </button>
      {error && <p className="text-xs text-punch-400">{error}</p>}
    </div>
  );
}
