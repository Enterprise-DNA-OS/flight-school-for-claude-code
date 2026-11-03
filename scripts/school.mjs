#!/usr/bin/env node
// The one CLI for Flight School for Claude Code. Human tables by default, --json for machines.
//   npm run school -- help
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { parseCsv, pick, yesNo } from './lib/csv.mjs';

// Every read the CFI, the instructors and the office ask for, by name.
export const reads = {
  settings: 'select key,value,unit,note from settings order by key',
  courses: "select code,name,min_total,min_dual,min_solo,min_xc_solo,min_instrument,array_to_string(exams,', ') exams,(select count(*) from lessons l where l.course_id=c.id)::int lessons from courses c order by code",
  syllabus: 'select c.code course,l.seq,l.code,l.title,l.kind,l.planned_hours from lessons l join courses c on c.id=l.course_id order by c.code,l.seq',
  aircraft: 'select code,type,kind,rate,status,hours,next_check_name,hours_to_check,annual_due from v_fleet order by kind,code',
  instructors: 'select code,name,category,rate,rating_expiry,medical_class,medical_expiry,active from instructors order by code',
  students: 'select code,name,course,instructor,status,lessons_done,lessons_total,total_hours,last_flight,balance from v_students order by code',
  schedule: "select code,booked_on,starts,ends,kind,student,aircraft,instructor,lesson,problems from v_schedule where status='booked' and booked_on>=current_date order by booked_on,starts,code",
  today: "select code,starts,ends,kind,student,aircraft,instructor,lesson,problems from v_schedule where status='booked' and booked_on=current_date order by starts,code",
  tomorrow: "select code,starts,ends,kind,student,aircraft,instructor,lesson,problems from v_schedule where status='booked' and booked_on=current_date+1 order by starts,code",
  flights: 'select code,flown_on,student,instructor,aircraft,lesson,kind,hours,landings,outcome,grade,charge from v_flights order by flown_on desc,code',
  ungraded: 'select code,flown_on,current_date-flown_on days,student,instructor,aircraft,lesson,kind,hours from v_flights where outcome is null order by flown_on,code',
  progress: "select code,name,course,instructor,lessons_done||'/'||lessons_total lessons,next_lesson,total_hours,solo_hours,xc_solo_hours,days_since from v_students where status='active' order by course,lessons_done desc,code",
  quiet: "select code,name,course,instructor,last_flight,days_since,next_lesson from v_students v where status='active' and days_since>=setting('quiet_days') and not exists (select 1 from bookings b where b.student_id=v.student_id and b.status='booked' and b.booked_on>=current_date) order by days_since desc",
  'test-ready': "select student,name,course,instructor,total_hours,solo_hours,xc_solo_hours,case when missing='' then 'ready' else missing end missing from v_test_ready order by missing<>'',lessons_total-lessons_done,student",
  exams: 'select s.code student,e.subject,e.sat_on,e.score,e.pass_mark,case when e.score>=e.pass_mark then \'pass\' else \'fail\' end result,(e.sat_on+(setting(\'exam_validity_months\')||\' months\')::interval)::date counts_until from exams e join students s on s.id=e.student_id order by s.code,e.subject,e.sat_on',
  accounts: "select b.student,b.name,b.charged,b.paid,b.balance,b.credit_limit,b.last_paid from v_balances b join students s on s.id=b.student_id where s.status<>'withdrawn' order by b.balance",
  'in-debit': "select b.student,b.name,b.balance,b.credit_limit,b.last_paid,(select count(*) from bookings k where k.student_id=b.student_id and k.status='booked' and k.booked_on>=current_date)::int bookings_ahead from v_balances b join students s on s.id=b.student_id where s.status='active' and b.balance<-b.credit_limit order by b.balance",
  currency: 'select who,code,name,detail,medical_class,medical_expiry,medical_days,rating_expiry,rating_days from v_currency order by least(coalesce(medical_days,9999),coalesce(rating_days,9999)),code',
  fleet: 'select code,type,status,hours,next_check_name,next_check_hours,hours_to_check,hours_a_day,annual_due,days_to_annual,open_defects,deferred_defects from v_fleet order by kind,code',
  defects: "select d.code,a.code aircraft,d.raised_on,d.description,d.deferred,d.due_on,d.cleared_on,d.cleared_ref,case when d.cleared_on is not null then 'cleared' when d.deferred and d.due_on<current_date then 'deferral expired' when d.deferred then 'deferred' else 'open' end state from defects d join aircraft a on a.id=d.aircraft_id order by d.cleared_on nulls first,d.due_on nulls first,d.code",
  utilisation: "select a.code aircraft,a.type,coalesce(sum(f.hours) filter (where f.flown_on>current_date-7),0) hours_7d,coalesce(sum(f.hours) filter (where f.flown_on>current_date-28),0) hours_28d,coalesce(sum(f.hours) filter (where f.flown_on>current_date-90),0) hours_90d,coalesce(sum(f.charge) filter (where f.flown_on>current_date-90),0) charged_90d,(select count(*) from bookings b where b.aircraft_id=a.id and b.status in ('cancelled','no-show') and b.booked_on>current_date-90)::int lost_bookings_90d from aircraft a left join flights f on f.aircraft_id=a.id group by a.id order by hours_90d desc,a.code",
  cancellations: "select coalesce(cancel_reason,'no-show') reason,count(*)::int bookings,round(sum(extract(epoch from (ends-starts))/3600)::numeric,1) hours_lost,max(booked_on) latest from bookings where status in ('cancelled','no-show') and booked_on>current_date-90 group by 1 order by bookings desc",
  'instructor-load': 'select code,name,category,hours_7d,hours_28d,flights_28d,students,not_graded,booked_7d from v_instructor_load order by hours_28d desc',
  compliance: 'select rule,record,issue from v_compliance order by rule,record',
  attention: 'select kind,record,due,detail from v_attention order by due nulls last,kind,record',
};

const named = {
  courses: { by: 'code', names: true }, aircraft: { by: 'code', names: 'type' }, instructors: { by: 'code', names: true },
  students: { by: 'code', names: true }, bookings: { by: 'code' }, flights: { by: 'code' }, defects: { by: 'code', names: 'description' },
};

