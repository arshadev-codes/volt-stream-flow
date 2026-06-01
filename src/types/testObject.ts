import type { ReactorSample } from "./sample";

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
  ratedVoltage: number;      // V
  maxVoltage: number;        // V
  ratedCurrent: number;      // A
  peakCurrent: number;       // A
  frequency?: number;        // Hz
  inductance?: number;       // mH
  notes?: string;
  createdAt: number;
  status: TestStatus;
}

export interface TestReport {
  objectId: string;
  status: Exclude<TestStatus, "pending">;
  samples: ReactorSample[];
  peakCurrent: number;
  durationS: number;
  completedAt: number;
}
