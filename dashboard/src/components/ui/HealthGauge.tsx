import { cn } from "../../lib/cn";

interface HealthGaugeProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

function getHealthColor(value: number): string {
  if (value >= 80) return "var(--accent-green)";
  if (value >= 60) return "var(--accent-yellow)";
  return "var(--accent-red)";
}

function HealthGauge({ value, max = 100, size = "md", showLabel = true, className }: HealthGaugeProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const color = getHealthColor(value);

  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("flex-1 rounded-full bg-[var(--bg-overlay)]", sizeClasses[size])}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-[var(--text-secondary)] min-w-[3ch] text-right">
          {Math.round(value)}
        </span>
      )}
    </div>
  );
}

export { HealthGauge };
