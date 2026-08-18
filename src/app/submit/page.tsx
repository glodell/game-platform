import Link from "next/link";
import type { Metadata } from "next";
import { SubmitForm } from "@/components/submit-form";
import { Badge } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { getViewer, listHackathons, listMySubmissions } from "@/lib/queries";
import { siteUrl } from "@/lib/sandbox";

export const metadata: Metadata = { title: "게임 제출" };

const STATUS_LABEL: Record<string, { text: string; tone: "neutral" | "gold" | "lime" | "punch" }> = {
  draft: { text: "임시저장", tone: "neutral" },
  pending: { text: "검토 대기", tone: "gold" },
  published: { text: "공개됨", tone: "lime" },
  rejected: { text: "반려됨", tone: "punch" },
  hidden: { text: "숨김", tone: "neutral" },
};

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ hackathon?: string }>;
}) {
  const { hackathon } = await searchParams;
  const viewer = await getViewer();
  const [hackathons, mine] = await Promise.all([
    listHackathons(),
    viewer ? listMySubmissions(viewer.id) : Promise.resolve([]),
  ]);

  const openHackathons = hackathons.filter(
    (h) =>
      Date.now() >= new Date(h.starts_at).getTime() &&
      Date.now() <= new Date(h.submit_ends_at).getTime(),
  );

  if (!viewer) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <h1 className="text-2xl font-black mb-3">로그인이 필요합니다</h1>
        <p className="text-ink-400 text-sm">
          게임을 제출하려면 먼저 로그인해 주세요. 오른쪽 위 로그인 버튼을 눌러주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">게임 제출</h1>
      <p className="text-ink-400 mt-2">
        HTML 파일 하나면 됩니다. 제출하면 운영자 검토 후 플랫폼에 공개됩니다.{" "}
        <Link href="/docs/sdk" className="text-neon-400 hover:underline">
          만드는 법 보기 →
        </Link>
      </p>

      <SubmitForm
        hackathons={openHackathons.map((h) => ({ slug: h.slug, title: h.title }))}
        defaultHackathon={hackathon ?? ""}
        siteUrl={siteUrl()}
      />

      {mine.length > 0 && (
        <section className="mt-16">
          <h2 className="font-black text-lg mb-4">내가 제출한 게임</h2>
          <ul className="space-y-2">
            {mine.map((game) => {
              const status = STATUS_LABEL[game.status] ?? STATUS_LABEL.draft;
              return (
                <li
                  key={game.id}
                  className="panel px-4 py-3 flex items-center gap-3 flex-wrap"
                >
                  <Link
                    href={`/games/${game.slug}`}
                    className="font-semibold hover:text-neon-400 transition-colors"
                  >
                    {game.title}
                  </Link>
                  <Badge tone={status.tone}>{status.text}</Badge>
                  <span className="text-xs text-ink-600 ml-auto">
                    {formatRelative(game.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
