-- Keep assignment separate from Korean approval; preserve prior task histories.
do $$
declare src text;
begin
 select pg_get_functiondef('public.sync_class_application_task(text,jsonb)'::regprocedure) into src;
 if position('or nullif(p_row->>''tutor_id'','''') is not null' in src)=0 then raise exception 'Unexpected application trigger definition';end if;
 src:=replace(src,'or nullif(p_row->>''tutor_id'','''') is not null','or exists(select 1 from public.app_settings a where a.key=''oc_confirmed_enrollments'' and a.value ? sid)');
 execute src;
end $$;

create or replace function public.set_online_application_approval(p_id text,p_on boolean,p_kind text,p_actor text,p_expected_tutor text default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.online_enrollments; k text; ids jsonb;
begin
 if not exists(select 1 from public.staff_accounts where username=p_actor and role='korean_admin' and is_active) then raise exception 'ADMIN_REQUIRED';end if;
 if p_kind not in ('confirm','close') then raise exception 'INVALID_KIND';end if;
 select * into e from public.online_enrollments where id::text=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if p_on and p_kind='confirm' and e.enrollment_type='free_package' and coalesce(e.notes,'') like '%엄마 앱 신청%' then
  if e.tutor_id is null then raise exception 'ASSIGN_FIRST';end if;
  if p_expected_tutor is not null and e.tutor_id::text<>p_expected_tutor then raise exception 'STALE_ASSIGNMENT';end if;
  if e.status not in ('active','scheduled') then raise exception 'INACTIVE';end if;
 end if;
 k:=case p_kind when 'confirm' then 'oc_confirmed_enrollments' else 'oc_closed_enrollments' end;
 insert into public.app_settings(key,value) values(k,'[]') on conflict(key) do nothing;
 select value into ids from public.app_settings where key=k for update;
 if jsonb_typeof(ids)<>'array' then raise exception 'INVALID_SETTINGS';end if;
 if p_on and not ids ? p_id then ids:=ids||jsonb_build_array(p_id);elsif not p_on then ids:=ids-p_id;end if;
 update public.app_settings set value=ids where key=k;
 if p_kind='confirm' and p_on then
  update public.staff_tasks set done=true,progress=100 where id='class-application:online_enrollments:'||p_id and not done;
 end if;
 return ids;
end $$;
revoke all on function public.set_online_application_approval(text,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.set_online_application_approval(text,boolean,text,text,text) to service_role;

create or replace function public.reset_online_assignment_approval()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.tutor_id is distinct from old.tutor_id and new.enrollment_type='free_package' and coalesce(new.notes,'') like '%엄마 앱 신청%' then
  update public.app_settings set value=value-new.id::text where key in ('oc_confirmed_enrollments','oc_closed_enrollments') and value ? new.id::text;
 end if;
 return new;
end $$;
revoke all on function public.reset_online_assignment_approval() from public,anon,authenticated;
create trigger online_assignment_approval_reset before update of tutor_id on public.online_enrollments for each row execute function public.reset_online_assignment_approval();
