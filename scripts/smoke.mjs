// npm test: a temp database, migrate, seed twice, then every command and every rule.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { run, reads, help } from './school.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flight-school-test-'));
// A blank URL keeps tests off any real database named in .env.
process.env.DATABASE_URL = ''; process.env.DATA_DIR = path.join(temp, 'db'); process.env.OUTPUT_DIR = temp;
let db; let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const rejects = async (args, re) => { await assert.rejects(() => run(db, args), re); checks++; };
const child = (script, args = []) => {
  const p = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { env: process.env, encoding: 'utf8', cwd: REPO_ROOT });
  assert.equal(p.status, 0, p.stderr || p.stdout); checks++; return p.stdout;
};
const daysFrom = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rules = async () => (await run(db, ['compliance'])).map((r) => `${r.rule} ${r.record}`);
const tomorrow = async () => Object.fromEntries((await run(db, ['tomorrow'])).map((r) => [r.code, r.problems]));

try {
  db = await getDb();
  eq((await migrate(db)).ran.length, 1); eq((await migrate(db)).ran.length, 0);
  const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase/seed.sql'), 'utf8');
  await db.exec(seed); await db.exec(seed);
  eq((await run(db, ['flights'])).length, 61); eq((await run(db, ['students'])).length, 8);
  eq((await run(db, ['syllabus'])).length, 20);
  eq((await db.query('select count(*)::int n from bookings'))[0].n, 10);

  for (const name of Object.keys(reads)) ok(Array.isArray(await run(db, [name])), name);
  ok(help.length > 50, 'help lists every command');

  // The demo has something to say on every rule.
  const found = new Set((await run(db, ['compliance'])).map((r) => r.rule));
  for (const r of ['SOLO-MEDICAL', 'SOLO-CHECK', 'SYLLABUS-ORDER', 'INSTRUCTOR-RATING', 'INSTRUCTOR-MEDICAL', 'INSTRUCTOR-HOURS', 'NOT-GRADED', 'AIRCRAFT-CHECK', 'ANNUAL-EXPIRED', 'DEFERRAL-EXPIRED', 'EXAM-EXPIRY']) ok(found.has(r), r);
  eq((await run(db, ['compliance'])).length, 12);

  // Tomorrow: every reason a booking should not go.
  const t = await tomorrow();
  eq(Object.keys(t), ['B2001', 'B2002', 'B2004', 'B2005', 'B2006']);
  eq(t.B2001, 'student medical not current for solo');
  ok(t.B2002.includes('aircraft annual expired') && t.B2002.includes('expired deferred defect') && t.B2002.includes('in debit'), 'B2002');
  ok(t.B2004.includes('aircraft past its 100 hourly') && t.B2004.includes('instructor medical expired'), 'B2004');
  eq(t.B2005, 'aircraft double booked');
  eq((await run(db, ['schedule'])).find((r) => r.code === 'B2003').problems, '');

  // Progress, readiness, accounts and currency.
  const tr = await run(db, ['test-ready']);
  eq(tr[0].student, 'S103'); eq(tr[0].missing, 'ready');
  ok(tr.find((r) => r.student === 'S101').missing.includes('exams missing: Navigation'), 'S101 missing navigation');
  ok(tr.find((r) => r.student === 'S106').missing.includes('solo 90.0 of 100.0'), 'S106 solo short');
  eq((await run(db, ['quiet'])).map((r) => r.code), ['S104']);
  eq((await run(db, ['in-debit'])).map((r) => r.student), ['S105']);
  eq(Number((await run(db, ['in-debit']))[0].balance), -574);
  eq((await run(db, ['ungraded'])).map((r) => r.code), ['F1094']);
  eq(Number((await run(db, ['fleet'])).find((r) => r.code === 'ZK-RVA').hours_to_check), 9.8);
  eq((await run(db, ['cancellations'])).map((r) => r.reason).sort(), ['aircraft', 'no-show', 'weather']);
  eq((await run(db, ['instructor-load']))[0].code, 'HM');
  const cur = await run(db, ['currency']);
  eq(cur[0].code, 'S102'); ok(cur.some((r) => r.code === 'TW' && r.rating_days < 0), 'TW rating lapsed');
  const attention = await run(db, ['attention']);
  for (const k of ['booking with a problem', 'flight not graded', 'student gone quiet', 'account in debit', 'medical due', 'instructor rating due', 'check due soon', 'annual due', 'deferred defect due', 'exam credit expiring', 'ready for flight test']) ok(attention.some((r) => r.kind === k), k);
  const st = await run(db, ['student', 'sophie']);
  eq(st.student[0].code, 'S103'); eq(st.syllabus.length, 14); eq(st.test_ready[0].missing, 'ready'); eq(st.notes.length, 1);
  eq((await run(db, ['instructor', 'tom'])).not_graded.map((r) => r.code), ['F1094']);

  // Matching: partial codes and names, ambiguity lists candidates.
  await rejects(['student', 'S10'], /Ambiguous student.*S101.*S108/);
  await rejects(['student', 'Nobody'], /No matching student/);
  await rejects(['book', 'S101', '--aircraft=ZK-RV', `--date=${daysFrom(5)}`, '--start=09:00', '--end=10:00', '--instructor=HM'], /Ambiguous aircraft.*ZK-RVA.*ZK-RVE/);
  eq((await run(db, ['student', 'aroha'])).student[0].code, 'S101');

  // Booking refuses a booking with problems unless the CFI says yes.
  await rejects(['book', 'Liam', '--aircraft=ZK-RVE', `--date=${daysFrom(4)}`, '--start=09:00', '--end=10:00', '--lesson=9'], /Not booked: student medical not current for solo/);
  await rejects(['book', 'Ella', '--aircraft=ZK-RVE', `--date=${daysFrom(4)}`, '--start=09:00', '--end=10:00', '--instructor=HM', '--lesson=5'], /previous lesson PPL-04 not yet competent/);
  await rejects(['book', 'Ben', '--aircraft=ZK-RVE', `--date=${daysFrom(4)}`, '--start=09:00', '--end=10:00', '--instructor=HM', '--kind=solo'], /solo booking has no instructor/);
  await rejects(['book', 'Noah', '--aircraft=ZK-RVE', `--date=${daysFrom(4)}`, '--start=09:00', '--end=10:00', '--instructor=HM'], /paused/);
  await rejects(['book', 'Jack', '--aircraft=ZK-RVE', `--date=${daysFrom(-1)}`, '--start=09:00', '--end=10:00', '--instructor=HM'], /in the past/);
  const nb = await run(db, ['book', 'Jack', '--aircraft=ZK-RVE', `--date=${daysFrom(4)}`, '--start=09:00', '--end=10:30', '--instructor=HM', '--lesson=6']);
  eq(nb[0].code, 'B2008'); eq(nb[0].problems, '');
  ok(!(await run(db, ['quiet'])).some((r) => r.code === 'S104'), 'booked student is no longer quiet');
  await rejects(['book', 'Aroha', '--aircraft=ZK-RVE', `--date=${daysFrom(4)}`, '--start=10:00', '--end=11:00', '--instructor=DR', '--lesson=13', '--kind=dual'], /aircraft double booked/);
  const forced = await run(db, ['book', 'Liam', '--aircraft=ZK-RVE', `--date=${daysFrom(6)}`, '--start=09:00', '--end=10:00', '--lesson=9', '--force']);
  ok(forced[0].problems.includes('medical'), 'forced booking keeps its problem visible');

  // Renewals clear problems.
  await run(db, ['renew', 'Liam', 'medical', `--date=${daysFrom(365)}`]);
  eq((await tomorrow()).B2001, '');
  await run(db, ['renew', 'PK', 'medical', `--date=${daysFrom(365)}`, '--class=1']);
  ok(!(await rules()).includes('INSTRUCTOR-MEDICAL PK'), 'PK medical renewed');
  await run(db, ['renew', 'TW', 'rating', `--date=${daysFrom(700)}`]);
  ok(!(await run(db, ['attention'])).some((r) => r.kind === 'instructor rating due' && r.record === 'TW'), 'TW rating renewed');
  await rejects(['renew', 'TW', 'licence', `--date=${daysFrom(10)}`], /medical or rating/);

  // Flying a booking: tacho, charge, status, airframe hours.
  const f = await run(db, ['fly', 'B2001', '--tacho=11862.9-11863.9', '--landings=6', `--date=${daysFrom(0)}`]);
  eq(f[0].code, 'F2001'); eq(Number(f[0].hours), 1); eq(Number(f[0].charge), 230);
  await rejects(['fly', 'B2001', '--hours=1'], /flown: cannot log it again/);
  eq(Number((await run(db, ['fleet'])).find((r) => r.code === 'ZK-RVE').hours), 11863.9);
  await rejects(['fly', 'B2003', '--hours=2'], /has not happened yet/);
  const g = await run(db, ['fly', '--student=Ben', '--aircraft=ZK-RVA', '--instructor=HM', '--lesson=CPL-05', '--kind=dual', '--hours=1:30', '--xc', '--instrument=0.5']);
  eq(Number(g[0].hours), 1.5); eq(Number(g[0].charge), 652.5);
  await rejects(['fly', '--student=Ben', '--aircraft=ZK-RVA', '--instructor=HM', '--kind=solo', '--hours=1'], /solo flight has no instructor/);
  await rejects(['fly', '--student=Ben', '--aircraft=ZK-RVA', '--kind=check', '--hours=1'], /needs --instructor/);
  await rejects(['fly', '--student=Ben', '--aircraft=ZK-RVA', '--tacho=10-9'], /Invalid --tacho|after tacho start/);

  // Grading: once, with a debrief, and the syllabus moves on.
  await rejects(['grade', 'F2001', 'competent'], /debrief/);
  await rejects(['grade', 'F2001', 'great', '--debrief=x'], /Invalid outcome/);
  await rejects(['grade', 'F2001', 'competent', '--grade=7', '--debrief=x'], /Invalid grade/);
  await run(db, ['grade', 'F2001', 'competent', '--grade=3', '--debrief=Circuits to standard, next is forced landings']);
  await rejects(['grade', 'F2001', 'repeat', '--debrief=changed my mind'], /not rewritten/);
  eq((await run(db, ['student', 'Liam'])).student[0].code, 'S102');
  ok((await run(db, ['progress'])).find((r) => r.code === 'S102').next_lesson.startsWith('PPL-10'), 'Liam moves to PPL-10');
  await run(db, ['grade', 'F1094', 'repeat', '--debrief=Stalls rushed, repeat after PPL-03']);
  ok(!(await rules()).includes('NOT-GRADED F1094'), 'graded flight clears NOT-GRADED');

  // Cancel, no-show and their tally.
  await rejects(['cancel', 'B2006'], /reason/);
  await run(db, ['cancel', 'B2006', '--reason=weather']);
  eq((await tomorrow()).B2005, '');
  await run(db, ['no-show', 'B2004']);
  await rejects(['no-show', 'B2004'], /no-show: cannot/);
  eq((await run(db, ['cancellations'])).find((r) => r.reason === 'weather').bookings, 2);

  // Money: a payment brings Mia back inside her limit.
  await run(db, ['pay', 'Mia', '600', '--ref=EFT-1101']);
  eq((await run(db, ['in-debit'])).length, 0);
  await rejects(['pay', 'Mia', '600', '--ref=EFT-1101'], /duplicate|unique/i);
  await rejects(['pay', 'Mia', '-5', '--ref=X'], /Invalid amount/);

  // Exams: a pass completes Aroha's set.
  const ex = await run(db, ['exam', 'Aroha', 'Navigation', '--score=81']);
  eq(ex[0].result, 'pass');
  ok(!(await run(db, ['test-ready'])).find((r) => r.student === 'S101').missing.includes('exams'), 'Aroha has every exam');
  eq((await run(db, ['exam', 'Liam', 'Air Law', '--score=65']))[0].result, 'fail');

  // Aircraft: defects, serviceability and checks.
  const d = await run(db, ['defect', 'ZK-RVE', 'Cracked', 'nose', 'wheel', 'fairing']);
  eq(d[0].code, 'D304');
  eq((await run(db, ['fleet'])).find((r) => r.code === 'ZK-RVE').status, 'unserviceable');
  ok((await run(db, ['schedule'])).find((r) => r.code === 'B2007').problems.includes('aircraft unserviceable'), 'booking sees the defect');
  await rejects(['serviceable', 'ZK-RVE', 'on'], /open defects: D304/);
  await run(db, ['clear', 'D304', '--ref=WO-5521']);
  await rejects(['clear', 'D304', '--ref=WO-5521'], /was cleared/);
  await run(db, ['serviceable', 'ZK-RVE', 'on']);
  await run(db, ['defect', 'ZK-RVA', 'Cabin', 'light', 'dim', '--defer', `--due=${daysFrom(20)}`]);
  eq((await run(db, ['fleet'])).find((r) => r.code === 'ZK-RVA').status, 'serviceable');
  await rejects(['check-done', 'ZK-RVD', '--next=2200'], /not after the current/);
  await run(db, ['check-done', 'ZK-RVD', '--next=2328.7']);
  ok(!(await rules()).includes('AIRCRAFT-CHECK ZK-RVD'), 'check done clears the rule');
  await run(db, ['check-done', 'ZK-RVB', '--next=6200', `--annual=${daysFrom(365)}`]);
  ok(!(await rules()).includes('ANNUAL-EXPIRED ZK-RVB'), 'annual done clears the rule');

  // Settings, notes, people and courses.
  await run(db, ['setting', 'solo_check_days', '90']);
  ok(!(await rules()).includes('SOLO-CHECK F1079'), 'a longer window clears SOLO-CHECK');
  await rejects(['setting', 'nope', '1'], /No setting nope/);
  eq((await run(db, ['log', 'Jack', 'Booked', 'PPL-06', 'after', 'harvest']))[0].body, 'Booked PPL-06 after harvest');
  await run(db, ['add', 'course', 'IR', 'Instrument Rating', '--total=50', '--instrument=40', '--exams=IR Air Law,IR Procedures']);
  await run(db, ['add', 'lesson', 'IR', '1', 'Basic', 'instrument', 'flight', '--kind=sim', '--hours=1.5']);
  eq((await run(db, ['courses'])).find((r) => r.code === 'IR').lessons, 1);
  await run(db, ['add', 'instructor', 'KM', 'Kiri Moana', '--category=B cat', '--rate=85', `--rating=${daysFrom(400)}`, `--medical=${daysFrom(300)}`, '--medical-class=1']);
  await run(db, ['add', 'student', 'S201', 'Ana Silva', '--course=IR', '--instructor=KM', `--medical=${daysFrom(300)}`, '--prior-total=180']);
  await run(db, ['add', 'aircraft', 'ZK-RVF', '--type=DA40', '--rate=390', '--hours=1200', '--next-check=1280', `--annual=${daysFrom(200)}`]);
  await run(db, ['assign', 'S201', '--instructor=HM']);
  eq((await run(db, ['student', 'S201'])).student[0].instructor, 'HM');
  await run(db, ['status', 'Noah', 'withdrawn']);
  await rejects(['status', 'Noah', 'gone'], /Invalid status/);
  await rejects(['add', 'lesson', 'IR', '2', 'X', '--kind=ground'], /Invalid kind/);

  // Drafts never send.
  const p = await run(db, ['draft-progress', 'Aroha']);
  const pText = fs.readFileSync(p[0].file, 'utf8');
  ok(pText.includes('Nothing has been sent') && pText.includes('12 of 14'), 'progress draft');
  const s = await run(db, ['draft-statement', 'Mia']);
  ok(fs.readFileSync(s[0].file, 'utf8').includes('Payment EFT-1101'), 'statement shows the payment');
  const rec = await run(db, ['draft-recommendation', 'Sophie']);
  const recText = fs.readFileSync(rec[0].file, 'utf8');
  ok(recText.includes('recommends Sophie Taylor') && !recText.includes('NOT READY'), 'Sophie recommended');
  ok(fs.readFileSync((await run(db, ['draft-recommendation', 'Ella']))[0].file, 'utf8').includes('NOT READY'), 'Ella not ready');

  // Export, then import FlightLogger exports with a dry run first.
  const counts = await run(db, ['export', path.join(temp, 'export')]);
  ok(counts.find((c) => c.entity === 'flights').rows === 63, 'export flights');
  ok(fs.existsSync(path.join(temp, 'export', 'manifest.json')), 'manifest');
  const fx = path.join(REPO_ROOT, 'tests', 'fixtures', 'flightlogger');
  const before = (await db.query('select count(*)::int n from flights'))[0].n;
  const dry = await run(db, ['import', 'flightlogger', fx, '--dry-run']);
  eq(dry.map((r) => `${r.entity}:${r.rows}`), ['aircraft:3', 'users:4', 'flights:5']);
  eq((await db.query('select count(*)::int n from flights'))[0].n, before);
  await run(db, ['import', 'flightlogger', fx]);
  await run(db, ['import', 'flightlogger', fx]);
  eq((await db.query('select count(*)::int n from flights'))[0].n, before + 5);
  const kate = await run(db, ['student', 'Kate Lee']);
  eq(kate.student[0].code, 'KLEE'); eq(kate.student[0].course, 'PPL');
  eq(kate.syllabus.filter((x) => x.state === 'competent').length, 2);
  eq(kate.syllabus.find((x) => x.lesson === 'PPL-03').state, 'in progress');
  eq(Number(kate.student[0].total_hours), 3.3);
  eq((await db.query("select kind,instructor_id is null solo from flights where code='FL-50105'"))[0], { kind: 'solo', solo: true });
  eq((await db.query("select kind from flights where code='FL-50104'"))[0].kind, 'sim');
  eq((await db.query("select count(*)::int n from students where code='OPRICE'"))[0].n, 0);
  eq((await run(db, ['instructor', 'Grace Hill'])).instructor[0].code, 'GHILL');
  const bad = path.join(temp, 'bad'); fs.mkdirSync(bad);
  fs.writeFileSync(path.join(bad, 'Flights.csv'), 'Date,Aircraft,Student,Flight time\n2026-09-01,ZK-NONE,Kate Lee,1.0\n');
  await rejects(['import', 'flightlogger', bad], /ZK-NONE, which is not in the database/);
  fs.writeFileSync(path.join(bad, 'Flights.csv'), 'Day,Plane,Who,Time\n2026-09-02,ZK-FLA,Kate Lee,1.0\n');
  fs.writeFileSync(path.join(temp, 'map.json'), JSON.stringify({ flights: { Date: 'Day', Aircraft: 'Plane', Student: 'Who', 'Flight time': 'Time' } }));
  eq((await run(db, ['import', 'flightlogger', bad, `--map=${path.join(temp, 'map.json')}`]))[0].rows, 1);
  await rejects(['import', 'csv', bad], /Supported import: flightlogger/);

  await db.close(); db = null;

  // The CLI, views and documents from the command line, like an operator would.
  ok(child('school.mjs', ['tomorrow']).includes('code'), 'cli tomorrow');
  ok(JSON.parse(child('school.mjs', ['attention', '--json'])).length > 0, 'cli json');
  const failed = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'school.mjs'), 'student', 'S1'], { env: process.env, encoding: 'utf8' });
  eq(failed.status, 1); ok(/Ambiguous student/.test(failed.stderr), 'ambiguous exits 1'); checks++;
  ok(child('view.mjs').includes('view:'), 'views');
  ok(/document\(s\) rendered/.test(child('docs.mjs')), 'documents');
  for (const v of JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'views.json'), 'utf8'))) ok(fs.existsSync(path.join(temp, 'views', `${v.name}.html`)), `view ${v.name}`);
  for (const d of JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'documents.json'), 'utf8'))) ok(fs.readdirSync(path.join(temp, 'docs-out', d.name)).length > 0, `document ${d.name}`);

  // Every slash command names a real CLI command.
  const cmds = fs.readdirSync(path.join(REPO_ROOT, '.claude', 'commands')).filter((x) => x.endsWith('.md') && x !== 'README.md');
  const verbs = new Set([...help.map((h) => h.split(' ')[0]), 'help']);
  for (const c of cmds) {
    const body = fs.readFileSync(path.join(REPO_ROOT, '.claude', 'commands', c), 'utf8');
    ok(/^---\ndescription: /.test(body), `${c} has a description`);
    for (const m of body.matchAll(/npm run school -- ([a-z-]+)/g)) ok(verbs.has(m[1]), `${c} runs ${m[1]}`);
  }
  console.log(`PASS: ${checks} checks, ${cmds.length} slash commands, ${Object.keys(reads).length} reads`);
} finally {
  if (db) await db.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
