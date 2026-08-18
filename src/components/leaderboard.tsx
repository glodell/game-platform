import Link from "next/link";
import { formatRelative, formatScore } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";
import { Avatar } from "./account-menu";
import { RankMedal } from "./ui";

export function Leaderboard({
  rows,
  scoreUnit,
  viewerId,
  emptyText = "아직 기록이 없습니다. 첫 번째 기록의 주인공이 되어보세요.",
}: {
  rows: LeaderboardRow[];
  scoreUnit: string | null;
  viewerId?: string | null;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-400 py-8 text-center">{emptyText}</p>;
  }

  return (
    <ol className="divide-y divide-ink-800">
      {rows.map((row) => {
        const isViewer = viewerId === row.user_id;
        return (
          <li
            key={row.user_id}
            className={`flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg ${
              isViewer ? "bg-neon-400/8 ring-1 ring-neon-400/25" : ""
            }`}
          >
            <RankMedal rank={row.rank} />
            <Avatar url={row.avatar_url} name={row.display_name} size={30} />
            <div className="min-w-0 flex-1">
              <Link
                href={`/u/${row.handle}`}
                className="block truncate text-sm font-semibold hover:text-neon-400 transition-colors"
              >
                {row.display_name}
                {isViewer && <span className="text-neon-400 ml-1.5 text-xs">나</span>}
              </Link>
              <p className="text-xs text-ink-400">{formatRelative(row.created_at)}</p>
            </div>
            <span className="tabular-nums font-black text-sm shrink-0">
              {formatScore(row.score, scoreUnit)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** 1·2·3등 시상대 */
export function Podium({
  rows,
  scoreUnit,
  prizes,
}: {
  rows: LeaderboardRow[];
  scoreUnit: string | null;
  prizes?: { rank: number; reward: string }[];
}) {
  const top = [rows.find((r) => r.rank === 1), rows.find((r) => r.rank === 2), rows.find((r) => r.rank === 3)];
  const order = [1, 0, 2]; // 2등 - 1등 - 3등 배치
  const heights = ["h-20", "h-28", "h-16"];
  const tones = [
    "from-silver/25 border-silver/40",
    "from-gold/25 border-gold/40",
    "from-bronze/25 border-bronze/40",
  ];

  if (!top[0]) {
    return (
      <p className="text-sm text-ink-400 py-8 text-center">
        아직 순위가 없습니다. 대회가 시작되면 여기에 1·2·3등이 표시됩니다.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 items-end">
      {order.map((idx) => {
        const row = top[idx];
        const rank = idx + 1;
        const prize = prizes?.find((p) => p.rank === rank);
        return (
          <div key={rank} className="text-center">
            {row ? (
              <>
                <Avatar url={row.avatar_url} name={row.display_name} size={48} />
                <p className="text-sm font-bold truncate mt-2">{row.display_name}</p>
                <p className="text-xs tabular-nums text-ink-300">
                  {formatScore(row.score, scoreUnit)}
                </p>
              </>
            ) : (
              <>
                <div className="size-12 mx-auto rounded-full border border-dashed border-ink-700" />
                <p className="text-sm text-ink-600 mt-2">—</p>
              </>
            )}
            <div
              className={`mt-2 rounded-t-xl border-t border-x bg-gradient-to-t to-transparent grid place-items-center ${heights[idx]} ${tones[idx]}`}
            >
              <span className="text-2xl font-black">{rank}</span>
            </div>
            {prize && <p className="text-[11px] text-ink-400 mt-1.5 leading-tight">{prize.reward}</p>}
          </div>
        );
      })}
    </div>
  );
}
