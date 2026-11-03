---
description: Bring aircraft, students, instructors and flight history across from FlightLogger exports
---

Read `docs/replace-flightlogger.md`. Run `npm run school -- import flightlogger <folder> --dry-run` first and show the counts. Map different headings with `--map=file.json`. Only run without `--dry-run` once the operator says yes. Afterwards run `/progress` and `/fleet` and compare with FlightLogger.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
