-- Fictional Riverside Aero Academy: a PPL and CPL school with five aircraft, a
-- simulator, four instructors and eight students, dated relative to today so there
-- is always something to chase. Times are the aerodrome's local clock.
-- Idempotent: running it twice changes nothing and never resets later changes.

insert into settings(key,value,unit,note) values
 ('solo_check_days',30,'days','A dual or check flight is needed in this many days before a solo. AU CASR 61.115 uses 30 days. Set from your exposition.'),
 ('grade_within_days',2,'days','Every flight graded and debriefed within this many days. House setting.'),
 ('quiet_days',21,'days','An active student with no flight and nothing booked for this long has gone quiet.'),
 ('instructor_daily_hours',7,'hours','Most flight instruction in one day. Demo value: set from your fatigue scheme.'),
 ('check_warn_hours',10,'hours','Warn when an aircraft is this close to its next check.'),
 ('exam_validity_months',36,'months','How long a theory exam pass counts towards the flight test. NZ rule 61.17 gives 3 years. Set from your regulator''s rule.')
on conflict (key) do nothing;

insert into courses(code,name,min_total,min_dual,min_solo,min_xc_solo,min_instrument,exams) values
 ('PPL','Private Pilot Licence (Aeroplane)',50,20,10,5,0,'{"Air Law","Navigation","Meteorology","Human Factors"}'),
 ('CPL','Commercial Pilot Licence (Aeroplane)',200,0,100,20,10,'{"CPL Air Law","CPL Navigation","CPL Meteorology"}')
on conflict (code) do nothing;

insert into lessons(course_id,seq,code,title,kind,planned_hours)
select c.id,v.seq,v.code,v.title,v.kind,v.hours from (values
 ('PPL',1,'PPL-01','Effects of controls','dual',1.0),
 ('PPL',2,'PPL-02','Straight and level, climbing and descending','dual',1.0),
 ('PPL',3,'PPL-03','Medium turns','dual',1.0),
 ('PPL',4,'PPL-04','Slow flight and stalling','dual',1.0),
 ('PPL',5,'PPL-05','Circuits','dual',1.2),
 ('PPL',6,'PPL-06','Circuit emergencies','dual',1.0),
 ('PPL',7,'PPL-07','First solo check','check',0.8),
 ('PPL',8,'PPL-08','First solo','solo',0.5),
 ('PPL',9,'PPL-09','Solo circuit consolidation','solo',1.0),
 ('PPL',10,'PPL-10','Forced landings without power','dual',1.2),
 ('PPL',11,'PPL-11','Steep turns and advanced handling','dual',1.0),
 ('PPL',12,'PPL-12','Navigation, dual cross-country','dual',2.0),
 ('PPL',13,'PPL-13','Navigation, solo cross-country','solo',2.0),
 ('PPL',14,'PPL-14','Pre flight test check','check',1.5),
 ('CPL',1,'CPL-01','Advanced handling review','dual',1.2),
 ('CPL',2,'CPL-02','Instrument flying in the simulator','sim',1.5),
 ('CPL',3,'CPL-03','Instrument flying, limited panel','dual',1.2),
 ('CPL',4,'CPL-04','Commercial navigation, dual','dual',2.5),
 ('CPL',5,'CPL-05','Commercial navigation, solo','solo',3.0),
 ('CPL',6,'CPL-06','Pre flight test check','check',1.5)
) v(course,seq,code,title,kind,hours) join courses c on c.code = v.course
on conflict (code) do nothing;

insert into aircraft(code,type,kind,rate,hours_base,hours_base_on,next_check_hours,next_check_name,annual_due,status)
select v.code,v.type,v.kind,v.rate,v.hours,current_date - 150,v.next,v.next_name,current_date + v.annual,v.status from (values
 ('ZK-RVA','C172S','aeroplane',340,8412.0,8442.0,'100 hourly',120,'serviceable'),
 ('ZK-RVB','C172S','aeroplane',340,6120.0,6200.0,'100 hourly',-3,'serviceable'),
 ('ZK-RVC','PA-28-161','aeroplane',360,9870.0,9950.0,'100 hourly',200,'unserviceable'),
 ('ZK-RVD','P2008','aeroplane',260,2210.0,2220.0,'100 hourly',90,'serviceable'),
 ('ZK-RVE','C152','aeroplane',230,11840.0,11900.0,'100 hourly',60,'serviceable'),
 ('SIM-1','AL172 simulator','simulator',180,3120.0,null,null,null,'serviceable')
) v(code,type,kind,rate,hours,next,next_name,annual,status)
on conflict (code) do nothing;

