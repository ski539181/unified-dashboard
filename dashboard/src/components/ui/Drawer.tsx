import * as React from "react";
import { cn } from "../../lib/cn";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right";
  children: React.ReactNode;
}

function Drawer({ open, onOpenChange, side = "right", children }: DrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)]">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div
        className={cn(
          "fixed inset-y-0 w-full max-w-md bg-[var(--bg-surface)] shadow-[var(--shadow-lg)] transition-transform",
          side === "left" ? "left-0" : "right-0"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between p-6 border-b border-[var(--border-subtle)]", className)} {...props} />;
}

function DrawerTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />;
}

function DrawerContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-auto p-6", className)} {...props} />;
}

export { Drawer, DrawerHeader, DrawerTitle, DrawerContent };
