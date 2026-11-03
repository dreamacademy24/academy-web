-- Private, append-only certificate snapshots. Booking records are never changed here.
create table public.certificate_template_versions (
 id uuid primary key default gen_random_uuid(), language text not null check(language in ('ko','en')),
 version integer not null check(version>0), payload jsonb not null check(jsonb_typeof(payload)='object'),
 created_by text not null, created_at timestamptz not null default now(), unique(language,version)
);
create table public.certificate_document_versions (
 id uuid primary key default gen_random_uuid(), document_id uuid not null, version integer not null check(version>0),
 language text not null check(language in ('ko','en')), booking_id uuid references public.bookings(id) on delete set null,
 student_name text not null, reference text not null, payload jsonb not null check(jsonb_typeof(payload)='object'),
 created_by text not null, created_at timestamptz not null default now(), unique(document_id,version)
);
alter table public.certificate_template_versions enable row level security;
alter table public.certificate_document_versions enable row level security;
revoke all on public.certificate_template_versions, public.certificate_document_versions from anon, authenticated;
grant select,insert on public.certificate_template_versions, public.certificate_document_versions to service_role;
create index certificate_documents_recent on public.certificate_document_versions(created_at desc);
create index certificate_documents_booking on public.certificate_document_versions(booking_id);

create function public.save_certificate_version(p_kind text,p_language text,p_expected_version integer,p_document_id uuid,p_booking_id uuid,p_payload jsonb,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_version integer; result jsonb;
begin
 if p_kind not in ('template','document') or p_language not in ('ko','en') or p_expected_version<0 then raise exception 'INVALID_CERTIFICATE'; end if;
 if not exists(select 1 from staff_accounts where username=p_actor and is_active=true and (role='korean_admin' or (role='local_teacher' and username in ('admin-abby','admin-axl')))) then raise exception 'CERTIFICATE_ACCESS_DENIED'; end if;
 if p_kind='template' then
  perform pg_advisory_xact_lock(hashtextextended('certificate-template:'||p_language,0));
  select coalesce(max(version),0) into current_version from certificate_template_versions where language=p_language;
  if current_version<>p_expected_version then raise exception 'CERTIFICATE_VERSION_CONFLICT'; end if;
  insert into certificate_template_versions(language,version,payload,created_by) values(p_language,current_version+1,p_payload,p_actor) returning to_jsonb(certificate_template_versions.*) into result;
 else
  if p_document_id is null then raise exception 'INVALID_DOCUMENT_ID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('certificate-document:'||p_document_id::text,0));
  select coalesce(max(version),0) into current_version from certificate_document_versions where document_id=p_document_id;
  if current_version<>p_expected_version then raise exception 'CERTIFICATE_VERSION_CONFLICT'; end if;
  if exists(select 1 from certificate_document_versions where document_id=p_document_id and language<>p_language) then raise exception 'CERTIFICATE_LANGUAGE_MISMATCH'; end if;
  insert into certificate_document_versions(document_id,version,language,booking_id,student_name,reference,payload,created_by)
   values(p_document_id,current_version+1,p_language,p_booking_id,coalesce(p_payload->'data'->>case when p_language='en' then 'studentNameEn' else 'studentNameKo' end,''),coalesce(p_payload->'data'->>'reference',''),p_payload,p_actor)
   returning to_jsonb(certificate_document_versions.*) into result;
 end if;
 return result;
end $$;
revoke all on function public.save_certificate_version(text,text,integer,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_certificate_version(text,text,integer,uuid,uuid,jsonb,text) to service_role;

create function public.certificate_search_bookings(p_query text)
returns setof jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('id',b.id,'reservation_no',b.reservation_no,'booker_name',b.booker_name,'booker_english',b.booker_english,
  'academy_start',b.academy_start,'academy_end',b.academy_end,'extra_guardians',b.extra_guardians,
  'students',case when jsonb_typeof(b.students)='array' and jsonb_array_length(b.students)>0 then b.students else coalesce(s.items,'[]'::jsonb) end,
  'invoice',jsonb_build_object('booker',i.saved_data->'booker','students',i.saved_data->'students'))
 from bookings b
 left join lateral(select saved_data from invoice_snapshots where booking_id=b.id order by saved_at desc limit 1)i on true
 left join lateral(select jsonb_agg(jsonb_build_object('name_kr',name_kr,'name_en',name_en,'age',age,'level',level,'academy_start',academy_start,'academy_end',academy_end)) items from students where booking_id=b.id)s on true
 where length(trim(p_query)) between 2 and 80 and (
  b.booker_name ilike '%'||replace(replace(replace(trim(p_query),'\','\\'),'%','\%'),'_','\_')||'%' or
  b.booker_english ilike '%'||replace(replace(replace(trim(p_query),'\','\\'),'%','\%'),'_','\_')||'%' or
  b.reservation_no ilike '%'||replace(replace(replace(trim(p_query),'\','\\'),'%','\%'),'_','\_')||'%' or
  b.students::text ilike '%'||replace(replace(replace(trim(p_query),'\','\\'),'%','\%'),'_','\_')||'%' or
  s.items::text ilike '%'||replace(replace(replace(trim(p_query),'\','\\'),'%','\%'),'_','\_')||'%' or
  i.saved_data->'students' is not null and (i.saved_data->'students')::text ilike '%'||replace(replace(replace(trim(p_query),'\','\\'),'%','\%'),'_','\_')||'%'
 ) order by b.created_at desc limit 30;
$$;
revoke all on function public.certificate_search_bookings(text) from public,anon,authenticated;
grant execute on function public.certificate_search_bookings(text) to service_role;
