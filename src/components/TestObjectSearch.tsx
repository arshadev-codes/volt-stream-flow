import { useMemo, useState } from "react";
import { Search, ChevronDown, CheckCircle2, XCircle, Circle } from "lucide-react";
import type { TestObject, TestStatus } from "@/types/testObject";

interface Props {
  objects: TestObject[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const STATUS_ICON: Record<TestStatus, React.ReactNode> = {
  pending: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  passed:  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--ok)]" />,
  failed:  <XCircle className="h-3.5 w-3.5 text-destructive" />,
};

export function TestObjectSearch({ objects, selectedId, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return objects;
    return objects.filter(
      (o) =>
        o.serialNumber.toLowerCase().includes(s) ||
        o.name.toLowerCase().includes(s) ||
        (o.manufacturer ?? "").toLowerCase().includes(s),
    );
  }, [q, objects]);

  const selected = objects.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={selected ? `${selected.serialNumber} · ${selected.name}` : "Search test object…"}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {selected && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onSelect(null); setQ(""); }}
            className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No test objects. Create one in <span className="font-semibold text-foreground">Test Objects</span>.
            </div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(o.id); setOpen(false); setQ(""); }}
                className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-accent ${
                  o.id === selectedId ? "bg-accent" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    {STATUS_ICON[o.status]}
                    <span className="truncate">{o.serialNumber}</span>
                    <span className="truncate text-muted-foreground">· {o.name}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {o.peakCurrent} A peak · {o.maxVoltage} V max
                  </div>
                </div>
                <span className="shrink-0 rounded-sm border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {o.status}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
