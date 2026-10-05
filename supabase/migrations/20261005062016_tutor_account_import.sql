alter table public.tutors add column if not exists staff_account_id uuid references public.staff_accounts(id) on delete set null;
create unique index if not exists tutors_staff_account_unique on public.tutors(staff_account_id) where staff_account_id is not null;
create or replace function public.import_tutor_account(p_account uuid,p_tutor uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.staff_accounts%rowtype; t public.tutors%rowtype; ids uuid[];
begin
 select * into a from public.staff_accounts where id=p_account for update;
 if not found or a.role<>'local_teacher' or not a.is_active or nullif(btrim(a.name),'') is null then raise exception 'Active teacher account required'; end if;
 -- Serialize imports, including two accounts referring to the same legacy name.
 perform pg_advisory_xact_lock(715230501);
 select * into t from public.tutors where staff_account_id=p_account;
 if found then return t.id; end if;
 if p_tutor is not null then
   select * into t from public.tutors where id=p_tutor for update;
   if not found then raise exception 'Tutor unavailable'; end if;
 else
   select array_agg(id) into ids from public.tutors where
    (a.hr_employee_id is not null and hr_employee_id=a.hr_employee_id)
    or lower(btrim(name))=lower(btrim(a.name));
   if coalesce(array_length(ids,1),0)>1 then raise exception 'Select an existing tutor'; end if;
   if coalesce(array_length(ids,1),0)=1 then select * into t from public.tutors where id=ids[1] for update; end if;
 end if;
 if t.id is not null then
   if t.staff_account_id is not null or not t.is_active then raise exception 'Tutor already linked or inactive'; end if;
   if a.hr_employee_id is not null and t.hr_employee_id is not null and a.hr_employee_id<>t.hr_employee_id then raise exception 'Employee mismatch'; end if;
   update public.tutors set staff_account_id=a.id,hr_employee_id=coalesce(hr_employee_id,a.hr_employee_id) where id=t.id;
   return t.id;
 end if;
 insert into public.tutors(name,is_active,staff_account_id,hr_employee_id) values(btrim(a.name),true,a.id,a.hr_employee_id) returning id into t.id;
 return t.id;
end; $$;
revoke all on function public.import_tutor_account(uuid,uuid) from public,anon,authenticated;
grant execute on function public.import_tutor_account(uuid,uuid) to service_role;
