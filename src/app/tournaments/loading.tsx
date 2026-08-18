import { CardListSkeleton, PageHeaderSkeleton, Skeleton } from "@/components/skeletons";

export default function TournamentsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeaderSkeleton />
      <section className="mt-10 space-y-5">
        <Skeleton className="h-7 w-28" />
        <CardListSkeleton count={3} />
      </section>
    </div>
  );
}
