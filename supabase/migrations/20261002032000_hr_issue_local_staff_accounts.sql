alter table public.staff_accounts add column if not exists hr_employee_id uuid references public.hr_employees(id);
alter table public.staff_accounts add column if not exists issued_by text;
alter table public.staff_accounts add column if not exists issued_at timestamptz;
create unique index if not exists staff_accounts_hr_employee_unique on public.staff_accounts(hr_employee_id) where hr_employee_id is not null;

create or replace function public.hr_issue_local_staff_account(p_employee uuid,p_username text,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public,extensions as $$
declare emp public.hr_employees%rowtype; acc public.staff_accounts%rowtype; login_id text:=lower(trim(p_username));
begin
 if not exists(select 1 from public.hr_accounts where username=p_actor and username in ('may','abby','bella') and role='admin' and is_active) then
  raise exception 'Central HR access required' using errcode='42501';
 end if;
 if login_id is null or login_id !~ '^[a-z][a-z0-9._-]{2,29}$' or login_id like 'admin-%' then raise exception 'Invalid username' using errcode='22023'; end if;
 select * into emp from public.hr_employees where id=p_employee for update;
 if not found or emp.status is distinct from 'Active' then raise exception 'Active employee required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtext('hr-staff-login:'||login_id));
 if exists(select 1 from public.staff_accounts where hr_employee_id=p_employee or lower(username) in (login_id,'admin-'||login_id)) then
  raise exception 'Employee account or username already exists' using errcode='23505';
 end if;
 insert into public.staff_accounts(username,password_hash,role,name,is_active,must_change_pw,initial,color,hr_employee_id,issued_by,issued_at)
 values(login_id,extensions.crypt(upper(login_id)||'2026!',extensions.gen_salt('bf')),'local_teacher',emp.first_name,true,true,upper(left(emp.first_name,1)),'#6366f1',p_employee,p_actor,now()) returning * into acc;
 return jsonb_build_object('username',acc.username,'is_active',acc.is_active,'issued_by',acc.issued_by,'issued_at',acc.issued_at);
end $$;
revoke all on function public.hr_issue_local_staff_account(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hr_issue_local_staff_account(uuid,text,text) to service_role;

