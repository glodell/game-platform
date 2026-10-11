import type { MetadataRoute } from "next";
import { isSupabaseConfigured } from "@/lib/env";
import { listGames, listNotes } from "@/lib/queries";
import { siteUrl } from "@/lib/sandbox";
import { FOOTER_LINKS } from "@/lib/site";

/**
 * /sitemap.xml — 검색 엔진에 알려줄 주소 목록.
 *
 * 방문자에게 실제로 열려 있는 것만 넣습니다. listGames 가 꺼 둔 기능(구독자 제작 게임 등)을
 * 이미 걸러주므로, 기능을 다시 켜면 여기도 따라서 늘어납니다. 프로필(/u/…)은 내용이 얇아
 * 넣지 않습니다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [games, notes] = isSupabaseConfigured()
    ? await Promise.all([listGames({ limit: 1000 }), listNotes(1000)])
    : [[], []];

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/games`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/notes`, changeFrequency: "weekly", priority: 0.8 },
    // 슬러그에 한글이 들어갈 수 있어 주소로 쓸 수 있게 인코딩합니다.
    ...games.map((game) => ({
      url: `${base}/games/${encodeURIComponent(game.slug)}`,
      lastModified: game.published_at ?? game.created_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...notes.map((note) => ({
      url: `${base}/notes/${encodeURIComponent(note.slug)}`,
      lastModified: note.updated_at,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...FOOTER_LINKS.map((item) => ({
      url: `${base}${item.href}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
