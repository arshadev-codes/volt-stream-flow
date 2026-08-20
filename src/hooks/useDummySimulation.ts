import { useEffect, useRef, useState } from "react";
import { generateExponentialData } from "@/utils/generateTestData";
import type { RawPoint } from "@/types/sample";

export function useDummySimulation() {
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState<RawPoint[]>([]);
  const [resistance, setResistance] = useState(0.05);
  const [duration, setDuration] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  const start = () => {
    setPoints(generateExponentialData({ peak: 368.92 }));
    startedAtRef.current = Date.now();
    setDuration(0);
    setActive(true);
  };

  const stop = () => {
    if (startedAtRef.current) {
      setDuration((Date.now() - startedAtRef.current) / 1000);
    }
    setActive(false);
    // NOTE: points intentionally NOT cleared here — "Save Simulation"
    // needs sim.points to still exist after Stop is clicked.
  };

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (startedAtRef.current) {
        setDuration((Date.now() - startedAtRef.current) / 1000);
      }
    }, 200);
    return () => clearInterval(id);
  }, [active]);

  const peak = points.length ? Math.max(...points.map((p) => p.current), 0) : 0;

  return { active, points, resistance, setResistance, duration, start, stop, peak };
}