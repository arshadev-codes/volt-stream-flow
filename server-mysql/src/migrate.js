import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDatabase, pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

export async function runMigrations() {
  await ensureDatabase();
  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    // mysql2 doesn't multi-statement by default on the pool, but our DDL is one-statement-per-block.
    const statements = sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    console.log(`✓ applied ${file}`);
  }
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => { console.log("Migrations complete."); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
