import { RotateCcw, Radio, WifiOff } from "lucide-react";
import type { CurrentUnit, ReactorPhase, TimeUnit } from "@/types/sample";
import { StatusBadge } from "./StatusBadge";

interface Props {
  status: ReactorPhase;
  connected: boolean;
  timeUnit: TimeUnit;
  currentUnit: CurrentUnit;
  onClear: () => void;
  onTimeUnitChange: (u: TimeUnit) => void;
  onCurrentUnitChange: (u: CurrentUnit) => void;
  /** Voltage overlay — unchecked by default. Only shows a line once real voltage
   *  data is non-zero; with dummy data (voltage always 0) it'll just be a flat line. */
  showVoltage: boolean;
  onShowVoltageChange: (v: boolean) => void;
  /** Tau-locked "smooth region" highlight overlay on the raw waveform — unchecked by default. */
  showSmoothLine: boolean;
  onShowSmoothLineChange: (v: boolean) => void;
}

export function TestController({
  status, connected, timeUnit, currentUnit,
  onClear, onTimeUnitChange, onCurrentUnitChange,
  showVoltage, onShowVoltageChange, showSmoothLine, onShowSmoothLineChange,
}: Props) {
  return (
    <div className="panel flex flex-wrap items-center gap-3 p-4">
      <StatusBadge status={status} />

      {connected ? (
        status === "idle" && (
          <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> Waiting for bench start…
          </span>
        )
      ) : (
        <span className="flex items-center gap-1.5 font-mono text-xs text-destructive">
          <WifiOff className="h-3.5 w-3.5" /> Backend not connected
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <UnitSelect label="Time"    value={timeUnit}    options={[["S", "Seconds"], ["MS", "Milliseconds"]]} onChange={(v) => onTimeUnitChange(v as TimeUnit)} />
        <UnitSelect label="Current" value={currentUnit} options={[["A", "Amperes"], ["mA", "Milliamps"]]}    onChange={(v) => onCurrentUnitChange(v as CurrentUnit)} />

        <GraphToggle label="Voltage"        checked={showVoltage}    onChange={onShowVoltageChange} />
        <GraphToggle label="Steady State" checked={showSmoothLine} onChange={onShowSmoothLineChange} />

        <button
          onClick={onClear}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-secondary-foreground transition hover:bg-accent"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}

function GraphToggle({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[11px] cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--current)]"
      />
      <span className="font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    </label>
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