create table public.online_applications (
 id uuid primary key default gen_random_uuid(),
 request_key uuid not null unique,
 payload_hash text not null,
 ip_hash text not null,
 payload jsonb not null,
 quote jsonb not null,
 guide_version text not null,
 existing_user_id uuid,
 status text not null default 'pending' check(status in ('pending','processing','issued','rejected')),
 claim_token uuid,
 account_username text,
 account_cipher text,
 provision_user_id uuid,
 enrollment_id uuid references public.online_enrollments(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.online_applications enable row level security;
revoke all on public.online_applications from anon, authenticated;
grant select,insert,update,delete on public.online_applications to service_role;
create index online_applications_created_idx on public.online_applications(created_at desc);
create index online_applications_rate_idx on public.online_applications(ip_hash,created_at);

-- Protect new booking3 rows without changing legacy account access during this release.
alter table public.profiles add column booking3_application_id uuid;
alter table public.profiles enable row level security;
create policy booking3_profiles_read on public.profiles as restrictive for select to anon,authenticated using(booking3_application_id is null or id=(select auth.uid()));
create policy booking3_profiles_update on public.profiles as restrictive for update to anon,authenticated using(booking3_application_id is null) with check(booking3_application_id is null);
create policy booking3_profiles_insert on public.profiles as restrictive for insert to anon,authenticated with check(booking3_application_id is null);
create policy booking3_profiles_delete on public.profiles as restrictive for delete to anon,authenticated using(booking3_application_id is null);
alter table public.online_enrollments add column booking3_application_id uuid;
alter table public.online_enrollments enable row level security;
create policy legacy_enrollments_access on public.online_enrollments for all to anon,authenticated using(booking3_application_id is null) with check(booking3_application_id is null);
create policy booking3_enrollments_read on public.online_enrollments for select to authenticated using(customer_user_id=(select auth.uid())::text);
alter table public.online_sessions enable row level security;
create policy legacy_sessions_access on public.online_sessions for all to anon,authenticated using(exists(select 1 from public.online_enrollments e where e.id=enrollment_id and e.booking3_application_id is null)) with check(exists(select 1 from public.online_enrollments e where e.id=enrollment_id and e.booking3_application_id is null));
create policy booking3_sessions_read on public.online_sessions for select to authenticated using(exists(select 1 from public.online_enrollments e where e.id=enrollment_id and e.customer_user_id=(select auth.uid())::text));

create function public.submit_online_application(p_key uuid,p_hash text,p_ip text,p_payload jsonb,p_quote jsonb,p_version text,p_user uuid default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare row public.online_applications; result uuid;
begin
 perform pg_advisory_xact_lock(hashtext(p_key::text));
 select * into row from public.online_applications where request_key=p_key;
 if found then
   if row.payload_hash<>p_hash or row.existing_user_id is distinct from p_user then raise exception 'REQUEST_CONFLICT'; end if;
   return row.id;
 end if;
 perform pg_advisory_xact_lock(hashtext('booking3:'||p_ip));
 if (select count(*) from public.online_applications where ip_hash=p_ip and created_at>now()-interval '1 hour')>=10 then raise exception 'RATE_LIMIT'; end if;
 insert into public.online_applications(request_key,payload_hash,ip_hash,payload,quote,guide_version,existing_user_id)
 values(p_key,p_hash,p_ip,p_payload,p_quote,p_version,p_user) returning id into result;
 return result;
end $$;
revoke all on function public.submit_online_application(uuid,text,text,jsonb,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.submit_online_application(uuid,text,text,jsonb,jsonb,text,uuid) to service_role;

create function public.finalize_online_application(p_id uuid,p_claim uuid,p_dates jsonb,p_start date)
returns uuid language plpgsql security invoker set search_path=public as $$
declare row public.online_applications; eid uuid; item jsonb; num integer:=0; last_date date; time_kr text; day_kr text;
begin
 select * into strict row from public.online_applications where id=p_id for update;
 if row.status='issued' then return row.enrollment_id; end if;
 if row.status<>'processing' or row.claim_token is distinct from p_claim or row.provision_user_id is null then raise exception 'ISSUE_CONFLICT'; end if;
 if jsonb_typeof(p_dates)<>'array' or jsonb_array_length(p_dates)<>(row.quote->>'totalSessions')::int or jsonb_array_length(p_dates)<1 then raise exception 'INVALID_SCHEDULE'; end if;
 if (select count(distinct value) from jsonb_array_elements_text(p_dates))<>jsonb_array_length(p_dates) then raise exception 'DUPLICATE_DATES'; end if;
 select max(value::date) into last_date from jsonb_array_elements_text(p_dates);
 insert into public.online_enrollments(student_name,student_name_en,student_birth_year,customer_user_id,enrollment_type,level,days_of_week,class_time_kr,class_time_ph,start_date,end_date,duration_weeks,class_duration_weeks,class_period,sessions_per_week,total_sessions,used_sessions,portal_open,status,day_times,notes)
 values(row.payload->>'student',row.payload->>'englishName',row.payload->>'birthYear',row.provision_user_id::text,'paid',row.payload->>'level',array(select jsonb_array_elements_text(row.payload->'days')),row.payload->'dayTimes'->>(row.payload->'days'->>0),to_char(((row.payload->'dayTimes'->>(row.payload->'days'->>0))::time-interval '1 hour'),'HH24:MI'),p_start,last_date,(row.quote->>'weeks')::int,(row.quote->>'weeks')::int,'standalone',(row.payload->>'weekly')::int,(row.quote->>'totalSessions')::int,0,true,'active',row.payload->'dayTimes',
 'booking3 신청 · '||row.id::text||E'\n보호자: '||(row.payload->>'guardian')||' / '||(row.payload->>'phone')||E'\n유료 '||(row.quote->>'paidSessions')||'회 + 추가 혜택 '||(row.quote->>'bonusSessions')||'회 / 신청 금액 '||(row.quote->>'amount')||E'원\n요청: '||coalesce(row.payload->>'notes','')||E'\n소개자(확인 후 별도 적용): '||coalesce(row.payload->>'referral','')) returning id into eid;
 for item in select value from jsonb_array_elements(p_dates) loop
   num:=num+1;
   if (item#>>'{}')::date<p_start then raise exception 'INVALID_START'; end if;
   day_kr:=(array['일','월','화','수','목','금','토'])[extract(dow from (item#>>'{}')::date)::int+1];
   time_kr:=row.payload->'dayTimes'->>day_kr;
   if time_kr is null then raise exception 'INVALID_DAY'; end if;
   insert into public.online_sessions(enrollment_id,session_number,scheduled_date,scheduled_time_kr,scheduled_time_ph,status)
   values(eid,num,(item#>>'{}')::date,time_kr,to_char((time_kr::time-interval '1 hour'),'HH24:MI'),'scheduled');
 end loop;
 update public.online_enrollments set booking3_application_id=p_id where id=eid;
 update public.online_applications set enrollment_id=eid,status='issued',claim_token=null,updated_at=now() where id=p_id;
 return eid;
end $$;
revoke all on function public.finalize_online_application(uuid,uuid,jsonb,date) from public,anon,authenticated;
grant execute on function public.finalize_online_application(uuid,uuid,jsonb,date) to service_role;
