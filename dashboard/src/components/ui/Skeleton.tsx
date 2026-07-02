import { cn } from "../../lib/cn";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer rounded-[var(--radius-md)]", className)}
      {...props}
    />
  );
}

export { Skeleton };
