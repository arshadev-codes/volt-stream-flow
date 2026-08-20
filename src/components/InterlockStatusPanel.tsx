import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import type { InterlockStatus } from "@/types/sample";

interface Props {
  status: InterlockStatus;
}

interface Item {
  key: keyof InterlockStatus;
  label: string;
  /** How to read the underlying boolean: some fields are "good when true", others "good when false". */
  goodWhen: boolean;
  goodLabel: string;
  badLabel: string;
}

const ITEMS: Item[] = [
  { key: "acbOn",      label: "ACB",     goodWhen: true,  goodLabel: "ON",      badLabel: "OFF" },
  { key: "acbTrip",    label: "ACB TRIP",goodWhen: false, goodLabel: "CLEAR",   badLabel: "TRIPPED" },
  { key: "emgHealthy", label: "EMERGENCY", goodWhen: true, goodLabel: "HEALTHY", badLabel: "TRIGGERED" },
  { key: "dcTrip",     label: "DC TRIP", goodWhen: false, goodLabel: "CLEAR",   badLabel: "TRIPPED" },
];

export function InterlockStatusPanel({ status }: Props) {
  const prevRef = useRef<InterlockStatus | null>(null);
  const [alert, setAlert] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = status;
    if (!prev) return;

    for (const item of ITEMS) {
      if (prev[item.key] !== status[item.key]) {
        const isGood = status[item.key] === item.goodWhen;
        setAlert({
          text: `${item.label} → ${isGood ? item.goodLabel : item.badLabel}`,
          ok: isGood,
        });
        const t = setTimeout(() => setAlert(null), 3500);
        return () => clearTimeout(t);
      }
    }
  }, [status]);

  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-foreground">
          {status.canArm ? (
            <ShieldCheck className="h-4 w-4 text-[var(--ok)]" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          )}
          Interlock Status
        </div>
        <span
          className={`rounded-md border px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest ${
            status.canArm
              ? "border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok)]"
              : "border-amber-500/40 bg-amber-500/10 text-amber-500"
          }`}
        >
          {status.canArm ? "Ready to Arm" : "Not Ready"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ITEMS.map((item) => {
          const value = status[item.key];
          const isGood = value === item.goodWhen;
          return (
            <div
              key={item.key}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                isGood
                  ? "border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok)]"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {isGood ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">
                {item.label}: {isGood ? item.goodLabel : item.badLabel}
              </span>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {alert && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mt-3 flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs ${
              alert.ok
                ? "border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok)]"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {alert.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}