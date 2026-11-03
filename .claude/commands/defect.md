---
description: Raise a defect against an aircraft. An open defect grounds it; a deferred one carries a due date
---

Run `npm run school -- defect <aircraft> <description> [--defer --due=YYYY-MM-DD]`. Only defer when the maintenance controller says so in this session. Then show the bookings on that aircraft with `/schedule`.

Ambiguous names list the candidates and stop: ask which one. Never send anything; drafts stay in `drafts/`.
