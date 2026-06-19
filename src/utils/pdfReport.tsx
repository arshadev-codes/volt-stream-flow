import { pdf, Document, Page, Text, View, StyleSheet, Svg, Path, Line, Rect, G } from "@react-pdf/renderer";
import type { TestObject, TestReport } from "@/types/testObject";
import type { RawPoint } from "@/types/sample";

/**
 * High-fidelity vector PDF report. Charts are drawn as native SVG inside
 * the PDF so output is sharp at any print resolution.
 */
export async function exportReportPdf(object: TestObject, report: TestReport) {
  const blob = await pdf(<ReportDocument object={object} report={report} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Report_${object.serialNumber}_${report.status}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ----------------- Theme ----------------- */

const C = {
  amber: "#F59E0B",
  amberDark: "#B45309",
  ink: "#0B1220",
  ink2: "#1E293B",
  ink3: "#334155",
  mute: "#64748B",
  line: "#E2E8F0",
  soft: "#F1F5F9",
  bg: "#F8FAFC",
  white: "#FFFFFF",
  ok: "#16A34A",
  okSoft: "#DCFCE7",
  fail: "#DC2626",
  failSoft: "#FEE2E2",
  current: "#EA580C",
  voltage: "#0EA5E9",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 92,
    paddingBottom: 64,
    paddingHorizontal: 44,
    fontSize: 10,
    color: C.ink,
    fontFamily: "Helvetica",
    backgroundColor: C.white,
  },

  // Header band
  band: {
    position: "absolute", top: 0, left: 0, right: 0, height: 70,
    backgroundColor: C.ink, paddingHorizontal: 44, paddingTop: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  bandAccent: {
    position: "absolute", top: 70, left: 0, right: 0, height: 4,
    backgroundColor: C.amber,
  },
  brandMark: {
    width: 28, height: 28, borderRadius: 4, backgroundColor: C.amber,
    alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  brand: { color: C.white, fontSize: 13, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
  brandSub: { color: C.amber, fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 3, marginTop: 2 },

  // Footer
  footer: {
    position: "absolute", left: 44, right: 44, bottom: 28,
    borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8,
    color: C.mute, fontSize: 8,
    flexDirection: "row", justifyContent: "space-between",
  },

  // Type
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 2, letterSpacing: 0.5 },
  h2: {
    fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ink,
    textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, marginTop: 18,
  },
  h2Bar: { width: 22, height: 3, backgroundColor: C.amber, marginBottom: 6, marginTop: 18 },

  row: { flexDirection: "row" },

  // Hero
  hero: {
    borderWidth: 1, borderColor: C.line, borderRadius: 6,
    backgroundColor: C.bg, padding: 14, marginBottom: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  heroLeftAccent: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
    backgroundColor: C.amber, borderTopLeftRadius: 6, borderBottomLeftRadius: 6,
  },
  eyebrow: { fontSize: 7, color: C.mute, fontFamily: "Helvetica-Bold", letterSpacing: 2.5 },

  // Stat cards
  statCard: {
    flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 4,
    backgroundColor: C.white, padding: 10, overflow: "hidden",
  },
  statTop: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  statLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.mute, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4, marginTop: 2 },
  statValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.ink },

  // Key-Value blocks
  kvCard: {
    borderWidth: 1, borderColor: C.line, borderRadius: 4,
    backgroundColor: C.white, padding: 10,
  },
  kvRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.line },
  kvRowLast: { flexDirection: "row", paddingVertical: 4 },
  kvLabel: { width: 110, color: C.mute, fontFamily: "Helvetica", fontSize: 9 },
  kvValue: { flex: 1, color: C.ink, fontFamily: "Helvetica-Bold", fontSize: 9 },

  // Badge
  badge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 3,
    fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 1.5,
  },
});

/* ----------------- Document ----------------- */

