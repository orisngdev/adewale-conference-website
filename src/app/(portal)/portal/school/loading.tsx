import { Skeleton } from "@/components/ui/skeleton";

// Streams instantly on navigation inside the school layout's content column.
export default function SchoolLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56 rounded-none" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-24 rounded-none" />
        <Skeleton className="h-24 rounded-none" />
        <Skeleton className="h-24 rounded-none" />
      </div>
      <Skeleton className="h-44 rounded-none" />
      <Skeleton className="h-44 rounded-none" />
    </div>
  );
}
