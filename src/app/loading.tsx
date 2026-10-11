import { GameGridSkeleton, CardListSkeleton, Skeleton } from "@/components/skeletons";
import { FEATURES } from "@/lib/site";

export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5">
      <section className="pt-16 sm:pt-24 pb-4 space-y-6">
        <Skeleton className="h-14 w-4/5 max-w-2xl" />
        <Skeleton className="h-14 w-3/5 max-w-xl" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-12 w-36 rounded-xl" />
          <Skeleton className="h-12 w-56 rounded-xl" />
        </div>
      </section>

      {FEATURES.tournaments && (
        <section className="mt-16 space-y-5">
          <Skeleton className="h-7 w-48" />
          <CardListSkeleton count={2} />
        </section>
      )}

      <section className="mt-16 space-y-5">
        <Skeleton className="h-7 w-32" />
        <GameGridSkeleton count={4} />
      </section>
    </div>
  );
}
