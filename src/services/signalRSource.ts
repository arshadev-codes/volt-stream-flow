import * as signalR from "@microsoft/signalr";
import type { RawPoint, InterlockStatus } from "@/types/sample";
import type { ReactorHandler, ReactorPhaseRuntime, ReactorSource } from "./reactorSimulation";

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
        handler({ batch: [], phase: "completed", finalPeak: payload?.peak });
      });

      connection.on("InterlockStatus", (status: InterlockStatus) => {
        // Interlock updates are infrequent (only sent on change) and are
        // safety-relevant, so we push them straight through rather than
        // waiting for the next animation-frame batch flush.
        handler({ batch: [], phase, interlock: status });
      });

      flushHandle = requestAnimationFrame(flush);

      return () => {
        cancelAnimationFrame(flushHandle);
        connection.off("DataPoint");
        connection.off("TestStarted");
        connection.off("TestStopped");
        connection.off("TestAborted");
        connection.off("InterlockStatus");
      };
    },
  };
}