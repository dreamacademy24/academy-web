-- Keep the package total unchanged when one lesson moves across the study stay.
create or replace function public.transfer_online_package_credit(p_enrollment uuid,p_from text,p_to text)
returns void language plpgsql security invoker set search_path=public as $$
declare e public.online_enrollments%rowtype; plan jsonb; from_count integer; to_count integer;
begin
 if p_from=p_to then return; end if;
 if p_from not in ('pre','post') or p_to not in ('pre','post') or p_from is null or p_to is null then raise exception 'INVALID_PACKAGE_PHASE'; end if;
 select * into e from public.online_enrollments where id=p_enrollment for update;
 plan:=e.package_plan;
 from_count:=(plan->p_from->>'count')::integer;
 to_count:=(plan->p_to->>'count')::integer;
 if plan is null or coalesce(from_count,0)<1 or to_count is null or jsonb_array_length(coalesce(plan->p_to->'days','[]'::jsonb))=0 then
   raise exception 'PACKAGE_DESTINATION_REQUIRED';
 end if;
 plan:=jsonb_set(jsonb_set(plan,array[p_from,'count'],to_jsonb(from_count-1)),array[p_to,'count'],to_jsonb(to_count+1));
 update public.online_enrollments set package_plan=plan,pre_sessions=(plan->'pre'->>'count')::integer,post_sessions=(plan->'post'->>'count')::integer,updated_at=now() where id=e.id;
end $$;
revoke all on function public.transfer_online_package_credit(uuid,text,text) from public,anon,authenticated;
grant execute on function public.transfer_online_package_credit(uuid,text,text) to service_role;

do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.approve_online_single_change(uuid,text,text,text)'::regprocedure) into definition;
 if position('schedule_locked=true where id=s.id;' in definition)=0 then raise exception 'Unexpected approval function'; end if;
 definition:=replace(definition,'chosen_time text;','chosen_time text; plan jsonb; ci date; co date; target_phase text; source_phase text;');
 definition:=replace(definition,' update public.online_sessions set scheduled_date=', $code$
 select package_plan into plan from public.online_enrollments where id=r.enrollment_id;
 target_phase:=s.package_phase;
 if plan is not null then
   select min(checkin_date),max(checkout_date) into ci,co from public.bookings where id in(select value::uuid from jsonb_array_elements_text(plan->'bookingIds'));
   if ci is null or co is null then raise exception 'PACKAGE_DESTINATION_REQUIRED'; end if;
   source_phase:=coalesce(s.package_phase,case when s.scheduled_date<ci then 'pre' else 'post' end);
   target_phase:=case when coalesce(r.req_date,s.scheduled_date)<ci then 'pre' when coalesce(r.req_date,s.scheduled_date)>co then 'post' else null end;
   if target_phase is null then raise exception 'PACKAGE_STAY_DATE'; end if;
   perform public.transfer_online_package_credit(r.enrollment_id,source_phase,target_phase);
 end if;
 update public.online_sessions set scheduled_date=$code$);
 definition:=replace(definition,'schedule_locked=true where id=s.id;','schedule_locked=true,package_phase=target_phase where id=s.id;');
 execute definition;

 select pg_get_functiondef('public.auto_add_makeup_session()'::regprocedure) into definition;
 if position('phase:=coalesce(NEW.package_phase' in definition)=0 then raise exception 'Unexpected makeup function'; end if;
 definition:=replace(definition,'phase text; part jsonb;','phase text; source_phase text; part jsonb;');
 definition:=replace(definition,'part:=e.package_plan->phase;', $code$
 source_phase:=phase;
 -- A configured post-study schedule is the final block of the package.
 if coalesce((e.package_plan->'post'->>'count')::integer,0)>0 then phase:='post'; end if;
 part:=e.package_plan->phase;
 if e.tutor_id is not null then perform pg_advisory_xact_lock(hashtext('online-tutor:'||e.tutor_id::text)); end if;
 $code$);
 definition:=replace(definition,$code$if phase='post' then cursor_date:=greatest(cursor_date,co+1); end if;$code$, $code$if phase='post' then select greatest(cursor_date,co+1,(part->>'start')::date,max(scheduled_date)+1) into cursor_date from public.online_sessions where enrollment_id=e.id; end if;$code$);
 definition:=replace(definition,$code$if phase='pre' and cursor_date>=ci then return NEW; end if;$code$, $code$if phase='pre' and cursor_date>=ci then raise exception 'PACKAGE_DESTINATION_REQUIRED'; end if;$code$);
 definition:=replace(definition,E'\n     update public.online_enrollments set end_date=greatest(end_date,cursor_date),updated_at=now() where id=e.id;', E'\n     perform public.transfer_online_package_credit(e.id,source_phase,phase);\n     update public.online_enrollments set end_date=greatest(end_date,cursor_date),updated_at=now() where id=e.id;');
 -- Only the package branch has this final fall-through (ordinary enrollments already raise).
 definition:=replace(definition,E' end loop;\n return NEW;\nend', E' end loop;\n raise exception ''NO_MAKEUP_DATE'';\nend');
 execute definition;
end $migration$;
