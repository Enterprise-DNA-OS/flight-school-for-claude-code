# Flight School for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR SCHOOL OR CLUB], [Part 141 / Part 142 / aero club]
- **Operator:** [YOUR NAME], [CFI / head of operations / office manager]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| Tomorrow's bookings and what would stop them | `/tomorrow` |
| Today's dispatch sheet | `/dispatch` |
| Every booking from today | `/schedule` |
| Can this week's solos go | `/solo-check` |
| One student's file | `/student` |
| One instructor | `/instructor` |
| Training progress across students | `/progress` |
| Students who have gone quiet | `/quiet` |
| Who is ready for the flight test | `/test-ready` |
| Flights waiting for a debrief | `/ungraded` |
| Theory exams and when passes stop counting | `/exams` |
| Accounts, or who owes money | `/accounts`, `/in-debit` |
| Medicals and instructor ratings | `/currency` |
| Aircraft hours, checks, annual reviews | `/fleet` |
| Defects | `/defects` |
| Aircraft use and lost bookings | `/utilisation`, `/cancellations` |
| Instructor workload | `/instructor-load` |
| Rule findings | `/compliance` |
| What needs chasing | `/attention` |
| Book, cancel or no-show a lesson | `/book`, `/cancel`, `/no-show` |
| Log a flight | `/fly` |
| Grade a flight | `/debrief` |
| Record an exam, payment or renewal | `/exam`, `/pay`, `/renew` |
| Change a student's instructor or status | `/assign`, `/student-status` |
| Raise or clear a defect, mark an aircraft serviceable, record a check | `/defect`, `/clear`, `/serviceable`, `/check-done` |
| Add a course, lesson, aircraft, instructor or student | `/add` |
| Change a house setting or limit | `/setting` |
| Add a note | `/log` |
| Draft a progress note, statement or flight test recommendation | `/draft-progress`, `/draft-statement`, `/draft-recommendation` |
| The CFI's weekly review | `/cfi-review` |
| The Monday review | `/weekly-review` |
| Close the day | `/end-of-day` |
| Dashboards or printed records | `/view`, `/documents` |
| Bring data across from FlightLogger | `/import` |
| Back everything up | `/export` |
| Change a field, a stage or a rule | `/customise` |
| A new dashboard page | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run school -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.
- Never rewrite a graded flight or a logged tacho time. Corrections go in a note with `/log`.
- Never `--force` a booking past its problems without the chief flying instructor's yes in this session.
- This system shows what the records say. The CFI decides who flies, the pilot in command decides whether the flight goes, and the maintenance controller decides whether the aircraft is serviceable.

## The school's week

- Morning: `/dispatch`. Before a solo: `/solo-check`. After every flight: `/fly` then `/debrief`.
- End of day: `/end-of-day`. Monday: `/weekly-review`. The CFI, weekly: `/cfi-review`.
- Times are the aerodrome's local clock. Hours are decimal (1.3 is 1 hour 18 minutes). Money is in the school's own currency.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off FlightLogger.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/flightlogger
