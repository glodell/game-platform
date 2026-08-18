import { LeaderboardSkeleton, Skeleton } from "@/components/skeletons";

export default function GameDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div className="min-w-0 space-y-4">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="aspect-[4/3] sm:aspect-video w-full rounded-2xl" />
          <div className="flex gap-3">
            <Skeleton className="h-11 w-24 rounded-xl" />
            <Skeleton className="h-11 w-40 rounded-xl" />
          </div>
        </div>

        <aside className="panel p-5 space-y-4">
          <Skeleton className="h-6 w-28" />
          <LeaderboardSkeleton count={7} />
        </aside>
      </div>
    </div>
  );
}
