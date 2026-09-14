alter table public.online_enrollments add column package_plan jsonb;
alter table public.online_sessions add column package_phase text check(package_phase in ('pre','post'));
create table public.online_package_sources(
 booking_id uuid not null references public.bookings(id),
 student_key text not null,
 enrollment_id uuid not null references public.online_enrollments(id) on delete cascade,
 primary key(booking_id,student_key)
);
create index online_package_sources_enrollment_idx on public.online_package_sources(enrollment_id);
alter table public.online_package_sources enable row level security;
revoke all on public.online_package_sources from anon,authenticated;
grant all on public.online_package_sources to service_role;
create policy package_enrollment_read on public.online_enrollments as restrictive for select to anon,authenticated using(package_plan is null or customer_user_id=(select auth.uid())::text);
create policy package_enrollment_insert on public.online_enrollments as restrictive for insert to anon,authenticated with check(package_plan is null);
create policy package_enrollment_update on public.online_enrollments as restrictive for update to anon,authenticated using(package_plan is null) with check(package_plan is null);
create policy package_enrollment_delete on public.online_enrollments as restrictive for delete to anon,authenticated using(package_plan is null);
create policy package_session_read on public.online_sessions as restrictive for select to anon,authenticated using(exists(select 1 from public.online_enrollments e where e.id=enrollment_id and (e.package_plan is null or e.customer_user_id=(select auth.uid())::text)));
create policy package_session_insert on public.online_sessions as restrictive for insert to anon,authenticated with check(exists(select 1 from public.online_enrollments e where e.id=enrollment_id and e.package_plan is null));
create policy package_session_update on public.online_sessions as restrictive for update to anon,authenticated using(exists(select 1 from public.online_enrollments e where e.id=enrollment_id and e.package_plan is null)) with check(exists(select 1 from public.online_enrollments e where e.id=enrollment_id and e.package_plan is null));
create policy package_session_delete on public.online_sessions as restrictive for delete to anon,authenticated using(exists(select 1 from public.online_enrollments e where e.id=enrollment_id and e.package_plan is null));

create function public.online_package_snapshot(p_id uuid) returns text language sql security invoker set search_path=public as $$
 select md5(coalesce((select to_jsonb(e)::text from public.online_enrollments e where e.id=p_id),'null')||coalesce((select jsonb_agg(to_jsonb(s) order by s.id)::text from public.online_sessions s where s.enrollment_id=p_id),'[]'));
$$;
revoke all on function public.online_package_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.online_package_snapshot(uuid) to service_role;

