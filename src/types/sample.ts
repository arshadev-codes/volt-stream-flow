/**
 * Core data contract for the Reactor Linearity Testing System.
 */
export type ReactorPhase = "idle" | "ramp_up" | "decay" | "completed";

/** Per-sample point — both raw (0.25 ms) and analysis (1 ms) datasets use this shape. */
export interface RawPoint {
  timestamp: number; // milliseconds from test start
  voltage: number;
  current: number;
  phase: number;     // radians (V vs I phase angle)
}

/** Legacy alias retained for transitional code. */
export interface ReactorSample {
  time: number;     // seconds
  current: number;
  voltage?: number;
  phase: "ramp_up" | "decay";
}
export type Sample = ReactorSample;

export type TimeUnit = "S" | "MS";
export type CurrentUnit = "A" | "mA";

export type TestStatus = ReactorPhase;
