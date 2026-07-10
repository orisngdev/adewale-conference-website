import { Skeleton } from "@/components/ui/skeleton";

// Streams instantly on navigation inside the student layout's content column.
export default function StudentLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 rounded-none" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-24 rounded-none" />
        <Skeleton className="h-24 rounded-none" />
        <Skeleton className="h-24 rounded-none" />
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-none" />
        <Skeleton className="h-24 rounded-none" />
        <Skeleton className="h-24 rounded-none" />
        <Skeleton className="h-24 rounded-none" />
      </div>
      <Skeleton className="h-40 rounded-none" />
    </div>
  );
}
