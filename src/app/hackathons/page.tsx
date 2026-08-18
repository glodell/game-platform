import Link from "next/link";
import type { Metadata } from "next";
import { Countdown } from "@/components/countdown";
import { EmptyState, PhaseBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { listHackathons } from "@/lib/queries";
import { phaseOf, type Prize } from "@/lib/types";

export const metadata: Metadata = { title: "해커톤" };

export default async function HackathonsPage() {
  const hackathons = await listHackathons();

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">해커톤</h1>
      <p className="text-ink-400 mt-2 max-w-2xl">
        주제를 하나 던지면, 구독자들이 직접 만든 게임을 올립니다. 마감 후에는 좋아요와 댓글로
        서로의 작품을 평가합니다.
      </p>

      {hackathons.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="아직 열린 해커톤이 없습니다"
            description="운영자 콘솔에서 첫 해커톤을 열어보세요. 주제와 마감일만 정하면 됩니다."
            action={{ href: "/admin", label: "운영자 콘솔 열기" }}
          />
        </div>
      ) : (
        <ul className="space-y-4 mt-10">
          {hackathons.map((h) => {
            const phase = phaseOf(h.starts_at, h.submit_ends_at);
            const prizes = (h.prizes as Prize[]) ?? [];
            return (
              <li key={h.id}>
                <Link
                  href={`/hackathons/${h.slug}`}
                  className="panel block p-6 hover:border-lime-glow/50 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <PhaseBadge phase={phase} />
                    <span className="text-xs text-ink-400">
                      제출 마감 {formatDateTime(h.submit_ends_at)}
                    </span>
                  </div>
                  <h2 className="text-xl font-black mt-2.5">{h.title}</h2>
                  {h.theme && <p className="text-ink-300 mt-1">주제 · {h.theme}</p>}
                  {h.description && (
                    <p className="text-sm text-ink-400 mt-2 line-clamp-2">{h.description}</p>
                  )}

                  <div className="flex flex-wrap items-end justify-between gap-4 mt-5">
                    {phase !== "ended" && <Countdown target={h.submit_ends_at} compact />}
                    {prizes.length > 0 && (
                      <p className="text-sm text-gold">
                        {prizes.map((p) => `${p.rank}등 ${p.reward}`).join(" · ")}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
