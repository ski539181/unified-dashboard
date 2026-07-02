import { cn } from "../../lib/cn";

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

function SkipLink({ href, children, className }: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[var(--z-toast)]",
        "focus:rounded-lg focus:bg-[var(--accent-blue)] focus:px-4 focus:py-2 focus:text-white",
        className
      )}
    >
      {children}
    </a>
  );
}

export { SkipLink };
