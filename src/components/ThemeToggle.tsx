import { Moon, Sun } from "lucide-react";
import type { Theme } from "@/hooks/useTheme";

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle color theme"
      className="group relative inline-flex h-9 w-16 items-center rounded-full border border-border bg-secondary/60 px-1 transition-colors hover:border-accent-foreground/40"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full bg-background shadow-md ring-1 ring-border transition-transform ${
          isDark ? "translate-x-7" : "translate-x-0"
        }`}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-accent-foreground" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        )}
      </span>
      <Sun className={`pointer-events-none absolute left-2 h-3.5 w-3.5 text-amber-400/70 transition-opacity ${isDark ? "opacity-30" : "opacity-0"}`} />
      <Moon className={`pointer-events-none absolute right-2 h-3.5 w-3.5 text-sky-300/70 transition-opacity ${isDark ? "opacity-0" : "opacity-40"}`} />
    </button>
  );
}
