import type { RawPoint } from "@/types/sample";

/**
 * Reactor linearity simulation — emits RawPoint samples at a 0.25 ms
 * simulated cadence batched per animation frame so the UI can render in
 * real-time without blocking. Replace `createReactorSource` with a
 * WebSocket/Modbus/REST stream when wiring to real hardware.
 *
 * Charge phase: I(t) = Ipeak * (1 - exp(-t / τc))
 * Decay phase:  I(t) = Iswitch * exp(-t / τd)
 */

export type ReactorPhaseRuntime = "ramp_up" | "decay" | "completed";

export interface ReactorEvent {
  /** Newly produced raw samples for this frame (empty if none). */
  batch: RawPoint[];
  phase: ReactorPhaseRuntime;
}

export type ReactorHandler = (e: ReactorEvent) => void;

export interface ReactorSource {
  subscribe(handler: ReactorHandler): () => void;
  triggerDecay(): void;
}

export interface ReactorConfig {
  sampleIntervalMs?: number; // simulated cadence (default 0.25 ms)
  peakCurrent?: number;      // A
  chargeDurationS?: number;
  chargeTauS?: number;
  decayTauS?: number;
  decayCutoffRatio?: number;
  nominalVoltage?: number;
  /** Real-time playback factor (1.0 = real time). */
  speed?: number;
}

const DEFAULTS: Required<ReactorConfig> = {
  sampleIntervalMs: 0.25,
  peakCurrent: 100,
  chargeDurationS: 2.5,
  chargeTauS: 0.55,
  decayTauS: 1.8,
  decayCutoffRatio: 0.01,
  nominalVoltage: 230,
  speed: 1,
};

export function createReactorSource(config: ReactorConfig = {}): ReactorSource {
  const cfg = { ...DEFAULTS, ...config };
  let decayRequested = false;

  return {
    triggerDecay() { decayRequested = true; },
    subscribe(handler) {
      let rafId = 0;
      let stopped = false;
      let phase: ReactorPhaseRuntime = "ramp_up";
      let simTimeMs = 0;        // simulated elapsed time
      let phaseStartMs = 0;
      let switchCurrent = 0;
      let wallStart = performance.now();

      const stepMs = cfg.sampleIntervalMs;

      const tick = () => {
        if (stopped) return;
        const wallNow = performance.now();
        const targetSimMs = (wallNow - wallStart) * cfg.speed;
        const batch: RawPoint[] = [];

        // Generate all samples whose timestamp <= targetSimMs.
        // Hard cap per frame to keep UI responsive on slow machines.
        let safety = 0;
        const MAX_PER_FRAME = 800;

        while (simTimeMs + stepMs <= targetSimMs && safety++ < MAX_PER_FRAME && phase !== "completed") {
          simTimeMs = +(simTimeMs + stepMs).toFixed(4);
          const tInPhaseS = (simTimeMs - phaseStartMs) / 1000;

          let current = 0;
          let phaseAngle = 0;

          if (phase === "ramp_up") {
            current = cfg.peakCurrent * (1 - Math.exp(-tInPhaseS / cfg.chargeTauS));
            // Phase angle (radians) — saturation increases inductive lag slightly.
            const saturation = current / cfg.peakCurrent;
            phaseAngle = 0.08 + saturation * 0.18 + (Math.random() - 0.5) * 0.004;

            const switchNow = decayRequested || tInPhaseS >= cfg.chargeDurationS;
            if (switchNow) {
              switchCurrent = current;
              batch.push(makePoint(simTimeMs, current, cfg.nominalVoltage, phaseAngle));
              phase = "decay";
              phaseStartMs = simTimeMs;
              continue;
            }
          } else if (phase === "decay") {
            current = switchCurrent * Math.exp(-tInPhaseS / cfg.decayTauS);
            phaseAngle = 0.26 - (1 - current / Math.max(switchCurrent, 1e-6)) * 0.12 + (Math.random() - 0.5) * 0.004;

            if (current <= switchCurrent * cfg.decayCutoffRatio) {
              batch.push(makePoint(simTimeMs, 0, cfg.nominalVoltage, 0));
              handler({ batch, phase: "decay" });
              handler({ batch: [], phase: "completed" });
              stopped = true;
              return;
            }
          }

          batch.push(makePoint(simTimeMs, current, cfg.nominalVoltage, phaseAngle));
        }

        if (batch.length) handler({ batch, phase });
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);

      return () => {
        stopped = true;
        cancelAnimationFrame(rafId);
      };
    },
  };
}

function makePoint(timestampMs: number, current: number, vNominal: number, phaseAngle: number): RawPoint {
  // Industrial signals are noisy — small jitter on V & I.
  const vNoise = (Math.random() - 0.5) * 1.4;
  const iNoise = (Math.random() - 0.5) * Math.max(0.05, Math.abs(current) * 0.012);
  return {
    timestamp: +timestampMs.toFixed(3),
    voltage: +(vNominal + vNoise).toFixed(3),
    current: +(current + iNoise).toFixed(4),
    phase: +phaseAngle.toFixed(4),
  };
}
