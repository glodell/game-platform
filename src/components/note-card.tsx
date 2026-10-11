import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { Note } from "@/lib/types";
import { parseYouTube, youTubeThumbnail } from "@/lib/youtube";

export function NoteCard({ note }: { note: Note }) {
  // 표지를 따로 정하지 않았으면 연결한 영상의 썸네일을 씁니다.
  const video = parseYouTube(note.video_url);
  const cover = note.cover_url ?? (video ? youTubeThumbnail(video) : null);

  return (
    <Link
      href={`/notes/${note.slug}`}
      className="group panel overflow-hidden flex flex-col hover:border-neon-400/50 transition-colors"
    >
      <div className="relative aspect-video bg-ink-850 overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="size-full grid place-items-center bg-gradient-to-br from-ink-800 to-ink-900">
            <span className="text-4xl opacity-30">📝</span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold leading-tight group-hover:text-neon-400 transition-colors">
          {note.title}
        </h3>
        {note.summary && (
          <p className="text-sm text-ink-400 mt-1.5 line-clamp-2 flex-1">{note.summary}</p>
        )}
        <p className="text-xs text-ink-600 mt-3.5 pt-3.5 border-t border-ink-800">
          {formatDate(note.published_at ?? note.created_at)}
        </p>
      </div>
    </Link>
  );
}
