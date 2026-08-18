import Link from "next/link";
import type { Phase } from "@/lib/types";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "neon" | "punch" | "lime" | "gold";
}) {
  const tones = {
    neutral: "border-ink-700 bg-ink-800/60 text-ink-300",
    neon: "border-neon-400/40 bg-neon-400/10 text-neon-400",
    punch: "border-punch-500/40 bg-punch-500/10 text-punch-400",
    lime: "border-lime-glow/40 bg-lime-glow/10 text-lime-glow",
    gold: "border-gold/40 bg-gold/10 text-gold",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PhaseBadge({ phase }: { phase: Phase }) {
  if (phase === "live") {
    return (
      <Badge tone="punch">
        <span className="live-dot size-1.5 rounded-full bg-punch-400" />
        진행 중
      </Badge>
    );
  }
  if (phase === "upcoming") return <Badge tone="neon">시작 예정</Badge>;
  return <Badge>종료</Badge>;
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight">{title}</h2>
        {description && <p className="text-sm text-ink-400 mt-1">{description}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="text-sm text-ink-300 hover:text-neon-400 whitespace-nowrap transition-colors"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="panel px-6 py-14 text-center">
      <p className="font-bold text-ink-100">{title}</p>
      {description && <p className="text-sm text-ink-400 mt-2 max-w-md mx-auto">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="inline-block mt-6 rounded-lg bg-ink-100 text-ink-950 px-5 py-2.5 text-sm font-semibold hover:bg-white transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function RankMedal({ rank }: { rank: number }) {
  const style =
    rank === 1
      ? "bg-gold/15 text-gold border-gold/40"
      : rank === 2
        ? "bg-silver/15 text-silver border-silver/40"
        : rank === 3
          ? "bg-bronze/15 text-bronze border-bronze/40"
          : "bg-ink-800 text-ink-400 border-ink-700";
  return (
    <span
      className={`grid place-items-center size-8 shrink-0 rounded-lg border text-sm font-black tabular-nums ${style}`}
    >
      {rank}
    </span>
  );
}
