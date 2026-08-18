import Link from "next/link";
import { notFound } from "next/navigation";
import { GameFrame } from "@/components/game-frame";
import { getGameBySlug, getViewer } from "@/lib/queries";
import { siteUrl, wrapUserGame } from "@/lib/sandbox";

export default async function FullscreenPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ slug }, { t }] = await Promise.all([params, searchParams]);
  const game = await getGameBySlug(slug);
  if (!game || game.status !== "published") notFound();

  const viewer = await getViewer();
  const srcDoc = game.source === "html" && game.html ? wrapUserGame(game.html, siteUrl()) : null;

  return (
    <div className="mx-auto max-w-4xl px-5 py-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <Link
          href={`/games/${game.slug}`}
          className="text-sm text-ink-400 hover:text-ink-100 transition-colors"
        >
          ← {game.title}
        </Link>
        {t && <span className="text-xs text-punch-400 font-semibold">대회 모드</span>}
      </div>

      <GameFrame
        gameId={game.id}
        title={game.title}
        scoreUnit={game.score_unit}
        entryUrl={game.entry_url}
        srcDoc={srcDoc}
        viewer={viewer ? { id: viewer.id, display_name: viewer.display_name } : null}
      />
    </div>
  );
}
