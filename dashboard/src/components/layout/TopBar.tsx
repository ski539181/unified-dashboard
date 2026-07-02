import { cn } from "../../lib/cn";
import { useTheme } from "../../hooks/useTheme";
import { Button } from "../ui/Button";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header
      className={cn(
        "sticky top-0 z-[var(--z-topbar)]",
        "h-[var(--topbar-height)]",
        "bg-[var(--bg-base)]/80 backdrop-blur-xl",
        "border-b border-[var(--border-subtle)]",
        "flex items-center justify-between px-6"
      )}
    >
      {/* Left: Title */}
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
        {subtitle && (
          <p className="text-xs text-[var(--text-secondary)]">{subtitle}</p>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="text-[var(--text-secondary)]">
          ⌘K Search
        </Button>
        <div className="w-px h-5 bg-[var(--border-subtle)]" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="text-[var(--text-secondary)]"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </Button>
      </div>
    </header>
  );
}
