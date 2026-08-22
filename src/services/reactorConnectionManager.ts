import type { RawPoint, ReactorPhase, InterlockStatus } from "@/types/sample";
import { createSignalRSource, type HardwareSource } from "@/services/signalRSource";
import { subscribeSettings, getSettings, type AppSettings } from "@/services/settings";

const HUB_URL = "https://localhost:7115/hubs/linearity";

export type SourceEvent = {
  interlock?: InterlockStatus;
  reset?: boolean;
  batch: RawPoint[];
  phase?: ReactorPhase;
  finalPeak?: number;
  abortReason?: string;
  hardwareFault?: string;
  hardwareRecovered?: boolean;
};

type EventListener = (e: SourceEvent) => void;
type ConnectedListener = (connected: boolean) => void;

let source: HardwareSource | null = null;
let unsubSource: (() => void) | null = null;
let connected = false;

const eventListeners = new Set<EventListener>();
const connectedListeners = new Set<ConnectedListener>();

function notifyConnected(v: boolean) {
  connected = v;
  connectedListeners.forEach((l) => l(v));
}

function startConnection() {
  if (source) return;

  source = createSignalRSource({ hubUrl: HUB_URL });
  unsubSource = source.subscribe((e) => {
    eventListeners.forEach((l) => l(e as SourceEvent));
  });

  source
    .connect()
    .then(() => notifyConnected(true))
    .catch(() => notifyConnected(false));
}

function stopConnection() {
  unsubSource?.();
  unsubSource = null;
  source?.disconnect();
  source = null;
  if (connected) notifyConnected(false);
}

function applyDataSource(dataSource: AppSettings["dataSource"]) {
  if (dataSource === "live") {
    startConnection();
  } else {
    stopConnection();
  }
}

if (typeof window !== "undefined") {
  applyDataSource(getSettings().dataSource);
  subscribeSettings((s) => applyDataSource(s.dataSource));
}

export function subscribeReactorEvents(l: EventListener): () => void {
  eventListeners.add(l);
  return () => eventListeners.delete(l);
}

export function subscribeReactorConnected(l: ConnectedListener): () => void {
  connectedListeners.add(l);
  l(connected);
  return () => connectedListeners.delete(l);
}

export function isReactorConnected(): boolean {
  return connected;
}