import type { Sample } from "@/types/sample";
import { generateRandomSample } from "@/utils/randomSample";

/**
 * Mock data source. This module is intentionally isolated so it can be
 * swapped for a REST poller or WebSocket stream without touching the UI.
 *
 * Future drop-in replacements should expose the same `subscribe(cb)` contract.
 */

export type SampleHandler = (sample: Sample) => void;
export interface SampleSource {
  subscribe(handler: SampleHandler): () => void;
}

const TICK_MS = 500;
const TICK_S = TICK_MS / 1000;

export function createMockSampleSource(): SampleSource {
  return {
    subscribe(handler) {
      let elapsed = 0;
      let last: Sample | undefined;

      const id = setInterval(() => {
        elapsed = +(elapsed + TICK_S).toFixed(3);
        const next = generateRandomSample(elapsed, last);
        last = next;
        handler(next);
      }, TICK_MS);

      return () => clearInterval(id);
    },
  };
}