create function public.save_online_package_plan(p_id uuid,p_existing boolean,p_snapshot text,p_student_key text,p_enrollment jsonb,p_plan jsonb,p_rows jsonb,p_today date)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_total integer:=(p_plan->>'total')::integer; v_pre integer:=(p_plan->'pre'->>'count')::integer; v_post integer:=(p_plan->'post'->>'count')::integer; v_part jsonb; v_item jsonb; v_booking uuid; v_tutor uuid:=nullif(p_enrollment->>'tutor_id','')::uuid; v_days text[]; v_time text; v_from date;
begin
 perform pg_advisory_xact_lock(hashtext('online-package:'||(p_enrollment->>'customer_user_id')||':'||p_student_key));
 if p_existing then
   perform 1 from public.online_enrollments where id=p_id for update;
   if not found then raise exception 'STALE'; end if;
   perform 1 from public.online_sessions where enrollment_id=p_id for update;
   if public.online_package_snapshot(p_id)<>p_snapshot then raise exception 'STALE'; end if;
 else
   if exists(select 1 from public.online_enrollments where id=p_id) then raise exception 'SOURCE_USED'; end if;
 end if;
 if v_total<1 or v_pre<0 or v_post<0 or v_pre+v_post<>v_total then raise exception 'INVALID_COUNT'; end if;
 if exists(select 1 from public.online_change_requests where enrollment_id=p_id and status='pending') then raise exception 'PENDING_REQUEST'; end if;
 for v_booking in select value::uuid from jsonb_array_elements_text(p_plan->'bookingIds') loop
   if exists(select 1 from public.online_package_sources where booking_id=v_booking and student_key=p_student_key and enrollment_id<>p_id) then raise exception 'SOURCE_USED'; end if;
 end loop;
 -- All writes below roll back together on any error. Recorded rows and IDs are never changed.
 if v_tutor is not null then
   perform pg_advisory_xact_lock(hashtext('online-tutor:'||v_tutor::text));
   if exists(select 1 from jsonb_array_elements(p_rows) r join public.online_sessions s on s.scheduled_date=(r->>'date')::date and left(s.scheduled_time_kr,5)=r->>'time' join public.online_enrollments e on e.id=s.enrollment_id where e.id<>p_id and coalesce(s.tutor_id,e.tutor_id)=v_tutor and e.status in ('active','scheduled') and s.status in ('scheduled','makeup')) then raise exception 'TUTOR_CONFLICT'; end if;
 end if;
 v_part:=case when v_pre>0 then p_plan->'pre' else p_plan->'post' end;
 select array_agg(value order by value) into v_days from jsonb_array_elements_text(v_part->'days');
 v_time:=v_part->'times'->>(v_part->'days'->>0);
 if not p_existing then
   insert into public.online_enrollments(id,student_name,customer_user_id,enrollment_type,start_date,total_sessions,used_sessions,days_of_week) values(p_id,p_enrollment->>'student_name',p_enrollment->>'customer_user_id','free_package',(p_enrollment->>'start_date')::date,v_total,0,v_days);
 end if;
 update public.online_enrollments set
  student_name=p_enrollment->>'student_name',student_name_en=p_enrollment->>'student_name_en',student_birth_year=p_enrollment->>'student_birth_year',customer_user_id=p_enrollment->>'customer_user_id',tutor_id=v_tutor,level=p_enrollment->>'level',notes=p_enrollment->>'notes',status=p_enrollment->>'status',portal_open=(p_enrollment->>'portal_open')::boolean,
  total_sessions=v_total,pre_sessions=v_pre,post_sessions=v_post,used_sessions=(p_enrollment->>'used_sessions')::integer,package_plan=p_plan,package_booking_id=(p_plan->'bookingIds'->>0)::uuid,
  start_date=(p_enrollment->>'start_date')::date,end_date=(p_enrollment->>'end_date')::date,duration_weeks=(p_enrollment->>'duration_weeks')::integer,class_duration_weeks=ceil(v_total/3.0),class_period=case when v_pre>0 and v_post>0 then 'split' when v_pre>0 then 'pre' else 'post' end,
  days_of_week=v_days,class_time_kr=v_time,class_time_ph=to_char(v_time::time-interval '1 hour','HH24:MI'),day_times=v_part->'times',sessions_per_week=cardinality(v_days),updated_at=now()
 where id=p_id;
 delete from public.online_package_sources where enrollment_id=p_id;
 insert into public.online_package_sources(booking_id,student_key,enrollment_id) select value::uuid,p_student_key,p_id from jsonb_array_elements_text(p_plan->'bookingIds');
 delete from public.online_sessions where enrollment_id=p_id and status='scheduled' and scheduled_date>=p_today and not coalesce(is_makeup_added,false) and original_session_id is null and coalesce(note,'')='' and coalesce(session_note,'')='' and coalesce(attitude,'')='' and coalesce(attitude_note,'')='' and recorded_at is null;
 for v_item in select value from jsonb_array_elements(p_rows) loop
   if (v_item->>'date')::date<p_today then raise exception 'INVALID_PAST_DATE'; end if;
   insert into public.online_sessions(enrollment_id,tutor_id,session_number,scheduled_date,scheduled_time_kr,scheduled_time_ph,status,package_phase) values(p_id,v_tutor,(v_item->>'number')::integer,(v_item->>'date')::date,v_item->>'time',to_char((v_item->>'time')::time-interval '1 hour','HH24:MI'),'scheduled',v_item->>'phase');
 end loop;
 return p_id;
end $$;
revoke all on function public.save_online_package_plan(uuid,boolean,text,text,jsonb,jsonb,jsonb,date) from public,anon,authenticated;
grant execute on function public.save_online_package_plan(uuid,boolean,text,text,jsonb,jsonb,jsonb,date) to service_role;

-- Package makeups use the selected phase's calendar, never the old last-date + 7 days rule.
create function public.online_package_peak(d date) returns boolean language sql immutable as $$
 select case extract(year from d)::int
 when 2027 then (extract(month from d)=7 and extract(day from d)>=18) or (extract(month from d)=8 and extract(day from d)<=30) or (extract(month from d)=12 and extract(day from d)>=19) or extract(month from d) in (1,2)
 when 2028 then extract(month from d)=1 or (extract(month from d)=2 and extract(day from d)<=28) or (extract(month from d)=7 and extract(day from d)>=15) or extract(month from d)=8 or (extract(month from d)=12 and extract(day from d)>=15)
 else (extract(month from d)=7 and extract(day from d)>=15) or extract(month from d)=8 or (extract(month from d)=12 and extract(day from d)>=15) or extract(month from d) in (1,2) end;
