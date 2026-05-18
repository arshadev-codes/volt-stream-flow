import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: "current" | "peak" | "phase" | "duration" | "samples" | "neutral";
}

const accents: Record<NonNullable<Props["accent"]>, string> = {
  current:  "text-orange-300",
  peak:     "text-rose-300",
  phase:    "text-sky-300",
  duration: "text-emerald-300",
  samples:  "text-violet-300",
  neutral:  "text-slate-100",
};

const glows: Record<NonNullable<Props["accent"]>, string> = {
  current:  "from-orange-500/20",
  peak:     "from-rose-500/20",
  phase:    "from-sky-500/20",
  duration: "from-emerald-500/20",
  samples:  "from-violet-500/20",
  neutral:  "from-slate-500/10",
};

export function StatCard({ label, value, unit, accent = "neutral" }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-lg backdrop-blur"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${glows[accent]} to-transparent opacity-60`} />
      <div className="relative">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {label}
        </div>
        <div className={`mt-2 font-mono text-2xl font-bold tabular-nums ${accents[accent]}`}>
          {value}
          {unit && <span className="ml-1 text-sm text-slate-400">{unit}</span>}
        </div>
      </div>
    </motion.div>
  );
}
