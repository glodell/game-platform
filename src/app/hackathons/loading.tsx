import { PageHeaderSkeleton, Skeleton } from "@/components/skeletons";

export default function HackathonsLoading() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <PageHeaderSkeleton />
      <div className="space-y-4 mt-10">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="panel p-6 space-y-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-7 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
