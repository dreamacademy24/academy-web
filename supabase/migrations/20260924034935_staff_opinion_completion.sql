alter table public.staff_opinions add column if not exists completed_at timestamptz;

create or replace function public.guard_staff_opinion_completion() returns trigger
language plpgsql set search_path = '' as $$
begin
 if (TG_OP = 'INSERT' and NEW.completed_at is not null) or
    (TG_OP = 'UPDATE' and NEW.completed_at is distinct from OLD.completed_at) then
  if current_user not in ('postgres','service_role') then
   raise exception 'Use the authenticated completion endpoint' using errcode='42501';
  end if;
 end if;
 return NEW;
end $$;
create trigger staff_opinion_completion_guard before insert or update on public.staff_opinions
for each row execute function public.guard_staff_opinion_completion();

create or replace function public.guard_closed_staff_vote() returns trigger
language plpgsql set search_path = '' as $$
declare op public.staff_opinions;
begin
 select * into op from public.staff_opinions where id=NEW.opinion_id for update;
 if not found then raise exception 'Opinion not found' using errcode='23503'; end if;
 if op.completed_at is not null or (op.vote_deadline is not null and op.vote_deadline < (now() at time zone 'Asia/Seoul')::date) then
  raise exception 'Voting is closed' using errcode='23514';
 end if;
 return NEW;
end $$;
create trigger staff_vote_closed_guard before insert or update on public.staff_votes
for each row execute function public.guard_closed_staff_vote();

