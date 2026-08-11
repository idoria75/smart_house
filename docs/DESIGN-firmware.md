# smart_house v2 — Firmware & Protocol Design

Decisions taken 2026-08-11 (follow-up to `HANDOVER.md` §4). These settle the technical
design gaps identified before phase ① implementation.

## 1. Uplink & acknowledgment

- **MQTT QoS 0 with an application-level ack** (keeps PubSubClient; no library switch).
- Readings are sent in **batches of 10 per message**, at **~1 message per second** while
  draining the backlog, until the buffer is empty. Live operation is the degenerate case:
  a batch of 1, once per minute.
- Each `readings` message carries a `batch` id. The **backend acks each batch** by
  publishing the same id on the device's ack topic; only then does the device consider
  those records flushed.
- Delivery is **at-least-once**: if an ack is lost, the device re-sends the batch and the
  DB deduplicates (primary key `(device_id, time_utc)`, idempotent insert). This means the
  device never needs to persist its send cursor — worst case after a reboot it re-sends
  data the server already has.
- PubSubClient's default 256-byte packet limit is too small for 10-reading batches;
  call `client.setBufferSize(2048)` at startup.

## 2. On-device buffer (LittleFS)

### Layout
- Fixed-size **binary records** (~12–16 B: epoch seconds, temp ×100 as int16, humidity
  ×100 as uint16, sample count). CSV is produced only when `/data.csv` streams the store.
- **Segment files**, one per ~4 h window (240 records ≈ 3.8 KB, ≈ one 4 KB flash block).
  Appends go to the newest segment; a RAM cursor tracks the oldest unacked record.

### Deletion strategy (longevity analysis, as requested)
Question: delete as we go, or one bulk FS operation at the end of a drain?

- Flash wear comes from **block erases**. LittleFS erases the same blocks whether a file
  is deleted early or late — *when* you delete doesn't change total wear. What does hurt
  is **rewriting** files to drop records from the head; that copies every surviving block.
- Therefore: never rewrite. **Delete a whole segment file as soon as all its records are
  acked** — that is already a single FS operation per segment, the cheapest possible.
- A single global wipe after the full drain was rejected: it saves no wear (same erases),
  but keeps the FS full longer (risking overflow while draining a large backlog) and loses
  all progress if the connection drops mid-drain — forcing a full, slow re-send of months
  of data instead of only the tail.

### Why LittleFS and not SPIFFS
- SPIFFS is **deprecated** (unmaintained upstream; ESP-IDF recommends LittleFS as its
  replacement).
- LittleFS is **power-loss resilient** by design (copy-on-write); SPIFFS can corrupt if
  power fails mid-write — exactly the wrong failure mode for a device whose job is to
  survive outages.
- Better/real **wear leveling**, real directories, dramatically faster deletes and mount
  times, and sane behavior when the FS is nearly full (SPIFFS degrades badly there).
- Same Arduino/PlatformIO API surface (`LittleFS.h` is a drop-in for `SPIFFS.h`).

## 3. Message contract

Naming convention (stable even if the structure evolves): **snake_case, unit suffix in the
field name** — `temp_c`, `hum_pct`, `time_utc`. Changes to the schema should be additive;
existing field names/meanings are never repurposed.

### Topics
| Topic | Direction | Purpose |
|---|---|---|
| `home/<device_id>/readings` | device → server | batched 1-min averages |
| `home/<device_id>/ack` | server → device | ack for a `readings` batch |
| `home/<device_id>/status` | device → server | `online` / `offline` (LWT, retained) |

`<device_id>` = `esp32-` + lowercase hex MAC suffix, e.g. `esp32-a4cf12`.

### `readings` payload
```json
{
  "device_id": "esp32-a4cf12",
  "batch": 1723380240,
  "readings": [
    { "time_utc": "2026-08-11T12:04:00Z", "temp_c": 23.41, "hum_pct": 51.2, "samples": 6 }
  ]
}
```
- `batch`: opaque id unique per in-flight message (epoch seconds of first reading works).
- `samples`: how many of the ≤6 raw reads contributed to the average (quality signal).
- Max 10 entries per message.

### `ack` payload
```json
{ "batch": 1723380240 }
```

### `status` payload
`online` on connect (retained); LWT publishes `offline` (retained). Feeds the dashboard's
device up/down indicator.

## 4. Time

**UTC everywhere** — on the wire (`time_utc`, ISO 8601 `Z`), in the DB, in the buffer
(epoch seconds). Conversion to local time happens only in the web UI.

## 5. Averaging windows

- Averages are **aligned to wall-clock minutes** (`hh:mm:00`–`hh:mm+1:00`), so rows from
  different devices line up in queries.
- **Partial windows are dropped**: samples taken before the first window boundary after
  boot (or after a clock correction) are discarded, never emitted as a short average.
