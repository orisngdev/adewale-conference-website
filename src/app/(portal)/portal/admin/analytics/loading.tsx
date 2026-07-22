import { Skeleton } from "@/components/ui/skeleton";

// Streams instantly on navigation while the analytics aggregation runs.
// Mirrors the PortalHeader + KPI band + chart grid frame.
export default function AnalyticsLoading() {
  return (
    <div className="px-5 md:px-10 py-6 md:py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-56 rounded-none" />
          <Skeleton className="h-4 w-80 max-w-full rounded-none" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-none" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-none" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-none" />
          <Skeleton className="h-64 rounded-none" />
        </div>
      </div>
    </div>
  );
}
