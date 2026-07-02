import { cn } from "../../lib/cn";

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

function ProgressBar({ value, max = 100, size = "md", showLabel = true, className }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("flex-1 rounded-full bg-[var(--bg-overlay)]", sizeClasses[size])}>
        <div
          className="h-full rounded-full bg-[var(--accent-blue)] transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-[var(--text-secondary)] min-w-[4ch] text-right">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}

export { ProgressBar };
