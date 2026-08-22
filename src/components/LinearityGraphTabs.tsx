import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VoltageCurrentGraph } from "@/components/VoltageCurrentGraph";
import { FluxCurveGraph } from "@/components/FluxCurveGraph";
import { FluxTimeGraph } from "@/components/FluxTimeGraph";
import type { CurrentUnit, RawPoint, TimeUnit } from "@/types/sample";
import { createAnalyzedSample } from "@/utils/createAnalyzedSample";
import { computeMagneticCharacteristicPu } from "@/utils/reactorCalcs";

interface Props {
  points: RawPoint[];
  rawPoints?: RawPoint[];
  timeUnit: TimeUnit;
  currentUnit: CurrentUnit;
  peakCurrent: number;
  datasetLabel?: string;
  resistance?: number;
  inductance?: number;
  ratedAcRmsCurrent?: number;
  showVoltage?: boolean;
  showSmoothLine?: boolean;
}

export function LinearityGraphTabs({
  points, rawPoints, timeUnit, currentUnit, peakCurrent, datasetLabel, resistance,
  inductance, ratedAcRmsCurrent, showVoltage, showSmoothLine,
}: Props) {
  const analyzed = useMemo(
    () => createAnalyzedSample(points, resistance ?? 0),
    [points, resistance],
  );

  const puData = useMemo(
    () => computeMagneticCharacteristicPu(analyzed.fluxData, inductance ?? 0, ratedAcRmsCurrent ?? 0),
    [analyzed.fluxData, inductance, ratedAcRmsCurrent],
  );

  // TEMP DEBUG — check browser console (F12): puDataLength should be > 0
  // console.log("[pu debug]", {
  //   inductance,
  //   ratedAcRmsCurrent,
  //   fluxDataLength: analyzed.fluxData.length,
  //   puDataLength: puData.length,
  //   samplePoint: puData[0],
  // });

  const dischargeDisplay = analyzed.rawDisplay.filter((p) => p.timestamp >= 0);

  // Distinguishes "genuinely no raw samples yet" from "samples exist but tau
  // never locked" (step response / sudden change, not a clean RL decay) —
  // the flux graphs need this to show the right empty-state message instead
  // of a misleading "No data captured yet." when data plainly was captured.
  const hasRawSamples = points.length > 0;

  return (
    <Tabs defaultValue="raw" className="w-full">
      <TabsList className="mb-3">
        <TabsTrigger value="raw" className="font-mono text-[11px] uppercase tracking-wider">Raw Waveform</TabsTrigger>
        <TabsTrigger value="raw-log" className="font-mono text-[11px] uppercase tracking-wider">Raw Waveform (Log)</TabsTrigger>
        <TabsTrigger value="flux-time" className="font-mono text-[11px] uppercase tracking-wider">Flux vs Time</TabsTrigger>
        <TabsTrigger value="flux-linear" className="font-mono text-[11px] uppercase tracking-wider">Flux Curve (Linear)</TabsTrigger>
      </TabsList>

      <TabsContent value="raw">
        <VoltageCurrentGraph
          points={analyzed.rawDisplay} rawPoints={rawPoints} timeUnit={timeUnit}
          currentUnit={currentUnit} peakCurrent={peakCurrent} datasetLabel={datasetLabel}
          breakPoint={analyzed.breakPoint}
          showVoltage={showVoltage} showSmoothLine={showSmoothLine}
        />
      </TabsContent>

      <TabsContent value="raw-log">
        <VoltageCurrentGraph
          points={dischargeDisplay} rawPoints={dischargeDisplay} timeUnit={timeUnit}
          currentUnit={currentUnit} peakCurrent={peakCurrent} datasetLabel={datasetLabel}
          yScale="log" breakPoint={analyzed.breakPoint}
          showVoltage={showVoltage} showSmoothLine={showSmoothLine}
        />
      </TabsContent>

      <TabsContent value="flux-time">
        <FluxTimeGraph
          fluxData={analyzed.fluxData} timeUnit={timeUnit} resistance={resistance}
          tau={analyzed.tau} hasRawSamples={hasRawSamples}
        />
      </TabsContent>

      <TabsContent value="flux-linear">
        <FluxCurveGraph
          fluxData={analyzed.fluxData} currentUnit={currentUnit} resistance={resistance}
          scale="linear" puData={puData}
          tau={analyzed.tau} hasRawSamples={hasRawSamples}
        />
      </TabsContent>
    </Tabs>
  );
}