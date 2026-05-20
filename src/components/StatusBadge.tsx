import { motion } from "framer-motion";
import type { ReactorPhase } from "@/types/sample";

const MAP: Record<ReactorPhase, { label: string; dot: string; text: string; bg: string; ring: string }> = {
  idle:      { label: "IDLE",       dot: "bg-slate-400",    text: "text-slate-200",    bg: "bg-slate-500/15",   ring: "ring-slate-400/30" },
  ramp_up:   { label: "RAMP UP",    dot: "bg-amber-400",    text: "text-amber-200",    bg: "bg-amber-500/15",   ring: "ring-amber-400/40" },
  
  decay:     { label: "DECAY",      dot: "bg-sky-400",      text: "text-sky-200",      bg: "bg-sky-500/15",     ring: "ring-sky-400/40" },
  completed: { label: "COMPLETED",  dot: "bg-emerald-400",  text: "text-emerald-200",  bg: "bg-emerald-500/15", ring: "ring-emerald-400/40" },
};

export function StatusBadge({ status }: { status: ReactorPhase }) {
  const s = MAP[status];
  const animated = status === "ramp_up" || status === "decay";
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold tracking-widest ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      <motion.span
        className={`h-2 w-2 rounded-full ${s.dot}`}
        animate={animated ? { opacity: [1, 0.3, 1], scale: [1, 1.2, 1] } : { opacity: 1 }}
        transition={{ duration: 1.2, repeat: Infinity }}
      />
      {s.label}
    </div>
  );
}
