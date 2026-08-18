import Link from "next/link";
import { Countdown } from "./countdown";
import { PhaseBadge } from "./ui";
import { phaseOf, type Prize, type Tournament } from "@/lib/types";

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  const phase = phaseOf(tournament.starts_at, tournament.ends_at);
  const prizes = (tournament.prizes as Prize[]) ?? [];

  return (
    <Link
      href={`/tournaments/${tournament.slug}`}
      className="panel p-5 flex flex-col gap-4 hover:border-neon-400/50 transition-colors"
    >
      <div>
        <PhaseBadge phase={phase} />
        <h3 className="text-lg font-black mt-2.5 leading-tight">{tournament.title}</h3>
        {tournament.game && <p className="text-sm text-ink-400 mt-1">🕹️ {tournament.game.title}</p>}
      </div>

      <Countdown
        target={phase === "upcoming" ? tournament.starts_at : tournament.ends_at}
        label={phase === "upcoming" ? "시작까지" : phase === "live" ? "마감까지" : "종료됨"}
      />

      {prizes.length > 0 && (
        <ul className="text-sm text-ink-300 space-y-1 border-t border-ink-800 pt-3">
          {prizes.slice(0, 3).map((p) => (
            <li key={p.rank} className="flex gap-2">
              <span className="text-gold font-bold w-8 shrink-0">{p.rank}등</span>
              <span className="truncate">{p.reward}</span>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
