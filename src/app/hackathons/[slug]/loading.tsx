import { GameGridSkeleton, Skeleton } from "@/components/skeletons";

export default function HackathonDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="panel p-6 sm:p-8 space-y-5">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-10 w-3/5" />
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-16 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="mt-12 space-y-5">
        <Skeleton className="h-7 w-32" />
        <GameGridSkeleton count={4} />
      </div>
    </div>
  );
}
