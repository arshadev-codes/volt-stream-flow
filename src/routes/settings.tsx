import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Database, Info } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { useTheme } from "@/hooks/useTheme";
import { useSettings } from "@/hooks/useSettings";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — Electrosoft Automation RLTS" },
      { name: "description", content: "Configure data acquisition and storage preferences." },
    ],
  }),
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const { settings, update } = useSettings();

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 lg:px-8">
        <BrandHeader theme={theme} onToggleTheme={toggle} />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="panel p-6"
        >
          <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.25em] text-foreground">
            <SettingsIcon className="h-4 w-4 text-amber-500" />
            System Settings
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Preferences are stored locally and apply to all future tests on this workstation.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="panel p-6"
        >
          <div className="mb-4 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
            <Database className="h-4 w-4 text-amber-500" />
            Data Acquisition
          </div>

          <label className="group flex cursor-pointer items-start justify-between gap-6 rounded-md border border-border bg-card p-5 transition hover:border-amber-500/40">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">Store Raw Data</div>
              <div className="mt-1 text-xs text-muted-foreground">
                When enabled, the full 0.25 ms raw acquisition stream is persisted to the database
                alongside the 1 ms analysis dataset. When disabled, only the analysis dataset is stored —
                significantly reducing storage footprint.
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <Info className="h-3 w-3" />
                Current: {settings.storeRawData ? "Raw + Analysis" : "Analysis only"}
              </div>
            </div>

            <Toggle
              checked={settings.storeRawData}
              onChange={(v) => update({ storeRawData: v })}
            />
          </label>
        </motion.div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? "bg-amber-500" : "bg-secondary"
      }`}
      aria-pressed={checked}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`inline-block h-5 w-5 transform rounded-full bg-background shadow ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
