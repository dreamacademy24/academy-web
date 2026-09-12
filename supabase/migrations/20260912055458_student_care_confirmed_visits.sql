-- Additive care registry. Existing bookings/students are read, never rewritten.
create table public.care_learners (
 id uuid primary key default gen_random_uuid(),
 name_kr text not null check(length(btrim(name_kr))>0), name_en text,
 created_by uuid not null, created_at timestamptz not null default now()
);
create table public.care_visits (
 id uuid primary key default gen_random_uuid(),
 learner_id uuid not null references public.care_learners(id) on delete restrict,
 booking_id uuid not null, reservation_no text,
 start_date date not null, end_date date not null check(end_date>=start_date),
 level_snapshot text, created_by uuid not null, created_at timestamptz not null default now(),
 unique(learner_id,booking_id)
);
create table public.care_links (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 booking_id uuid not null, source_index integer not null check(source_index>=0),
 legacy_student_id uuid not null unique,
 learner_id uuid not null references public.care_learners(id) on delete restrict,
 visit_id uuid not null references public.care_visits(id) on delete restrict,
 source_snapshot jsonb not null, requested_learner_id uuid,
 confirmed_by uuid not null, confirmed_at timestamptz not null default now(),
 unique(booking_id,source_index)
);
create table public.care_audit (
 id uuid primary key default gen_random_uuid(), link_id uuid not null references public.care_links(id) on delete restrict,
 actor_id uuid not null, action text not null check(action='confirm_student_link'),
 created_at timestamptz not null default now()
);
create index care_visits_learner_date on public.care_visits(learner_id,start_date);
alter table public.care_learners enable row level security;
alter table public.care_visits enable row level security;
alter table public.care_links enable row level security;
alter table public.care_audit enable row level security;
revoke all on public.care_learners,public.care_visits,public.care_links,public.care_audit from public,anon,authenticated;
grant select,insert on public.care_learners,public.care_visits,public.care_links,public.care_audit to service_role;

create function public.confirm_care_student_link(
 p_request_id uuid,p_actor_id uuid,p_booking_id uuid,p_source_index integer,
 p_student_id uuid,p_expected_students jsonb,p_expected_student jsonb,
 p_start date,p_end date,p_learner_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 b public.bookings%rowtype; s public.students%rowtype;
 old public.care_links%rowtype; v public.care_visits%rowtype;
 payload jsonb; entry jsonb; learner uuid; visit uuid; link uuid;
 name_kr text; name_en text; source_id text;
begin
 if not exists(select 1 from public.staff_accounts where id=p_actor_id and is_active=true and role='korean_admin') then
  raise exception 'CARE_FORBIDDEN' using errcode='42501';
 end if;
 if p_request_id is null or p_start is null or p_end is null or p_end<p_start or p_source_index is null or p_source_index<0 then
  raise exception 'CARE_INVALID_INPUT' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into old from public.care_links where request_id=p_request_id;
 if found then
  select * into v from public.care_visits where id=old.visit_id;
  if old.booking_id<>p_booking_id or old.source_index<>p_source_index or old.legacy_student_id<>p_student_id
   or old.confirmed_by<>p_actor_id or old.requested_learner_id is distinct from p_learner_id
   or v.start_date<>p_start or v.end_date<>p_end then
   raise exception 'CARE_REQUEST_CONFLICT' using errcode='40001';
  end if;
  return jsonb_build_object('learnerId',old.learner_id,'visitId',old.visit_id,'alreadyConfirmed',true);
 end if;
 select * into b from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'CARE_SOURCE_MISSING' using errcode='40001'; end if;
 select * into s from public.students where id=p_student_id for update;
 if not found or s.booking_id is distinct from p_booking_id then raise exception 'CARE_SOURCE_MISSING' using errcode='40001'; end if;
 if b.students is distinct from p_expected_students or
  jsonb_build_object('id',s.id,'booking_id',s.booking_id,'name_kr',s.name_kr,'name_en',s.name_en) is distinct from p_expected_student then
  raise exception 'CARE_SOURCE_CHANGED' using errcode='40001';
 end if;
 payload:=case when jsonb_typeof(b.students)='string' then (b.students#>>'{}')::jsonb else b.students end;
 if jsonb_typeof(payload) is distinct from 'array' then raise exception 'CARE_INVALID_SOURCE' using errcode='22023'; end if;
 entry:=payload->p_source_index;
 if jsonb_typeof(entry) is distinct from 'object' then raise exception 'CARE_INVALID_SOURCE' using errcode='22023'; end if;
 source_id:=coalesce(nullif(btrim(entry->>'id'),''),nullif(btrim(entry->>'student_id'),''));
 name_kr:=coalesce(nullif(btrim(entry->>'korName'),''),nullif(btrim(entry->>'name_kr'),''),nullif(btrim(entry->>'koreanName'),''),nullif(btrim(entry->>'name'),''));
 name_en:=coalesce(nullif(btrim(entry->>'engName'),''),nullif(btrim(entry->>'name_en'),''));
 if source_id is distinct from p_student_id::text or name_kr is distinct from btrim(s.name_kr)
  or (name_en is not null and s.name_en is not null and lower(name_en)<>lower(btrim(s.name_en))) then
  raise exception 'CARE_NOT_EXACT_CANDIDATE' using errcode='40001';
 end if;
 if nullif(btrim(entry->>'id'),'') is not null and nullif(btrim(entry->>'student_id'),'') is not null
  and btrim(entry->>'id')<>btrim(entry->>'student_id') then raise exception 'CARE_CONFLICTING_IDS' using errcode='40001'; end if;
 if (select count(*) from jsonb_array_elements(payload) e where coalesce(nullif(btrim(e->>'id'),''),nullif(btrim(e->>'student_id'),''))=source_id)<>1 then
  raise exception 'CARE_REPEATED_ID' using errcode='40001';
 end if;
 if exists(select 1 from public.care_links where (booking_id=p_booking_id and source_index=p_source_index) or legacy_student_id=p_student_id) then
  raise exception 'CARE_ALREADY_LINKED' using errcode='40001';
 end if;
 if p_learner_id is null then
  insert into public.care_learners(name_kr,name_en,created_by) values(s.name_kr,s.name_en,p_actor_id) returning id into learner;
 else
  select id into learner from public.care_learners where id=p_learner_id;
  if not found then raise exception 'CARE_LEARNER_MISSING' using errcode='22023'; end if;
 end if;
 insert into public.care_visits(learner_id,booking_id,reservation_no,start_date,end_date,level_snapshot,created_by)
 values(learner,p_booking_id,b.reservation_no,p_start,p_end,s.level,p_actor_id) returning id into visit;
 insert into public.care_links(request_id,booking_id,source_index,legacy_student_id,learner_id,visit_id,source_snapshot,requested_learner_id,confirmed_by)
 values(p_request_id,p_booking_id,p_source_index,p_student_id,learner,visit,jsonb_build_object('entry',entry,'student',p_expected_student),p_learner_id,p_actor_id) returning id into link;
 insert into public.care_audit(link_id,actor_id,action) values(link,p_actor_id,'confirm_student_link');
 return jsonb_build_object('learnerId',learner,'visitId',visit,'alreadyConfirmed',false);
end;
$$;
revoke all on function public.confirm_care_student_link(uuid,uuid,uuid,integer,uuid,jsonb,jsonb,date,date,uuid) from public,anon,authenticated;
grant execute on function public.confirm_care_student_link(uuid,uuid,uuid,integer,uuid,jsonb,jsonb,date,date,uuid) to service_role;
