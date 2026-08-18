"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addComment, deleteComment } from "@/app/actions/social";
import { formatRelative } from "@/lib/format";
import type { Comment } from "@/lib/types";
import { Avatar } from "./account-menu";

type Props = {
  gameId: string;
  slug: string;
  comments: Comment[];
  viewer: { id: string; isStaff: boolean } | null;
};

export function Comments({ gameId, slug, comments, viewer }: Props) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!viewer) {
      setError("로그인이 필요합니다.");
      return;
    }
    const text = body;
    startTransition(async () => {
      const result = await addComment(gameId, slug, text, replyTo);
      if (result.ok) {
        setBody("");
        setReplyTo(null);
        setError(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteComment(id, slug);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="space-y-2">
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-ink-400">
            답글 작성 중
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-punch-400 hover:underline"
            >
              취소
            </button>
          </div>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={
            viewer
              ? "플레이 소감이나 개선 아이디어를 남겨주세요. 만든 사람에게 큰 도움이 됩니다."
              : "로그인하면 댓글을 남길 수 있습니다."
          }
          disabled={!viewer || pending}
          className="w-full rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3 text-sm placeholder:text-ink-600 focus:border-neon-400/60 focus:outline-none resize-y disabled:opacity-60"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!viewer || pending || !body.trim()}
            className="rounded-lg bg-ink-100 text-ink-950 px-4 py-2 text-sm font-semibold hover:bg-white transition-colors disabled:opacity-40"
          >
            {pending ? "등록 중…" : "등록"}
          </button>
          <span className="text-xs text-ink-600 tabular-nums">{body.length}/2000</span>
          {error && <span className="text-xs text-punch-400">{error}</span>}
        </div>
      </form>

      {roots.length === 0 ? (
        <p className="text-sm text-ink-400 py-6 text-center">
          아직 댓글이 없습니다. 첫 피드백을 남겨보세요.
        </p>
      ) : (
        <ul className="space-y-5">
          {roots.map((c) => (
            <li key={c.id}>
              <CommentRow
                comment={c}
                viewer={viewer}
                onReply={() => setReplyTo(c.id)}
                onDelete={() => remove(c.id)}
                pending={pending}
              />
              {repliesOf(c.id).length > 0 && (
                <ul className="mt-4 ml-6 sm:ml-11 space-y-4 border-l border-ink-800 pl-4">
                  {repliesOf(c.id).map((r) => (
                    <li key={r.id}>
                      <CommentRow
                        comment={r}
                        viewer={viewer}
                        onDelete={() => remove(r.id)}
                        pending={pending}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  viewer,
  onReply,
  onDelete,
  pending,
}: {
  comment: Comment;
  viewer: { id: string; isStaff: boolean } | null;
  onReply?: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const canDelete = viewer && (viewer.id === comment.user_id || viewer.isStaff);
  const author = comment.author;

  return (
    <div className="flex gap-3">
      <Avatar url={author?.avatar_url ?? null} name={author?.display_name ?? "?"} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/u/${author?.handle ?? ""}`}
            className="text-sm font-semibold hover:text-neon-400 transition-colors"
          >
            {author?.display_name ?? "알 수 없음"}
          </Link>
          <span className="text-xs text-ink-600">{formatRelative(comment.created_at)}</span>
        </div>
        <p className="text-sm text-ink-300 mt-1 whitespace-pre-wrap break-words">{comment.body}</p>
        <div className="flex gap-3 mt-1.5 text-xs text-ink-600">
          {onReply && viewer && (
            <button onClick={onReply} className="hover:text-ink-300 transition-colors">
              답글
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDelete}
              disabled={pending}
              className="hover:text-punch-400 transition-colors"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
