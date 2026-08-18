import { LeaderboardSkeleton, Skeleton } from "@/components/skeletons";

export default function TournamentDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="panel p-6 sm:p-8 space-y-5">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-10 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-16 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start mt-8">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <aside className="panel p-5 space-y-4">
          <Skeleton className="h-6 w-32" />
          <LeaderboardSkeleton count={8} />
        </aside>
      </div>
    </div>
  );
}
