import { cn } from "../../lib/cn";

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

export function StatCard({ icon, label, value, subtitle, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-[var(--bg-surface)]",
        "border border-[var(--border-subtle)]",
        "rounded-[var(--radius-lg)]",
        "p-5",
        "flex flex-col gap-3",
        "hover:border-[var(--border-default)]",
        "transition-colors",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          {label}
        </span>
        <span className="text-base">{icon}</span>
      </div>

      {/* Value */}
      <div className="text-3xl font-bold text-[var(--text-primary)] font-mono">
        {value}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-[var(--text-tertiary)]">{subtitle}</p>
      )}
    </div>
  );
}
