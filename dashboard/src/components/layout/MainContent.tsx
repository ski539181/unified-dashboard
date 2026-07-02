import { cn } from "../../lib/cn";

interface MainContentProps {
  children: React.ReactNode;
  className?: string;
}

export function MainContent({ children, className }: MainContentProps) {
  return (
    <main
      className={cn(
        "md:ml-[var(--sidebar-width)]",
        "min-h-screen",
        "bg-[var(--bg-base)]",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto",
          "max-w-[var(--content-max-width)]",
          "px-4 md:px-6 py-6"
        )}
      >
        {children}
      </div>
    </main>
  );
}
