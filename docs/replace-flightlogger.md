# Moving off FlightLogger

FlightLogger exports every recorded flight, and most of its reports, as CSV or Excel ([FlightLogger help: CSV export and Excel](https://help.flightlogger.net/knowledge/importing-and-creating-custom-flight-reporting-with-csv-export-and-excel)). Three exports bring a school across.

## 1. Export three files

Put them in one folder. The file names tell the importer what each one is:

| File | What to export | Columns read |
|---|---|---|
| `Aircraft.csv` | Your aircraft and simulators | Registration (or Aircraft, Callsign), Type (or Model), Category, Price per hour (or Hourly rate), Total time (or Tacho, Hobbs) |
| `Users.csv` | Students and instructors | Name, or First name and Last name; Role (Student, Instructor; others are skipped); Email; Phone; Program (or Class, Course); Medical expiry; Status; Initials (or Code) |
| `Flights.csv` | The raw data flight report for the dates you want | Flight ID, Date, Aircraft, Student, Instructor, Flight type, Lesson, Flight time (1.3 or 1:18), Landings, Cross country, Instrument time, Result, Comment |

## 2. Set up your courses first

Add each course and its syllabus before the import (`/add course`, `/add lesson`), using the lesson names your FlightLogger programs use. A flight's Lesson is matched to a lesson code or title in the student's course. A flight whose lesson does not match still comes across, with its hours and charge, but without a lesson against it.

## 3. Dry run, then import

```bash
npm run school -- import flightlogger ./exports --dry-run
npm run school -- import flightlogger ./exports
```

The dry run reports the counts and changes nothing. Running the import twice adds nothing twice: flights are keyed on FlightLogger's Flight ID.

Headings depend on how each report is set up. If yours differ, map them in a JSON file, keyed by `aircraft`, `users` or `flights`, from our column name to yours:

```json
{ "flights": { "Date": "Off block date", "Flight time": "Airborne", "Student": "Pilot name" } }
```

```bash
npm run school -- import flightlogger ./exports --map=map.json --dry-run
```

## What maps

- Aircraft and simulators, with their hourly rate and hours.
- Students with their program, medical expiry and status; instructors with their medical and rating expiry where exported. A code is made from the name when no initials column exists (Kate Lee becomes KLEE).
- Every flight: date, aircraft, student, instructor, dual, solo, check or simulator, hours, landings, cross-country, instrument time, and the lesson. A result of Completed or Passed is recorded as competent; Not completed, Failed or Repeat as repeat; anything else stays ungraded.
- Each flight is charged at the rates in this system at the time of import.

## What does not carry over

- Bookings and the schedule ahead. Rebook upcoming lessons with `/book`, or export them and ask Claude Code to map the file.
- Individual exercise grades inside a lesson, student logbook signatures and uploaded documents. Keep FlightLogger's PDF exports with the student's file.
- Invoices and payments. Bring opening balances across as a payment or a note per student, or ask Claude Code to map your accounting export.
- Duty times and safety reports.

Check afterwards: run `/progress` and `/fleet` and compare students, hours and lessons signed off against FlightLogger before you stop using it.
