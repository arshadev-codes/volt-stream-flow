import "dotenv/config";
import mysql from "mysql2/promise";

const {
  DB_HOST = "127.0.0.1",
  DB_PORT = "3306",
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_NAME = "reactor_testing",
} = process.env;

/**
 * Bootstrap: ensure the database exists, then create a pool against it.
 * Includes basic reconnection — mysql2's pool handles transient drops
 * but we expose `withRetry()` for first-call resilience.
 */
export async function ensureDatabase() {
  const root = await mysql.createConnection({
    host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASSWORD, multipleStatements: true,
  });
  await root.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await root.end();
}

export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
});

export async function withRetry(fn, retries = 3, delayMs = 500) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (!["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "ETIMEDOUT"].includes(e.code)) throw e;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}