function ReportDocument({ object, report }: { object: TestObject; report: TestReport }) {
  const generated = new Date().toLocaleString();
  const completed = new Date(report.completedAt).toLocaleString();
  const created = new Date(object.createdAt).toLocaleString();
  const statusColor = report.status === "passed" ? C.ok : C.fail;
  const statusSoft = report.status === "passed" ? C.okSoft : C.failSoft;
  const hasRaw = report.rawResult.length > 0;

  return (
    <Document title={`Reactor Test Report — ${object.serialNumber}`} author="Electrosoft Automation">
      <Page size="A4" style={s.page} wrap>
        <Header />
        <Footer generated={generated} object={object} />

        {/* HERO */}
        <View style={s.hero}>
          <View style={s.heroLeftAccent} />
          <View style={{ flex: 1, paddingLeft: 8 }}>
            <Text style={s.eyebrow}>REACTOR LINEARITY TEST REPORT</Text>
            <Text style={[s.h1, { marginTop: 4 }]}>{object.serialNumber}</Text>
            <Text style={{ fontSize: 11, color: C.ink3, fontFamily: "Helvetica-Bold", marginTop: 1 }}>
              {object.name}
            </Text>
            <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
              <Text style={{ fontSize: 8, color: C.mute }}>
                <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink3 }}>Test conducted  </Text>
                {completed}
              </Text>
              <Text style={{ fontSize: 8, color: C.mute }}>
                <Text style={{ fontFamily: "Helvetica-Bold", color: C.ink3 }}>Object created  </Text>
                {created}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={[s.badge, { backgroundColor: statusColor, color: C.white, marginBottom: 6 }]}>
              <Text>{report.status.toUpperCase()}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: statusSoft, color: statusColor }]}>
              <Text>{hasRaw ? "RAW + ANALYSIS" : "ANALYSIS ONLY"}</Text>
            </View>
            <Text style={{ fontSize: 7, color: C.mute, marginTop: 6 }}>
              ID · {object.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* STATS */}
        <View style={[s.row, { gap: 8 }]}>
          <Stat label="Peak Current" value={`${report.peakCurrent.toFixed(2)} A`} color={C.current} />
          <Stat label="Duration" value={`${report.durationS.toFixed(2)} s`} color={C.amber} />
          <Stat label="Raw Samples" value={hasRaw ? formatNum(report.rawResult.length) : "—"} color={C.ink2} />
          <Stat label="Analysis Pts" value={formatNum(report.analysisResult.length)} color={C.voltage} />
        </View>

        {/* PROJECT */}
        <SectionTitle>Project & Customer</SectionTitle>
        <View style={[s.row, { gap: 10 }]}>
          <View style={[s.kvCard, { flex: 1 }]}>
            <KV k="Project" v={object.projectName || "—"} />
            <KV k="Customer" v={object.customerName || "—"} />
            <KV k="Work Order" v={object.workOrder || "—"} last />
          </View>
          <View style={[s.kvCard, { flex: 1 }]}>
            <KV k="Manufacturer" v={object.manufacturer || "—"} />
            <KV k="Serial Number" v={object.serialNumber} />
            <KV k="Object Name" v={object.name} last />
          </View>
        </View>

        {/* RATINGS */}
        <SectionTitle>Electrical Ratings</SectionTitle>
        <View style={[s.row, { gap: 10 }]}>
          <View style={[s.kvCard, { flex: 1 }]}>
            <KV k="Rated Voltage" v={`${object.ratedVoltage} V`} />
            <KV k="Max Voltage" v={`${object.maxVoltage} V`} />
            <KV k="Frequency" v={object.frequency ? `${object.frequency} Hz` : "—"} last />
          </View>
          <View style={[s.kvCard, { flex: 1 }]}>
            <KV k="Rated Current" v={`${object.ratedCurrent} A`} />
            <KV k="Peak Current" v={`${object.peakCurrent} A`} />
            <KV k="Inductance" v={object.inductance ? `${object.inductance} mH` : "—"} last />
          </View>
        </View>

        {/* CHART */}
        <SectionTitle>Analysis Curve — 1 ms median filtered</SectionTitle>
        <ChartCard points={report.analysisResult.length ? report.analysisResult : report.rawResult} peak={report.peakCurrent} />

        {object.notes && (
          <>
            <SectionTitle>Notes</SectionTitle>
            <View style={s.kvCard}>
              <Text style={{ fontSize: 10, color: C.ink2, lineHeight: 1.5 }}>{object.notes}</Text>
            </View>
          </>
        )}
      </Page>

      {hasRaw && (
        <Page size="A4" style={s.page} wrap>
          <Header />
          <Footer generated={generated} object={object} />

          <View style={s.hero}>
            <View style={s.heroLeftAccent} />
            <View style={{ flex: 1, paddingLeft: 8 }}>
              <Text style={s.eyebrow}>RAW ACQUISITION DATA</Text>
              <Text style={[s.h1, { marginTop: 4 }]}>0.25 ms Cadence</Text>
              <Text style={{ fontSize: 9, color: C.mute, marginTop: 2 }}>
                {formatNum(report.rawResult.length)} samples (downsampled for plot)
              </Text>
            </View>
          </View>

          <ChartCard points={report.rawResult} peak={report.peakCurrent} />

          <SectionTitle>Analysis Sample · first 30 of {report.analysisResult.length}</SectionTitle>
          <SampleTable points={report.analysisResult.slice(0, 30)} />
        </Page>
      )}
    </Document>
  );
}

