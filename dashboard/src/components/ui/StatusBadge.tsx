import { cn } from "../../lib/cn";

interface StatusBadgeProps {
  status: "idle" | "working" | "error" | "offline" | "success" | "warning";
  label?: string;
  className?: string;
}

const statusConfig = {
  idle: { color: "bg-[var(--accent-green)]", text: "Idle" },
  working: { color: "bg-[var(--accent-blue)]", text: "Working" },
  error: { color: "bg-[var(--accent-red)]", text: "Error" },
  offline: { color: "bg-[var(--text-tertiary)]", text: "Offline" },
  success: { color: "bg-[var(--accent-green)]", text: "Success" },
  warning: { color: "bg-[var(--accent-yellow)]", text: "Warning" },
};

function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <span className={cn("h-2 w-2 rounded-full", config.color)} />
      <span className="text-[var(--text-secondary)]">{label || config.text}</span>
    </span>
  );
}

export { StatusBadge };
