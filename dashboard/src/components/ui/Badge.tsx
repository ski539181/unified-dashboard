import * as React from "react";
import { cn } from "../../lib/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        {
          "bg-[var(--accent-blue-dim)] text-[var(--accent-blue)]": variant === "default",
          "bg-[var(--bg-elevated)] text-[var(--text-secondary)]": variant === "secondary",
          "bg-[var(--accent-green-dim)] text-[var(--accent-green)]": variant === "success",
          "bg-[var(--accent-yellow-dim)] text-[var(--accent-yellow)]": variant === "warning",
          "bg-[var(--accent-red-dim)] text-[var(--accent-red)]": variant === "destructive",
          "border border-[var(--border-subtle)] text-[var(--text-secondary)]": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
