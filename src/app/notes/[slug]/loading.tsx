import { Skeleton } from "@/components/skeletons";

export default function NoteLoading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 space-y-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-4/5" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
