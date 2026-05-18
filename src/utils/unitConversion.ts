import type { TimeUnit, CurrentUnit } from "@/types/sample";

/** Convert a time value stored in seconds to the requested unit. */
export function convertTimeUnit(seconds: number, unit: TimeUnit): number {
  return unit === "MS" ? seconds * 1000 : seconds;
}

/** Convert a current value stored in amperes to the requested unit. */
export function convertCurrentUnit(amps: number, unit: CurrentUnit): number {
  return unit === "mA" ? amps * 1000 : amps;
}

export const timeUnitLabel = (u: TimeUnit) => (u === "MS" ? "ms" : "s");
export const currentUnitLabel = (u: CurrentUnit) => (u === "mA" ? "mA" : "A");
