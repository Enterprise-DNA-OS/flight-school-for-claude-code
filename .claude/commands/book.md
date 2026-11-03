---
description: Book a lesson: student, aircraft, instructor, lesson and time. Refuses a booking with a problem unless the CFI says yes
---

Run `npm run school -- book <student> --date=YYYY-MM-DD --start=HH:MM --end=HH:MM --aircraft=.. [--instructor=..] [--lesson=code or number]`. The kind comes from the lesson. If it refuses, show the problems and stop. Only add `--force` after the chief flying instructor says yes in this session.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
