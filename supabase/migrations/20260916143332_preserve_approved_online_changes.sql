alter table public.online_sessions add column if not exists schedule_locked boolean not null default false;
comment on column public.online_sessions.schedule_locked is 'Individually approved schedule changes survive bulk regeneration.';
update public.online_sessions s set schedule_locked=true where exists(select 1 from public.online_change_requests r where r.session_id=s.id and r.enrollment_id=s.enrollment_id and r.req_type='single' and r.status='approved');

DO $migration$
declare definition text;
begin
 select pg_get_functiondef('public.save_online_package_plan(uuid,boolean,text,text,jsonb,jsonb,jsonb,date)'::regprocedure) into definition;
 if position('and recorded_at is null;' in definition)=0 then raise exception 'Unexpected package save definition'; end if;
 definition:=replace(definition,'and recorded_at is null;','and recorded_at is null and not schedule_locked;');
 execute definition;
end $migration$;

create or replace function public.approve_online_single_change(p_request uuid,p_note text,p_by text)
returns void language plpgsql set search_path=public as $function$
declare r public.online_change_requests%rowtype; s public.online_sessions%rowtype; assigned uuid;
begin
 select * into r from public.online_change_requests where id=p_request;
 if not found then raise exception 'REQUEST_MISSING'; end if;
 select tutor_id into assigned from public.online_enrollments where id=r.enrollment_id for update;
 select * into r from public.online_change_requests where id=p_request for update;
 if r.status<>'pending' or r.req_type<>'single' then raise exception 'REQUEST_NOT_PENDING'; end if;
 if assigned is not null and r.teacher_status is distinct from 'approved' then raise exception 'TEACHER_APPROVAL_REQUIRED'; end if;
 select * into s from public.online_sessions where id=r.session_id and enrollment_id=r.enrollment_id for update;
 if not found or s.status<>'scheduled' then raise exception 'SESSION_MISSING_OR_PROCESSED'; end if;
 if assigned is not null then
  perform pg_advisory_xact_lock(hashtext('online-tutor:'||assigned::text));
  if exists(select 1 from public.online_sessions other_s join public.online_enrollments other_e on other_e.id=other_s.enrollment_id where other_s.id<>s.id and other_s.status='scheduled' and other_e.status in ('active','scheduled') and coalesce(other_s.tutor_id,other_e.tutor_id)=assigned and other_s.scheduled_date=coalesce(r.req_date,s.scheduled_date) and left(other_s.scheduled_time_kr,5)=coalesce(r.req_time_kr,left(s.scheduled_time_kr,5))) then raise exception 'TUTOR_CONFLICT'; end if;
 end if;
 update public.online_sessions set scheduled_date=coalesce(r.req_date,s.scheduled_date),scheduled_time_kr=coalesce(r.req_time_kr,s.scheduled_time_kr),scheduled_time_ph=case when r.req_time_kr is null then s.scheduled_time_ph else to_char(r.req_time_kr::time-interval '1 hour','HH24:MI') end,schedule_locked=true where id=s.id;
 update public.online_change_requests set status='approved',admin_status='approved',admin_note=p_note,processed_by=p_by,processed_at=now() where id=r.id;
 update public.online_enrollments set end_date=(select max(scheduled_date) from public.online_sessions where enrollment_id=r.enrollment_id),updated_at=now() where id=r.enrollment_id;
end $function$;
revoke all on function public.approve_online_single_change(uuid,text,text) from public,anon,authenticated;
grant execute on function public.approve_online_single_change(uuid,text,text) to service_role;
