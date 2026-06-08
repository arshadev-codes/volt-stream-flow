import { pdf, Document, Page, Text, View, StyleSheet, Svg, Path, Line, Rect } from "@react-pdf/renderer";
import type { TestObject, TestReport } from "@/types/testObject";
import type { RawPoint } from "@/types/sample";

/**
 * High-fidelity vector PDF report. Charts are drawn as native SVG inside
 * the PDF so output is sharp at any print resolution — no rasterized
 * screenshots. Output is paginated with consistent margins.
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

/* ----------------- Styles ----------------- */

const C = {
  amber: "#F59E0B",
  ink: "#0F172A",
  ink2: "#334155",
  mute: "#64748B",
  line: "#E2E8F0",
  bg: "#F8FAFC",
  ok: "#16A34A",
  fail: "#DC2626",
  current: "#EA580C",
  voltage: "#0EA5E9",
};

const s = StyleSheet.create({
  page: { paddingTop: 64, paddingBottom: 56, paddingHorizontal: 40, fontSize: 10, color: C.ink, fontFamily: "Helvetica" },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: 44, backgroundColor: C.ink, paddingHorizontal: 40, justifyContent: "center" },
  brand: { color: "#FFF", fontSize: 14, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
  brandSub: { color: C.amber, fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 3, marginTop: 2 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 24, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, color: C.mute, fontSize: 8, flexDirection: "row", justifyContent: "space-between" },

  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.ink, marginBottom: 2 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 16 },

  row: { flexDirection: "row" },
  hr: { borderBottomWidth: 1, borderBottomColor: C.line, marginVertical: 6 },

  card: { borderWidth: 1, borderColor: C.line, borderRadius: 4, padding: 10, backgroundColor: C.bg },
  cardHeader: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.mute, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  cardBig: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.ink },

  kvRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.line },
  kvLabel: { width: 130, color: C.mute, fontFamily: "Helvetica" },
  kvValue: { flex: 1, color: C.ink, fontFamily: "Helvetica-Bold" },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 3, fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 1 },
});

/* ----------------- Document ----------------- */

function ReportDocument({ object, report }: { object: TestObject; report: TestReport }) {
  const generated = new Date().toLocaleString();
  const completed = new Date(report.completedAt).toLocaleString();
  const created = new Date(object.createdAt).toLocaleString();
  const statusColor = report.status === "passed" ? C.ok : C.fail;
  const hasRaw = report.rawResult.length > 0;

  return (
    <Document title={`Reactor Test Report — ${object.serialNumber}`} author="Electrosoft Automation">
      <Page size="A4" style={s.page} wrap>
        <Header />
        <Footer generated={generated} object={object} />

        {/* HERO */}
        <View style={{ borderLeftWidth: 4, borderLeftColor: C.amber, paddingLeft: 12, marginBottom: 14 }}>
          <Text style={{ fontSize: 8, color: C.mute, fontFamily: "Helvetica-Bold", letterSpacing: 2 }}>
            REACTOR LINEARITY TEST REPORT
          </Text>
          <Text style={s.h1}>{object.serialNumber} · {object.name}</Text>
          <Text style={{ color: C.mute, fontSize: 9, marginTop: 2 }}>
            Test conducted {completed} · Object created {created}
          </Text>
        </View>

        <View style={[s.row, { justifyContent: "space-between", alignItems: "center", marginBottom: 10 }]}>
          <View style={[s.row, { gap: 6 }]}>
            <View style={[s.badge, { backgroundColor: statusColor, color: "#FFF" }]}>
              <Text>{report.status.toUpperCase()}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: C.ink, color: "#FFF" }]}>
              <Text>{hasRaw ? "RAW + ANALYSIS" : "ANALYSIS ONLY"}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 8, color: C.mute }}>Report ID · {object.id.slice(0, 8).toUpperCase()}</Text>
        </View>

        <Text style={s.h2}>Project & Customer</Text>
        <View style={s.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <KV k="Project" v={object.projectName || "—"} />
            <KV k="Customer" v={object.customerName || "—"} />
            <KV k="Work Order" v={object.workOrder || "—"} />
          </View>
          <View style={{ flex: 1 }}>
            <KV k="Manufacturer" v={object.manufacturer || "—"} />
            <KV k="Serial Number" v={object.serialNumber} />
            <KV k="Object Name" v={object.name} />
          </View>
        </View>

        <Text style={s.h2}>Electrical Ratings</Text>
        <View style={s.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <KV k="Rated Voltage" v={`${object.ratedVoltage} V`} />
            <KV k="Max Voltage" v={`${object.maxVoltage} V`} />
            <KV k="Frequency" v={object.frequency ? `${object.frequency} Hz` : "—"} />
          </View>
          <View style={{ flex: 1 }}>
            <KV k="Rated Current" v={`${object.ratedCurrent} A`} />
            <KV k="Peak Current" v={`${object.peakCurrent} A`} />
            <KV k="Inductance" v={object.inductance ? `${object.inductance} mH` : "—"} />
          </View>
        </View>

        <Text style={s.h2}>Test Summary</Text>
        <View style={[s.row, { gap: 8 }]}>
          <Stat label="Peak Current" value={`${report.peakCurrent.toFixed(2)} A`} />
          <Stat label="Duration" value={`${report.durationS.toFixed(2)} s`} />
          <Stat label="Raw Samples" value={hasRaw ? String(report.rawResult.length) : "—"} />
          <Stat label="Analysis Pts" value={String(report.analysisResult.length)} />
        </View>

        <Text style={s.h2}>Analysis Curve (1 ms median filtered)</Text>
        <ChartSvg points={report.analysisResult.length ? report.analysisResult : report.rawResult} />

        {object.notes && (
          <>
            <Text style={s.h2}>Notes</Text>
            <View style={s.card}><Text>{object.notes}</Text></View>
          </>
        )}
      </Page>

      {hasRaw && (
        <Page size="A4" style={s.page} wrap>
          <Header />
          <Footer generated={generated} object={object} />

          <Text style={s.h1}>Raw Acquisition Curve</Text>
          <Text style={{ color: C.mute, fontSize: 9, marginBottom: 8 }}>
            0.25 ms cadence · {report.rawResult.length} points (downsampled for display)
          </Text>
          <ChartSvg points={report.rawResult} />

          <Text style={s.h2}>Analysis Sample (first 30 of {report.analysisResult.length})</Text>
          <SampleTable points={report.analysisResult.slice(0, 30)} />
        </Page>
      )}
    </Document>
  );
}

