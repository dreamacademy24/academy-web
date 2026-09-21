begin;
do $test$
declare e uuid; n int; tid text;
begin
 insert into public.online_enrollments(student_name,days_of_week,start_date,total_sessions,enrollment_type)
 values('AUTOTEST absence <safe>',array['mon','wed'],'2000-01-01',8,'free_package') returning id into e;
 insert into public.online_sessions(enrollment_id,session_number,scheduled_date,status)
 select e,i,date '2000-01-01'+i,'scheduled' from generate_series(1,8) i;
 update public.online_sessions set status='no_show' where enrollment_id=e and session_number=1;
 select count(*) into n from public.staff_tasks where id like 'online-absence:'||e||':%';
 if n<>0 then raise exception 'single absence created task'; end if;
 update public.online_sessions set status='no_show' where enrollment_id=e and session_number=2;
 select count(*),min(id) into n,tid from public.staff_tasks where id like 'online-absence:'||e||':%';
 if n<>1 then raise exception 'two absences expected 1 got %',n; end if;
 if not exists(select 1 from public.staff_tasks where id=tid and not done and shared and note like '%&lt;safe&gt;%' and note like '%담당 미배정%') then raise exception 'task fields invalid'; end if;
 update public.staff_tasks set done=true where id=tid;
 update public.online_sessions set status='no_show' where enrollment_id=e and session_number in(2,3);
 select count(*) into n from public.staff_tasks where id like 'online-absence:'||e||':%';
 if n<>1 or not exists(select 1 from public.staff_tasks where id=tid and done) then raise exception 'duplicate or completion changed'; end if;
 update public.online_sessions set status='attended' where enrollment_id=e and session_number=4;
 update public.online_sessions set status='no_show' where enrollment_id=e and session_number=6;
 select count(*) into n from public.staff_tasks where id like 'online-absence:'||e||':%';
 if n<>1 then raise exception 'unrecorded lesson must break streak'; end if;
 update public.online_sessions set status='no_show' where enrollment_id=e and session_number=5;
 select count(*) into n from public.staff_tasks where id like 'online-absence:'||e||':%';
 if n<>2 then raise exception 'out-of-order second streak missing'; end if;
 update public.online_sessions set status='cancelled' where enrollment_id=e and session_number=7;
 update public.online_sessions set status='no_show' where enrollment_id=e and session_number=8;
 select count(*) into n from public.staff_tasks where id like 'online-absence:'||e||':%';
 if n<>2 then raise exception 'cancelled placeholder counted or duplicate'; end if;
end $test$;
select 'PASS: single/double absence, duplicates, completed task preservation, pending gap, out-of-order entry, cancellation, escaped content' as result;
rollback;