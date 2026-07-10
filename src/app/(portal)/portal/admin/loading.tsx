import { Skeleton } from "@/components/ui/skeleton";

// Streams instantly on navigation so admin pages feel immediate while their
// data loads. Mirrors the PortalHeader + PortalBody frame.
export default function AdminLoading() {
  return (
    <div className="px-5 md:px-10 py-6 md:py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64 rounded-none" />
          <Skeleton className="h-4 w-96 max-w-full rounded-none" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-none" />
          <Skeleton className="h-24 rounded-none" />
          <Skeleton className="h-24 rounded-none" />
          <Skeleton className="h-24 rounded-none" />
        </div>
        <Skeleton className="h-48 rounded-none" />
        <Skeleton className="h-48 rounded-none" />
      </div>
    </div>
  );
}
