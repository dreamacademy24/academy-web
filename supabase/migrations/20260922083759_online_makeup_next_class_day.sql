CREATE OR REPLACE FUNCTION public.auto_add_makeup_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare last_session record; e public.online_enrollments%rowtype; phase text; part jsonb; ci date; co date; cursor_date date; day_kr text; time_kr text; next_number integer; i integer;
begin
 select * into e from public.online_enrollments where id=NEW.enrollment_id for update;
 if e.package_plan is null then
   if NEW.status<>'makeup' or OLD.status='makeup' or exists(select 1 from public.online_sessions where original_session_id=NEW.id) then return NEW; end if;
   if e.tutor_id is not null then perform pg_advisory_xact_lock(hashtext('online-tutor:'||e.tutor_id::text)); end if;
   select greatest(max(scheduled_date)+1,(now() at time zone 'Asia/Seoul')::date),coalesce(max(session_number),0)+1
     into cursor_date,next_number from public.online_sessions where enrollment_id=e.id;
   for i in 1..3000 loop
     day_kr:=(array['일','월','화','수','목','금','토'])[extract(dow from cursor_date)::integer+1];
     time_kr:=coalesce(nullif(e.day_times->>day_kr,''),nullif(e.class_time_kr,''),NEW.scheduled_time_kr);
     if (day_kr=any(e.days_of_week) or (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from cursor_date)::integer+1]=any(e.days_of_week))
        and not public.online_package_peak(cursor_date)
        and not exists(select 1 from public.holidays where date=cursor_date and is_deployed=true)
        and not exists(select 1 from public.bookings b where b.id=e.package_booking_id and cursor_date between b.checkin_date and b.checkout_date)
        and not exists(select 1 from public.online_sessions s where s.enrollment_id=e.id and s.scheduled_date=cursor_date)
        and not exists(select 1 from public.online_sessions s join public.online_enrollments other_e on other_e.id=s.enrollment_id
          where coalesce(s.tutor_id,other_e.tutor_id)=e.tutor_id and s.scheduled_date=cursor_date
          and left(s.scheduled_time_kr,5)=left(time_kr,5) and s.status='scheduled' and other_e.status in ('active','scheduled')) then
       if time_kr is null then raise exception 'Makeup requires a class time'; end if;
       insert into public.online_sessions(enrollment_id,tutor_id,session_number,scheduled_date,scheduled_time_kr,scheduled_time_ph,status,is_makeup_added,original_session_id)
         values(e.id,e.tutor_id,next_number,cursor_date,time_kr,to_char(time_kr::time-interval '1 hour','HH24:MI'),'scheduled',true,NEW.id);
       update public.online_enrollments set end_date=greatest(end_date,cursor_date),updated_at=now() where id=e.id;
       return NEW;
     end if;
     cursor_date:=cursor_date+1;
   end loop;
   raise exception 'No available makeup date within scheduling horizon';
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
end $function$
;
