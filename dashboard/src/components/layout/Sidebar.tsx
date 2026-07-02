import { useState } from "react";
import { cn } from "../../lib/cn";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  currentRoute?: string;
  onNavigate?: (route: string) => void;
}

const navItems = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "tasks", label: "Tasks", icon: "📋" },
  { id: "agents", label: "Agents", icon: "🤖" },
  { id: "intelligence", label: "Intelligence", icon: "🧠" },
  { id: "healing", label: "Self-Healing", icon: "🛡️" },
  { id: "events", label: "Events", icon: "📡" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar({ collapsed = false, currentRoute = "overview", onNavigate }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-[var(--z-sidebar)] h-screen",
        "bg-[var(--bg-surface)] border-r border-[var(--border-subtle)]",
        "flex flex-col transition-all duration-200",
        "hidden md:flex",
        collapsed ? "w-[var(--sidebar-collapsed)]" : "w-[var(--sidebar-width)]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-[var(--topbar-height)] border-b border-[var(--border-subtle)]">
        <span className="text-lg">🚀</span>
        {!collapsed && (
          <span className="text-sm font-semibold text-[var(--text-primary)]">Hermes</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate?.(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  currentRoute === item.id
                    ? "bg-[var(--accent-blue-dim)] text-[var(--accent-blue)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                )}
              >
                <span className="text-base">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* System Status */}
      <div className="px-3 py-4 border-t border-[var(--border-subtle)]">
        <div className={cn("flex items-center gap-2 px-3", collapsed && "justify-center")}>
          <div className="w-2 h-2 rounded-full bg-[var(--accent-green)]" />
          {!collapsed && (
            <span className="text-xs text-[var(--text-secondary)]">Online</span>
          )}
        </div>
      </div>
    </aside>
  );
}

export function MobileMenu({ currentRoute, onNavigate }: { currentRoute: string; onNavigate: (route: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-3 left-3 z-[var(--z-topbar)] md:hidden p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
      >
        <span className="text-lg">{open ? "✕" : "☰"}</span>
      </button>

      {/* Mobile Sidebar Overlay */}
      {open && (
        <div className="fixed inset-0 z-[var(--z-overlay)] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)]">
            <div className="flex items-center gap-3 px-5 h-[var(--topbar-height)] border-b border-[var(--border-subtle)]">
              <span className="text-lg">🚀</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">Hermes</span>
            </div>
            <nav className="py-4 px-3">
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => { onNavigate(item.id); setOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                        currentRoute === item.id
                          ? "bg-[var(--accent-blue-dim)] text-[var(--accent-blue)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                      )}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