/* ----------------- Pieces ----------------- */

function Header() {
  return (
    <View fixed>
      <View style={s.band}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={s.brandMark}>
            <Text style={{ color: C.ink, fontSize: 14, fontFamily: "Helvetica-Bold" }}>E</Text>
          </View>
          <View>
            <Text style={s.brand}>ELECTROSOFT AUTOMATION</Text>
            <Text style={s.brandSub}>REACTOR LINEARITY TESTING SYSTEM</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: C.amber, fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 2 }}>CONFIDENTIAL</Text>
          <Text style={{ color: "#94A3B8", fontSize: 7, marginTop: 2 }}>Reactor Test Report</Text>
        </View>
      </View>
      <View style={s.bandAccent} />
    </View>
  );
}

function Footer({ generated, object }: { generated: string; object: TestObject }) {
  return (
    <View style={s.footer} fixed>
      <Text>Electrosoft Automation · {object.serialNumber} · Generated {generated}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <View>
      <View style={s.h2Bar} />
      <Text style={[s.h2, { marginTop: 0 }]}>{children}</Text>
    </View>
  );
}

function KV({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <View style={last ? s.kvRowLast : s.kvRow}>
      <Text style={s.kvLabel}>{k}</Text>
      <Text style={s.kvValue}>{v}</Text>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statTop, { backgroundColor: color }]} />
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function SampleTable({ points }: { points: RawPoint[] }) {
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 4, overflow: "hidden" }}>
      <View style={[s.row, { backgroundColor: C.ink, padding: 7 }]}>
        <Text style={{ flex: 1, fontFamily: "Helvetica-Bold", color: C.white, fontSize: 8, letterSpacing: 1 }}>t (ms)</Text>
        <Text style={{ flex: 1, fontFamily: "Helvetica-Bold", color: C.white, fontSize: 8, letterSpacing: 1 }}>V (V)</Text>
        <Text style={{ flex: 1, fontFamily: "Helvetica-Bold", color: C.white, fontSize: 8, letterSpacing: 1 }}>I (A)</Text>
        <Text style={{ flex: 1, fontFamily: "Helvetica-Bold", color: C.white, fontSize: 8, letterSpacing: 1 }}>Phase (rad)</Text>
      </View>
      {points.map((p, i) => (
        <View key={i} style={[s.row, { padding: 5, backgroundColor: i % 2 ? C.bg : C.white }]}>
          <Text style={{ flex: 1, fontSize: 8, color: C.ink2 }}>{p.timestamp.toFixed(2)}</Text>
          <Text style={{ flex: 1, fontSize: 8, color: C.ink2 }}>{p.voltage.toFixed(2)}</Text>
          <Text style={{ flex: 1, fontSize: 8, color: C.ink2 }}>{p.current.toFixed(3)}</Text>
          <Text style={{ flex: 1, fontSize: 8, color: C.ink2 }}>{p.phase.toFixed(3)}</Text>
        </View>
      ))}
    </View>
  );
}

