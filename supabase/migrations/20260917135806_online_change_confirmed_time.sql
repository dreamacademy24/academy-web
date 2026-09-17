drop function public.approve_online_single_change(uuid,text,text);
create or replace function public.approve_online_single_change(p_request uuid,p_note text,p_by text,p_confirmed_time text default null)
returns void language plpgsql set search_path=public as $function$
declare r public.online_change_requests%rowtype; s public.online_sessions%rowtype; assigned uuid; chosen_time text;
begin
 select * into r from public.online_change_requests where id=p_request;
 if not found then raise exception 'REQUEST_MISSING'; end if;
 select tutor_id into assigned from public.online_enrollments where id=r.enrollment_id for update;
 select * into r from public.online_change_requests where id=p_request for update;
 if r.status<>'pending' or r.req_type<>'single' then raise exception 'REQUEST_NOT_PENDING'; end if;
 if assigned is not null and r.teacher_status is distinct from 'approved' then raise exception 'TEACHER_APPROVAL_REQUIRED'; end if;
 select * into s from public.online_sessions where id=r.session_id and enrollment_id=r.enrollment_id for update;
 if not found or s.status<>'scheduled' then raise exception 'SESSION_MISSING_OR_PROCESSED'; end if;
 chosen_time:=coalesce(p_confirmed_time,r.req_time_kr);
 if chosen_time is not null and chosen_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'CONFIRMED_TIME_REQUIRED'; end if;
 if assigned is not null then
  perform pg_advisory_xact_lock(hashtext('online-tutor:'||assigned::text));
  if exists(select 1 from public.online_sessions other_s join public.online_enrollments other_e on other_e.id=other_s.enrollment_id where other_s.id<>s.id and other_s.status='scheduled' and other_e.status in ('active','scheduled') and coalesce(other_s.tutor_id,other_e.tutor_id)=assigned and other_s.scheduled_date=coalesce(r.req_date,s.scheduled_date) and left(other_s.scheduled_time_kr,5)=coalesce(chosen_time,left(s.scheduled_time_kr,5))) then raise exception 'TUTOR_CONFLICT'; end if;
 end if;
 update public.online_sessions set scheduled_date=coalesce(r.req_date,s.scheduled_date),scheduled_time_kr=coalesce(chosen_time,s.scheduled_time_kr),scheduled_time_ph=case when chosen_time is null then s.scheduled_time_ph else to_char(chosen_time::time-interval '1 hour','HH24:MI') end,schedule_locked=true where id=s.id;
 update public.online_change_requests set status='approved',admin_status='approved',admin_note=case when chosen_time is distinct from r.req_time_kr then concat_ws(E'\n',nullif(p_note,''),'확정 수업 시간 (한국): '||chosen_time||' / 요청: '||coalesce(r.req_time_kr,'시간 유지')) else p_note end,processed_by=p_by,processed_at=now() where id=r.id;
 update public.online_enrollments set end_date=(select max(scheduled_date) from public.online_sessions where enrollment_id=r.enrollment_id),updated_at=now() where id=r.enrollment_id;
end $function$;
revoke all on function public.approve_online_single_change(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.approve_online_single_change(uuid,text,text,text) to service_role;
