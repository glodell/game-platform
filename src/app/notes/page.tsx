import type { Metadata } from "next";
import { NoteCard } from "@/components/note-card";
import { EmptyState } from "@/components/ui";
import { listNotes } from "@/lib/queries";

const DESCRIPTION =
  "쇼츠에 나온 게임을 AI와 어떻게 만들었는지 남기는 기록입니다. 아이디어, 프롬프트, 막혔던 지점과 해결 과정을 적어 둡니다.";

export const metadata: Metadata = {
  title: "제작 노트",
  description: DESCRIPTION,
};

export default async function NotesPage() {
  const notes = await listNotes(60);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight">제작 노트</h1>
      <p className="text-ink-400 mt-2 max-w-2xl">{DESCRIPTION}</p>

      {notes.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="아직 올라온 노트가 없습니다"
            description="첫 번째 제작기를 준비하고 있습니다. 그동안 게임부터 해보세요."
            action={{ href: "/games", label: "게임하러 가기" }}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-10">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
