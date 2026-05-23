import { Play, Square, RotateCcw } from "lucide-react";
import type { CurrentUnit, ReactorPhase, TimeUnit } from "@/types/sample";
import { StatusBadge } from "./StatusBadge";

interface Props {
  status: ReactorPhase;
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
  const isRunning = status === "ramp_up" || status === "decay";
  const canStart = status === "idle" || status === "completed";

  return (
    <div className="panel flex flex-wrap items-center gap-3 p-4">
      <StatusBadge status={status} />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <UnitSelect label="Time"    value={timeUnit}    options={[["S", "Seconds"], ["MS", "Milliseconds"]]} onChange={(v) => onTimeUnitChange(v as TimeUnit)} />
        <UnitSelect label="Current" value={currentUnit} options={[["A", "Amperes"], ["mA", "Milliamps"]]}    onChange={(v) => onCurrentUnitChange(v as CurrentUnit)} />

        <button
          onClick={onStart}
          disabled={!canStart}
          className="inline-flex items-center gap-2 rounded-md border border-transparent bg-[var(--ok)] px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-background shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Play className="h-3.5 w-3.5" /> Start
        </button>
        <button
          onClick={onStop}
          disabled={!isRunning || status === "decay"}
          className="inline-flex items-center gap-2 rounded-md border border-transparent bg-destructive px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-destructive-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Square className="h-3.5 w-3.5" /> Stop
        </button>
        <button
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-secondary-foreground transition hover:bg-accent"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
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
    <label className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[11px]">
      <span className="font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-semibold text-foreground outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-popover text-popover-foreground">
            {l} ({v})
          </option>
        ))}
      </select>
    </label>
  );
}
