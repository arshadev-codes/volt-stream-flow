import type { ReactorSample } from "@/types/sample";

/**
 * Reactor linearity simulation engine.
 *
 * Linear rise → linear fall (triangle profile) — no peak hold.
 * Streams in real-time. Service is isolated so it can be swapped for
 * PLC / Modbus / WebSocket data without touching the UI.
 */

export type ReactorPhaseRuntime = "ramp_up" | "decay" | "completed";

export interface ReactorEvent {
  sample?: ReactorSample;
  phase: ReactorPhaseRuntime;
}

export type ReactorHandler = (e: ReactorEvent) => void;

export interface ReactorSource {
  subscribe(handler: ReactorHandler): () => void;
  triggerDecay(): void;
}

export interface ReactorConfig {
  tickMs?: number;
  peakCurrent?: number;   // A
  rampDurationS?: number;
  decayDurationS?: number;
  nominalVoltage?: number;
}

const DEFAULTS: Required<ReactorConfig> = {
  tickMs: 100,
  peakCurrent: 100,
  rampDurationS: 6,
  decayDurationS: 6,
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
      let switchCurrent = 0; // current at moment ramp ended

      const id = setInterval(() => {
        elapsed = +(elapsed + tickS).toFixed(3);
        const tInPhase = elapsed - phaseStart;

        let current = 0;

        if (phase === "ramp_up") {
          // Strict linear rise.
          const p = Math.min(1, tInPhase / cfg.rampDurationS);
          current = cfg.peakCurrent * p;

          if (decayRequested || p >= 1) {
            switchCurrent = current;
            phase = "decay";
            phaseStart = elapsed;
          }
        } else if (phase === "decay") {
          // Strict linear fall from wherever we switched.
          const p = Math.min(1, tInPhase / cfg.decayDurationS);
          current = switchCurrent * (1 - p);

          if (p >= 1) {
            const finalSample: ReactorSample = {
              time: elapsed,
              current: 0,
              voltage: round(cfg.nominalVoltage, 2),
              phase: "decay",
            };
            handler({ sample: finalSample, phase: "decay" });
            handler({ phase: "completed" });
            clearInterval(id);
            return;
          }
        }

        const sample: ReactorSample = {
          time: elapsed,
          current: round(current, 3),
          voltage: round(cfg.nominalVoltage + (Math.random() - 0.5) * 1.2, 2),
          phase: phase as ReactorSample["phase"],
        };

        handler({ sample, phase });
      }, cfg.tickMs);

      return () => clearInterval(id);
    },
  };
}

const round = (v: number, d: number) => Number(v.toFixed(d));