$$;
create or replace function public.auto_add_makeup_session() returns trigger language plpgsql set search_path=public as $$
declare last_session record; e public.online_enrollments%rowtype; phase text; part jsonb; ci date; co date; cursor_date date; day_kr text; time_kr text; next_number integer; i integer;
begin
 select * into e from public.online_enrollments where id=NEW.enrollment_id;
 if e.package_plan is null then
   if NEW.status='makeup' and OLD.status='scheduled' then
     select * into last_session from public.online_sessions where enrollment_id=NEW.enrollment_id order by session_number desc limit 1;
     insert into public.online_sessions(enrollment_id,tutor_id,session_number,scheduled_date,scheduled_time_ph,scheduled_time_kr,status,is_makeup_added,original_session_id) values(NEW.enrollment_id,NEW.tutor_id,last_session.session_number+1,last_session.scheduled_date+interval '7 days',NEW.scheduled_time_ph,NEW.scheduled_time_kr,'scheduled',true,NEW.id);
   end if;
   return NEW;
 end if;
 if NEW.status<>'makeup' or OLD.status='makeup' then return NEW; end if;
 perform 1 from public.online_enrollments where id=NEW.enrollment_id for update;
 if exists(select 1 from public.online_sessions where original_session_id=NEW.id) then return NEW; end if;
 select min(b.checkin_date),max(b.checkout_date) into ci,co from public.bookings b where b.id in(select value::uuid from jsonb_array_elements_text(e.package_plan->'bookingIds'));
 phase:=coalesce(NEW.package_phase,case when NEW.scheduled_date<ci then 'pre' else 'post' end);
 part:=e.package_plan->phase;
 select greatest(coalesce(max(scheduled_date),NEW.scheduled_date)+1,(now() at time zone 'Asia/Seoul')::date),coalesce(max(session_number),0)+1 into cursor_date,next_number from public.online_sessions where enrollment_id=e.id and (package_phase=phase or (package_phase is null and ((phase='pre' and scheduled_date<ci) or (phase='post' and scheduled_date>co))));
 select coalesce(max(session_number),0)+1 into next_number from public.online_sessions where enrollment_id=e.id;
 if phase='post' then cursor_date:=greatest(cursor_date,co+1); end if;
 for i in 1..3000 loop
   if phase='pre' and cursor_date>=ci then return NEW; end if; -- credit retained, staff reallocates when pre-study has no capacity
   day_kr:=(array['일','월','화','수','목','금','토'])[extract(dow from cursor_date)::integer+1];
   time_kr:=part->'times'->>day_kr;
   if part->'days' ? day_kr and not public.online_package_peak(cursor_date)
      and not exists(select 1 from public.holidays where date=cursor_date and is_deployed=true)
      and not exists(select 1 from public.bookings b where b.id in(select value::uuid from jsonb_array_elements_text(e.package_plan->'bookingIds')) and cursor_date between b.checkin_date and b.checkout_date)
      and not exists(select 1 from public.online_sessions s where s.enrollment_id=e.id and s.scheduled_date=cursor_date)
      and not exists(select 1 from public.online_sessions s join public.online_enrollments other_e on other_e.id=s.enrollment_id where coalesce(s.tutor_id,other_e.tutor_id)=e.tutor_id and s.scheduled_date=cursor_date and left(s.scheduled_time_kr,5)=time_kr and s.status='scheduled' and other_e.status in ('active','scheduled')) then
     insert into public.online_sessions(enrollment_id,tutor_id,session_number,scheduled_date,scheduled_time_kr,scheduled_time_ph,status,is_makeup_added,original_session_id,package_phase) values(e.id,e.tutor_id,next_number,cursor_date,time_kr,to_char(time_kr::time-interval '1 hour','HH24:MI'),'scheduled',true,NEW.id,phase);
     update public.online_enrollments set end_date=greatest(end_date,cursor_date),updated_at=now() where id=e.id;
     return NEW;
   end if;
   cursor_date:=cursor_date+1;
 end loop;
 return NEW;
end $$;

-- Prevent older editing paths from moving a split class across its study boundary.
create function public.check_online_package_session_date() returns trigger language plpgsql set search_path=public as $$
declare plan jsonb; ci date; co date; phase text;
begin
 if TG_OP='UPDATE' and NEW.scheduled_date is not distinct from OLD.scheduled_date then return NEW; end if;
 select package_plan into plan from public.online_enrollments where id=NEW.enrollment_id;
 if plan is null then return NEW; end if;
 select min(b.checkin_date),max(b.checkout_date) into ci,co from public.bookings b where b.id in(select value::uuid from jsonb_array_elements_text(plan->'bookingIds'));
 phase:=NEW.package_phase;
 if phase is null and TG_OP='UPDATE' then phase:=case when OLD.scheduled_date<ci then 'pre' else 'post' end; end if;
 if (phase='pre' and NEW.scheduled_date>=ci) or (phase='post' and NEW.scheduled_date<=co) then raise exception '연수 전후 경계를 넘겨 변경할 수 없습니다. 학생 상세 화면에서 회차를 재배분해주세요.'; end if;
 if extract(dow from NEW.scheduled_date) in(0,6) or public.online_package_peak(NEW.scheduled_date) or exists(select 1 from public.holidays where date=NEW.scheduled_date and is_deployed=true) then raise exception '주말·휴일·성수기에는 화상영어 수업을 배정할 수 없습니다.'; end if;
 NEW.package_phase:=phase;
 return NEW;
end $$;
create trigger check_online_package_session_date before insert or update of scheduled_date on public.online_sessions for each row execute function public.check_online_package_session_date();