// Exact code or id first, then a unique prefix or name match. Ambiguity lists candidates.
export async function resolve(db, entity, value) {
  const label = entity === 'aircraft' ? entity : entity.replace(/s$/, '');
  if (!value || value === true) throw Error(`Supply a ${label} code, name or id prefix`);
  const { by, names } = named[entity];
  const exact = await db.query(`select * from ${entity} where lower(${by})=lower($1) or id::text=$1${names === true ? ' or lower(name)=lower($1)' : ''}`, [String(value)]);
  if (exact.length === 1) return exact[0];
  const nameCol = names === true ? 'name' : names;
  const found = await db.query(`select * from ${entity} where starts_with(lower(${by}),lower($1)) or starts_with(id::text,$1)${nameCol ? ` or position(lower($1) in lower(${nameCol}))>0` : ''} order by ${by}`, [String(value)]);
  if (found.length === 1) return found[0];
  const list = found.map((r) => `${r[by]}${nameCol ? ' ' + r[nameCol] : ''}`).join('; ') || '(none)';
  throw Error(`${found.length ? 'Ambiguous' : 'No matching'} ${label}: ${value}. Candidates: ${list}`);
}

// A lesson by its code, or by its number in the student's own course ("9" or "09").
async function lessonFor(db, student, value) {
  if (!value || value === true) return null;
  const v = String(value).trim();
  const rows = /^\d+$/.test(v)
    ? await db.query('select * from lessons where course_id=$1 and seq=$2', [student.course_id, Number(v)])
    : await db.query('select * from lessons where lower(code)=lower($1) or (course_id=$2 and position(lower($1) in lower(title))>0) order by seq', [v, student.course_id]);
  if (rows.length === 1) return rows[0];
  throw Error(`${rows.length ? 'Ambiguous' : 'No matching'} lesson: ${v}${rows.length ? '. Candidates: ' + rows.map((r) => `${r.code} ${r.title}`).join('; ') : ''}`);
}

const required = (v, n) => { if (v === undefined || v === null || v === true || String(v).trim() === '') throw Error(`Required: ${n}`); return String(v).trim(); };
const number = (v, n, { positive = false, min } = {}) => {
  const x = Number(required(v, n));
  if (!Number.isFinite(x) || (positive && x <= 0) || (min !== undefined && x < min)) throw Error(`Invalid ${n}: ${v}`);
  return x;
};
const date = (v, n = 'date') => {
  required(v, n);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) throw Error(`Invalid ${n}: use a real YYYY-MM-DD date`);
  return v;
};
const time = (v, n) => {
  const s = required(v, `${n} (HH:MM)`);
  if (!/^\d{2}:\d{2}$/.test(s) || Number(s.slice(0, 2)) > 23 || Number(s.slice(3)) > 59) throw Error(`Invalid ${n}: ${s}. Use HH:MM`);
  return s;
};
// "1.3" or "1:18" -> 1.3 hours, to one decimal.
const hoursOf = (v, n) => {
  const s = required(v, n);
  const m = s.match(/^(\d+):(\d{2})$/);
  const h = m ? Number(m[1]) + Number(m[2]) / 60 : Number(s);
  if (!Number.isFinite(h) || h <= 0) throw Error(`Invalid ${n}: ${s}`);
  return Math.round(h * 10) / 10;
};
const today = () => new Date().toISOString().slice(0, 10);
const ymd = (d) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);
const kinds = ['dual', 'solo', 'check', 'sim'];

async function transaction(db, fn, dry = false) {
  await db.exec('begin');
  try { const out = await fn(); await db.exec(dry ? 'rollback' : 'commit'); return out; }
  catch (e) { await db.exec('rollback'); throw e; }
}

async function nextCode(db, tbl, prefix, start) {
  const r = await db.query(`select greatest(max(substring(code from ${prefix.length + 1})::int),$2) n from ${tbl} where code ~ $1`, [`^${prefix}[0-9]+$`, start]);
  return `${prefix}${Number(r[0].n) + 1}`;
}

async function chargeFor(db, aircraftId, instructorId, kind, hours) {
  const a = (await db.query('select rate from aircraft where id=$1', [aircraftId]))[0];
  const i = instructorId && kind !== 'solo' ? (await db.query('select rate from instructors where id=$1', [instructorId]))[0] : null;
  return Math.round(hours * (Number(a.rate) + Number(i?.rate || 0)) * 100) / 100;
}

const entities = ['settings', 'courses', 'lessons', 'aircraft', 'instructors', 'students', 'exams', 'bookings', 'flights', 'payments', 'defects', 'notes'];

export const help = [
  ...Object.keys(reads),
  'student <code|name>', 'instructor <code|name>',
  'add course <code> <name> [--total=h --dual=h --solo=h --xc-solo=h --instrument=h] [--exams="Air Law,Navigation"]',
  'add lesson <course> <seq> <title> --kind=dual|solo|check|sim [--hours=1.0] [--code=PPL-15]',
  'add aircraft <rego> --type=C172 --rate=340 [--kind=aeroplane|helicopter|simulator] [--hours=tacho] [--next-check=hours] [--check-name=..] [--annual=YYYY-MM-DD]',
  'add instructor <code> <name> [--category=..] [--rate=..] [--rating=YYYY-MM-DD] [--medical=YYYY-MM-DD] [--medical-class=1|2]',
  'add student <code> <name> --course=PPL [--instructor=..] [--medical=YYYY-MM-DD] [--medical-class=1|2] [--email=..] [--phone=..] [--sponsor=..] [--credit-limit=..] [--prior-total=h --prior-solo=h --prior-xc-solo=h --prior-instrument=h]',
  'book <student> --date=YYYY-MM-DD --start=HH:MM --end=HH:MM [--aircraft=..] [--instructor=..] [--lesson=code|number] [--kind=dual|solo|check|sim] [--force]',
  'cancel <booking> --reason=weather|aircraft|instructor|student|other', 'no-show <booking>',
  'fly <booking> (--tacho=8432.2-8433.6 | --hours=1.4) [--landings=n] [--xc] [--instrument=h] [--date=YYYY-MM-DD]',
  'fly --student=.. --aircraft=.. --date=YYYY-MM-DD --hours=1.2 [--instructor=..] [--lesson=..] [--kind=..]',
  'grade <flight> competent|repeat|incomplete --debrief="..." [--grade=1-5]',
  'exam <student> <subject> --score=n [--date=YYYY-MM-DD] [--pass-mark=70]',
  'pay <student> <amount> --ref=.. [--date=YYYY-MM-DD]',
  'renew <instructor|student> medical|rating --date=YYYY-MM-DD [--class=1|2]',
  'assign <student> --instructor=..', 'status <student> active|paused|completed|withdrawn',
  'defect <aircraft> <description> [--defer --due=YYYY-MM-DD]', 'clear <defect> --ref=work order',
  'serviceable <aircraft> on|off', 'check-done <aircraft> --next=hours [--name=..] [--annual=YYYY-MM-DD]',
  'setting <key> <value>', 'log <student> <note>',
  'import flightlogger <folder> [--dry-run] [--map=file.json]', 'export <folder>',
  'draft-progress <student>', 'draft-statement <student>', 'draft-recommendation <student>',
];

