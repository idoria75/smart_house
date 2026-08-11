# smart_house — guidance for Claude

ESP32 temp/humidity sensor network → MQTT → MySQL → web app. v2 is a from-scratch restart
on the `v2` branch; `master` holds the abandoned v1.

## Read first
- `docs/SUMMARY.md` — one-page overview of the v2 design.
- `docs/HANDOVER.md` — full decisions and rationale from the kickoff interview.
- `docs/DESIGN-firmware.md` — buffer layout, MQTT contract, time/averaging rules.
- `docs/STYLE-firmware.md` — mandatory C++ style for all firmware code.

## Workflow rules
- Development happens in small verifiable steps, one commit each; every commit must build
  clean and have an observable result proving it.
- Commit messages: single line, imperative, no trailers (no Co-Authored-By).
- Never commit or push without Ivan's explicit confirmation.
- Firmware is built with PlatformIO (Arduino framework); `debug` env logs to serial at
  115200, `release` strips logging.
- Secrets live in `include/secrets.h` and `.env` — both gitignored, never commit them.
