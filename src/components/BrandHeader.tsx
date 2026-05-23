import logo from "@/assets/electrosoft-logo.png";
import { ThemeToggle } from "./ThemeToggle";
import type { Theme } from "@/hooks/useTheme";

export function BrandHeader({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-5">
      <div className="flex items-center gap-4">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-md border border-border bg-card shadow-sm">
          <img
            src={logo}
            alt="Electrosoft Automation"
            className={`h-9 w-9 object-contain ${theme === "dark" ? "invert" : ""}`}
          />
        </div>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.45em] text-amber-500 dark:text-amber-400">
            Electrosoft Automation
          </div>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-foreground">
            Reactor Linearity Testing System
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Industrial excitation rise &amp; exponential decay analyzer · PLC / Modbus / WebSocket ready
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden rounded-md border border-border bg-card px-3 py-1.5 font-mono text-[11px] text-muted-foreground md:block">
          REACTOR-01 · 100A peak · 230V nominal
        </div>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
