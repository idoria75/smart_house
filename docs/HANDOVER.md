# smart_house v2 — Handover

Date: 2026-08-10. Outcome of the v2 kickoff interview (Steve + Claude). This document records
the decisions made, their rationale, and the defaults chosen where no explicit decision was
needed. It supersedes the v1 design on `master`; v2 restarts from scratch on the `v2` branch.

## 1. Project goal

Monitor temperature and humidity (more sensor types later) from ESP32 nodes around the house,
transport readings over MQTT, aggregate them in a database, and visualize them in a web
application — including, eventually, comparing tendencies across times of the year (e.g.,
daily temperature curves in winter vs summer).

Development order: **① ESP32 firmware → ② MQTT + DB integration → ③ web application.**

## 2. Decisions from the interview

### Fleet & sensors
- **2–3 ESP32 nodes initially, DHT22 only** (temp + humidity). More nodes and sensor types
  may come later; the data model should not block that, but v2 does not design for them yet.
- Wiring per the repo images: DHT22 data on **GPIO4** with pull-up, 3V3/GND (`images/`).

### Sampling & averaging
- **Read the DHT22 every ~10 s; produce one average per minute** (6 samples/average).
  DHT22 max rate is one read per ~2 s; 10 s is a good noise/self-heating balance.
- Failed reads (NaN) are skipped; an average is emitted as long as ≥1 sample succeeded.

### Offline buffering (on-device)
- **LittleFS on flash** stores all not-yet-flushed 1-minute averages.
- Capacity: a record is ~16 bytes (timestamp + temp + humidity); with the standard ~1.5 MB
  LittleFS partition on a 4 MB module this is roughly **2 months of autonomy** while
  disconnected. Survives reboots and power loss.
- Flash wear is negligible at one small append per minute with LittleFS wear leveling.
- v1's approach (RAM array, `MAX_READINGS 3000`) is dropped.

### On-device interface
- Small HTTP server on the ESP32 with:
  - **`/data.csv`** — streams the buffered (unflushed) readings as CSV.
  - **`/` (HTML table)** — minimal page rendering the same data, **for easier debugging**.
- Confirmed feasible: streaming from LittleFS keeps RAM usage low; this coexists fine with
  MQTT and OTA.

### OTA updates
- **Required.** Steve wants to update devices with minimal downtime and without connecting
  them to a PC. Keep ArduinoOTA (already in v1); a pull-based HTTP OTA can be added later if
  fleet management demands it.

### Device identity
- **MAC/chip-ID based.** All nodes run identical firmware and self-identify by MAC; the
  human-readable location ("bedroom", "living room") is assigned in the DB via the web app
  (or SQL for now). This keeps OTA uniform — no per-device builds.

### Clock handling
- NTP for wall-clock time (`configTime` once at boot, not per reading — v1 re-called it on
  every timestamp, which is a bug to avoid).
- **Persist last-known time across reboots**; if the device boots offline, it continues from
  the persisted time with slight drift and corrects on the next NTP sync. Readings are never
  dropped for lack of a synced clock.

### Retention / rotation (DB)
- **1-minute averages are kept for 2 weeks.**
- Older data is **downsampled to one entry per 10 minutes per device, kept indefinitely**
  (needed for the year-over-year comparisons).
- Volume check: 1-min tier ≈ 20k rows/device at steady state; 10-min tier ≈ 53k
  rows/device/year — trivial for MySQL for the foreseeable future.

### Server stack & hosting
- Runs on **the home server (this machine)** via docker-compose: Mosquitto, MySQL, backend,
  frontend (plus Adminer for DB inspection, as in v1).
- **Backend: Python (FastAPI)** — new in v2 (v1 was Node/Express). MQTT ingest via
  paho-mqtt/aiomqtt. **Frontend: React** with a charting library.
- **MySQL kept** as the database (existing `mysql/` data dir on this machine).

### Security
- **Mosquitto user/password auth** (password file). v1's `allow_anonymous true` is dropped.
  No TLS — LAN-only deployment, considered overkill for now.
- Credentials live in `secrets.h` (firmware, gitignored) and `.env` (server). Note: `.env`
  currently exists untracked in the working tree with the DB password — keep it out of git.

### Web app scope (v2 first version)
- **Live dashboard only**: current temp/humidity per room, last-update time, device
  online/offline status.
- Time-series explorer and **seasonal comparison (winter vs summer, week vs same week last
  year) are explicitly later milestones** — the retention design above preserves the data
  they will need.

### Alerts
- **Not in v2.** No threshold/notification work now.

## 3. Defaults chosen without an explicit decision (revisit if wrong)

- **MQTT topics**: `home/<device_id>/readings` for data; `home/<device_id>/status` with an
  MQTT Last Will for online/offline (feeds the dashboard's device status).
- **Payload**: JSON, QoS 1. Backfill after reconnection drains LittleFS oldest-first in
  batches (e.g., 100 records/message); records are deleted from flash only after the broker
  acknowledges (QoS 1), so nothing is lost mid-flush.
- **DB schema (clean, replaces v1's redundant tables)**: `devices` (id, mac, location,
  created_at, last_seen) and two reading tiers, `readings_1min` and `readings_10min`, both
  keyed (device_id, ts). v1's overlapping `sensors`/`readings`/`sensor_readings` trio is
  not carried over.
- **Rotation job**: scheduled task in the backend (or a MySQL event) that aggregates
  1-min → 10-min for data older than 2 weeks, then deletes the aggregated 1-min rows.
- **Firmware stack**: PlatformIO + Arduino framework, as v1.

## 4. Open questions (park until relevant)

- Exact LittleFS record format (binary vs CSV lines) and file rotation on the device.
- Whether the 10-min tier ever needs a further hourly tier (only if DB size becomes a topic).
- Config portal / provisioning UX if the fleet grows beyond a handful of nodes.
- Additional sensor types and how they extend the schema (wide table vs per-metric rows).

## 5. Next step

Phase ①: v2 firmware skeleton — WiFi + NTP-with-persisted-clock, DHT22 sampling/averaging,
LittleFS buffer, MQTT publish with backfill, `/data.csv` + HTML table, ArduinoOTA.
