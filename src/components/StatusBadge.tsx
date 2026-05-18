import { motion } from "framer-motion";
import type { TestStatus } from "@/types/sample";

const MAP: Record<TestStatus, { label: string; dot: string; text: string; bg: string }> = {
  idle:    { label: "IDLE",    dot: "bg-muted-foreground",        text: "text-muted-foreground", bg: "bg-muted/40" },
  running: { label: "RUNNING", dot: "bg-emerald-400",             text: "text-emerald-300",      bg: "bg-emerald-500/10" },
  stopped: { label: "STOPPED", dot: "bg-amber-400",               text: "text-amber-300",        bg: "bg-amber-500/10" },
};

export function StatusBadge({ status }: { status: TestStatus }) {
  const s = MAP[status];
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1 text-xs font-semibold tracking-widest ${s.bg} ${s.text}`}>
      <motion.span
        className={`h-2 w-2 rounded-full ${s.dot}`}
        animate={status === "running" ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
        transition={{ duration: 1.2, repeat: Infinity }}
      />
      {s.label}
    </div>
  );
}
