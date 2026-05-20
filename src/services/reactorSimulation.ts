import type { ReactorSample } from "@/types/sample";

/**
 * Reactor linearity simulation engine.
 *
 * Models IEC 60076-6 B.7.2 DC charge / discharge behavior:
 *   - Charge phase: I(t) = Ipeak * (1 - exp(-t / τc))  → fast rise toward peak
 *   - Discharge:    I(t) = Iswitch * exp(-t / τd)      → exponential decay
 *
 * No peak hold — the moment charging completes (or Stop is pressed) we
 * transition straight into exponential decay. Streams in real time.
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
  peakCurrent?: number;     // A
  chargeDurationS?: number; // total time allowed for charging
  chargeTauS?: number;      // charge time-constant (smaller = faster rise)
  decayTauS?: number;       // discharge time-constant
  decayCutoffRatio?: number;// stop when current < ratio * Iswitch
  nominalVoltage?: number;
}

const DEFAULTS: Required<ReactorConfig> = {
  tickMs: 80,
  peakCurrent: 100,
  chargeDurationS: 3,
  chargeTauS: 0.7,
  decayTauS: 2.2,
  decayCutoffRatio: 0.01,
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
      let switchCurrent = 0;

      const id = setInterval(() => {
        elapsed = +(elapsed + tickS).toFixed(3);
        const tInPhase = elapsed - phaseStart;

        let current = 0;

        if (phase === "ramp_up") {
          // Exponential approach to peak — fast initial rise, gentle curl near top.
          current = cfg.peakCurrent * (1 - Math.exp(-tInPhase / cfg.chargeTauS));

          const shouldSwitch = decayRequested || tInPhase >= cfg.chargeDurationS;
          if (shouldSwitch) {
            // Emit the apex sample now, then flip to decay on the next tick.
            switchCurrent = current;
            const apex: ReactorSample = {
              time: elapsed,
              current: round(current, 3),
              voltage: round(cfg.nominalVoltage + (Math.random() - 0.5) * 1.2, 2),
              phase: "ramp_up",
            };
            handler({ sample: apex, phase: "ramp_up" });
            phase = "decay";
            phaseStart = elapsed;
            return;
          }
        } else if (phase === "decay") {
          current = switchCurrent * Math.exp(-tInPhase / cfg.decayTauS);

          if (current <= switchCurrent * cfg.decayCutoffRatio) {
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
