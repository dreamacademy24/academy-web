begin;
do $test$
declare e uuid; other_e uuid; tutor uuid; d date;
begin
 insert into online_tutors(name_display,name_en) values('AUTOTEST makeup','AUTOTEST makeup') returning id into tutor;
 insert into online_enrollments(student_name,days_of_week,start_date,end_date,total_sessions,class_time_kr,day_times,tutor_id)
 values('AUTOTEST makeup',array['화','목','금'],'2026-09-08','2026-10-02',12,'20:00','{"목":"19:30"}',tutor) returning id into e;
 insert into online_sessions(enrollment_id,tutor_id,session_number,scheduled_date,scheduled_time_kr,status)
 values(e,tutor,8,'2026-09-24','20:00','scheduled'),(e,tutor,9,'2026-09-25','20:00','scheduled'),(e,tutor,12,'2026-10-02','20:00','scheduled');
 update online_sessions set status='makeup' where enrollment_id=e and session_number=8;
 update online_sessions set status='makeup' where enrollment_id=e and session_number=9;
 if not exists(select 1 from online_sessions where enrollment_id=e and session_number=13 and scheduled_date='2026-10-06' and scheduled_time_kr='20:00') then raise exception 'first makeup not Oct 6'; end if;
 if not exists(select 1 from online_sessions where enrollment_id=e and session_number=14 and scheduled_date='2026-10-08' and scheduled_time_kr='19:30' and scheduled_time_ph='18:30') then raise exception 'second makeup/day time incorrect'; end if;
 if not exists(select 1 from online_enrollments where id=e and end_date='2026-10-08') then raise exception 'end date stale'; end if;
 update online_sessions set status='scheduled' where enrollment_id=e and session_number=8;
 update online_sessions set status='makeup' where enrollment_id=e and session_number=8;
 if (select count(*) from online_sessions where enrollment_id=e and is_makeup_added)<>2 then raise exception 'duplicate replacement'; end if;
 -- A new makeup must skip a deployed holiday and another active class for this teacher.
 insert into holidays(date,name,year,is_deployed) values('2026-10-09','AUTOTEST makeup',2026,true);
 insert into online_enrollments(student_name,days_of_week,start_date,total_sessions,tutor_id,status)
 values('AUTOTEST conflict',array['화'],'2026-10-13',1,tutor,'active') returning id into other_e;
 insert into online_sessions(enrollment_id,tutor_id,session_number,scheduled_date,scheduled_time_kr,status)
 values(other_e,tutor,1,'2026-10-13','20:00','scheduled');
 update online_sessions set status='makeup' where enrollment_id=e and session_number=12;
 if not exists(select 1 from online_sessions where enrollment_id=e and session_number=15 and scheduled_date='2026-10-15') then raise exception 'holiday/conflict skip failed'; end if;
 -- English weekdays also work, and vacation dates are skipped.
 insert into online_enrollments(student_name,days_of_week,start_date,total_sessions,class_time_kr)
 values('AUTOTEST vacation',array['tue','thu','fri'],'2026-12-11',2,'20:00') returning id into e;
 insert into online_sessions(enrollment_id,session_number,scheduled_date,scheduled_time_kr,status)
 values(e,1,'2026-12-10','20:00','scheduled'),(e,2,'2026-12-11','20:00','scheduled');
 update online_sessions set status='makeup' where enrollment_id=e and session_number=1;
 select scheduled_date into d from online_sessions where enrollment_id=e and is_makeup_added;
 if d<>'2027-03-02' then raise exception 'vacation/English weekdays: %',d; end if;
end $test$;
select 'PASS: Oct 6/8, weekday time/PH time, end date, duplicate toggle, holiday, tutor conflict, vacation, English weekdays' as result;

rollback;