insert into instructors(code,name,category,rate,rating_expiry,medical_class,medical_expiry,email,phone)
select v.code,v.name,v.cat,v.rate,current_date + v.rating,1,current_date + v.medical,v.email,v.phone from (values
 ('HM','Hana Morgan','A cat (CFI)',95,300,200,'hana@riverside-aero.example','021 555 0201'),
 ('DR','Daniel Reid','B cat',85,20,150,'daniel@riverside-aero.example','021 555 0202'),
 ('PK','Priya Kumar','C cat',75,250,-6,'priya@riverside-aero.example','021 555 0203'),
 ('TW','Tom Walker','C cat',75,-10,180,'tom@riverside-aero.example','021 555 0204')
) v(code,name,cat,rate,rating,medical,email,phone)
on conflict (code) do nothing;

insert into students(code,name,course_id,instructor_id,email,phone,sponsor,medical_class,medical_expiry,started_on,status,prior_total,prior_solo,prior_xc_solo,prior_instrument,credit_limit)
select v.code,v.name,c.id,i.id,v.email,v.phone,v.sponsor,v.mclass,current_date + v.medical,current_date - v.started,v.status,v.pt,v.ps,v.px,v.pi,v.credit
from (values
 ('S101','Aroha Ngata','PPL','HM','aroha.n@example.com','021 555 0301',null,2,300,120,'active',0,0,0,0,500),
 ('S102','Liam Chen','PPL','DR','liam.chen@example.com','021 555 0302',null,2,-10,100,'active',0,0,0,0,500),
 ('S103','Sophie Taylor','PPL','HM','sophie.t@example.com','021 555 0303','Taylor Farms Ltd',2,400,200,'active',34,7,3.5,0,500),
 ('S104','Jack Wilson','PPL','PK','jack.w@example.com','021 555 0304',null,2,250,90,'active',0,0,0,0,500),
 ('S105','Mia Patel','PPL','DR','mia.patel@example.com','021 555 0305',null,2,180,160,'active',0,0,0,0,500),
 ('S106','Ben Harris','CPL','HM','ben.h@example.com','021 555 0306','Harris Aviation Cadetship',1,200,40,'active',160,90,40,8,0),
 ('S107','Ella Brown','PPL','TW','ella.b@example.com','021 555 0307',null,2,320,25,'active',0,0,0,0,1000),
 ('S108','Noah Wright','PPL','PK','noah.w@example.com','021 555 0308',null,2,90,210,'paused',0,0,0,0,500)
) v(code,name,course,instr,email,phone,sponsor,mclass,medical,started,status,pt,ps,px,pi,credit)
join courses c on c.code = v.course join instructors i on i.code = v.instr
on conflict (code) do nothing;

-- Flights: code, days ago, aircraft, student, instructor (null on solo), lesson, kind,
-- hours, landings, cross-country, instrument hours, outcome, grade.
insert into flights(code,flown_on,aircraft_id,student_id,instructor_id,lesson_id,kind,hours,landings,xc,instrument_hours,charge,outcome,grade,debrief,graded_on)
select v.code,current_date - v.ago,a.id,s.id,i.id,l.id,v.kind,v.hours,v.landings,v.xc,v.ih,
  round(v.hours * (a.rate + coalesce(i.rate,0)),2),v.outcome,v.grade,
  case when v.outcome is not null then v.debrief end,
  case when v.outcome is not null then current_date - v.ago end
