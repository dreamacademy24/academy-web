-- Expand the official level choices without changing any existing visit or assignment.
-- App publication remains limited to the explicitly supported level/unit pair.
alter table public.care_learning_assignments
 drop constraint care_learning_assignments_level_code_check;
alter table public.care_learning_assignments
 add constraint care_learning_assignments_level_code_check
 check(level_code in (
  'DSL-F1','DSL-F2','DSL-S1','DSL-S2','DSL-T1','DSL-T2',
  'DR-F1','DR-F2','DR-S','DR-T','DW-F','DW-S1','DW-S2','DW-T','DW-M'
 ));

create or replace function public.set_care_learning_assignment(
 p_actor_id uuid,p_request_id uuid,p_visit_id uuid,p_previous_id uuid,p_level_code text,p_unit_id text
)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare previous public.care_learning_assignments; existing public.care_learning_assignments;
begin
 if not exists(select 1 from public.staff_accounts where id=p_actor_id and is_active and role='korean_admin') then
  raise exception 'CARE_FORBIDDEN' using errcode='42501';
 end if;
 if p_request_id is null or p_visit_id is null or p_level_code is null
  or p_level_code not in (
   'DSL-F1','DSL-F2','DSL-S1','DSL-S2','DSL-T1','DSL-T2',
   'DR-F1','DR-F2','DR-S','DR-T','DW-F','DW-S1','DW-S2','DW-T','DW-M'
  )
  or (p_unit_id is not null and (p_unit_id<>'dsl-f2-w1-d1' or p_level_code<>'DSL-F2')) then
  raise exception 'CARE_INVALID_INPUT' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,11));
 select * into existing from public.care_learning_assignments where id=p_request_id;
 if found then
  if existing.actor_id<>p_actor_id or existing.visit_id<>p_visit_id
   or existing.previous_id is distinct from p_previous_id or existing.level_code<>p_level_code
   or existing.unit_id is distinct from p_unit_id then
   raise exception 'CARE_REQUEST_CONFLICT' using errcode='40001';
  end if;
  return public.get_care_learning_assignment(p_actor_id,p_visit_id)||jsonb_build_object('alreadySaved',true);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_visit_id::text,12));
 if not exists(select 1 from public.care_visits where id=p_visit_id) then
  raise exception 'CARE_VISIT_MISSING' using errcode='22023';
 end if;
 select * into previous from public.care_learning_assignments where visit_id=p_visit_id order by version desc limit 1;
 if previous.id is distinct from p_previous_id then raise exception 'CARE_ASSIGNMENT_CHANGED' using errcode='40001'; end if;
 if previous.level_code=p_level_code and previous.unit_id is not distinct from p_unit_id then
  raise exception 'CARE_NO_CHANGE' using errcode='22023';
 end if;
 insert into public.care_learning_assignments(id,visit_id,actor_id,level_code,unit_id,previous_id,version)
 values(p_request_id,p_visit_id,p_actor_id,p_level_code,p_unit_id,p_previous_id,coalesce(previous.version,0)+1);
 insert into public.care_learning_assignment_audit(assignment_id,actor_id,action)
 values(p_request_id,p_actor_id,'set_learning_assignment');
 return public.get_care_learning_assignment(p_actor_id,p_visit_id)||jsonb_build_object('alreadySaved',false);
end; $$;
revoke all on function public.set_care_learning_assignment(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.set_care_learning_assignment(uuid,uuid,uuid,uuid,text,text) to service_role;
