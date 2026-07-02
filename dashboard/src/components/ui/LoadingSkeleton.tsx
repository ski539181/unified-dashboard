import { cn } from "../../lib/cn";

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
}

export function LoadingSkeleton({ className, count = 1 }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-shimmer rounded-[var(--radius-md)] bg-[var(--bg-elevated)] h-4 w-full"
        />
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3 w-16 animate-shimmer rounded bg-[var(--bg-elevated)]" />
        <div className="h-4 w-4 animate-shimmer rounded bg-[var(--bg-elevated)]" />
      </div>
      <div className="h-8 w-12 animate-shimmer rounded bg-[var(--bg-elevated)]" />
      <div className="h-3 w-32 animate-shimmer rounded bg-[var(--bg-elevated)]" />
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-3 w-16 animate-shimmer rounded bg-[var(--bg-elevated)]" />
            <div className="h-5 w-6 animate-shimmer rounded-full bg-[var(--bg-elevated)]" />
          </div>
          <div className="bg-[var(--bg-elevated)] rounded-lg p-3 space-y-2">
            <div className="h-4 w-full animate-shimmer rounded bg-[var(--bg-overlay)]" />
            <div className="h-3 w-20 animate-shimmer rounded bg-[var(--bg-overlay)]" />
            <div className="h-2 w-full animate-shimmer rounded bg-[var(--bg-overlay)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EventSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 w-16 animate-shimmer rounded bg-[var(--bg-elevated)]" />
          <div className="h-4 w-4 animate-shimmer rounded-full bg-[var(--bg-elevated)]" />
          <div className="h-3 w-24 animate-shimmer rounded bg-[var(--bg-elevated)]" />
        </div>
      ))}
    </div>
  );
}
