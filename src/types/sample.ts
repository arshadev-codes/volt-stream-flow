/**
 * Core data contract for the Reactor Linearity Testing System.
 */
export type ReactorPhase = "idle" | "ramp_up" | "peak" | "decay" | "completed";

export interface ReactorSample {
  time: number;     // seconds
  current: number;  // amperes (canonical)
  voltage?: number; // volts (optional)
  phase: "ramp_up" | "peak" | "decay";
}

// Back-compat alias used by some components.
export type Sample = ReactorSample;

export type TimeUnit = "S" | "MS";
export type CurrentUnit = "A" | "mA";

export type TestStatus = ReactorPhase;
