import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: "voltage" | "current" | "neutral";
}

const accents = {
  voltage: "text-sky-400 shadow-[0_0_24px_-8px_rgba(56,189,248,0.6)]",
  current: "text-orange-400 shadow-[0_0_24px_-8px_rgba(251,146,60,0.6)]",
  neutral: "text-foreground",
};

export function StatCard({ label, value, unit, accent = "neutral" }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-lg border border-border/60 bg-card/60 p-4 backdrop-blur"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 font-mono text-2xl font-bold tabular-nums ${accents[accent]}`}>
        {value}
        {unit && <span className="ml-1 text-sm text-muted-foreground">{unit}</span>}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </motion.div>
  );
}
