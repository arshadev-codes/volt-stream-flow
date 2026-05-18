/**
 * Core data contract for the Linear Voltage Testing System.
 * Kept in /types so it can be shared by services, hooks, and components.
 */
export interface Sample {
  time: number;     // seconds (canonical unit, converted at render time)
  voltage: number;  // volts
  current: number;  // amperes (canonical unit, converted at render time)
}

export type TimeUnit = "S" | "MS";
export type CurrentUnit = "A" | "mA";

export type TestStatus = "idle" | "running" | "stopped";
