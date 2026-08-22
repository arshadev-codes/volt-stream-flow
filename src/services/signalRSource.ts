import * as signalR from "@microsoft/signalr";
import type { RawPoint, InterlockStatus } from "@/types/sample";

export type ReactorPhaseRuntime = "idle" | "ramp_up" | "decay" | "completed";

export interface SourceEvent {
  batch: (RawPoint & { peak?: number })[];
  phase: ReactorPhaseRuntime;
  reset?: boolean;
  finalPeak?: number;
  /** Why the backend aborted the test ("ACB_TRIP" / "DC_TRIP"). Previously
   *  this was received from the backend and silently dropped — now it's
   *  forwarded alongside finalPeak on the completed event. */
  abortReason?: string;
  /** Set when the backend's DAQ acquisition loop faults (e.g. USB
   *  unplugged mid-test) — a plain-language reason for display. */
  hardwareFault?: string;
  /** True on the event that follows a fault once acquisition recovers. */
  hardwareRecovered?: boolean;
  interlock?: InterlockStatus;
}

export type ReactorHandler = (event: SourceEvent) => void;

export interface ReactorSource {
  subscribe(handler: ReactorHandler): () => void;
  triggerDecay(): void;
}

export interface HardwareSource extends ReactorSource {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface SignalRSourceConfig {
  hubUrl: string;
}

export function createSignalRSource(config: SignalRSourceConfig): HardwareSource {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(config.hubUrl)
    .withAutomaticReconnect()
    .build();

  let phase: ReactorPhaseRuntime = "ramp_up";

  return {
    async connect() {
      if (connection.state === signalR.HubConnectionState.Disconnected) {
        await connection.start();
      }
    },
    async disconnect() {
      await connection.stop();
    },
    triggerDecay() {},
    subscribe(handler: ReactorHandler) {
      let batchBuffer: (RawPoint & { peak?: number })[] = [];
      let flushHandle = 0;

      const flush = () => {
        if (batchBuffer.length > 0) {
          handler({ batch: batchBuffer, phase });
          batchBuffer = [];
        }
        flushHandle = requestAnimationFrame(flush);
      };

      connection.on(
        "DataPoint",
        (point: { time: number; voltage: number; current: number; peak: number }) => {
          batchBuffer.push({
            timestamp: point.time * 1000,
            voltage: point.voltage,
            current: point.current,
            phase: 0,
            peak: point.peak,
          });
        }
      );

      connection.on("TestStarted", () => {
        phase = "ramp_up";
        handler({ batch: [], phase: "ramp_up", reset: true });
      });

      connection.on("TestStopped", (payload: { peak: number }) => {
        phase = "completed";
        handler({ batch: [], phase: "completed", finalPeak: payload?.peak });
      });

      connection.on("TestAborted", (payload: { peak: number; reason: string }) => {
        phase = "completed";
        handler({
          batch: [],
          phase: "completed",
          finalPeak: payload?.peak,
          abortReason: payload?.reason,
        });
      });

      connection.on("InterlockStatus", (status: InterlockStatus) => {
        handler({ batch: [], phase, interlock: status });
      });

      connection.on("HardwareFault", (payload: { message?: string }) => {
        handler({ batch: [], phase, hardwareFault: payload?.message ?? "Hardware connection lost." });
      });

      connection.on("HardwareRecovered", () => {
        handler({ batch: [], phase, hardwareRecovered: true });
      });

      flushHandle = requestAnimationFrame(flush);

      return () => {
        cancelAnimationFrame(flushHandle);
        connection.off("DataPoint");
        connection.off("TestStarted");
        connection.off("TestStopped");
        connection.off("TestAborted");
        connection.off("InterlockStatus");
        connection.off("HardwareFault");
        connection.off("HardwareRecovered");
      };
    },
  };
}