from (values
 -- Aroha Ngata: steady progress, nav solo booked next
 ('F1001',100,'ZK-RVE','S101','HM','PPL-01','dual',1.0,1,false,0,'competent',3,'Good feel for the controls.'),
 ('F1002',95,'ZK-RVE','S101','HM','PPL-02','dual',1.1,1,false,0,'competent',3,'Trim use improving.'),
 ('F1003',90,'ZK-RVE','S101','HM','PPL-03','dual',1.0,1,false,0,'competent',4,'Balanced turns.'),
 ('F1004',84,'ZK-RVE','S101','HM','PPL-04','dual',1.0,1,false,0,'competent',3,'Recovery prompt.'),
 ('F1005',80,'ZK-RVA','S101','HM','PPL-05','dual',1.2,6,false,0,'repeat',2,'Flare high, repeat circuits.'),
 ('F1006',76,'ZK-RVA','S101','HM','PPL-05','dual',1.3,7,false,0,'competent',3,'Consistent approaches.'),
 ('F1007',70,'ZK-RVA','S101','HM','PPL-06','dual',1.0,5,false,0,'competent',3,'Engine failure after take-off handled well.'),
 ('F1008',64,'ZK-RVA','S101','HM','PPL-07','check',0.8,4,false,0,'competent',4,'Cleared for first solo.'),
 ('F1009',63,'ZK-RVA','S101',null,'PPL-08','solo',0.5,1,false,0,'competent',4,'First solo flown.'),
 ('F1010',55,'ZK-RVA','S101',null,'PPL-09','solo',1.0,6,false,0,'competent',3,'Circuits to standard.'),
 ('F1011',40,'ZK-RVA','S101','HM','PPL-10','dual',1.2,3,false,0,'competent',3,'Field selection good.'),
 ('F1012',30,'ZK-RVA','S101','HM','PPL-11','dual',1.0,1,false,0,'competent',3,'Steep turns within limits.'),
 ('F1013',9,'ZK-RVA','S101','HM','PPL-12','dual',2.0,2,true,0,'competent',3,'Navigation log well kept.'),
 -- Liam Chen: medical lapsed, flew solo anyway
 ('F1021',90,'ZK-RVE','S102','DR','PPL-01','dual',1.0,1,false,0,'competent',3,'Settled first lesson.'),
 ('F1022',85,'ZK-RVE','S102','DR','PPL-02','dual',1.0,1,false,0,'competent',3,'Good attitude flying.'),
 ('F1023',80,'ZK-RVE','S102','DR','PPL-03','dual',1.0,1,false,0,'competent',3,'Turns balanced.'),
 ('F1024',75,'ZK-RVE','S102','DR','PPL-04','dual',1.1,1,false,0,'competent',3,'Stall recovery good.'),
 ('F1025',70,'ZK-RVE','S102','DR','PPL-05','dual',1.2,7,false,0,'competent',3,'Circuits consistent.'),
 ('F1026',60,'ZK-RVE','S102','DR','PPL-06','dual',1.0,5,false,0,'competent',3,'Emergencies handled.'),
 ('F1027',20,'ZK-RVE','S102','DR','PPL-07','check',0.8,4,false,0,'competent',3,'Cleared for first solo.'),
 ('F1028',12,'ZK-RVE','S102',null,'PPL-08','solo',0.5,1,false,0,'competent',3,'First solo flown.'),
 ('F1029',4,'ZK-RVE','S102',null,'PPL-09','solo',0.9,5,false,0,'repeat',2,'Two long landings, repeat.'),
 -- Sophie Taylor: syllabus done, hours and exams in, ready for the flight test
 ('F1041',110,'ZK-RVD','S103','HM','PPL-01','dual',1.0,1,false,0,'competent',4,'Prior hours from her logbook.'),
 ('F1042',105,'ZK-RVD','S103','HM','PPL-02','dual',1.0,1,false,0,'competent',4,'Accurate.'),
 ('F1043',100,'ZK-RVD','S103','HM','PPL-03','dual',1.0,1,false,0,'competent',4,'Accurate.'),
 ('F1044',96,'ZK-RVD','S103','HM','PPL-04','dual',1.0,1,false,0,'competent',4,'Clean recoveries.'),
 ('F1045',90,'ZK-RVD','S103','HM','PPL-05','dual',1.2,7,false,0,'competent',4,'Good circuits.'),
 ('F1046',85,'ZK-RVD','S103','HM','PPL-06','dual',1.0,5,false,0,'competent',4,'Calm in emergencies.'),
 ('F1047',80,'ZK-RVD','S103','HM','PPL-07','check',0.8,4,false,0,'competent',4,'Cleared for first solo.'),
 ('F1048',79,'ZK-RVD','S103',null,'PPL-08','solo',0.5,1,false,0,'competent',4,'First solo flown.'),
 ('F1049',70,'ZK-RVD','S103',null,'PPL-09','solo',1.0,6,false,0,'competent',4,'To standard.'),
 ('F1050',50,'ZK-RVA','S103','DR','PPL-10','dual',1.2,3,false,0,'competent',4,'Good field selection.'),
 ('F1051',30,'ZK-RVA','S103','DR','PPL-11','dual',1.0,1,false,0,'competent',4,'Within limits.'),
 ('F1052',9,'ZK-RVA','S103','HM','PPL-12','dual',2.1,2,true,0,'competent',4,'Diversion planned well.'),
 ('F1053',7,'ZK-RVA','S103',null,'PPL-13','solo',2.0,2,true,0,'competent',4,'Solo cross-country to standard.'),
 ('F1054',3,'ZK-RVA','S103','HM','PPL-14','check',1.5,3,false,0,'competent',4,'Recommend for flight test.'),
 -- Jack Wilson: has not flown in five weeks
 ('F1061',80,'ZK-RVE','S104','PK','PPL-01','dual',1.0,1,false,0,'competent',3,'Good start.'),
 ('F1062',72,'ZK-RVE','S104','PK','PPL-02','dual',1.0,1,false,0,'competent',3,'Improving.'),
 ('F1063',60,'ZK-RVE','S104','PK','PPL-03','dual',1.0,1,false,0,'competent',3,'Turns balanced.'),
 ('F1064',50,'ZK-RVE','S104','PK','PPL-04','dual',1.0,1,false,0,'competent',3,'Recoveries fine.'),
 ('F1065',35,'ZK-RVE','S104','PK','PPL-05','dual',1.2,6,false,0,'competent',3,'Circuits done.'),
 -- Mia Patel: solo without a recent dual check, account behind
 ('F1071',150,'ZK-RVD','S105','DR','PPL-01','dual',1.0,1,false,0,'competent',3,'Good start.'),
 ('F1072',140,'ZK-RVD','S105','DR','PPL-02','dual',1.0,1,false,0,'competent',3,'Fine.'),
 ('F1073',130,'ZK-RVD','S105','DR','PPL-03','dual',1.0,1,false,0,'competent',3,'Fine.'),
 ('F1074',120,'ZK-RVD','S105','DR','PPL-04','dual',1.1,1,false,0,'competent',3,'Fine.'),
 ('F1075',100,'ZK-RVD','S105','DR','PPL-05','dual',1.3,7,false,0,'competent',3,'Circuits done.'),
 ('F1076',90,'ZK-RVD','S105','DR','PPL-06','dual',1.0,5,false,0,'competent',3,'Emergencies done.'),
 ('F1077',70,'ZK-RVD','S105','DR','PPL-07','check',0.8,4,false,0,'competent',3,'Cleared for first solo.'),
 ('F1078',68,'ZK-RVD','S105',null,'PPL-08','solo',0.5,1,false,0,'competent',3,'First solo flown.'),
 ('F1079',25,'ZK-RVD','S105',null,'PPL-09','solo',1.0,6,false,0,'competent',3,'Circuits to standard.'),
 -- Ben Harris: CPL, a long instructing day for Hana
 ('F1081',30,'ZK-RVA','S106','HM','CPL-01','dual',1.2,2,false,0,'competent',4,'Sharp handling.'),
 ('F1082',20,'SIM-1','S106','HM','CPL-02','sim',1.5,0,false,1.5,'competent',4,'Scan improving.'),
 ('F1083',15,'ZK-RVA','S106','HM','CPL-03','dual',1.2,1,false,1.0,'competent',3,'Limited panel holds.'),
 ('F1084',9,'ZK-RVD','S106','HM','CPL-04','dual',2.5,3,true,0,'competent',4,'Commercial standard navigation.'),
 ('F1085',9,'ZK-RVE','S101','HM',null,'dual',1.0,4,false,0,'competent',3,'Revision circuits.'),
 -- Ella Brown: instructor's rating lapsed, lessons out of order, last flight not graded
 ('F1091',20,'ZK-RVE','S107','TW','PPL-01','dual',1.0,1,false,0,'competent',3,'Good start.'),
 ('F1092',14,'ZK-RVE','S107','TW','PPL-02','dual',1.0,1,false,0,'competent',3,'Fine.'),
 ('F1093',8,'ZK-RVE','S107','TW','PPL-03','dual',1.0,1,false,0,'repeat',2,'Balance ball wandering, repeat.'),
 ('F1094',4,'ZK-RVE','S107','TW','PPL-04','dual',1.1,1,false,0,null,null,null),
 -- Noah Wright: paused
 ('F1101',200,'ZK-RVE','S108','PK','PPL-01','dual',1.0,1,false,0,'competent',3,'Good start.'),
 ('F1102',190,'ZK-RVE','S108','PK','PPL-02','dual',1.0,1,false,0,'competent',3,'Fine.')
) v(code,ago,aircraft,student,instr,lesson,kind,hours,landings,xc,ih,outcome,grade,debrief)
join aircraft a on a.code = v.aircraft
join students s on s.code = v.student
left join instructors i on i.code = v.instr
left join lessons l on l.code = v.lesson
on conflict (code) do nothing;

