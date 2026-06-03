import type { RawPoint } from "@/types/sample";

/**
 * Group every 4 consecutive raw samples and take the median for voltage,
 * current and phase. Output timestamps are aligned to the mid-group time,
 * effectively producing a 1 ms cadence dataset from a 0.25 ms raw stream.
 *
 * The analysis dataset is ALWAYS derived from the raw dataset — never
 * generated independently.
 */
export function analyzeRaw(raw: RawPoint[], groupSize = 4): RawPoint[] {
  if (raw.length === 0) return [];
  const out: RawPoint[] = [];
  for (let i = 0; i < raw.length; i += groupSize) {
    const group = raw.slice(i, i + groupSize);
    if (group.length === 0) continue;
    out.push({
      timestamp: +((group[0].timestamp + group[group.length - 1].timestamp) / 2).toFixed(3),
      voltage: median(group.map((p) => p.voltage)),
      current: median(group.map((p) => p.current)),
      phase:   median(group.map((p) => p.phase)),
    });
  }
  return out;
}

function median(values: number[]): number {
  const a = [...values].sort((x, y) => x - y);
  const mid = a.length >> 1;
  const m = a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  return +m.toFixed(4);
}