export async function run(db, args) {
  const flags = {}; const pos = [];
  for (const a of args) {
    if (a.startsWith('--')) { const i = a.indexOf('='); flags[a.slice(2, i < 0 ? undefined : i)] = i < 0 ? true : a.slice(i + 1); }
    else pos.push(a);
  }
  const [cmd = 'help', ...a] = pos;
  if (cmd === 'help') return help.map((command) => ({ command }));
  if (reads[cmd]) return db.query(reads[cmd]);

  if (cmd === 'student') {
    const s = await resolve(db, 'students', a.join(' ') || undefined);
    return {
      student: await db.query('select code,name,course,instructor,status,sponsor,medical_class,medical_expiry,started_on,total_hours,dual_hours,solo_hours,xc_solo_hours,instrument_hours,sim_hours,balance from v_students where student_id=$1', [s.id]),
      syllabus: await db.query("select lesson,title,kind,attempts,case when competent then 'competent' when attempts>0 then 'in progress' else '' end state,competent_on from v_lesson_progress where student_id=$1 order by seq", [s.id]),
      test_ready: await db.query("select case when missing='' then 'ready' else missing end missing from v_test_ready where student=$1", [s.code]),
      flights: await db.query('select code,flown_on,lesson,kind,aircraft,instructor,hours,outcome,grade,debrief from v_flights where student_id=$1 order by flown_on desc,code limit 10', [s.id]),
      booked: await db.query("select code,booked_on,starts,kind,lesson,aircraft,instructor,problems from v_schedule where student=$1 and status='booked' and booked_on>=current_date order by booked_on,starts", [s.code]),
      exams: await db.query("select subject,sat_on,score,case when score>=pass_mark then 'pass' else 'fail' end result from exams where student_id=$1 order by sat_on", [s.id]),
      notes: await db.query('select created_at,body from notes where student_id=$1 order by created_at', [s.id]),
    };
  }
  if (cmd === 'instructor') {
    const i = await resolve(db, 'instructors', a.join(' ') || undefined);
    return {
      instructor: await db.query('select * from v_instructor_load where code=$1', [i.code]),
      currency: await db.query('select medical_class,medical_expiry,medical_days,rating_expiry,rating_days from v_currency where who=$1 and code=$2', ['instructor', i.code]),
      not_graded: await db.query('select code,flown_on,student,lesson,hours from v_flights where instructor_id=$1 and outcome is null order by flown_on', [i.id]),
      booked: await db.query("select code,booked_on,starts,ends,student,lesson,aircraft,problems from v_schedule where instructor=$1 and status='booked' and booked_on>=current_date order by booked_on,starts", [i.code]),
      students: await db.query("select v.code,v.name,v.course,v.lessons_done||'/'||v.lessons_total lessons,v.days_since from v_students v join students s on s.id=v.student_id where s.instructor_id=$1 and v.status='active' order by v.code", [i.id]),
    };
  }

  if (cmd === 'export') {
    const dir = path.resolve(required(a[0], 'export folder'));
    fs.mkdirSync(dir, { recursive: true });
    return transaction(db, async () => {
      await db.exec('set transaction isolation level repeatable read');
      const counts = [];
      for (const t of entities) {
        const rows = await db.query(`select * from ${t} order by ${t === 'settings' ? 'key' : 'id'}`);
        fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(rows, null, 2) + '\n');
        counts.push({ entity: t, rows: rows.length });
      }
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ version: 1, at: new Date().toISOString(), counts }, null, 2) + '\n');
      return counts;
    });
  }

  if (cmd === 'import') return importFlightLogger(db, a, flags);
  if (cmd === 'add') return transaction(db, () => add(db, a, flags));

  if (cmd === 'book') return transaction(db, async () => {
    const s = await resolve(db, 'students', a.join(' ') || undefined);
    if (s.status !== 'active') throw Error(`${s.code} is ${s.status}: set them active before booking`);
    const lesson = await lessonFor(db, s, flags.lesson);
    const kind = flags.kind ? String(flags.kind) : lesson?.kind || 'dual';
    if (!kinds.includes(kind)) throw Error(`Invalid kind: ${kind}`);
    const ac = flags.aircraft ? await resolve(db, 'aircraft', flags.aircraft) : null;
    if (!ac && kind !== 'sim') throw Error('Required: --aircraft for a flight booking');
    const instr = flags.instructor ? await resolve(db, 'instructors', flags.instructor) : null;
    if (kind === 'solo' && instr) throw Error('A solo booking has no instructor: book a dual or check instead');
    const day = date(flags.date);
    if (day < today()) throw Error(`${day} is in the past: log what was flown with fly instead`);
    const code = await nextCode(db, 'bookings', 'B', 2000);
    await db.query('insert into bookings(code,booked_on,starts,ends,student_id,aircraft_id,instructor_id,lesson_id,kind) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [code, day, time(flags.start, 'start'), time(flags.end, 'end'), s.id, ac?.id || null, instr?.id || null, lesson?.id || null, kind]);
    const row = await db.query('select code,booked_on,starts,ends,kind,student,aircraft,instructor,lesson,problems from v_schedule where code=$1', [code]);
    if (row[0].problems && !flags.force) throw Error(`Not booked: ${row[0].problems}. Fix these, or add --force once the CFI has said yes`);
    return row;
  });

  if (cmd === 'cancel' || cmd === 'no-show') return transaction(db, async () => {
    const b = await resolve(db, 'bookings', a[0]);
    if (b.status !== 'booked') throw Error(`Booking ${b.code} is ${b.status}: cannot ${cmd}`);
    if (cmd === 'no-show') return db.query("update bookings set status='no-show' where id=$1 returning code,status", [b.id]);
    const reason = required(flags.reason, 'reason (--reason=weather|aircraft|instructor|student|other)');
    return db.query("update bookings set status='cancelled',cancel_reason=$2 where id=$1 returning code,status,cancel_reason", [b.id, reason]);
  });

  if (cmd === 'fly') return transaction(db, async () => {
    let b = null; let s; let ac; let instr; let lesson; let kind; let day;
    if (a[0]) {
      b = await resolve(db, 'bookings', a[0]);
      if (b.status !== 'booked') throw Error(`Booking ${b.code} is ${b.status}: cannot log it again`);
      s = (await db.query('select * from students where id=$1', [b.student_id]))[0];
      ac = flags.aircraft ? await resolve(db, 'aircraft', flags.aircraft) : b.aircraft_id ? (await db.query('select * from aircraft where id=$1', [b.aircraft_id]))[0] : null;
      instr = b.instructor_id ? (await db.query('select * from instructors where id=$1', [b.instructor_id]))[0] : null;
      lesson = b.lesson_id ? (await db.query('select * from lessons where id=$1', [b.lesson_id]))[0] : null;
      kind = b.kind; day = flags.date ? date(flags.date) : ymd(b.booked_on);
    } else {
      s = await resolve(db, 'students', flags.student);
      ac = await resolve(db, 'aircraft', flags.aircraft);
      instr = flags.instructor ? await resolve(db, 'instructors', flags.instructor) : null;
      lesson = await lessonFor(db, s, flags.lesson);
      kind = flags.kind ? String(flags.kind) : lesson?.kind || (instr ? 'dual' : 'solo');
      day = date(flags.date || today());
    }
    if (!ac) throw Error('Required: --aircraft (the booking has none)');
    if (!kinds.includes(kind)) throw Error(`Invalid kind: ${kind}`);
    if (kind === 'solo' && instr) throw Error('A solo flight has no instructor');
    if (['dual', 'check'].includes(kind) && !instr) throw Error(`A ${kind} flight needs --instructor`);
    if (day > today()) throw Error(`${day} has not happened yet`);
    let start = null; let end = null; let hours;
    if (flags.tacho) {
      const m = String(flags.tacho).match(/^(\d+(?:\.\d)?)-(\d+(?:\.\d)?)$/);
      if (!m) throw Error('Invalid --tacho: use start-end, for example 8432.2-8433.6');
      start = Number(m[1]); end = Number(m[2]);
      if (end <= start) throw Error('Tacho end must be after tacho start');
      hours = Math.round((end - start) * 10) / 10;
    } else hours = hoursOf(flags.hours, 'hours (--hours or --tacho)');
    const code = await nextCode(db, 'flights', 'F', 2000);
    const charge = await chargeFor(db, ac.id, instr?.id, kind, hours);
    const out = await db.query('insert into flights(code,booking_id,flown_on,aircraft_id,student_id,instructor_id,lesson_id,kind,tacho_start,tacho_end,hours,landings,xc,instrument_hours,charge) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning code,flown_on,kind,hours,charge',
      [code, b?.id || null, day, ac.id, s.id, instr?.id || null, lesson?.id || null, kind, start, end, hours,
        flags.landings ? number(flags.landings, 'landings', { min: 0 }) : 1, Boolean(flags.xc), flags.instrument ? number(flags.instrument, 'instrument hours', { min: 0 }) : 0, charge]);
    if (b) await db.query("update bookings set status='flown' where id=$1", [b.id]);
    return out;
  });

  if (cmd === 'grade') return transaction(db, async () => {
    const f = await resolve(db, 'flights', a[0]);
    const outcome = required(a[1], 'outcome: competent, repeat or incomplete');
    if (!['competent', 'repeat', 'incomplete'].includes(outcome)) throw Error(`Invalid outcome: ${outcome}. Use competent, repeat or incomplete`);
    if (f.outcome) throw Error(`Flight ${f.code} was graded ${f.outcome} on ${ymd(f.graded_on)}. Training records are not rewritten: add a note with log instead`);
    const grade = flags.grade ? number(flags.grade, 'grade', { min: 1 }) : null;
    if (grade !== null && (grade > 5 || !Number.isInteger(grade))) throw Error('Invalid grade: use a whole number 1 to 5');
    return db.query('update flights set outcome=$2,grade=$3,debrief=$4,graded_on=current_date where id=$1 returning code,outcome,grade,debrief',
      [f.id, outcome, grade, required(flags.debrief, 'debrief (--debrief="what was covered and what is next")')]);
  });

  if (cmd === 'exam') return transaction(db, async () => {
    const s = await resolve(db, 'students', a[0]);
    const subject = required(a.slice(1).join(' '), 'subject');
    const score = number(flags.score, 'score (--score)', { min: 0 });
    if (score > 100) throw Error('Invalid score: 0 to 100');
    return db.query("insert into exams(student_id,subject,sat_on,score,pass_mark) values($1,$2,$3,$4,$5) returning subject,sat_on,score,case when score>=pass_mark then 'pass' else 'fail' end result",
      [s.id, subject, flags.date ? date(flags.date) : today(), score, flags['pass-mark'] ? number(flags['pass-mark'], 'pass mark', { min: 0 }) : 70]);
  });

  if (cmd === 'pay') return transaction(db, async () => {
    const s = await resolve(db, 'students', a[0]);
    const amount = number(a[1], 'amount', { positive: true });
    await db.query('insert into payments(student_id,paid_on,amount,ref) values($1,$2,$3,$4)', [s.id, flags.date ? date(flags.date) : today(), amount, required(flags.ref, 'reference (--ref)')]);
    return db.query('select student,name,charged,paid,balance from v_balances where student_id=$1', [s.id]);
  });

  if (cmd === 'renew') return transaction(db, async () => {
    const what = required(a[1], 'medical or rating');
    const on = date(flags.date, 'expiry date (--date)');
    const instr = (await db.query('select * from instructors where lower(code)=lower($1) or lower(name)=lower($1)', [String(a[0] || '')]))[0];
    if (what === 'rating') {
      const i = instr || await resolve(db, 'instructors', a[0]);
      return db.query('update instructors set rating_expiry=$2 where id=$1 returning code,name,rating_expiry', [i.id, on]);
    }
    if (what !== 'medical') throw Error(`Renew medical or rating, not ${what}`);
    const cls = flags.class ? number(flags.class, 'class') : null;
    if (instr) return db.query('update instructors set medical_expiry=$2,medical_class=coalesce($3,medical_class) where id=$1 returning code,name,medical_class,medical_expiry', [instr.id, on, cls]);
    const s = await resolve(db, 'students', a[0]);
    return db.query('update students set medical_expiry=$2,medical_class=coalesce($3,medical_class) where id=$1 returning code,name,medical_class,medical_expiry', [s.id, on, cls]);
  });

  if (cmd === 'assign') return transaction(db, async () => {
    const s = await resolve(db, 'students', a[0]);
    const i = await resolve(db, 'instructors', flags.instructor);
    return db.query('update students set instructor_id=$2 where id=$1 returning code,name', [s.id, i.id]);
  });
  if (cmd === 'status') return transaction(db, async () => {
    const s = await resolve(db, 'students', a[0]);
    const st = required(a[1], 'status');
    if (!['active', 'paused', 'completed', 'withdrawn'].includes(st)) throw Error(`Invalid status: ${st}`);
    return db.query('update students set status=$2 where id=$1 returning code,name,status', [s.id, st]);
  });

  if (cmd === 'defect') return transaction(db, async () => {
    const ac = await resolve(db, 'aircraft', a[0]);
    const code = await nextCode(db, 'defects', 'D', 300);
    if (flags.defer) date(flags.due, 'deferral due date (--due)');
    const out = await db.query('insert into defects(code,aircraft_id,description,deferred,due_on) values($1,$2,$3,$4,$5) returning code,description,deferred,due_on',
      [code, ac.id, required(a.slice(1).join(' '), 'description'), Boolean(flags.defer), flags.defer ? flags.due : null]);
    if (!flags.defer) await db.query("update aircraft set status='unserviceable' where id=$1", [ac.id]);
    return out;
  });
  if (cmd === 'clear') return transaction(db, async () => {
    const d = await resolve(db, 'defects', a[0]);
    if (d.cleared_on) throw Error(`Defect ${d.code} was cleared on ${ymd(d.cleared_on)}`);
    return db.query('update defects set cleared_on=current_date,cleared_ref=$2 where id=$1 returning code,cleared_on,cleared_ref', [d.id, required(flags.ref, 'work order (--ref)')]);
  });
  if (cmd === 'serviceable') return transaction(db, async () => {
    const ac = await resolve(db, 'aircraft', a[0]);
    const on = required(a[1], 'on or off');
    if (on === 'on') {
      const open = await db.query('select code from defects where aircraft_id=$1 and cleared_on is null and not deferred', [ac.id]);
      if (open.length && !flags.force) throw Error(`${ac.code} has open defects: ${open.map((d) => d.code).join(', ')}. Clear or defer them first`);
    }
    return db.query('update aircraft set status=$2 where id=$1 returning code,status', [ac.id, on === 'on' ? 'serviceable' : 'unserviceable']);
  });
  if (cmd === 'check-done') return transaction(db, async () => {
    const ac = await resolve(db, 'aircraft', a[0]);
    const cur = (await db.query('select hours from v_fleet where aircraft_id=$1', [ac.id]))[0];
    const next = number(flags.next, 'next check hours (--next)', { positive: true });
    if (next <= Number(cur.hours)) throw Error(`Next check at ${next} is not after the current ${cur.hours} hours`);
    return db.query('update aircraft set next_check_hours=$2,next_check_name=coalesce($3,next_check_name),annual_due=coalesce($4,annual_due) where id=$1 returning code,next_check_name,next_check_hours,annual_due',
      [ac.id, next, flags.name || null, flags.annual ? date(flags.annual, 'annual') : null]);
  });

  if (cmd === 'setting') return transaction(db, async () => {
    const key = required(a[0], 'key');
    const rows = await db.query('update settings set value=$2 where key=$1 returning key,value,unit,note', [key, number(a[1], 'value', { min: 0 })]);
    if (!rows.length) throw Error(`No setting ${key}. Settings: ${(await db.query('select key from settings order by key')).map((r) => r.key).join(', ')}`);
    return rows;
  });
  if (cmd === 'log') return transaction(db, async () => {
    const s = await resolve(db, 'students', a[0]);
    return db.query('insert into notes(student_id,body) values($1,$2) returning created_at,body', [s.id, required(a.slice(1).join(' '), 'note')]);
  });

  if (cmd.startsWith('draft-')) return draft(db, cmd, a.join(' '));
  throw Error(`Unknown command: ${cmd}. Run help`);
}

