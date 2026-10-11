import { GameGridSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/skeletons";
import { FEATURES } from "@/lib/site";

export default function GamesLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeaderSkeleton />
      <div className="flex gap-6 mt-8 mb-7">
        {FEATURES.community && (
          <div className="flex gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>
      <GameGridSkeleton count={8} />
    </div>
  );
}
