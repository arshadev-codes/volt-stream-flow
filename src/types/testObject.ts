import type { RawPoint } from "./sample";

export const TestStatus = {
  Pending: "pending",
  Passed: "passed",
  Failed: "failed",
} as const;
export type TestStatus = typeof TestStatus[keyof typeof TestStatus];

export interface TestObject {
  id: string;
  serialNumber: string;
  name: string;
  manufacturer?: string;

  /** Job context */
  projectName: string;
  customerName: string;
  workOrder: string;

  ratedVoltage: number;
  maxVoltage: number;
  ratedCurrent: number;
  peakCurrent: number;
  frequency?: number;
  inductance?: number;
  notes?: string;

  createdAt: number;
  status: TestStatus;
}

export interface TestReport {
  objectId: string;
  status: Exclude<TestStatus, "pending">;
  /** Serialized JSON array as captured by the acquisition loop (0.25 ms cadence). */
  rawResult: RawPoint[];
  /** Median-of-4 downsampled dataset (1 ms cadence) computed after completion. */
  analysisResult: RawPoint[];
  peakCurrent: number;
  durationS: number;
  completedAt: number;
}