async function add(db, a, flags) {
  const [what, code, ...rest] = a;
  const name = rest.join(' ');
  const opt = (k, n, o) => (flags[k] !== undefined ? number(flags[k], n, o) : null);
  const optDate = (k) => (flags[k] ? date(flags[k], k) : null);
  if (what === 'course') {
    return db.query('insert into courses(code,name,min_total,min_dual,min_solo,min_xc_solo,min_instrument,exams) values($1,$2,$3,$4,$5,$6,$7,$8) returning code,name',
      [required(code, 'course code').toUpperCase(), required(name, 'course name'), opt('total', 'total', { min: 0 }) || 0, opt('dual', 'dual', { min: 0 }) || 0, opt('solo', 'solo', { min: 0 }) || 0,
        opt('xc-solo', 'cross-country solo', { min: 0 }) || 0, opt('instrument', 'instrument', { min: 0 }) || 0,
        flags.exams ? String(flags.exams).split(',').map((x) => x.trim()).filter(Boolean) : []]);
  }
  if (what === 'lesson') {
    const c = await resolve(db, 'courses', code);
    const seq = number(rest[0], 'lesson number', { positive: true });
    const kind = required(flags.kind, 'kind (--kind=dual|solo|check|sim)');
    if (!kinds.includes(kind)) throw Error(`Invalid kind: ${kind}`);
    return db.query('insert into lessons(course_id,seq,code,title,kind,planned_hours) values($1,$2,$3,$4,$5,$6) returning code,title,kind',
      [c.id, seq, flags.code || `${c.code}-${String(seq).padStart(2, '0')}`, required(rest.slice(1).join(' '), 'lesson title'), kind, opt('hours', 'hours', { positive: true }) || 1]);
  }
  if (what === 'aircraft') {
    return db.query('insert into aircraft(code,type,kind,rate,hours_base,next_check_hours,next_check_name,annual_due) values($1,$2,$3,$4,$5,$6,$7,$8) returning code,type,rate',
      [required(code, 'registration').toUpperCase(), required(flags.type, 'type (--type)'), flags.kind || 'aeroplane', number(flags.rate, 'hourly rate (--rate)', { min: 0 }),
        opt('hours', 'hours', { min: 0 }) || 0, opt('next-check', 'next check', { positive: true }), flags['check-name'] || (flags['next-check'] ? '100 hourly' : null), optDate('annual')]);
  }
  if (what === 'instructor') {
    return db.query('insert into instructors(code,name,category,rate,rating_expiry,medical_class,medical_expiry) values($1,$2,$3,$4,$5,$6,$7) returning code,name,category',
      [required(code, 'instructor code').toUpperCase(), required(name, 'name'), flags.category || null, opt('rate', 'rate', { min: 0 }) || 0, optDate('rating'), opt('medical-class', 'medical class'), optDate('medical')]);
  }
  if (what === 'student') {
    const c = await resolve(db, 'courses', required(flags.course, 'course (--course)'));
    const i = flags.instructor ? await resolve(db, 'instructors', flags.instructor) : null;
    return db.query('insert into students(code,name,course_id,instructor_id,email,phone,sponsor,medical_class,medical_expiry,credit_limit,prior_total,prior_solo,prior_xc_solo,prior_instrument) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning code,name',
      [required(code, 'student code').toUpperCase(), required(name, 'name'), c.id, i?.id || null, flags.email || null, flags.phone || null, flags.sponsor || null,
        opt('medical-class', 'medical class'), optDate('medical'), opt('credit-limit', 'credit limit', { min: 0 }) || 0,
        opt('prior-total', 'prior total', { min: 0 }) || 0, opt('prior-solo', 'prior solo', { min: 0 }) || 0, opt('prior-xc-solo', 'prior cross-country solo', { min: 0 }) || 0, opt('prior-instrument', 'prior instrument', { min: 0 }) || 0]);
  }
  throw Error('add course|lesson|aircraft|instructor|student');
}

