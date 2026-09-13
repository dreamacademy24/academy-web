-- Official learning assignments are separate from the original class/level snapshot.
-- Rows and their audit records are append-only; publishing a level does not publish a unit.
create table public.care_learning_assignments (
 id uuid primary key,
 visit_id uuid not null references public.care_visits(id) on delete restrict,
 actor_id uuid not null references public.staff_accounts(id) on delete restrict,
 level_code text not null check(level_code in ('DSL-F2','DSL-T1','DR-F1','DR-F2','DR-S','DR-T')),
 unit_id text,
 previous_id uuid references public.care_learning_assignments(id) on delete restrict,
 version integer not null check(version>0),
 effective_at timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default clock_timestamp(),
 unique(visit_id,version),
 check(unit_id is null or (unit_id='dsl-f2-w1-d1' and level_code='DSL-F2'))
);
create index care_learning_assignments_visit on public.care_learning_assignments(visit_id,version desc);
create table public.care_learning_assignment_audit (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null unique references public.care_learning_assignments(id) on delete restrict,
 actor_id uuid not null references public.staff_accounts(id) on delete restrict,
 action text not null check(action='set_learning_assignment'),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.care_learning_assignments enable row level security;
alter table public.care_learning_assignment_audit enable row level security;
revoke all on public.care_learning_assignments,public.care_learning_assignment_audit from public,anon,authenticated;
revoke all on public.care_learning_assignments,public.care_learning_assignment_audit from service_role;
grant select,insert on public.care_learning_assignments,public.care_learning_assignment_audit to service_role;

create function public.get_care_learning_assignment(p_actor_id uuid,p_visit_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor_role text; current_assignment jsonb; assignment_history jsonb;
begin
 select role into actor_role from public.staff_accounts where id=p_actor_id and is_active;
 if actor_role is null or actor_role not in ('korean_admin','local_teacher') then
  raise exception 'CARE_FORBIDDEN' using errcode='42501';
 end if;
 if actor_role='local_teacher' and not coalesce((
  select active from public.care_assignment_events
  where visit_id=p_visit_id and teacher_id=p_actor_id order by sequence desc limit 1
 ),false) then raise exception 'CARE_FORBIDDEN' using errcode='42501'; end if;
 if p_visit_id is null or not exists(select 1 from public.care_visits where id=p_visit_id) then
  raise exception 'CARE_VISIT_MISSING' using errcode='22023';
 end if;
 select jsonb_build_object('id',a.id,'level_code',a.level_code,'unit_id',a.unit_id,
  'effective_at',a.effective_at,'created_at',a.created_at,'version',a.version)
 into current_assignment from public.care_learning_assignments a
 where a.visit_id=p_visit_id order by a.version desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'level_code',a.level_code,'unit_id',a.unit_id,
  'effective_at',a.effective_at,'created_at',a.created_at,'version',a.version,'actor_name',s.name)
  order by a.version desc),'[]'::jsonb)
 into assignment_history from public.care_learning_assignments a
 join public.staff_accounts s on s.id=a.actor_id where a.visit_id=p_visit_id;
 return jsonb_build_object('assignment',current_assignment,'history',assignment_history,'canEdit',actor_role='korean_admin');
end; $$;
revoke all on function public.get_care_learning_assignment(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_care_learning_assignment(uuid,uuid) to service_role;

create function public.set_care_learning_assignment(
 p_actor_id uuid,p_request_id uuid,p_visit_id uuid,p_previous_id uuid,p_level_code text,p_unit_id text
)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare previous public.care_learning_assignments; existing public.care_learning_assignments;
begin
 if not exists(select 1 from public.staff_accounts where id=p_actor_id and is_active and role='korean_admin') then
  raise exception 'CARE_FORBIDDEN' using errcode='42501';
 end if;
 if p_request_id is null or p_visit_id is null or p_level_code is null
  or p_level_code not in ('DSL-F2','DSL-T1','DR-F1','DR-F2','DR-S','DR-T')
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
