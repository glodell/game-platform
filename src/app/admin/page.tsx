import Link from "next/link";
import type { Metadata } from "next";
import { AdminForms, ReviewRow, ThumbnailManager } from "@/components/admin-panels";
import { formatRelative } from "@/lib/format";
import { getViewer } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/types";

export const metadata: Metadata = { title: "운영자 콘솔" };

export default async function AdminPage() {
  const viewer = await getViewer();
  const isStaff = viewer?.role === "owner" || viewer?.role === "moderator";

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <h1 className="text-2xl font-black mb-3">운영자 전용 페이지입니다</h1>
        <p className="text-ink-400 text-sm leading-relaxed">
          {viewer
            ? "로그인은 되어 있지만 운영자 권한이 없습니다. Supabase SQL Editor 에서 아래를 실행하면 권한이 생깁니다."
            : "먼저 로그인해 주세요."}
        </p>
        {viewer && (
          <pre className="mt-5 text-left text-xs bg-ink-900 border border-ink-700 rounded-xl p-4 overflow-x-auto">
            {`update profiles set role = 'owner'\nwhere handle = '${viewer.handle}';`}
          </pre>
        )}
        <Link href="/" className="inline-block mt-6 text-sm text-neon-400 hover:underline">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: pending }, { data: games }] = await Promise.all([
    supabase
      .from("games")
      .select(
        "id, slug, title, tagline, status, created_at, hackathon_id, author:profiles!games_author_id_fkey(handle, display_name, avatar_url)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    // 썸네일은 공개 전 제출작에도 미리 달아둘 수 있어야 해서 반려 건만 뺍니다.
    supabase
      .from("games")
      .select("id, title, slug, thumbnail_url, status")
      .in("status", ["published", "pending", "draft"])
      .order("title"),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl font-black tracking-tight">운영자 콘솔</h1>
      <p className="text-ink-400 mt-2">
        게임 등록, 대회 개설, 해커톤 개설, 제출작 심사를 여기서 합니다.
      </p>

      <section className="mt-10">
        <h2 className="font-black text-lg mb-4">
          검토 대기{" "}
          {pending && pending.length > 0 && (
            <span className="text-gold tabular-nums">{pending.length}</span>
          )}
        </h2>
        {!pending || pending.length === 0 ? (
          <p className="panel px-5 py-8 text-center text-sm text-ink-400">
            대기 중인 제출작이 없습니다.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((game) => (
              <ReviewRow
                key={game.id}
                game={{
                  id: game.id,
                  slug: game.slug,
                  title: game.title,
                  tagline: game.tagline,
                  authorHandle:
                    (game as unknown as Game).author?.handle ?? "알 수 없음",
                  createdAt: formatRelative(game.created_at),
                  isHackathonEntry: Boolean(game.hackathon_id),
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <AdminForms games={(games ?? []).filter((g) => g.status === "published")} />

      <ThumbnailManager games={games ?? []} />
    </div>
  );
}