function formatNum(n: number) {
  return n.toLocaleString();
}

/* ----------------- Vector chart ----------------- */

const CHART_W = 515;
const CHART_H = 260;
const PAD = { l: 46, r: 46, t: 18, b: 36 };

function ChartCard({ points, peak }: { points: RawPoint[]; peak: number }) {
  if (points.length < 2) {
    return (
      <View style={[s.kvCard, { height: CHART_H, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: C.mute }}>No data captured.</Text>
      </View>
    );
  }

  // Downsample so the SVG path is manageable even for 20k+ raw points.
  const target = 500;
  const stride = Math.max(1, Math.ceil(points.length / target));
  const slim: RawPoint[] = [];
  for (let i = 0; i < points.length; i += stride) slim.push(points[i]);
  if (slim[slim.length - 1] !== points[points.length - 1]) slim.push(points[points.length - 1]);

  const tMax = slim[slim.length - 1].timestamp || 1;
  const tMin = slim[0].timestamp || 0;
  const iMax = Math.max(...slim.map((p) => p.current), 0.01) * 1.05;
  const vMin = Math.min(...slim.map((p) => p.voltage));
  const vMax = Math.max(...slim.map((p) => p.voltage));
  const vRange = (vMax - vMin) * 1.1 || 1;
  const vLow = vMin - (vMax - vMin) * 0.05;

  const innerW = CHART_W - PAD.l - PAD.r;
  const innerH = CHART_H - PAD.t - PAD.b;
  const sx = (t: number) => PAD.l + ((t - tMin) / (tMax - tMin || 1)) * innerW;
  const syI = (i: number) => PAD.t + innerH - (i / iMax) * innerH;
  const syV = (v: number) => PAD.t + innerH - ((v - vLow) / vRange) * innerH;

  const linePath = (ys: (p: RawPoint) => number) =>
    slim.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.timestamp).toFixed(1)},${ys(p).toFixed(1)}`).join(" ");
  // Area fill under the current curve
  const areaPath =
    `M${sx(slim[0].timestamp).toFixed(1)},${(PAD.t + innerH).toFixed(1)} ` +
    slim.map((p) => `L${sx(p.timestamp).toFixed(1)},${syI(p.current).toFixed(1)}`).join(" ") +
    ` L${sx(slim[slim.length - 1].timestamp).toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;

  const yTicks = 5;
  const xTicks = 6;
  const yIVals = Array.from({ length: yTicks + 1 }, (_, i) => (iMax * (yTicks - i)) / yTicks);
  const yVVals = Array.from({ length: yTicks + 1 }, (_, i) => vLow + (vRange * (yTicks - i)) / yTicks);
  const xVals = Array.from({ length: xTicks + 1 }, (_, i) => tMin + ((tMax - tMin) * i) / xTicks);

  const peakY = peak > 0 && peak <= iMax ? syI(peak) : null;

  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 6, backgroundColor: C.white, padding: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: C.mute, letterSpacing: 1.5 }}>
          VOLTAGE · CURRENT vs TIME
        </Text>
        <View style={[s.row, { gap: 12 }]}>
          <LegendItem color={C.current} label="Current (A)" />
          <LegendItem color={C.voltage} label="Voltage (V)" dashed />
          {peakY !== null && <LegendItem color={C.amber} label={`Peak ${peak.toFixed(2)} A`} dashed />}
        </View>
      </View>

      <Svg width={CHART_W} height={CHART_H}>
        {/* Plot background */}
        <Rect x={PAD.l} y={PAD.t} width={innerW} height={innerH} fill={C.bg} stroke={C.line} strokeWidth={0.5} />

        {/* Y grid + left labels (current) */}
        {yIVals.map((v, i) => {
          const y = PAD.t + (innerH * i) / yTicks;
          return (
            <G key={`yi${i}`}>
              <Line x1={PAD.l} y1={y} x2={PAD.l + innerW} y2={y} stroke={C.line} strokeWidth={0.4} strokeDasharray="2,2" />
            </G>
          );
        })}
        {/* X grid */}
        {xVals.map((_, i) => {
          const x = PAD.l + (innerW * i) / xTicks;
          return (
            <Line key={`xg${i}`} x1={x} y1={PAD.t} x2={x} y2={PAD.t + innerH} stroke={C.line} strokeWidth={0.4} strokeDasharray="2,2" />
          );
        })}

        {/* Voltage line (dashed, behind) */}
        <Path d={linePath((p) => syV(p.voltage))} stroke={C.voltage} strokeWidth={0.9} strokeDasharray="3,2" fill="none" />

        {/* Current area + line */}
        <Path d={areaPath} fill={C.current} fillOpacity={0.12} />
        <Path d={linePath((p) => syI(p.current))} stroke={C.current} strokeWidth={1.6} fill="none" />

        {/* Peak reference */}
        {peakY !== null && (
          <Line x1={PAD.l} y1={peakY} x2={PAD.l + innerW} y2={peakY} stroke={C.amber} strokeWidth={0.8} strokeDasharray="4,3" />
        )}

        {/* Axes */}
        <Line x1={PAD.l} y1={PAD.t + innerH} x2={PAD.l + innerW} y2={PAD.t + innerH} stroke={C.ink2} strokeWidth={0.8} />
        <Line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + innerH} stroke={C.ink2} strokeWidth={0.8} />
        <Line x1={PAD.l + innerW} y1={PAD.t} x2={PAD.l + innerW} y2={PAD.t + innerH} stroke={C.ink2} strokeWidth={0.8} />
      </Svg>

      {/* Left Y labels (current) */}
      {yIVals.map((v, i) => {
        const y = PAD.t + (innerH * i) / yTicks - 4;
        return (
          <Text key={`yl${i}`} style={{ position: "absolute", left: 6, top: y + 10, fontSize: 6.5, color: C.current, width: PAD.l - 8, textAlign: "right" }}>
            {v.toFixed(1)}
          </Text>
        );
      })}
      {/* Right Y labels (voltage) */}
      {yVVals.map((v, i) => {
        const y = PAD.t + (innerH * i) / yTicks - 4;
        return (
          <Text key={`yr${i}`} style={{ position: "absolute", right: 6, top: y + 10, fontSize: 6.5, color: C.voltage, width: PAD.r - 8, textAlign: "left" }}>
            {v.toFixed(0)}
          </Text>
        );
      })}
      {/* X labels */}
      {xVals.map((v, i) => {
        const x = PAD.l + (innerW * i) / xTicks - 12;
        return (
          <Text key={`xl${i}`} style={{ position: "absolute", left: x + 10, top: PAD.t + innerH + 14, fontSize: 6.5, color: C.mute, width: 30, textAlign: "center" }}>
            {v < 1000 ? `${v.toFixed(0)} ms` : `${(v / 1000).toFixed(2)} s`}
          </Text>
        );
      })}
      {/* Axis titles */}
      <Text style={{ position: "absolute", left: PAD.l, top: PAD.t + innerH + 24, fontSize: 7, color: C.current, fontFamily: "Helvetica-Bold", letterSpacing: 1 }}>
        ◀ CURRENT (A)
      </Text>
      <Text style={{ position: "absolute", right: PAD.r, top: PAD.t + innerH + 24, fontSize: 7, color: C.voltage, fontFamily: "Helvetica-Bold", letterSpacing: 1, textAlign: "right" }}>
        VOLTAGE (V) ▶
      </Text>
      <Text style={{ textAlign: "center", marginTop: 2, fontSize: 7, color: C.mute, fontFamily: "Helvetica-Bold", letterSpacing: 1.5 }}>
        TIME
      </Text>
    </View>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={[s.row, { alignItems: "center", gap: 4 }]}>
      <View style={{ width: 14, height: 2, backgroundColor: color, opacity: dashed ? 0.7 : 1 }} />
      <Text style={{ fontSize: 7, color: C.ink3, fontFamily: "Helvetica-Bold" }}>{label}</Text>
    </View>
  );
}