// FlightLogger exports: an aircraft list, a user list and the raw data flight report.
const importFiles = [
  { match: /^(aircraft|fleet)/, entity: 'aircraft' },
  { match: /^(users?|people|students?|instructors?)/, entity: 'users' },
  { match: /^(flights?|raw)/, entity: 'flights' },
];

async function importFlightLogger(db, a, flags) {
  if (a[0] !== 'flightlogger') throw Error('Supported import: flightlogger. See docs/replace-flightlogger.md');
  const dir = path.resolve(required(a[1], 'folder of FlightLogger CSV exports'));
  const mapping = flags.map ? JSON.parse(fs.readFileSync(flags.map, 'utf8')) : {};
  const files = fs.readdirSync(dir).filter((n) => /\.csv$/i.test(n));
  if (!files.length) throw Error(`No CSV files in ${dir}`);
  const rank = (f) => { const i = importFiles.findIndex((x) => x.match.test(f.toLowerCase())); return i < 0 ? 9 : i; };
  files.sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
  return transaction(db, async () => {
    const out = [];
    for (const file of files) {
      const spec = importFiles.find((x) => x.match.test(file.toLowerCase()));
      if (!spec) throw Error(`Unrecognised file ${file}: expected Aircraft, Users or Flights. See docs/replace-flightlogger.md`);
      const rows = parseCsv(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (!rows.length) throw Error(`Empty file: ${file}`);
      let added = 0;
      for (const raw of rows) {
        const row = { ...raw };
        for (const [ours, theirs] of Object.entries(mapping[spec.entity] || {})) {
          if (!(theirs in raw)) throw Error(`${file}: mapped column "${theirs}" is not in the file`);
          row[ours] = raw[theirs];
        }
        if (spec.entity === 'aircraft') await importAircraft(db, file, row);
        else if (spec.entity === 'users') await importUser(db, file, row);
        else await importFlight(db, file, row);
        added++;
      }
      out.push({ file, entity: spec.entity, rows: added, dry_run: Boolean(flags['dry-run']) });
    }
    return out;
  }, Boolean(flags['dry-run']));
}

async function importAircraft(db, file, row) {
  const rego = required(pick(row, 'Registration', 'Aircraft', 'Callsign'), `${file}: Registration`).toUpperCase();
  const type = required(pick(row, 'Type', 'Aircraft type', 'Model'), `${file} ${rego}: Type`);
  const rate = pick(row, 'Hourly rate', 'Price per hour', 'Rate');
  const hours = pick(row, 'Total time', 'Tacho', 'Hobbs', 'Airframe hours');
  const sim = /sim/i.test(pick(row, 'Category', 'Class', 'Kind') + ' ' + type);
  await db.query('insert into aircraft(code,type,kind,rate,hours_base) values($1,$2,$3,$4,$5) on conflict(code) do update set type=excluded.type,rate=case when $6 then excluded.rate else aircraft.rate end',
    [rego, type, sim ? 'simulator' : 'aeroplane', rate ? number(rate, `${file} ${rego}: rate`, { min: 0 }) : 0, hours ? number(hours, `${file} ${rego}: hours`, { min: 0 }) : 0, Boolean(rate)]);
}

const personCode = (name) => name.split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, '')).filter(Boolean).map((w, i, arr) => (i === arr.length - 1 ? w : w[0])).join('').toUpperCase().slice(0, 12);

