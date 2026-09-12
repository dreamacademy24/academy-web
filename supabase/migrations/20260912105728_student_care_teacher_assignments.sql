-- Append-only assignment history. Pending bundled release; do not apply independently.
create table public.care_assignment_events (
 id uuid primary key default gen_random_uuid(),
 visit_id uuid not null references public.care_visits(id) on delete restrict,
 teacher_id uuid not null references public.staff_accounts(id) on delete restrict,
 actor_id uuid not null references public.staff_accounts(id) on delete restrict,
 active boolean not null,
 previous_id uuid references public.care_assignment_events(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 sequence bigint generated always as identity unique
);
create index care_assignment_pair on public.care_assignment_events(visit_id,teacher_id,sequence desc);
alter table public.care_assignment_events enable row level security;
revoke all on public.care_assignment_events from public,anon,authenticated;
grant select,insert on public.care_assignment_events to service_role;
revoke all on sequence public.care_assignment_events_sequence_seq from public,anon,authenticated;
grant usage,select on sequence public.care_assignment_events_sequence_seq to service_role;

create function public.set_care_assignment(p_actor_id uuid,p_request_id uuid,p_visit_id uuid,p_teacher_id uuid,p_active boolean,p_previous_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare old public.care_assignment_events; latest public.care_assignment_events;
begin
 if not exists(select 1 from public.staff_accounts where id=p_actor_id and is_active and role='korean_admin') then
  raise exception 'CARE_FORBIDDEN' using errcode='42501';
 end if;
 if p_request_id is null or p_visit_id is null or p_teacher_id is null or p_active is null then
  raise exception 'CARE_INVALID_INPUT' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,1));
 select * into old from public.care_assignment_events where id=p_request_id;
 if found then
  if old.actor_id<>p_actor_id or old.visit_id<>p_visit_id or old.teacher_id<>p_teacher_id or old.active<>p_active or old.previous_id is distinct from p_previous_id then
   raise exception 'CARE_REQUEST_CONFLICT' using errcode='40001';
  end if;
  return jsonb_build_object('id',old.id,'alreadySaved',true);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_visit_id::text||p_teacher_id::text,2));
 if not exists(select 1 from public.care_visits where id=p_visit_id) then
  raise exception 'CARE_VISIT_MISSING' using errcode='22023';
 end if;
 -- A disabled teacher can still be unassigned. New access requires an active teacher.
 if not exists(select 1 from public.staff_accounts where id=p_teacher_id and (not p_active or (is_active and role='local_teacher'))) then
  raise exception 'CARE_TEACHER_INVALID' using errcode='22023';
 end if;
 select * into latest from public.care_assignment_events where visit_id=p_visit_id and teacher_id=p_teacher_id order by sequence desc limit 1;
 if latest.id is distinct from p_previous_id then raise exception 'CARE_ASSIGNMENT_CHANGED' using errcode='40001'; end if;
 if coalesce(latest.active,false)=p_active then raise exception 'CARE_NO_CHANGE' using errcode='22023'; end if;
 insert into public.care_assignment_events(id,visit_id,teacher_id,actor_id,active,previous_id)
 values(p_request_id,p_visit_id,p_teacher_id,p_actor_id,p_active,p_previous_id);
 return jsonb_build_object('id',p_request_id,'alreadySaved',false);
end; $$;
revoke all on function public.set_care_assignment(uuid,uuid,uuid,uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.set_care_assignment(uuid,uuid,uuid,uuid,boolean,uuid) to service_role;

create function public.get_care_roster(p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor_role text; result jsonb;
begin
 select role into actor_role from public.staff_accounts where id=p_actor_id and is_active;
 if actor_role is null or actor_role not in ('korean_admin','local_teacher') then
  raise exception 'CARE_FORBIDDEN' using errcode='42501';
 end if;
 with latest as (
  select distinct on (visit_id,teacher_id) * from public.care_assignment_events order by visit_id,teacher_id,sequence desc
 ), visible as (
  select v.id,v.learner_id,v.start_date,v.end_date,l.name_kr,l.name_en
  from public.care_visits v join public.care_learners l on l.id=v.learner_id
  where actor_role='korean_admin' or exists(select 1 from latest a where a.visit_id=v.id and a.teacher_id=p_actor_id and a.active)
 ) select jsonb_build_object(
  'isAdmin',actor_role='korean_admin',
  'visits',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object(
   'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'teacherId',a.teacher_id,'name',s.name,'active',a.active,'available',s.is_active and s.role='local_teacher') order by s.name)
    from latest a join public.staff_accounts s on s.id=a.teacher_id where a.visit_id=v.id and (actor_role='korean_admin' or a.active)),'[]'::jsonb),
   'history',case when actor_role='korean_admin' then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'teacher',s.name,'actor',u.name,'active',a.active,'at',a.created_at) order by a.sequence desc)
    from public.care_assignment_events a join public.staff_accounts s on s.id=a.teacher_id join public.staff_accounts u on u.id=a.actor_id where a.visit_id=v.id),'[]'::jsonb) else '[]'::jsonb end
   ) order by v.start_date desc,v.id) from visible v),'[]'::jsonb),
  'teachers',case when actor_role='korean_admin' then coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id) from public.staff_accounts where is_active and role='local_teacher'),'[]'::jsonb) else '[]'::jsonb end
 ) into result;
 return result;
end; $$;
revoke all on function public.get_care_roster(uuid) from public,anon,authenticated;
grant execute on function public.get_care_roster(uuid) to service_role;
