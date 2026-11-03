# Record checks for flight training organisations and aero clubs

This system checks your own records against the rules and limits below and lists what is missing, late or out of line. It does not approve a solo, replace your exposition, your syllabus or your chief flying instructor, and it does not decide whether a student, an instructor or an aircraft is fit to fly. Where a rule is set by your exposition, the number lives in the `settings` table and the seeded value is a demo value: set it from your own exposition with `/setting`.

## Where the rules come from

New Zealand: the Civil Aviation Rules, read from the CAA's consolidations ([Part 61](https://www.aviation.govt.nz/assets/rules/consolidations/Part_061_Consolidation.pdf), [Part 67](https://www.aviation.govt.nz/assets/rules/consolidations/Part_067_Consolidation.pdf), [Part 91](https://www.aviation.govt.nz/assets/rules/consolidations/Part_091_Consolidation.pdf), [Part 141](https://www.aviation.govt.nz/assets/rules/consolidations/Part_141_Consolidation.pdf)). The CAA says the consolidations are for reference and not the official versions: check the official rule text before you rely on a number.

Australia: the Civil Aviation Safety Regulations 1998 ([CASR, latest compilation](https://www.legislation.gov.au/F1998B00220/latest/text)), Parts 61, 67, 141 and 142.

### Training records

- NZ rule 141.59 requires a record for every person who undertakes a training course, including ground and flight training, instructor comments and internal assessments, kept "accurate, legible and of a permanent nature" for 3 years from the last entry (141.155 for a restricted organisation).
- AU CASR 141.275 requires a record of each training session within 7 days, kept for at least 7 years, and 141.280 a copy to the student within 7 days. CASR 142.355 requires a record with a description and assessment of the person's performance within 21 days, kept for at least 7 years.

### Student solo flights

- NZ rule 61.105 says a student must not fly solo unless, among other things, they hold at least a current class 2 medical certificate, the flight is authorised by a current Category A, B or C instructor (A or B for a first solo), they have had dual instruction within the last 5 hours of flight experience unless an A or B instructor authorises otherwise, and they have piloting experience in the preceding 30 days.
- AU CASR 61.114 requires a student flying solo to hold a class 1 or 2 medical certificate (or an exemption). CASR 61.112 requires the flight to be approved by and supervised by an instructor authorised by a Part 141 or 142 operator. CASR 61.115 requires a dual flight check within the previous 30 days in the same type, with a limit on solo hours since that check, subject to the exceptions in that regulation.

### Instructor currency

- NZ rule 61.307: a Category B or C instructor must have demonstrated competency to a flight examiner in the preceding 12 months; a Category A or E instructor in the preceding 24 months.
- AU CASR 61.1180: an instructor needs a valid instructor proficiency check. After the first year, each check is valid to the end of the 24th month after the month it was passed.
- Record the date the rating stops being current as the instructor's `rating_expiry`.

### Medical certificates

- NZ rule 67.61: class 1 up to 12 months (6 months for single-pilot passenger operations at 40 or over); class 2 up to 60 months under 40 and 24 months at 40 or over.
- AU CASR 67.205: class 1 up to 1 year; class 2 up to 4 years under 40 and 2 years at 40 or over.
- Record the expiry printed on the certificate. The system does not work it out from age.

### Aircraft

- NZ rule 91.615: a review of airworthiness certified within the preceding 12 months for an aircraft operated for hire or reward (24 months otherwise). NZ rule 91.605: the aircraft is maintained under its maintenance programme or the manufacturer's schedule. The 100 hourly in the demo is a programme check, set per aircraft.
- In Australia the scheduled checks come from the aircraft's maintenance programme or schedule. Set `next_check_hours` and `annual_due` from yours.

### Theory exams

- NZ rule 61.17: the pass mark is 70%, and a PPL, CPL or instrument rating exam credit is valid for 3 years.
- AU CASR 61.225 requires all parts of an examination to be passed within 2 years. The period an exam credit counts towards a flight test is set by the Part 61 Manual of Standards: set `exam_validity_months` from it.

## Implemented checks

| Rule | What it finds | Setting | Basis |
|---|---|---|---|
| SOLO-MEDICAL | A solo flown on a day the student had no current medical recorded | The expiry on the certificate | NZ 61.105 (class 2 for solo), 67.61; AU CASR 61.114, 67.205 |
| SOLO-CHECK | A solo flown with no dual or check flight in the window before it | `solo_check_days` | AU CASR 61.115 (dual check in 30 days); NZ 61.105 (dual within the last 5 hours, experience in 30 days). Set the window from your exposition |
| SYLLABUS-ORDER | A lesson flown before the lesson before it was signed off as competent | The order of your syllabus | Your syllabus under NZ Part 141 or AU Part 141/142; NZ 61.105 and AU CASR 61.1225 require the instructor to be satisfied before a solo |
| INSTRUCTOR-RATING | Instruction given on a day the instructor's rating had expired | The expiry on the rating | NZ 61.307; AU CASR 61.1180 |
| INSTRUCTOR-MEDICAL | An active instructor whose medical has expired | The expiry on the certificate | NZ 67.61; AU CASR 67.205; the medical class your exposition requires of instructors |
| INSTRUCTOR-HOURS | More hours of flight instruction in a day than your limit | `instructor_daily_hours` | Your exposition or fatigue scheme. House setting |
| NOT-GRADED | A flight with no grade or debrief after the set number of days | `grade_within_days` | AU CASR 141.275 (7 days), 142.355 (21 days); NZ 141.59. Set the days from your exposition |
| AIRCRAFT-CHECK | A serviceable aircraft at or past the hours of its next scheduled check | `next_check_hours` on the aircraft | NZ 91.605, 91.615; your maintenance programme |
| ANNUAL-EXPIRED | A serviceable aircraft past its annual review date | `annual_due` on the aircraft | NZ 91.605, 91.615; your maintenance programme |
| DEFERRAL-EXPIRED | A deferred defect not cleared by its due date | The due date set when it was deferred | Your maintenance controller's deferral, under the aircraft's maintenance programme |
| EXAM-EXPIRY | A theory exam pass that stops counting in the next 90 days for an active student | `exam_validity_months` | NZ 61.17 (3 years); AU: the Part 61 Manual of Standards |

Bookings get the same checks before they fly (`/tomorrow`, `/schedule`): a solo with no current medical or no recent dual check, a lesson whose previous lesson is not signed off, an aircraft unserviceable, past its check, out of its annual review or carrying an expired deferral, an instructor with an expired medical or rating, double bookings, and an account past its credit limit. `/book` refuses a booking with any of these unless the CFI says yes.

## Records that cannot be rewritten

A graded flight is not regraded: `/debrief` refuses a second grade and corrections go in a note with `/log`. Flights, grades, exams and payments are never deleted by any command, so the records are there for as long as your exposition says to keep them.

## Keeping this current

Sources were read on 3 November 2026. Rules change. When one does, change the setting and this page together, in the same commit, and run `npm test`.
