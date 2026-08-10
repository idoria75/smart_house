# smart_house v2 — One-Page Summary

**Goal.** ESP32 nodes measure temp/humidity around the house → MQTT → MySQL → web app.
Build order: firmware → MQTT/DB → web app. Fresh start on `v2`; details in `HANDOVER.md`.

## Device (ESP32 + DHT22)

- 2–3 nodes to start, DHT22 on GPIO4, identical firmware on every node.
- Sample every ~10 s, emit **one average per minute**.
- **Offline buffer on LittleFS**: all unflushed averages persist on flash — roughly
  **2 months of autonomy** (~16 B/record in ~1.5 MB), survives power loss.
- On reconnect, backfill oldest-first over MQTT (QoS 1); delete from flash only after ACK.
- Local debug interface: **`/data.csv` + tiny HTML table** served by the device.
- **OTA updates** (ArduinoOTA) — no PC hookup for reflashing.
- Identity by **MAC/chip ID**; location names assigned server-side.
- NTP clock, persisted across reboots; readings never dropped while offline.

## Transport & storage

- **Mosquitto with user/password auth** (no more anonymous, no TLS on LAN).
- Topics: `home/<device_id>/readings` (JSON) + `home/<device_id>/status` (Last Will).
- **MySQL** on the home server (docker-compose, with Adminer).
- Tables: `devices`, `readings_1min`, `readings_10min`.
- **Retention**: 1-min averages kept **2 weeks**, then downsampled to
  **10-min per device, kept forever** (~53k rows/device/year — negligible).

## Backend & web app

- **Python FastAPI** backend (MQTT ingest + REST API) — replaces v1's Node/Express.
- **React** frontend.
- v2 scope: **live dashboard** (current values per room, last update, online/offline).
- Later: time-series explorer, **seasonal comparisons** (winter vs summer, year-over-year) —
  the 10-min-forever tier exists precisely to enable these.
- Alerts: out of scope for v2.

## Deployment

- Everything on the home server via docker-compose: mosquitto, mysql, backend, frontend,
  adminer. Secrets in `.env` (untracked) and firmware `secrets.h` (gitignored).

## Immediate next step

Firmware skeleton: WiFi + NTP, DHT sampling/averaging, LittleFS buffer + backfill,
CSV/table endpoints, ArduinoOTA.
