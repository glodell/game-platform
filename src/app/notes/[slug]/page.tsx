import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NoteBody, YouTubeEmbed } from "@/components/note-body";
import { formatDate } from "@/lib/format";
import { getNoteBySlug } from "@/lib/queries";
import { FEATURES } from "@/lib/site";
import { parseYouTube, youTubeThumbnail } from "@/lib/youtube";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const note = await getNoteBySlug(slug);
  if (!note) return { title: "노트를 찾을 수 없음" };

  const video = parseYouTube(note.video_url);
  const image = note.cover_url ?? (video ? youTubeThumbnail(video) : null);

  return {
    title: note.title,
    description: note.summary ?? undefined,
    openGraph: {
      type: "article",
      title: note.title,
      description: note.summary ?? undefined,
      publishedTime: note.published_at ?? undefined,
      modifiedTime: note.updated_at,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function NotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // 비공개 노트는 RLS 가 운영자에게만 돌려주므로, 여기서 따로 권한을 보지 않습니다.
  const note = await getNoteBySlug(slug);
  if (!note) notFound();

  const video = parseYouTube(note.video_url);
  // 지금 방문자에게 열려 있는 게임일 때만 바로가기를 붙입니다.
  const game =
    note.game?.status === "published" && (FEATURES.community || note.game.kind === "official")
      ? note.game
      : null;

  return (
    <article className="mx-auto max-w-3xl px-5 py-10">
      {!note.is_published && (
        <div className="mb-6 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          아직 공개하지 않은 노트입니다. 운영자에게만 보입니다.
        </div>
      )}

      <Link href="/notes" className="text-sm text-ink-400 hover:text-neon-400 transition-colors">
        ← 제작 노트
      </Link>

      <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mt-4">
        {note.title}
      </h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-400 mt-3">
        <time dateTime={note.published_at ?? note.created_at}>
          {formatDate(note.published_at ?? note.created_at)}
        </time>
        {game && (
          <Link href={`/games/${game.slug}`} className="hover:text-neon-400 transition-colors">
            🕹️ {game.title}
          </Link>
        )}
      </div>
      {note.summary && (
        <p className="text-lg text-ink-300 leading-relaxed mt-5">{note.summary}</p>
      )}

      {video ? (
        <YouTubeEmbed video={video} title={note.title} />
      ) : (
        note.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={note.cover_url}
            alt=""
            className="w-full rounded-2xl border border-ink-700 my-6"
          />
        )
      )}

      <NoteBody body={note.body ?? ""} />

      {game && (
        <Link
          href={`/games/${game.slug}`}
          className="panel glow-ring mt-12 flex flex-wrap items-center gap-4 p-5 sm:p-6 hover:border-neon-400/60 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-neon-400 tracking-widest">이 노트의 게임</p>
            <p className="text-xl font-black tracking-tight mt-1">{game.title}</p>
            {game.tagline && <p className="text-sm text-ink-400 mt-1">{game.tagline}</p>}
          </div>
          <span className="rounded-xl bg-ink-100 text-ink-950 px-5 py-2.5 text-sm font-bold shrink-0">
            직접 해보기 →
          </span>
        </Link>
      )}
    </article>
  );
}
