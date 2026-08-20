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

  // new_timestamp: number;
  // linked_flux : number;
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

/**
 * Live interlock/breaker status, read from DI0.1-DI0.6 on the bench panel.
 * VCB is not monitored — the test bench doesn't report it reliably.
 * Backend only sends an update when something actually changes.
 */
export interface InterlockStatus {
  acbOn: boolean;
  acbTrip: boolean;
  emgHealthy: boolean;
  dcTrip: boolean;
  /** True only when ACB ON, EMG healthy, and no trips are active —
   *  i.e. a DC-ON blip is currently allowed to start a test. */
  canArm: boolean;
}