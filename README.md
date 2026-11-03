<h1 align="center">Flight School for Claude Code</h1>

<p align="center">
  <strong>The open-source flight school system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your FlightLogger data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=flightlogger">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/flightlogger?utm_source=github&utm_medium=readme&utm_campaign=flightlogger">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-flightlogger">Instead of FlightLogger</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Flight School for Claude Code does the job you pay FlightLogger for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the FlightLogger dashboard cannot.

FlightLogger does not publish a price. Its packages page says a school pays for the platform plus "Active Student & Operations Flights Fees", with add-on modules on top, and quotes each school privately ([flightlogger.net/packages](https://www.flightlogger.net/packages)). The bill grows with every student you train, and the records it holds are the ones your training organisation lives on.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=flightlogger).

It is for flight training organisations, academies and aero clubs in New Zealand and Australia: from a two-aircraft club to an academy running PPL and CPL students through a fleet and a simulator. It holds the courses and their syllabus, every student's progress lesson by lesson, the booking sheet, every flight with its grade and debrief, theory exams, medicals and instructor ratings, aircraft hours to the next check, annual reviews and defects, and each student's account. It does not run an online booking page for students, a student logbook app or a learning management system for ground school.

The fictional Riverside Aero Academy demo has five aircraft, a simulator, four instructors and eight students. Tomorrow a student is booked solo with a lapsed medical, another is booked on an aircraft whose annual review ran out three days ago while her account sits past its limit, an instructor with an expired medical is rostered on an aircraft past its 100 hourly, and two bookings share one aircraft. One student flew solo after his medical lapsed, another flew solo with no dual check in 30 days, an instructor taught for two weeks on an expired rating, a lesson was flown before the one before it was signed off, and one student has everything in place for the flight test.

## Your first hour: ten things to ask for

1. "What is wrong with tomorrow's bookings?"
2. "Who is booked solo this week, and can they all go?"
3. "Who is ready for the flight test?"
4. "Which students have gone quiet?"
5. "Which flights still need a debrief?"
6. "Who owes us money, and are they booked?"
7. "Which medicals and instructor ratings run out in the next six weeks?"
8. "Which aircraft is next due for its 100 hourly?"
9. "How many hours did we lose to weather this quarter?"
10. "Add a column to the training record for the examiner's name." (`/customise`)

## Ten questions the FlightLogger dashboard does not answer

Each runs against the demo today, through the command shown.

| Question | Command |
|---|---|
| Which bookings tomorrow should not go as planned, and why? | `/tomorrow` |
| Which students booked solo this week have a medical that has lapsed, or no dual check in the last 30 days? | `/solo-check` |
| Who is ready to be put forward for the flight test, and what is each other student still missing? | `/test-ready` |
| Which students have not flown in three weeks and have nothing booked? | `/quiet` |
| Which flights have no grade or debrief yet, and which instructor owes them? | `/ungraded` |
| Which lessons were flown before the lesson before them was signed off? | `/compliance` |
| Which instructors flew more instruction in a day than our limit allows? | `/compliance` |
| Which theory exam passes stop counting before the student is likely to sit the flight test? | `/exams` |
| Which aircraft reaches its next check this week at the rate it is flying? | `/fleet` |
| How many hours did we lose to weather, aircraft and no-shows in the last 90 days? | `/cancellations` |

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/flight-school-for-claude-code.git
cd flight-school-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/tomorrow` for tomorrow's go or fix-first list, or `/attention` for everything that needs chasing. `npm run view` writes this week, training progress and compliance views to `views/`; `npm run docs` writes student training records, statements of account and aircraft status sheets to `docs-out/`, in the brand set in `brand.json`.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

The week in the school's own words: `/dispatch` in the morning, `/book` and `/fly` through the day, `/debrief` after every flight, `/end-of-day` when the aircraft are tied down, `/solo-check` before solos, `/cfi-review` for the chief flying instructor and `/weekly-review` on Monday.

| Command | What it does |
|---|---|
| `/accounts` | Every student account: charged, paid, balance and credit limit |
| `/add` | Add a course, lesson, aircraft, instructor or student |
| `/assign` | Give a student a lead instructor |
| `/attention` | What needs chasing today: bookings with problems, flights not graded, quiet students, accounts in debit, medicals, ratings, checks, annual reviews, deferrals, exam credits, students ready to test |
| `/book` | Book a lesson: student, aircraft, instructor, lesson and time. Refuses a booking with a problem unless the CFI says yes |
| `/cancel` | Cancel a booking with its reason |
| `/cancellations` | Bookings lost in the last 90 days by reason: weather, aircraft, instructor, student, no-show |
| `/cfi-review` | The chief flying instructor's weekly review: compliance findings, flights not graded, instructor load, quiet students and who is ready to test |
| `/check-done` | Record a completed maintenance check: the next check hours and the annual review date |
| `/clear` | Clear a defect with the work order reference |
| `/compliance` | Check the records against the rules this industry lives under (the ones listed in docs/compliance.md) and report what is missing, late, or about to breach, with the rule cited. |
| `/courses` | The courses, their minimum hours and the theory exams each needs |
| `/currency` | Medicals and instructor ratings for every active instructor and student, soonest first |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/debrief` | Grade a flight and record the debrief: competent, repeat or incomplete. Once only |
| `/defect` | Raise a defect against an aircraft. An open defect grounds it; a deferred one carries a due date |
| `/defects` | Every defect: open, deferred, deferral expired and cleared |
| `/dispatch` | The morning dispatch: today's sheet, what grounds an aircraft or a student, and flights still to grade from yesterday |
| `/documents` | Render training records, statements of account and aircraft status sheets in the school brand |
| `/draft-progress` | Draft a training progress note to a student (and their sponsor) |
| `/draft-recommendation` | Draft the flight test recommendation for the CFI to check and sign |
| `/draft-statement` | Draft a statement of account for a student or sponsor |
| `/end-of-day` | Close the day: bookings not logged, flights not graded, defects raised, payments in |
| `/exam` | Record a theory exam result |
| `/exams` | Every theory exam: score, pass or fail, and the date the pass stops counting |
| `/export` | Export every record to JSON files in a folder |
| `/fleet` | Each aircraft: status, hours, hours to the next check, days of flying left at the current rate, annual review date and defects |
| `/flights` | The flight log: every flight, newest first, with lesson, outcome and charge |
| `/fly` | Log a flight: from a booking, or an unbooked flight. Charges the student at the aircraft and instructor rates |
| `/import` | Bring aircraft, students, instructors and flight history across from FlightLogger exports |
| `/in-debit` | Students owing more than their credit limit, and how many bookings they have ahead |
| `/instructor-load` | Each instructor: hours in 7 and 28 days, students, flights not graded, bookings this week |
| `/instructor` | One instructor: hours, currency, flights to grade, bookings and their students |
| `/log` | Add a note to a student file |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |
| `/no-show` | Mark a booking as a no-show |
| `/pay` | Record a payment against a student account |
| `/progress` | Every active student against the syllabus: lessons signed off, next lesson, hours, days since flying |
| `/quiet` | Active students who have not flown and have nothing booked for longer than the quiet setting |
| `/renew` | Record a renewed medical or instructor rating |
| `/schedule` | Every booking from today on, with its problems |
| `/serviceable` | Mark an aircraft serviceable or unserviceable |
| `/setting` | Change a house setting or limit (solo check window, quiet days, instructor daily hours, exam validity) |
| `/settings` | The house settings and limits the checks use, with notes |
| `/solo-check` | Every solo booked in the next 7 days and whether the student can go: medical, recent dual check, previous lesson signed off |
| `/student-status` | Pause, complete, withdraw or reactivate a student |
| `/student` | One student's whole file: record, syllabus, flight test gaps, recent flights and debriefs, bookings, exams and notes |
| `/syllabus` | Every lesson in every course, in order, with its kind and planned hours |
| `/test-ready` | Who is ready for the flight test, and exactly what is still missing for everyone else |
| `/today` | Today's booking sheet with every problem against each booking |
| `/tomorrow` | Tomorrow's booking sheet with every reason a booking should not go: aircraft, instructor, medical, solo check, syllabus order, account, double bookings |
| `/ungraded` | Flights with no grade or debrief yet, oldest first |
| `/utilisation` | Hours, charges and lost bookings per aircraft over 7, 28 and 90 days |
| `/view` | Render the read-only dashboards (this week, training progress, compliance) in the school brand |
| `/weekly-review` | The Monday review written from the booking sheet, training progress, the fleet and the accounts |

## Instead of FlightLogger

FlightLogger exports every recorded flight, and most reports, to CSV or Excel. Export your aircraft list, your user list and the raw data flight report, put the three files in one folder, and run:

```bash
npm run school -- import flightlogger ./exports --dry-run
npm run school -- import flightlogger ./exports
```

The dry run shows the counts and changes nothing. Aircraft, students, instructors and every flight come across, with each flight matched to its lesson where the lesson names line up. Headings depend on how each report is set up; map yours with `--map=file.json`. The full guide, and what does not carry over, is in [docs/replace-flightlogger.md](docs/replace-flightlogger.md).

## Architecture

```
flight-school-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Flight School for Claude Code for your business, migrates your FlightLogger data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=flightlogger)
- Read more: [enterprisedna.co/omni/instead-of/flightlogger](https://enterprisedna.co/omni/instead-of/flightlogger?utm_source=github&utm_medium=readme&utm_campaign=flightlogger)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