insert into payments(student_id,paid_on,amount,ref)
select s.id,current_date - v.ago,v.amount,v.ref from (values
 ('S101',120,2000,'DEP-S101-1'),('S101',70,2500,'DEP-S101-2'),('S101',20,1500,'DEP-S101-3'),
 ('S102',100,2000,'DEP-S102-1'),('S102',40,2000,'DEP-S102-2'),
 ('S103',200,3000,'DEP-S103-1'),('S103',60,3500,'DEP-S103-2'),
 ('S104',90,2500,'DEP-S104-1'),
 ('S105',160,1500,'DEP-S105-1'),('S105',60,800,'DEP-S105-2'),
 ('S106',40,6000,'CADET-S106-1'),
 ('S107',25,1000,'DEP-S107-1'),
 ('S108',210,1000,'DEP-S108-1')
) v(student,ago,amount,ref) join students s on s.code = v.student
on conflict (student_id,ref) do nothing;

insert into exams(student_id,subject,sat_on,score,pass_mark)
select s.id,v.subject,v.sat,v.score,70 from (values
 ('S103','Air Law',current_date - 150,84),('S103','Navigation',current_date - 120,78),
 ('S103','Meteorology',current_date - 90,81),('S103','Human Factors',current_date - 60,88),
 ('S101','Air Law',current_date - 80,76),('S101','Meteorology',current_date - 40,72),('S101','Human Factors',current_date - 30,90),
 ('S102','Air Law',current_date - 50,66),
 ('S106','CPL Air Law',(current_date - interval '36 months')::date + 50,82),
 ('S106','CPL Navigation',current_date - 100,75),
 ('S106','CPL Meteorology',current_date - 60,68),('S106','CPL Meteorology',current_date - 20,78)
) v(student,subject,sat,score) join students s on s.code = v.student
on conflict (student_id,subject,sat_on) do nothing;

