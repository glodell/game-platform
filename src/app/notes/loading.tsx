import { PageHeaderSkeleton, Skeleton } from "@/components/skeletons";

export default function NotesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="panel overflow-hidden">
            <Skeleton className="aspect-video rounded-none" />
            <div className="p-4 space-y-2.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
