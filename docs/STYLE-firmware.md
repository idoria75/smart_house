# smart_house v2 — Firmware Code Style

Applies to all C++ under `src/`, `include/`, `lib/`. Defined 2026-08-11.

## Language & tooling
- **Arduino framework** on ESP32, built with **PlatformIO** (VSCode). Two build envs:
  `debug` (serial logging on) and `release` (logging compiled out).
- Formatting enforced by the repo `.clang-format` (run "Format Document" in VSCode).

## Naming
| Thing | Style | Example |
|---|---|---|
| Class | `ThisIsAClass` | `ReadingBuffer` |
| Method / function | `this_is_a_method` | `flush_segment()` |
| Local variable | `thisIsAVariable` | `avgTemp` |
| Method argument | leading `_` | `_batchId` |
| Global variable | trailing `_` | `mqttClient_` |
| Class member variable | trailing `_` (long-lived state, same rule as globals) | `cursor_` |
| Constant | `constexpr` UPPER_SNAKE — no `#define` for values | `constexpr uint32_t READ_PERIOD_MS = 10000;` |
| File | snake_case, one class per pair | `reading_buffer.h/.cpp` |

## Structure
- **Terse language.** Comments max 2 lines, and only where the code is not self-explanatory.
- Max line length **120**.
- Prefer **classes where they earn their keep**; prefer **short, single-purpose methods**
  over long ones doing too much.
- Headers use `#pragma once`. Include order: own header, C/C++ std, libraries, project.

## Robustness rules (device runs unattended for months)
- **No Arduino `String`** — heap fragmentation kills long uptimes. Fixed `char` buffers +
  `snprintf`. (`String` may appear only at library boundaries that force it.)
- **No `delay()` in steady state**; everything in `loop()` is `millis()`-scheduled and
  non-blocking, so OTA, MQTT, and the web server stay responsive. `delay()` allowed only
  in `setup()`-time hardware waits.
- **No dynamic allocation in steady state** — allocate at startup, reuse buffers.
- **Fixed-width types** (`uint32_t`, `int16_t`, …) for anything stored, transmitted, or
  time-related; bare `int` only for trivially local arithmetic.
- **No exceptions** (disabled in Arduino builds). Fallible methods return `bool` (or a
  small enum) and `LOG()` the failure; the loop never crashes on a failed step.
- `constexpr char FW_VERSION[] = "2.x.y";` — logged at boot, since OTA-updated devices
  can't be identified by their cable.

## Commits & workflow
- Commit messages are a **single line** (imperative, e.g. `Add LittleFS segment buffer`).
- Development proceeds in **small verifiable steps, one commit each**: every commit builds
  clean and has an observable result (serial log, endpoint, MQTT message) that proves it.

## Debug logging
- Compile-time switch, not runtime: `-D DEBUG_LOG` set by the `debug` PlatformIO env.
- `LOG(fmt, ...)` macro → `Serial.printf` when `DEBUG_LOG` is defined, expands to nothing
  in `release` (strings stripped from the binary, zero runtime cost).
- Serial at **115200** (matches `monitor_speed`); `Serial.begin` itself only in debug builds.

```cpp
#ifdef DEBUG_LOG
  #define LOG(fmt, ...) Serial.printf(fmt "\n", ##__VA_ARGS__)
#else
  #define LOG(fmt, ...)
#endif
```

## Example

```cpp
class ReadingBuffer
{
public:
  bool append(uint32_t _timeUtc, int16_t _tempCx100, uint16_t _humPctx100, uint8_t _samples);
  bool delete_segment(uint16_t _segmentId);

private:
  uint16_t activeSegment_;
  uint32_t cursor_;
};
```
