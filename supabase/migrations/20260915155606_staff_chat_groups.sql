-- Group membership uses the same verified staff session and service-only API as DM chat.
create table public.staff_chat_groups (
 id uuid primary key,
 name text not null check (length(btrim(name)) between 1 and 80),
 creator text not null,
 members text[] not null check (cardinality(members) between 2 and 50 and creator=any(members)),
 created_at timestamptz not null default now()
);
create index staff_chat_groups_members on public.staff_chat_groups using gin(members);
alter table public.staff_chat_groups enable row level security;
revoke all on public.staff_chat_groups from public,anon,authenticated;
grant all on public.staff_chat_groups to service_role;
create function public.staff_chat_group_create(p_id uuid,p_name text,p_creator text,p_members text[]) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare g public.staff_chat_groups; clean text[];
begin
 select array_agg(distinct x order by x) into clean from unnest(p_members||array[p_creator]) x;
 if p_name is null or length(btrim(p_name)) not between 1 and 80 or cardinality(clean) not between 2 and 50
 or exists(select 1 from unnest(clean) x where x is null or x='jun' or not exists(
 select 1 from public.staff_accounts a where regexp_replace(a.username,'^admin-','')=x and a.is_active and a.role='korean_admin'))
 then raise exception 'invalid group'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,988));
 select * into g from public.staff_chat_groups where id=p_id;
 if found then
  if g.creator<>p_creator or g.name<>btrim(p_name) or g.members<>clean then raise exception 'group conflict'; end if;
 else
  insert into public.staff_chat_groups(id,name,creator,members) values(p_id,btrim(p_name),p_creator,clean) returning * into g;
 end if;
 return to_jsonb(g);
end $$;
revoke all on function public.staff_chat_group_create(uuid,text,text,text[]) from public,anon,authenticated;
grant execute on function public.staff_chat_group_create(uuid,text,text,text[]) to service_role;
create or replace function public.staff_message_counts(p_employee text,p_rooms text[]) returns table(room text,unread bigint,attention bigint,last_seq bigint)
language sql security invoker set search_path=public as $$
 select m.room,count(*) filter(where m.seq>coalesce(r.seq,0) and m.sender<>p_employee),
 count(*) filter(where m.seq>coalesce(r.seq,0) and m.sender<>p_employee and (m.room like 'dm:%' or p_employee=any(m.mentions))),max(m.seq)
 from public.staff_messages m left join public.staff_message_reads r on r.room=m.room and r.employee=p_employee
 where m.room=any(p_rooms) group by m.room;
$$;
