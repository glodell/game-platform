import { PageHeaderSkeleton, Skeleton } from "@/components/skeletons";

export default function SubmitLoading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <PageHeaderSkeleton />
      <div className="space-y-6 mt-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ))}
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-13 w-full rounded-xl" />
      </div>
    </div>
  );
}
