import type { Sample } from "@/types/sample";

const VOLT_MIN = 210;
const VOLT_MAX = 240;
const CURR_MIN = 0.5;
const CURR_MAX = 5;

/**
 * Generates a single sample with a small drift from the previous one so the
 * graph looks like a real signal instead of pure noise.
 */
export function generateRandomSample(
  time: number,
  previous?: Sample,
): Sample {
  const baseV = previous?.voltage ?? (VOLT_MIN + VOLT_MAX) / 2;
  const baseI = previous?.current ?? (CURR_MIN + CURR_MAX) / 2;

  const voltage = clamp(baseV + (Math.random() - 0.5) * 4, VOLT_MIN, VOLT_MAX);
  const current = clamp(baseI + (Math.random() - 0.5) * 0.6, CURR_MIN, CURR_MAX);

  return {
    time,
    voltage: round(voltage, 2),
    current: round(current, 3),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, d: number) => Number(v.toFixed(d));
