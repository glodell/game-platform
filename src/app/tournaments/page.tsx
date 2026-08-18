import type { Metadata } from "next";
import { TournamentCard } from "@/components/tournament-card";
import { EmptyState, SectionHeader } from "@/components/ui";
import { listTournaments } from "@/lib/queries";

export const metadata: Metadata = { title: "대회" };

export default async function TournamentsPage() {
  const [live, upcoming, ended] = await Promise.all([
    listTournaments("live"),
    listTournaments("upcoming"),
    listTournaments("ended"),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">대회</h1>
      <p className="text-ink-400 mt-2">
        제한 시간 안에 최고 기록을 남기세요. 마감 시점의 1·2·3등에게 상품이 갑니다.
      </p>

      <section className="mt-10">
        <SectionHeader title="진행 중" />
        {live.length === 0 ? (
          <EmptyState
            title="지금 열려 있는 대회가 없습니다"
            description="다음 쇼츠에서 새 대회가 열립니다. 예정된 대회를 확인해 보세요."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="mt-12">
          <SectionHeader title="시작 예정" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </section>
      )}

      {ended.length > 0 && (
        <section className="mt-12">
          <SectionHeader title="지난 대회" description="최종 순위와 수상자를 확인할 수 있습니다." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ended.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
