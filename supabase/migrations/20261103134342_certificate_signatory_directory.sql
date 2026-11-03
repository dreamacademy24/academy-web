create table public.certificate_signatory_versions(
 id uuid primary key default gen_random_uuid(),version integer not null unique check(version>0),
 payload jsonb not null check(jsonb_typeof(payload)='array'),created_by text not null,created_at timestamptz not null default now()
);
alter table public.certificate_signatory_versions enable row level security;
revoke all on public.certificate_signatory_versions from anon,authenticated,service_role;
grant select,insert on public.certificate_signatory_versions to service_role;
create function public.save_certificate_signatory_directory(p_expected_version integer,p_payload jsonb,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_version integer;result jsonb;
begin
 if p_expected_version is null or p_expected_version<0 or jsonb_typeof(p_payload)<>'array' or jsonb_array_length(p_payload) not between 1 and 30 then raise exception 'INVALID_CERTIFICATE_DIRECTORY';end if;
 if not exists(select 1 from staff_accounts where username=p_actor and is_active=true and (role='korean_admin' or (role='local_teacher' and username in ('admin-abby','admin-axl')))) then raise exception 'CERTIFICATE_ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended('certificate-signatory-directory',0));
 select coalesce(max(version),0) into current_version from certificate_signatory_versions;
 if current_version<>p_expected_version then raise exception 'CERTIFICATE_VERSION_CONFLICT';end if;
 insert into certificate_signatory_versions(version,payload,created_by)values(current_version+1,p_payload,p_actor)returning to_jsonb(certificate_signatory_versions.*)into result;
 return result;
end $$;
revoke all on function public.save_certificate_signatory_directory(integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_certificate_signatory_directory(integer,jsonb,text) to service_role;
