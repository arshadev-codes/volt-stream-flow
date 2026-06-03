import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { pool, withRetry } from "./db.js";
import { runMigrations } from "./migrate.js";

const app = express();
app.use(express.json({ limit: "100mb" })); // raw_result can be large (0.25ms cadence)
app.use(cors({ origin: (process.env.CORS_ORIGIN || "*").split(",") }));

const ObjectInput = z.object({
  serial_number: z.string().min(1).max(120),
  rated_voltage: z.number().finite(),
  rated_current: z.number().finite(),
  project_name: z.string().max(255).default(""),
  customer_name: z.string().max(255).default(""),
  work_order: z.string().max(120).default(""),
  raw_result: z.string().nullable().optional(),
  analysis_result: z.string().nullable().optional(),
});

const ResultsInput = z.object({
  raw_result: z.string(),
  analysis_result: z.string(),
});

/* ---------- Routes ---------- */

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/test-objects", async (_req, res, next) => {
  try {
    const [rows] = await withRetry(() =>
      pool.query("SELECT id, serial_number, rated_voltage, rated_current, project_name, customer_name, work_order, analysis_result, created_at, modified_at FROM test_objects ORDER BY created_at DESC")
    );
    res.json(rows);
  } catch (e) { next(e); }
});

app.get("/api/test-objects/:id", async (req, res, next) => {
  try {
    const [rows] = await withRetry(() =>
      pool.query("SELECT * FROM test_objects WHERE id = ? LIMIT 1", [req.params.id])
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

app.post("/api/test-objects", async (req, res, next) => {
  try {
    const body = ObjectInput.parse(req.body);
    const [result] = await withRetry(() => pool.query(
      `INSERT INTO test_objects
       (serial_number, rated_voltage, rated_current, project_name, customer_name, work_order, raw_result, analysis_result)
       VALUES (?,?,?,?,?,?,?,?)`,
      [body.serial_number, body.rated_voltage, body.rated_current, body.project_name, body.customer_name, body.work_order, body.raw_result ?? null, body.analysis_result ?? null]
    ));
    const [rows] = await pool.query("SELECT * FROM test_objects WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

app.put("/api/test-objects/:id", async (req, res, next) => {
  try {
    const body = ObjectInput.partial().parse(req.body);
    const fields = Object.keys(body);
    if (!fields.length) return res.status(400).json({ error: "no fields" });
    const set = fields.map((f) => `\`${f}\` = ?`).join(", ");
    const values = fields.map((f) => body[f]);
    await withRetry(() => pool.query(`UPDATE test_objects SET ${set} WHERE id = ?`, [...values, req.params.id]));
    const [rows] = await pool.query("SELECT * FROM test_objects WHERE id = ?", [req.params.id]);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

app.post("/api/test-objects/:id/results", async (req, res, next) => {
  try {
    const { raw_result, analysis_result } = ResultsInput.parse(req.body);
    await withRetry(() => pool.query(
      "UPDATE test_objects SET raw_result = ?, analysis_result = ? WHERE id = ?",
      [raw_result, analysis_result, req.params.id]
    ));
    const [rows] = await pool.query("SELECT id, modified_at FROM test_objects WHERE id = ?", [req.params.id]);
    res.json({ ok: true, ...rows[0] });
  } catch (e) { next(e); }
});

app.delete("/api/test-objects/:id", async (req, res, next) => {
  try {
    await withRetry(() => pool.query("DELETE FROM test_objects WHERE id = ?", [req.params.id]));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ---------- Error handler ---------- */

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.issues) return res.status(400).json({ error: "ValidationError", issues: err.issues });
  res.status(500).json({ error: err.message || "internal" });
});

/* ---------- Boot ---------- */

const PORT = Number(process.env.API_PORT || 4000);
runMigrations()
  .then(() => app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`)))
  .catch((e) => { console.error("Failed to start:", e); process.exit(1); });
