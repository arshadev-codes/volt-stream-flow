import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: "current" | "peak" | "phase" | "duration" | "samples" | "neutral";
}

const accentVar: Record<NonNullable<Props["accent"]>, string> = {
  current:  "var(--current)",
  peak:     "var(--peak)",
  phase:    "var(--voltage)",
  duration: "var(--ok)",
  samples:  "var(--chart-5)",
  neutral:  "var(--foreground)",
};

export function StatCard({ label, value, unit, accent = "neutral" }: Props) {
  const c = accentVar[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel relative overflow-hidden p-4"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute -inset-px opacity-[0.08]"
        style={{ background: `radial-gradient(120% 80% at 0% 0%, ${c}, transparent 60%)` }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            {label}
          </div>
        </div>
        <div className="mt-2 font-mono text-2xl font-bold tabular-nums" style={{ color: c }}>
          {value}
          {unit && <span className="ml-1 text-sm text-muted-foreground">{unit}</span>}
        </div>
      </div>
    </motion.div>
  );
}
