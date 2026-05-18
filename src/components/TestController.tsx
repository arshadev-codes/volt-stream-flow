import { Play, Square, Trash2 } from "lucide-react";
import type { CurrentUnit, TestStatus, TimeUnit } from "@/types/sample";
import { StatusBadge } from "./StatusBadge";

interface Props {
  status: TestStatus;
  timeUnit: TimeUnit;
  currentUnit: CurrentUnit;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  onTimeUnitChange: (u: TimeUnit) => void;
  onCurrentUnitChange: (u: CurrentUnit) => void;
}

export function TestController({
  status, timeUnit, currentUnit,
  onStart, onStop, onClear,
  onTimeUnitChange, onCurrentUnitChange,
}: Props) {
  const isRunning = status === "running";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/60 p-4 backdrop-blur">
      <StatusBadge status={status} />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <UnitSelect
          label="Time"
          value={timeUnit}
          options={[["S", "Seconds"], ["MS", "Milliseconds"]]}
          onChange={(v) => onTimeUnitChange(v as TimeUnit)}
        />
        <UnitSelect
          label="Current"
          value={currentUnit}
          options={[["A", "Amperes"], ["mA", "Milliamps"]]}
          onChange={(v) => onCurrentUnitChange(v as CurrentUnit)}
        />

        <button
          onClick={onStart}
          disabled={isRunning}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-500/90 px-3 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-4 w-4" /> Start
        </button>
        <button
          onClick={onStop}
          disabled={!isRunning}
          className="inline-flex items-center gap-2 rounded-md bg-rose-500/90 px-3 py-2 text-sm font-semibold text-white shadow transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Square className="h-4 w-4" /> Stop
        </button>
        <button
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/60"
        >
          <Trash2 className="h-4 w-4" /> Clear
        </button>
      </div>
    </div>
  );
}

function UnitSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-foreground outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-background">
            {l} ({v})
          </option>
        ))}
      </select>
    </label>
  );
}
