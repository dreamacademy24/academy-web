alter table public.online_change_requests add column if not exists original_date date, add column if not exists original_time_kr text;
create or replace function public.capture_online_change_original_schedule()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if NEW.req_type='single' then
  select scheduled_date,scheduled_time_kr into NEW.original_date,NEW.original_time_kr
  from public.online_sessions where id=NEW.session_id and enrollment_id=NEW.enrollment_id;
 end if;
 return NEW;
end;
$$;
create trigger online_change_original_schedule before insert on public.online_change_requests
for each row execute function public.capture_online_change_original_schedule();
update public.online_change_requests r
set original_date=s.scheduled_date,original_time_kr=s.scheduled_time_kr
from public.online_sessions s where r.session_id=s.id and r.enrollment_id=s.enrollment_id
and r.req_type='single' and r.status='pending' and r.original_date is null;
