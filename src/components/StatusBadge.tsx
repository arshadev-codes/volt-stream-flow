import { motion } from "framer-motion";
import type { ReactorPhase } from "@/types/sample";

const MAP: Record<ReactorPhase, { label: string; color: string }> = {
  idle:      { label: "IDLE",        color: "var(--muted-foreground)" },
  ramp_up:   { label: "CHARGING",    color: "var(--current)" },
  decay:     { label: "DISCHARGING", color: "var(--voltage)" },
  completed: { label: "COMPLETED",   color: "var(--ok)" },
};

export function StatusBadge({ status }: { status: ReactorPhase }) {
  const s = MAP[status];
  const animated = status === "ramp_up" || status === "decay";
  return (
    <div
      className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.2em]"
      style={{
        color: s.color,
        borderColor: `color-mix(in oklab, ${s.color} 40%, var(--border))`,
        background: `color-mix(in oklab, ${s.color} 10%, var(--card))`,
      }}
    >
      <motion.span
        className="h-2 w-2 rounded-full"
        style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }}
        animate={animated ? { opacity: [1, 0.3, 1], scale: [1, 1.25, 1] } : { opacity: 1 }}
        transition={{ duration: 1.1, repeat: Infinity }}
      />
      {s.label}
    </div>
  );
}
