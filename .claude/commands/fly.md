---
description: Log a flight: from a booking, or an unbooked flight. Charges the student at the aircraft and instructor rates
---

Run `npm run school -- fly <booking> --tacho=start-end` (or `--hours=1.3`, `--landings`, `--xc`, `--instrument`). For a flight with no booking: `npm run school -- fly --student=.. --aircraft=.. [--instructor=..] [--lesson=..] --hours=..`. Then remind the instructor to `/debrief`.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
