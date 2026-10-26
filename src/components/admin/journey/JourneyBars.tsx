export function ShareBar({ label, count, max, detail }: { label: string; count: number; max: number; detail?: string }) {
  const width = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
      <p className="min-w-0 text-sm">{label}</p>
      <div className="h-2 rounded bg-border" aria-hidden="true">
        <div className="h-2 rounded bg-foreground" style={{ width: `${width}%` }} />
      </div>
      <p className="text-sm font-medium tabular-nums">{detail ?? count}</p>
    </div>
  );
}

export function EmptyNote({ children }: { children: string }) {
  return <p className="mt-4 text-sm text-muted">{children}</p>;
}

export function maxCount(values: number[]) {
  return values.reduce((max, value) => Math.max(max, value), 0);
}