async function importUser(db, file, row) {
  const name = pick(row, 'Name', 'Full name') || [pick(row, 'First name', 'Firstname'), pick(row, 'Last name', 'Lastname', 'Surname')].filter(Boolean).join(' ');
  required(name, `${file}: Name`);
  const role = pick(row, 'Role', 'User type', 'Type').toLowerCase();
  const code = (pick(row, 'Initials', 'Code', 'Student ID', 'Callsign') || personCode(name)).toUpperCase();
  const medical = pick(row, 'Medical expiry', 'Medical expires', 'Medical');
  const med = medical ? date(medical.slice(0, 10), `${file} ${name}: medical expiry`) : null;
  if (/instructor/.test(role)) {
    const rating = pick(row, 'Instructor rating expiry', 'Rating expiry');
    await db.query('insert into instructors(code,name,email,phone,medical_expiry,rating_expiry) values($1,$2,$3,$4,$5,$6) on conflict(code) do update set name=excluded.name,email=coalesce(excluded.email,instructors.email),medical_expiry=coalesce(excluded.medical_expiry,instructors.medical_expiry),rating_expiry=coalesce(excluded.rating_expiry,instructors.rating_expiry)',
      [code, name, pick(row, 'Email', 'E-mail') || null, pick(row, 'Phone', 'Mobile') || null, med, rating ? date(rating.slice(0, 10), `${file} ${name}: rating expiry`) : null]);
    return;
  }
  if (role && !/student/.test(role)) return; // renters, staff and guests are not training records
  const program = pick(row, 'Program', 'Class', 'Course', 'Training program');
  const course = program ? (await db.query('select id from courses where lower(code)=lower($1) or lower(name)=lower($1) or position(lower(code) in lower($1))>0 order by length(code) desc limit 1', [program]))[0] : null;
  const status = /inactive|archiv|completed/i.test(pick(row, 'Status', 'Active')) ? 'paused' : 'active';
  await db.query('insert into students(code,name,course_id,email,phone,medical_expiry,status) values($1,$2,$3,$4,$5,$6,$7) on conflict(code) do update set name=excluded.name,course_id=coalesce(excluded.course_id,students.course_id),email=coalesce(excluded.email,students.email),medical_expiry=coalesce(excluded.medical_expiry,students.medical_expiry)',
    [code, name, course?.id || null, pick(row, 'Email', 'E-mail') || null, pick(row, 'Phone', 'Mobile') || null, med, status]);
}

