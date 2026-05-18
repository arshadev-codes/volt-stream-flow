import type { ReactorSample } from "@/types/sample";

/**
 * Reactor linearity simulation engine.
 *
 * Drives a deterministic rise → peak hold → decay curve that resembles real
 * reactor excitation/discharge behavior. The service is intentionally isolated
 * so it can be swapped for PLC/Modbus/WebSocket data without touching the UI.
 */

export type ReactorPhaseRuntime = "ramp_up" | "peak" | "decay" | "completed";

export interface ReactorEvent {
  sample?: ReactorSample;
  phase: ReactorPhaseRuntime;
}

export type ReactorHandler = (e: ReactorEvent) => void;

export interface ReactorSource {
  subscribe(handler: ReactorHandler): () => void;
  /** Trigger the decay phase early (e.g. operator pressed Stop). */
  triggerDecay(): void;
}

export interface ReactorConfig {
  tickMs?: number;
  peakCurrent?: number;   // A
  rampDurationS?: number;
  peakDurationS?: number;
  decayDurationS?: number;
  nominalVoltage?: number;
}

const DEFAULTS: Required<ReactorConfig> = {
  tickMs: 200,
  peakCurrent: 100,
  rampDurationS: 8,
  peakDurationS: 4,
  decayDurationS: 10,
  nominalVoltage: 230,
};

export function createReactorSource(config: ReactorConfig = {}): ReactorSource {
  const cfg = { ...DEFAULTS, ...config };
  const tickS = cfg.tickMs / 1000;

  let decayRequested = false;

  return {
    triggerDecay() {
      decayRequested = true;
    },
    subscribe(handler) {
      let elapsed = 0;
      let phase: ReactorPhaseRuntime = "ramp_up";
      let phaseStart = 0;
      let lastCurrent = 0;
      let peakReached = 0;

      const id = setInterval(() => {
        elapsed = +(elapsed + tickS).toFixed(3);
        const tInPhase = elapsed - phaseStart;

        let current = 0;

        if (phase === "ramp_up") {
          // Smooth ease-out ramp toward peak (sinusoidal acceleration).
          const p = Math.min(1, tInPhase / cfg.rampDurationS);
          const eased = Math.sin((p * Math.PI) / 2); // 0 → 1 smooth
          current = cfg.peakCurrent * eased;
          peakReached = Math.max(peakReached, current);

          if (decayRequested || p >= 1) {
            phase = decayRequested ? "decay" : "peak";
            phaseStart = elapsed;
          }
        } else if (phase === "peak") {
          // Tiny realistic fluctuations around peak.
          const jitter = (Math.random() - 0.5) * cfg.peakCurrent * 0.01;
          current = cfg.peakCurrent + jitter;
          peakReached = Math.max(peakReached, current);

          if (decayRequested || tInPhase >= cfg.peakDurationS) {
            phase = "decay";
            phaseStart = elapsed;
            lastCurrent = current;
          }
        } else if (phase === "decay") {
          // Exponential discharge: I(t) = I0 * exp(-t / τ)
          const tau = cfg.decayDurationS / 4;
          const decayFactor = Math.exp(-tInPhase / tau);
          const start = lastCurrent || cfg.peakCurrent;
          current = start * decayFactor;

          if (current < cfg.peakCurrent * 0.01 || tInPhase >= cfg.decayDurationS) {
            phase = "completed";
            handler({ phase: "completed" });
            clearInterval(id);
            return;
          }
        }

        const sample: ReactorSample = {
          time: elapsed,
          current: round(current, 3),
          voltage: round(cfg.nominalVoltage + (Math.random() - 0.5) * 1.5, 2),
          phase: phase as ReactorSample["phase"],
        };

        handler({ sample, phase });
      }, cfg.tickMs);

      return () => clearInterval(id);
    },
  };
}

const round = (v: number, d: number) => Number(v.toFixed(d));
