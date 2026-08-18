import { PageHeaderSkeleton, Skeleton } from "@/components/skeletons";

export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <PageHeaderSkeleton />
      <div className="mt-10 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div className="mt-14 space-y-4">
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