async function person(db, tbl, value, file, what) {
  if (!value) return null;
  const r = await db.query(`select * from ${tbl} where lower(code)=lower($1) or lower(name)=lower($1)`, [value]);
  if (r.length !== 1) throw Error(`${file}: ${what} "${value}" ${r.length ? 'matches more than one record' : 'is not in the database or the Users file'}`);
  return r[0];
}

// One raw data flight report row is one flight.
async function importFlight(db, file, row) {
  const day = date(required(pick(row, 'Date', 'Flight date', 'Off block date'), `${file}: Date`).slice(0, 10), `${file}: Date`);
  const rego = required(pick(row, 'Aircraft', 'Registration', 'Callsign'), `${file} ${day}: Aircraft`).toUpperCase();
  const ac = (await db.query('select * from aircraft where lower(code)=lower($1)', [rego]))[0];
  if (!ac) throw Error(`${file}: flight on ${day} names aircraft ${rego}, which is not in the database or the Aircraft file`);
  const s = await person(db, 'students', required(pick(row, 'Student', 'Student name', 'Pilot'), `${file} ${day}: Student`), file, 'student');
  const instr = await person(db, 'instructors', pick(row, 'Instructor', 'Instructor name'), file, 'instructor');
  const typeText = pick(row, 'Flight type', 'Type', 'Training type').toLowerCase();
  let kind = /sim/.test(typeText) || ac.kind === 'simulator' ? 'sim' : /check|progress|test/.test(typeText) ? 'check' : /solo|spic|pic/.test(typeText) || !instr ? 'solo' : 'dual';
  if (kind === 'solo' && instr) kind = 'dual';
  const lessonText = pick(row, 'Lesson', 'Lecture', 'Exercise');
  const lesson = lessonText && s.course_id
    ? (await db.query('select * from lessons where course_id=$1 and (lower(code)=lower($2) or lower(title)=lower($2))', [s.course_id, lessonText]))[0] || null : null;
  const hours = hoursOf(pick(row, 'Flight time', 'Airborne time', 'Block time', 'Duration', 'Tacho time'), `${file} ${day} ${rego}: flight time`);
  const id = pick(row, 'Flight ID', 'ID', 'Flight number');
  const code = `FL-${id || `${day}-${rego}-${s.code}-${hours}`}`;
  const result = pick(row, 'Result', 'Status', 'Grade', 'Lesson status').toLowerCase();
  const outcome = /complet|pass|competent|satisf/.test(result) && !/not|un/.test(result) ? 'competent' : /repeat|fail|not|unsatisf/.test(result) ? 'repeat' : null;
  const landings = pick(row, 'Landings', 'Total landings');
  const instrument = pick(row, 'Instrument time', 'IF time', 'Instrument');
  await db.query('insert into flights(code,flown_on,aircraft_id,student_id,instructor_id,lesson_id,kind,hours,landings,xc,instrument_hours,charge,outcome,debrief,graded_on) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) on conflict(code) do nothing',
    [code, day, ac.id, s.id, instr?.id || null, lesson?.id || null, kind, hours, landings ? number(landings, `${file} ${code}: landings`, { min: 0 }) : 1,
      yesNo(pick(row, 'Cross country', 'XC', 'Cross-country')), instrument ? hoursOf(instrument, `${file} ${code}: instrument time`) : 0,
      await chargeFor(db, ac.id, instr?.id, kind, hours), outcome, outcome ? pick(row, 'Comment', 'Remarks', 'Debrief') || 'Imported from FlightLogger' : null, outcome ? day : null]);
}