/* ----------------- Pieces ----------------- */

function Header() {
  return (
    <View style={s.band} fixed>
      <Text style={s.brand}>ELECTROSOFT AUTOMATION</Text>
      <Text style={s.brandSub}>REACTOR LINEARITY TESTING SYSTEM</Text>
    </View>
  );
}

function Footer({ generated, object }: { generated: string; object: TestObject }) {
  return (
    <View style={s.footer} fixed>
      <Text>Generated {generated} · {object.serialNumber}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvLabel}>{k}</Text>
      <Text style={s.kvValue}>{v}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.card, { flex: 1 }]}>
      <Text style={s.cardHeader}>{label}</Text>
      <Text style={s.cardBig}>{value}</Text>
    </View>
  );
}

function SampleTable({ points }: { points: RawPoint[] }) {
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 4 }}>
      <View style={[s.row, { backgroundColor: C.bg, padding: 6 }]}>
        <Text style={{ flex: 1, fontFamily: "Helvetica-Bold" }}>t (ms)</Text>
        <Text style={{ flex: 1, fontFamily: "Helvetica-Bold" }}>V (V)</Text>
        <Text style={{ flex: 1, fontFamily: "Helvetica-Bold" }}>I (A)</Text>
        <Text style={{ flex: 1, fontFamily: "Helvetica-Bold" }}>Phase (rad)</Text>
      </View>
      {points.map((p, i) => (
        <View key={i} style={[s.row, { padding: 5, borderTopWidth: 0.5, borderTopColor: C.line }]}>
          <Text style={{ flex: 1 }}>{p.timestamp.toFixed(2)}</Text>
          <Text style={{ flex: 1 }}>{p.voltage.toFixed(2)}</Text>
          <Text style={{ flex: 1 }}>{p.current.toFixed(3)}</Text>
          <Text style={{ flex: 1 }}>{p.phase.toFixed(3)}</Text>
        </View>
      ))}
    </View>
  );
}

/* ----------------- Vector chart ----------------- */

const CHART_W = 515;
const CHART_H = 240;
const PAD = { l: 44, r: 14, t: 12, b: 28 };

