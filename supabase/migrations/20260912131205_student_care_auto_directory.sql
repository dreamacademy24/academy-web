-- Show the source directory immediately; only exact source identities are auto-linked.
alter table public.care_links add column link_method text not null default 'manual'
 check (link_method in ('manual','automatic'));
grant update(link_method) on public.care_links to service_role;

create function public.sync_care_directory(p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 s public.students%rowtype; b public.bookings%rowtype;
 payload jsonb; item jsonb; idx integer; matches integer; outcome jsonb;
 first_date date; last_date date; linked integer:=0; skipped integer:=0;
begin
 if not exists(select 1 from public.staff_accounts where id=p_actor_id and is_active and role='korean_admin') then
  raise exception 'CARE_FORBIDDEN' using errcode='42501';
 end if;
 if not pg_catalog.pg_try_advisory_xact_lock(6926412301) then
  return jsonb_build_object('linked',0,'busy',true);
 end if;
 for s in select st.* from public.students st where not exists(select 1 from public.care_links l where l.legacy_student_id=st.id) order by st.booking_id,st.id loop
  begin
   -- Same locking order as manual confirmation. Never alter source rows.
   select * into b from public.bookings where id=s.booking_id for update;
   if not found or nullif(btrim(s.name_kr),'') is null or btrim(s.name_kr)='-' then continue; end if;
   if b.academy_start::text !~ '^\d{4}-\d{2}-\d{2}$' or b.academy_end::text !~ '^\d{4}-\d{2}-\d{2}$' then continue; end if;
   first_date:=b.academy_start::date; last_date:=b.academy_end::date;
   if first_date is null or last_date is null or last_date<first_date then continue; end if;
   payload:=case when jsonb_typeof(b.students)='string' then (b.students#>>'{}')::jsonb else b.students end;
   if jsonb_typeof(payload) is distinct from 'array' then continue; end if;
   select count(*),min((e.ordinality-1)::integer) into matches,idx
   from jsonb_array_elements(payload) with ordinality e(value,ordinality)
   where coalesce(nullif(btrim(e.value->>'id'),''),nullif(btrim(e.value->>'student_id'),''))=s.id::text;
   if matches<>1 then continue; end if;
   if exists(select 1 from public.care_links where (booking_id=b.id and source_index=idx) or legacy_student_id=s.id) then continue; end if;
   item:=payload->idx;
   if jsonb_typeof(item) is distinct from 'object' then continue; end if;
   if coalesce(nullif(btrim(item->>'korName'),''),nullif(btrim(item->>'name_kr'),''),nullif(btrim(item->>'koreanName'),''),nullif(btrim(item->>'name'),'')) is distinct from btrim(s.name_kr) then continue; end if;
   -- The existing transactional function rechecks identifiers, names, duplicate
   -- claims and both snapshots after locking the source student row.
   outcome:=public.confirm_care_student_link(gen_random_uuid(),p_actor_id,b.id,idx,s.id,b.students,
    jsonb_build_object('id',s.id,'booking_id',s.booking_id,'name_kr',s.name_kr,'name_en',s.name_en),
    first_date,last_date,null);
   update public.care_links set link_method='automatic' where visit_id=(outcome->>'visitId')::uuid;
   linked:=linked+1;
  exception when serialization_failure or unique_violation or invalid_text_representation or invalid_parameter_value or datetime_field_overflow or invalid_datetime_format then
   skipped:=skipped+1;
  end;
 end loop;
 return jsonb_build_object('linked',linked,'skipped',skipped,'busy',false);
end; $$;
revoke all on function public.sync_care_directory(uuid) from public,anon,authenticated;
grant execute on function public.sync_care_directory(uuid) to service_role;

create function public.get_care_directory(p_actor_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 result:=public.get_care_roster(p_actor_id);
 -- Local teachers never receive unassigned source directory data.
 if not (result->>'isAdmin')::boolean then return result; end if;
 return result||jsonb_build_object(
  'sourceCount',(select count(*) from public.students),
  'pendingStudents',coalesce((select jsonb_agg(jsonb_build_object(
   'id',s.id,'name_kr',s.name_kr,'name_en',s.name_en,
   'start_date',b.academy_start,'end_date',b.academy_end,
   'reason',case when b.id is null then '예약 정보 없음' when b.academy_start is null or b.academy_end is null then '방문 기간 확인 필요' else '학생·예약 정보 확인 필요' end
   ) order by s.name_kr,s.id) from public.students s left join public.bookings b on b.id=s.booking_id
   where not exists(select 1 from public.care_links l where l.legacy_student_id=s.id)),'[]'::jsonb),
  'visits',coalesce((select jsonb_agg(v.value||jsonb_build_object('linkMethod',coalesce((select l.link_method from public.care_links l where l.visit_id=(v.value->>'id')::uuid limit 1),'manual'))) from jsonb_array_elements(result->'visits') v),'[]'::jsonb)
 );
end; $$;
revoke all on function public.get_care_directory(uuid) from public,anon,authenticated;
grant execute on function public.get_care_directory(uuid) to service_role;