async function draft(db, cmd, ref) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const s = await resolve(db, 'students', ref || undefined);
  const v = (await db.query('select * from v_students where student_id=$1', [s.id]))[0];
  const ready = (await db.query('select missing from v_test_ready where student=$1', [s.code]))[0];
  const school = (() => { try { return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'brand.json'), 'utf8')).business_name; } catch { return 'the school'; } })();
  let body;
  if (cmd === 'draft-progress') {
    const done = await db.query('select lesson,title,competent_on from v_lesson_progress where student_id=$1 and competent order by seq desc limit 5', [s.id]);
    const booked = await db.query("select booked_on,starts,lesson_title,kind from v_schedule where student=$1 and status='booked' and booked_on>=current_date order by booked_on,starts", [s.code]);
    body = `# DRAFT: training progress for ${v.name}\n\nTo: ${s.email || '(no email on file)'}${s.sponsor ? `\nCopy for: ${s.sponsor}` : ''}\n\nHi ${v.name.split(' ')[0]},\n\nHere is where your ${v.course} training stands.\n\n- Syllabus: ${v.lessons_done} of ${v.lessons_total} lessons signed off\n- Next: ${v.next_lesson || 'all lessons signed off'}\n- Hours: ${v.total_hours} total, ${v.solo_hours} solo, ${v.xc_solo_hours} solo cross-country\n\nRecently signed off:\n${done.map((d) => `- ${d.lesson} ${d.title} (${ymd(d.competent_on)})`).join('\n') || '- nothing yet'}\n\nBooked:\n${booked.map((b) => `- ${ymd(b.booked_on)} ${String(b.starts).slice(0, 5)}: ${b.lesson_title || b.kind}`).join('\n') || '- nothing booked yet. Reply with times that suit and we will book your next lesson.'}\n\n${ready?.missing ? `Still to do before the flight test: ${ready.missing}.\n\n` : 'You have everything in place for the flight test. We will be in touch to arrange it.\n\n'}For review before sending. Nothing has been sent.\n`;
  } else if (cmd === 'draft-statement') {
    const lines = await db.query("select flown_on on_date,coalesce(lesson||' ','')||kind||' '||aircraft||' '||hours||'h' item,charge debit,null::numeric credit from v_flights where student_id=$1 union all select paid_on,'Payment '||ref,null,amount from payments where student_id=$1 order by 1,2", [s.id]);
    const b = (await db.query('select * from v_balances where student_id=$1', [s.id]))[0];
    body = `# DRAFT: statement of account for ${v.name}\n\nTo: ${s.email || '(no email on file)'}${s.sponsor ? `\nBill to: ${s.sponsor}` : ''}\n\n| Date | Item | Charged | Paid |\n|---|---|---|---|\n${lines.map((l) => `| ${ymd(l.on_date)} | ${l.item} | ${l.debit ?? ''} | ${l.credit ?? ''} |`).join('\n')}\n\n- Charged: ${b.charged}\n- Paid: ${b.paid}\n- Balance: ${b.balance}${Number(b.balance) < 0 ? ' owing' : ' in credit'}\n\n${Number(b.balance) < -Number(b.credit_limit) ? `REVIEW BEFORE SENDING: the account is past its limit of ${b.credit_limit}. Bookings show a problem until it is paid down.\n\n` : ''}For review before sending. Nothing has been sent.\n`;
  } else if (cmd === 'draft-recommendation') {
    const hm = (await db.query('select i.name from students s left join instructors i on i.id=s.instructor_id where s.id=$1', [s.id]))[0];
    const ex = await db.query('select subject,sat_on,score from v_exam_credits where student_id=$1 order by subject', [s.id]);
    body = `# DRAFT: flight test recommendation, ${v.name}\n\n${ready?.missing ? `NOT READY: ${ready.missing}. Do not sign until each is cleared.\n\n` : ''}${school} recommends ${v.name} (${v.code}) for the ${v.course} flight test.\n\n- Syllabus: ${v.lessons_done} of ${v.lessons_total} lessons signed off as competent\n- Total ${v.total_hours} hours, dual ${v.dual_hours}, solo ${v.solo_hours}, solo cross-country ${v.xc_solo_hours}, instrument ${v.instrument_hours}\n- Medical: class ${s.medical_class ?? '?'}, valid to ${s.medical_expiry ? ymd(s.medical_expiry) : 'not recorded'}\n- Theory exams:\n${ex.map((e) => `  - ${e.subject}: ${e.score}% on ${ymd(e.sat_on)}`).join('\n') || '  - none recorded'}\n\nRecommending instructor: ${hm?.name || '(not assigned)'}\nSigned: ____________________  Date: __________\n\nFor the chief flying instructor to check and sign. Nothing has been sent.\n`;
  } else throw Error(`Unknown draft: ${cmd}`);
  const file = path.join(dir, `${cmd.replace('draft-', '')}-${s.code}-${Date.now()}.md`);
  fs.writeFileSync(file, body);
  return [{ file, student: s.code }];
}

function print(value) {
  if (Array.isArray(value)) { console.log(value.length ? table(value, Object.keys(value[0]).map((key) => ({ key, label: key, format: fmt }))) : '(none)'); return; }
  for (const [key, v] of Object.entries(value)) { console.log(`\n${key}`); print(Array.isArray(v) ? v : [v]); }
}
function fmt(v) {
  if (v instanceof Date) return v.toISOString().slice(0, v.getUTCHours() || v.getUTCMinutes() ? 16 : 10).replace('T', ' ');
  if (v === true) return 'yes';
  if (v === false) return 'no';
  if (typeof v === 'string' && /^\d{2}:\d{2}:00$/.test(v)) return v.slice(0, 5);
  return v;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const out = await run(db, process.argv.slice(2).filter((x) => x !== '--json'));
    if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2)); else print(out);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { await db?.close(); }
}
