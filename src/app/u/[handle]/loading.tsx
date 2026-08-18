import { LeaderboardSkeleton, Skeleton } from "@/components/skeletons";

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <div className="flex items-center gap-5">
        <Skeleton className="size-[72px] rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="mt-12 space-y-5">
        <Skeleton className="h-7 w-32" />
        <div className="panel p-4">
          <LeaderboardSkeleton count={5} />
        </div>
      </div>
    </div>
  );
}
