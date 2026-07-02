import { cn } from "../../lib/cn";

interface TimelineItem {
  id: string;
  time: string;
  title: string;
  description?: string;
  status?: "success" | "warning" | "error" | "info";
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

const statusColors = {
  success: "bg-[var(--accent-green)]",
  warning: "bg-[var(--accent-yellow)]",
  error: "bg-[var(--accent-red)]",
  info: "bg-[var(--accent-blue)]",
};

function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {items.map((item) => (
        <div key={item.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={cn("h-3 w-3 rounded-full", statusColors[item.status || "info"])} />
            <div className="w-px flex-1 bg-[var(--border-subtle)]" />
          </div>
          <div className="pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--text-tertiary)]">{item.time}</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">{item.title}</span>
            </div>
            {item.description && (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export { Timeline };
export type { TimelineItem };
