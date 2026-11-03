-- Flight School for Claude Code: the records a flight training organisation or aero club
-- runs on. Courses and their syllabus, aircraft and simulators, instructors, students,
-- the booking sheet, every flight with its grade, theory exams, student accounts and
-- defects. Plain SQL: runs on any Postgres and on the embedded PGlite.
--
-- Times are the aerodrome's local clock. Hours are decimal (1.3 = 1 hour 18 minutes).
-- Money is in the school's own currency, two decimals.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- House settings and the limits the school's exposition sets. Every one is editable.
create table settings (
  key text primary key,
  value numeric not null,
  unit text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  min_total numeric(6,1) not null default 0,
  min_dual numeric(6,1) not null default 0,
  min_solo numeric(6,1) not null default 0,
  min_xc_solo numeric(6,1) not null default 0,
  min_instrument numeric(6,1) not null default 0,
  exams text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The syllabus: one row per lesson, flown in order.
create table lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  seq int not null check (seq > 0),
  code text not null unique,
  title text not null,
  kind text not null check (kind in ('dual','solo','check','sim')),
  planned_hours numeric(4,1) not null default 1.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, seq)
);

create table aircraft (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null,
  kind text not null default 'aeroplane' check (kind in ('aeroplane','helicopter','simulator')),
  rate numeric(8,2) not null default 0,
  hours_base numeric(8,1) not null default 0,
  hours_base_on date not null default current_date,
  next_check_hours numeric(8,1),
  next_check_name text,
  annual_due date,
  status text not null default 'serviceable' check (status in ('serviceable','unserviceable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table instructors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text,
  rate numeric(8,2) not null default 0,
  rating_expiry date,
  medical_class int check (medical_class in (1,2)),
  medical_expiry date,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  course_id uuid references courses(id),
  instructor_id uuid references instructors(id),
  email text,
  phone text,
  sponsor text,
  medical_class int check (medical_class in (1,2)),
  medical_expiry date,
  started_on date not null default current_date,
  status text not null default 'active' check (status in ('active','paused','completed','withdrawn')),
  prior_total numeric(6,1) not null default 0,
  prior_solo numeric(6,1) not null default 0,
  prior_xc_solo numeric(6,1) not null default 0,
  prior_instrument numeric(6,1) not null default 0,
  credit_limit numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject text not null,
  sat_on date not null,
  score int not null check (score between 0 and 100),
  pass_mark int not null default 70 check (pass_mark between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, subject, sat_on)
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  booked_on date not null,
  starts time not null,
  ends time not null,
  student_id uuid not null references students(id),
  aircraft_id uuid references aircraft(id),
  instructor_id uuid references instructors(id),
  lesson_id uuid references lessons(id),
  kind text not null default 'dual' check (kind in ('dual','solo','check','sim')),
  status text not null default 'booked' check (status in ('booked','flown','cancelled','no-show')),
  cancel_reason text check (cancel_reason in ('weather','aircraft','instructor','student','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends > starts)
);

-- One row per flight or simulator session. Charge is fixed when it is logged.
create table flights (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  booking_id uuid unique references bookings(id),
  flown_on date not null,
  aircraft_id uuid not null references aircraft(id),
  student_id uuid not null references students(id),
  instructor_id uuid references instructors(id),
  lesson_id uuid references lessons(id),
  kind text not null check (kind in ('dual','solo','check','sim')),
  tacho_start numeric(8,1),
  tacho_end numeric(8,1),
  hours numeric(5,1) not null check (hours > 0),
  landings int not null default 1 check (landings >= 0),
  xc boolean not null default false,
  instrument_hours numeric(4,1) not null default 0 check (instrument_hours >= 0),
  charge numeric(10,2) not null default 0,
  outcome text check (outcome in ('competent','repeat','incomplete')),
  grade int check (grade between 1 and 5),
  debrief text,
  graded_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tacho_end is null or tacho_start is null or tacho_end > tacho_start),
  check ((kind = 'solo') = (instructor_id is null) or kind = 'sim')
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  paid_on date not null default current_date,
  amount numeric(10,2) not null check (amount > 0),
  ref text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, ref)
);

create table defects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  aircraft_id uuid not null references aircraft(id),
  raised_on date not null default current_date,
  description text not null,
  deferred boolean not null default false,
  due_on date,
  cleared_on date,
  cleared_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id),
  aircraft_id uuid references aircraft(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on lessons(course_id);
create index on students(course_id);
create index on bookings(booked_on);
create index on bookings(student_id);
create index on flights(student_id, flown_on);
create index on flights(aircraft_id, flown_on);
create index on flights(instructor_id, flown_on);
create index on exams(student_id);
create index on payments(student_id);
create index on defects(aircraft_id);

do $$ declare t text; begin
  foreach t in array array['settings','courses','lessons','aircraft','instructors','students','exams','bookings','flights','payments','defects','notes'] loop
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

create or replace function setting(k text) returns numeric language sql stable as $$
  select value from settings where key = k
$$;

-- Every flight with its people, aircraft and lesson by name.
create view v_flights as
select f.id flight_id, f.code, f.flown_on, f.kind, f.hours, f.landings, f.xc, f.instrument_hours, f.charge,
  f.outcome, f.grade, f.debrief, f.graded_on, f.tacho_start, f.tacho_end,
  a.code aircraft, a.type aircraft_type, a.kind aircraft_kind,
  s.id student_id, s.code student, s.name student_name,
  i.id instructor_id, i.code instructor, i.name instructor_name,
  l.id lesson_id, l.code lesson, l.seq lesson_seq, l.title lesson_title, c.code course, b.code booking
from flights f
join aircraft a on a.id = f.aircraft_id
join students s on s.id = f.student_id
left join instructors i on i.id = f.instructor_id
left join lessons l on l.id = f.lesson_id
left join courses c on c.id = l.course_id
left join bookings b on b.id = f.booking_id;

-- Each student against each lesson of their course: attempts and whether it is done.
create view v_lesson_progress as
select s.id student_id, s.code student, l.id lesson_id, l.seq, l.code lesson, l.title, l.kind,
  count(f.id)::int attempts,
  bool_or(f.outcome = 'competent') is true competent,
  min(f.flown_on) filter (where f.outcome = 'competent') competent_on,
  max(f.flown_on) last_flown
from students s
join lessons l on l.course_id = s.course_id
left join flights f on f.student_id = s.id and f.lesson_id = l.id
group by s.id, s.code, l.id, l.seq, l.code, l.title, l.kind;

create view v_balances as
select s.id student_id, s.code student, s.name, s.credit_limit,
  coalesce((select sum(charge) from flights f where f.student_id = s.id), 0) charged,
  coalesce((select sum(amount) from payments p where p.student_id = s.id), 0) paid,
  coalesce((select sum(amount) from payments p where p.student_id = s.id), 0)
    - coalesce((select sum(charge) from flights f where f.student_id = s.id), 0) balance,
  (select max(paid_on) from payments p where p.student_id = s.id) last_paid
from students s;

-- Exams that count today: passed and inside the validity window.
create view v_exam_credits as
select e.student_id, s.code student, e.subject, e.sat_on, e.score, e.pass_mark,
  (e.sat_on + (setting('exam_validity_months') || ' months')::interval)::date expires_on
from exams e join students s on s.id = e.student_id
where e.score >= e.pass_mark;

create view v_students as
select s.id student_id, s.code, s.name, s.status, c.code course, i.code instructor, s.sponsor,
  s.medical_class, s.medical_expiry, s.started_on,
  (select count(*) from v_lesson_progress p where p.student_id = s.id and p.competent)::int lessons_done,
  (select count(*) from lessons l where l.course_id = s.course_id)::int lessons_total,
  (select p.lesson || ' ' || p.title from v_lesson_progress p where p.student_id = s.id and not p.competent order by p.seq limit 1) next_lesson,
  s.prior_total + coalesce(sum(f.hours) filter (where a.kind <> 'simulator'), 0) total_hours,
  coalesce(sum(f.hours) filter (where f.kind in ('dual','check') and a.kind <> 'simulator'), 0) dual_hours,
  s.prior_solo + coalesce(sum(f.hours) filter (where f.kind = 'solo'), 0) solo_hours,
  s.prior_xc_solo + coalesce(sum(f.hours) filter (where f.kind = 'solo' and f.xc), 0) xc_solo_hours,
  s.prior_instrument + coalesce(sum(f.instrument_hours), 0) instrument_hours,
  coalesce(sum(f.hours) filter (where a.kind = 'simulator'), 0) sim_hours,
  max(f.flown_on) last_flight,
  current_date - coalesce(max(f.flown_on), s.started_on) days_since,
  (select balance from v_balances b where b.student_id = s.id) balance
from students s
left join courses c on c.id = s.course_id
left join instructors i on i.id = s.instructor_id
left join flights f on f.student_id = s.id
left join aircraft a on a.id = f.aircraft_id
group by s.id, c.code, i.code;

-- Who is ready to be put forward for the flight test, and what is still missing.
create view v_test_ready as
select v.code student, v.name, v.course, v.instructor, v.lessons_done, v.lessons_total, v.total_hours, v.solo_hours, v.xc_solo_hours, v.instrument_hours,
  concat_ws('; ',
    case when v.lessons_done < v.lessons_total then (v.lessons_total - v.lessons_done) || ' lessons to go' end,
    case when v.total_hours < c.min_total then 'total ' || v.total_hours || ' of ' || c.min_total end,
    case when v.dual_hours + s.prior_total - s.prior_solo < c.min_dual then 'dual ' || (v.dual_hours + s.prior_total - s.prior_solo) || ' of ' || c.min_dual end,
    case when v.solo_hours < c.min_solo then 'solo ' || v.solo_hours || ' of ' || c.min_solo end,
    case when v.xc_solo_hours < c.min_xc_solo then 'solo cross-country ' || v.xc_solo_hours || ' of ' || c.min_xc_solo end,
    case when v.instrument_hours < c.min_instrument then 'instrument ' || v.instrument_hours || ' of ' || c.min_instrument end,
    (select 'exams missing: ' || string_agg(x, ', ' order by x) from unnest(c.exams) x
      where not exists (select 1 from v_exam_credits e where e.student_id = s.id and e.subject = x and e.expires_on >= current_date)),
    case when s.medical_expiry is null or s.medical_expiry < current_date then 'medical not current' end,
    case when v.balance < -s.credit_limit then 'account ' || v.balance end
  ) missing
from v_students v
join students s on s.id = v.student_id
join courses c on c.id = s.course_id
where s.status = 'active';

create view v_fleet as
select a.id aircraft_id, a.code, a.type, a.kind, a.status, a.rate,
  a.hours_base + coalesce((select sum(f.hours) from flights f where f.aircraft_id = a.id and f.flown_on > a.hours_base_on), 0) hours,
  a.next_check_name, a.next_check_hours,
  a.next_check_hours - (a.hours_base + coalesce((select sum(f.hours) from flights f where f.aircraft_id = a.id and f.flown_on > a.hours_base_on), 0)) hours_to_check,
  round(coalesce((select sum(f.hours) from flights f where f.aircraft_id = a.id and f.flown_on > current_date - 28), 0) / 28.0, 2) hours_a_day,
  a.annual_due, a.annual_due - current_date days_to_annual,
  (select count(*) from defects d where d.aircraft_id = a.id and d.cleared_on is null and not d.deferred)::int open_defects,
  (select count(*) from defects d where d.aircraft_id = a.id and d.cleared_on is null and d.deferred)::int deferred_defects,
  (select count(*) from defects d where d.aircraft_id = a.id and d.cleared_on is null and d.deferred and d.due_on < current_date)::int deferrals_expired
from aircraft a;

-- The booking sheet from today, each booking with every reason it should not go.
create view v_schedule as
select b.id booking_id, b.code, b.booked_on, b.starts, b.ends, b.kind, b.status,
  s.code student, s.name student_name, a.code aircraft, i.code instructor, l.code lesson, l.title lesson_title,
  concat_ws('; ',
    case when b.kind in ('dual','check') and b.instructor_id is null then 'no instructor' end,
    case when b.kind <> 'sim' and b.aircraft_id is null then 'no aircraft' end,
    case when fl.status = 'unserviceable' then 'aircraft unserviceable' end,
    case when fl.hours_to_check <= 0 then 'aircraft past its ' || coalesce(fl.next_check_name, 'check') end,
    case when fl.annual_due < b.booked_on then 'aircraft annual expired' end,
    case when fl.deferrals_expired > 0 then 'aircraft has an expired deferred defect' end,
    case when i.id is not null and (i.rating_expiry is null or i.rating_expiry < b.booked_on) then 'instructor rating expired' end,
    case when i.id is not null and (i.medical_expiry is null or i.medical_expiry < b.booked_on) and b.kind <> 'sim' then 'instructor medical expired' end,
    case when b.kind = 'solo' and (s.medical_expiry is null or s.medical_expiry < b.booked_on) then 'student medical not current for solo' end,
    case when b.kind = 'solo' and coalesce((select max(f.flown_on) from flights f where f.student_id = s.id and f.kind in ('dual','check') and f.flown_on <= b.booked_on), date '1900-01-01')
      < b.booked_on - setting('solo_check_days')::int then 'no dual check in ' || setting('solo_check_days') || ' days before solo' end,
    (select 'previous lesson ' || p.lesson || ' not yet competent' from lessons l2 join v_lesson_progress p on p.lesson_id = l2.id and p.student_id = s.id
      where l2.course_id = l.course_id and l2.seq = l.seq - 1 and not p.competent),
    case when bal.balance < -s.credit_limit then 'account ' || bal.balance || ' in debit' end,
    case when exists (select 1 from bookings o where o.id <> b.id and o.status = 'booked' and o.booked_on = b.booked_on and o.aircraft_id = b.aircraft_id
      and o.starts < b.ends and b.starts < o.ends) then 'aircraft double booked' end,
    case when exists (select 1 from bookings o where o.id <> b.id and o.status = 'booked' and o.booked_on = b.booked_on and o.instructor_id = b.instructor_id
      and o.starts < b.ends and b.starts < o.ends) then 'instructor double booked' end
  ) problems
from bookings b
join students s on s.id = b.student_id
left join aircraft a on a.id = b.aircraft_id
left join v_fleet fl on fl.aircraft_id = a.id
left join instructors i on i.id = b.instructor_id
left join lessons l on l.id = b.lesson_id
left join v_balances bal on bal.student_id = s.id;

create view v_currency as
select 'instructor' who, i.code, i.name, i.category detail, i.medical_class, i.medical_expiry, i.medical_expiry - current_date medical_days,
  i.rating_expiry, i.rating_expiry - current_date rating_days
from instructors i where i.active
union all
select 'student', s.code, s.name, c.code, s.medical_class, s.medical_expiry, s.medical_expiry - current_date, null, null
from students s left join courses c on c.id = s.course_id where s.status = 'active';

create view v_instructor_load as
select i.code, i.name, i.category,
  coalesce(sum(f.hours) filter (where f.flown_on > current_date - 7), 0) hours_7d,
  coalesce(sum(f.hours) filter (where f.flown_on > current_date - 28), 0) hours_28d,
  count(f.id) filter (where f.flown_on > current_date - 28)::int flights_28d,
  (select count(*) from students s where s.instructor_id = i.id and s.status = 'active')::int students,
  count(f.id) filter (where f.outcome is null)::int not_graded,
  (select count(*) from bookings b where b.instructor_id = i.id and b.status = 'booked' and b.booked_on between current_date and current_date + 6)::int booked_7d
from instructors i
left join flights f on f.instructor_id = i.id
where i.active
group by i.id;

-- Rules checked against the records. Each rule's source is in docs/compliance.md.
create view v_compliance as
select 'SOLO-MEDICAL' rule, f.code record, f.student || ' flew solo on ' || f.flown_on || ' with no current medical' issue
from v_flights f join students s on s.id = f.student_id
where f.kind = 'solo' and (s.medical_expiry is null or s.medical_expiry < f.flown_on)
union all
select 'SOLO-CHECK', f.code, f.student || ' flew solo on ' || f.flown_on || ' with no dual check in the ' || setting('solo_check_days') || ' days before'
from v_flights f
where f.kind = 'solo' and coalesce((select max(d.flown_on) from flights d where d.student_id = f.student_id and d.kind in ('dual','check') and d.flown_on <= f.flown_on), date '1900-01-01')
  < f.flown_on - setting('solo_check_days')::int
union all
select 'SYLLABUS-ORDER', f.code, f.student || ' flew ' || f.lesson || ' on ' || f.flown_on || ' before ' || l2.code || ' was signed off as competent'
from v_flights f join lessons l on l.id = f.lesson_id join lessons l2 on l2.course_id = l.course_id and l2.seq = l.seq - 1
where not exists (select 1 from flights d where d.student_id = f.student_id and d.lesson_id = l2.id and d.outcome = 'competent' and d.flown_on <= f.flown_on)
union all
select 'INSTRUCTOR-RATING', f.code, f.instructor || ' instructed on ' || f.flown_on || ' with the instructor rating expired ' || i.rating_expiry
from v_flights f join instructors i on i.id = f.instructor_id
where i.rating_expiry is not null and i.rating_expiry < f.flown_on
union all
select 'INSTRUCTOR-MEDICAL', i.code, 'Class ' || coalesce(i.medical_class::text, '?') || ' medical expired ' || i.medical_expiry
from instructors i where i.active and i.medical_expiry < current_date
union all
select 'INSTRUCTOR-HOURS', i.code || ' ' || f.flown_on, sum(f.hours) || ' hours instructing in a day, house limit ' || setting('instructor_daily_hours')
from flights f join instructors i on i.id = f.instructor_id
group by i.code, f.flown_on having sum(f.hours) > setting('instructor_daily_hours')
union all
select 'NOT-GRADED', f.code, f.student || ' ' || coalesce(f.lesson, f.kind) || ' on ' || f.flown_on || ' has no grade or debrief after ' || (current_date - f.flown_on) || ' days'
from v_flights f where f.outcome is null and f.flown_on < current_date - setting('grade_within_days')::int
union all
select 'AIRCRAFT-CHECK', fl.code, fl.hours || ' hours, ' || coalesce(fl.next_check_name, 'check') || ' was due at ' || fl.next_check_hours
from v_fleet fl where fl.status = 'serviceable' and fl.hours_to_check <= 0
union all
select 'ANNUAL-EXPIRED', fl.code, 'Annual review due ' || fl.annual_due || ' and the aircraft is marked serviceable'
from v_fleet fl where fl.status = 'serviceable' and fl.annual_due < current_date and fl.kind <> 'simulator'
union all
select 'DEFERRAL-EXPIRED', d.code, a.code || ': ' || d.description || ', deferred to ' || d.due_on
from defects d join aircraft a on a.id = d.aircraft_id where d.deferred and d.cleared_on is null and d.due_on < current_date
union all
select 'EXAM-EXPIRY', e.student || ' ' || e.subject, 'Exam credit expires ' || e.expires_on || ' and the flight test is not yet passed'
from v_exam_credits e join students s on s.id = e.student_id
where s.status = 'active' and e.expires_on between current_date and current_date + 90;

create view v_attention as
select 'booking with a problem' kind, s.code record, s.booked_on due, s.student || ' ' || coalesce(s.lesson, s.kind) || ': ' || s.problems detail
from v_schedule s where s.status = 'booked' and s.booked_on between current_date and current_date + 2 and s.problems <> ''
union all
select 'flight not graded', f.code, f.flown_on, f.student || ' ' || coalesce(f.lesson, f.kind) || ' with ' || coalesce(f.instructor, 'no instructor')
from v_flights f where f.outcome is null
union all
select 'student gone quiet', v.code, coalesce(v.last_flight, v.started_on), v.name || ', ' || v.days_since || ' days since last flight, next ' || coalesce(v.next_lesson, 'nothing')
from v_students v where v.status = 'active' and v.days_since >= setting('quiet_days')
  and not exists (select 1 from bookings b where b.student_id = v.student_id and b.status = 'booked' and b.booked_on >= current_date)
union all
select 'account in debit', b.student, b.last_paid, b.name || ' ' || b.balance || ' against a limit of ' || b.credit_limit
from v_balances b join students s on s.id = b.student_id where s.status = 'active' and b.balance < -b.credit_limit
union all
select 'medical due', c.code, c.medical_expiry, c.who || ' ' || c.name || ', class ' || coalesce(c.medical_class::text, '?')
from v_currency c where c.medical_expiry < current_date + 45
union all
select 'instructor rating due', c.code, c.rating_expiry, c.name || ' ' || coalesce(c.detail, '')
from v_currency c where c.who = 'instructor' and c.rating_expiry < current_date + 45
union all
select 'check due soon', fl.code, null::date, case when fl.hours_to_check <= 0 then (-fl.hours_to_check) || ' hours past ' else fl.hours_to_check || ' hours to ' end || coalesce(fl.next_check_name, 'next check')
from v_fleet fl where fl.status = 'serviceable' and fl.hours_to_check <= setting('check_warn_hours')
union all
select 'annual due', fl.code, fl.annual_due, fl.type || ' annual review'
from v_fleet fl where fl.kind <> 'simulator' and fl.annual_due < current_date + 30
union all
select 'deferred defect due', d.code, d.due_on, a.code || ': ' || d.description
from defects d join aircraft a on a.id = d.aircraft_id where d.deferred and d.cleared_on is null and d.due_on < current_date + 14
union all
select 'exam credit expiring', e.student, e.expires_on, e.subject
from v_exam_credits e join students s on s.id = e.student_id where s.status = 'active' and e.expires_on between current_date and current_date + 90
union all
select 'ready for flight test', t.student, null::date, t.name || ', ' || t.course || ', ' || t.total_hours || ' hours'
from v_test_ready t where t.missing = '';

do $$ declare t text; begin
  foreach t in array array['settings','courses','lessons','aircraft','instructors','students','exams','bookings','flights','payments','defects','notes'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