function ChartSvg({ points }: { points: RawPoint[] }) {
  if (points.length < 2) {
    return (
      <View style={[s.card, { height: CHART_H, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: C.mute }}>No data captured.</Text>
      </View>
    );
  }

  // Downsample so the SVG path is manageable even for 20k+ raw points.
  const target = 400;
  const stride = Math.max(1, Math.ceil(points.length / target));
  const slim: RawPoint[] = [];
  for (let i = 0; i < points.length; i += stride) slim.push(points[i]);
  if (slim[slim.length - 1] !== points[points.length - 1]) slim.push(points[points.length - 1]);

  const tMax = slim[slim.length - 1].timestamp || 1;
  const iMax = Math.max(...slim.map((p) => p.current), 0.01);
  const vMin = Math.min(...slim.map((p) => p.voltage));
  const vMax = Math.max(...slim.map((p) => p.voltage));
  const vRange = vMax - vMin || 1;

  const innerW = CHART_W - PAD.l - PAD.r;
  const innerH = CHART_H - PAD.t - PAD.b;
  const sx = (t: number) => PAD.l + (t / tMax) * innerW;
  const syI = (i: number) => PAD.t + innerH - (i / iMax) * innerH;
  const syV = (v: number) => PAD.t + innerH - ((v - vMin) / vRange) * innerH;

  const pathI = slim.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.timestamp).toFixed(1)},${syI(p.current).toFixed(1)}`).join(" ");
  const pathV = slim.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.timestamp).toFixed(1)},${syV(p.voltage).toFixed(1)}`).join(" ");

  // Y / X ticks
  const yTicks = 5;
  const xTicks = 5;

  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => iMax * (1 - i / yTicks));
  const xTickVals = Array.from({ length: xTicks + 1 }, (_, i) => (tMax * i) / xTicks);

  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        {/* Y axis labels column */}
        <View style={{ width: PAD.l - 4, paddingTop: PAD.t, height: CHART_H - PAD.b - PAD.t + PAD.t, justifyContent: "space-between" }}>
          {yTickVals.map((v, i) => (
            <Text key={i} style={{ fontSize: 7, color: C.mute, textAlign: "right" }}>{v.toFixed(1)}</Text>
          ))}
        </View>
        {/* Chart SVG */}
        <Svg width={CHART_W - PAD.l + 4} height={CHART_H - PAD.b} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 2, backgroundColor: "#FFF" }}>
          {yTickVals.map((_, i) => {
            const y = PAD.t + (innerH * i) / yTicks - PAD.t;
            return <Line key={`y${i}`} x1={0} y1={y + PAD.t} x2={innerW + PAD.r} y2={y + PAD.t} stroke={C.line} strokeWidth={0.4} />;
          })}
          {xTickVals.map((_, i) => {
            const x = (innerW * i) / xTicks;
            return <Line key={`x${i}`} x1={x} y1={PAD.t} x2={x} y2={PAD.t + innerH} stroke={C.line} strokeWidth={0.4} />;
          })}
          <Path d={shift(pathV, -PAD.l)} stroke={C.voltage} strokeWidth={0.8} strokeDasharray="3,2" fill="none" />
          <Path d={shift(pathI, -PAD.l)} stroke={C.current} strokeWidth={1.5} fill="none" />
        </Svg>
      </View>
      {/* X axis labels */}
      <View style={{ flexDirection: "row", marginLeft: PAD.l - 4, marginTop: 2, justifyContent: "space-between", width: innerW + PAD.r }}>
        {xTickVals.map((v, i) => (
          <Text key={i} style={{ fontSize: 7, color: C.mute }}>
            {v < 1000 ? `${v.toFixed(0)} ms` : `${(v / 1000).toFixed(2)} s`}
          </Text>
        ))}
      </View>
      <View style={[s.row, { marginTop: 6, gap: 14 }]}>
        <Legend color={C.current} label="Current (A)" />
        <Legend color={C.voltage} label="Voltage (V) — dashed" />
      </View>
    </View>
  );
}

/** Shift all X coordinates in an SVG path string by `dx`. */
function shift(d: string, dx: number): string {
  return d.replace(/([ML])([\d.\-]+),([\d.\-]+)/g, (_, cmd, x, y) => `${cmd}${(parseFloat(x) + dx).toFixed(1)},${y}`);
}


function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={[s.row, { alignItems: "center", gap: 4 }]}>
      <View style={{ width: 16, height: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 8, color: C.mute }}>{label}</Text>
    </View>
  );
}
