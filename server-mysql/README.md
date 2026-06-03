# Electrosoft Automation RLTS — MySQL HTTP API

A small Node.js + Express + mysql2 service that sits in front of your local MySQL
and exposes the REST endpoints the frontend calls. It is intentionally separate
from the web app because the web app runs in a serverless edge runtime that
cannot open raw TCP connections to MySQL.

## 1. Configure credentials

```bash
cp .env.example .env
# edit .env and put your real DB credentials in it
```

The file is your only secret store — **never** commit it.

## 2. Install & boot

Requires Node.js 20+.

```bash
npm install
npm run migrate   # one-time; also runs automatically on server start
npm start         # http://localhost:4000
```

On boot the server will:
1. Create the `reactor_testing` database if it does not exist.
2. Apply every SQL file under `migrations/` in order.
3. Open a 10-connection pool with keep-alive and transient-error retry.

## 3. Point the web app at it

In the web app's environment set:

```
VITE_API_BASE_URL=http://localhost:4000
```

Then restart the dev server. When this variable is unset, the app keeps using
`localStorage` so it still works without the backend.

## 4. Exposing it to a deployed frontend

The deployed app cannot reach `localhost`. Put this service behind a public
HTTPS hostname (your own server, ngrok, Cloudflare Tunnel, etc.) and set
`VITE_API_BASE_URL` to that URL.

## API surface

| Method | Path                              | Description                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/health`                         | Liveness check                       |
| GET    | `/api/test-objects`               | List all objects                     |
| GET    | `/api/test-objects/:id`           | Single object (incl. raw/analysis)   |
| POST   | `/api/test-objects`               | Create object                        |
| PUT    | `/api/test-objects/:id`           | Update object fields                 |
| POST   | `/api/test-objects/:id/results`   | Store `raw_result` + `analysis_result` |
| DELETE | `/api/test-objects/:id`           | Delete object                        |

All `raw_result` / `analysis_result` payloads are serialized JSON arrays of
`{timestamp, voltage, current, phase}` objects, exactly as produced by the
acquisition loop in the frontend.
