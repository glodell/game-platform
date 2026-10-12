import Link from "next/link";
import { formatCompact } from "@/lib/format";
import { FEATURES } from "@/lib/site";
import type { Game } from "@/lib/types";
import { Badge } from "./ui";

export function GameCard({
  game,
  eventLive = false,
}: {
  game: Game;
  /** 이 게임에 랭킹 이벤트가 열려 있는지 */
  eventLive?: boolean;
}) {
  return (
    <Link
      href={`/games/${game.slug}`}
      className="group panel overflow-hidden flex flex-col hover:border-neon-400/50 transition-colors"
    >
      <div className="relative aspect-[16/10] bg-ink-850 overflow-hidden">
        {game.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.thumbnail_url}
            alt=""
            className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <PlaceholderArt seed={game.slug} />
        )}
        {/* 구독자 제작 게임이 없을 때는 전부 공식이라 구분 표시가 의미 없습니다. */}
        {FEATURES.community && (
          <div className="absolute top-2.5 left-2.5">
            {game.kind === "official" ? (
              <Badge tone="neon">공식</Badge>
            ) : (
              <Badge tone="lime">구독자 제작</Badge>
            )}
          </div>
        )}
        {eventLive && (
          <div className="absolute top-2.5 right-2.5">
            {/* 썸네일 위에서도 읽히도록 배지 뒤를 어둡게 받칩니다. */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-punch-500/50 bg-ink-950/85 px-2.5 py-0.5 text-xs font-semibold text-punch-400 backdrop-blur">
              <span className="live-dot size-1.5 rounded-full bg-punch-400" />
              랭킹 이벤트
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold leading-tight group-hover:text-neon-400 transition-colors">
          {game.title}
        </h3>
        {game.tagline && (
          <p className="text-sm text-ink-400 mt-1.5 line-clamp-2 flex-1">{game.tagline}</p>
        )}

        <div className="flex items-center gap-3 mt-3.5 pt-3.5 border-t border-ink-800 text-xs text-ink-400">
          {game.author && <span className="truncate max-w-28">@{game.author.handle}</span>}
          <span className="ml-auto flex items-center gap-1">♥ {formatCompact(game.like_count)}</span>
          <span className="flex items-center gap-1">💬 {formatCompact(game.comment_count)}</span>
          <span className="flex items-center gap-1">▶ {formatCompact(game.play_count)}</span>
        </div>
      </div>
    </Link>
  );
}

/** 썸네일이 없을 때 슬러그에서 결정적으로 생성하는 그라디언트 */
function PlaceholderArt({ seed }: { seed: string }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  const a = hash;
  const b = (hash + 80) % 360;
  return (
    <div
      className="size-full grid place-items-center"
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${a} 70% 22%), hsl(${b} 75% 14%))`,
      }}
    >
      <span className="text-4xl opacity-30">🕹️</span>
    </div>
  );
}
