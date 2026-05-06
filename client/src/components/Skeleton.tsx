export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === 0 ? "w-10" : i === 1 ? "flex-1" : "w-20"}`} />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 14%)" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={i > 0 ? { borderTop: "1px solid hsl(0 0% 12%)" } : undefined}>
          <TableRowSkeleton cols={cols} />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-3 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
      </div>
      <ListSkeleton />
    </div>
  );
}