insert into bookings(code,booked_on,starts,ends,student_id,aircraft_id,instructor_id,lesson_id,kind,status,cancel_reason)
select v.code,current_date + v.day,v.starts::time,v.ends::time,s.id,a.id,i.id,l.id,v.kind,v.status,v.reason from (values
 ('B2001',1,'08:00','09:30','S102','ZK-RVE',null,'PPL-09','solo','booked',null),
 ('B2002',1,'10:00','11:30','S105','ZK-RVB','DR','PPL-10','dual','booked',null),
 ('B2003',2,'10:00','13:00','S101','ZK-RVA',null,'PPL-13','solo','booked',null),
 ('B2004',1,'13:00','14:30','S107','ZK-RVD','PK','PPL-03','dual','booked',null),
 ('B2005',1,'15:00','17:30','S106','ZK-RVA',null,'CPL-05','solo','booked',null),
 ('B2006',1,'16:00','17:00','S103','ZK-RVA','HM',null,'dual','booked',null),
 ('B2007',3,'09:00','10:30','S107','ZK-RVE','HM','PPL-03','dual','booked',null),
 ('B1990',-6,'09:00','10:30','S104','ZK-RVE','PK','PPL-06','dual','cancelled','weather'),
 ('B1991',-3,'14:00','16:00','S101','ZK-RVC',null,'PPL-13','solo','cancelled','aircraft'),
 ('B1992',-2,'08:00','09:30','S105','ZK-RVD','DR','PPL-10','dual','no-show',null)
) v(code,day,starts,ends,student,aircraft,instr,lesson,kind,status,reason)
join students s on s.code = v.student
left join aircraft a on a.code = v.aircraft
left join instructors i on i.code = v.instr
left join lessons l on l.code = v.lesson
on conflict (code) do nothing;

insert into defects(code,aircraft_id,raised_on,description,deferred,due_on)
select v.code,a.id,current_date - v.ago,v.description,v.deferred,current_date + v.due from (values
 ('D301','ZK-RVC',3,'Left magneto drop out of limits on run-up',false,null::int),
 ('D302','ZK-RVA',10,'Landing light inoperative, day VFR only',true,5),
 ('D303','ZK-RVB',20,'Pitot heat inoperative',true,-2)
) v(code,aircraft,ago,description,deferred,due) join aircraft a on a.code = v.aircraft
on conflict (code) do nothing;

insert into notes(student_id,body)
select s.id,v.body from (values
 ('S104','Said he was busy with harvest; call before the end of the month.'),
 ('S103','Flight test with the examiner to be arranged once the recommendation is signed.')
) v(student,body) join students s on s.code = v.student
where not exists (select 1 from notes n where n.student_id = s.id and n.body = v.body);
