-- Signed staff sessions are checked by the server; no direct browser access.
create table public.staff_messages (
 id uuid primary key, seq bigint generated always as identity unique,
 room text not null, sender text not null, body text not null default '',
 reply_to uuid references public.staff_messages(id), mentions text[] not null default '{}',
 files jsonb not null default '[]', created_at timestamptz not null default now(),
 check(length(body)<=20000), check(jsonb_array_length(files)<=10)
);
create index staff_messages_room_seq on public.staff_messages(room,seq desc);
create table public.staff_message_reads (room text not null, employee text not null, seq bigint not null default 0, primary key(room,employee));
create table public.staff_message_files (id uuid primary key, room text not null, owner text not null, path text not null unique, name text not null, mime text not null, size integer not null, created_at timestamptz not null default now());
create table public.staff_message_links (message_id uuid references public.staff_messages(id) on delete cascade, task_id text references public.staff_tasks(id) on delete cascade, linked_by text not null, created_at timestamptz not null default now(), primary key(message_id,task_id));
create index staff_message_links_task on public.staff_message_links(task_id);
create table public.staff_message_push (endpoint text primary key, employee text not null, p256dh text not null, auth text not null, updated_at timestamptz not null default now());
alter table public.staff_messages enable row level security;
alter table public.staff_message_reads enable row level security;
alter table public.staff_message_files enable row level security;
alter table public.staff_message_links enable row level security;
alter table public.staff_message_push enable row level security;
revoke all on public.staff_messages,public.staff_message_reads,public.staff_message_files,public.staff_message_links,public.staff_message_push from anon,authenticated;
grant all on public.staff_messages,public.staff_message_reads,public.staff_message_files,public.staff_message_links,public.staff_message_push to service_role;
grant usage,select on sequence public.staff_messages_seq_seq to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('staff-chat-private','staff-chat-private',false,3145728) on conflict(id) do nothing;

create function public.staff_message_send(p_id uuid,p_room text,p_sender text,p_body text,p_reply uuid,p_mentions text[],p_files jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare m public.staff_messages;
begin
 -- Serialize each room so a read cursor never jumps past an uncommitted message.
 perform pg_advisory_xact_lock(hashtextextended(p_room,987));
 select * into m from public.staff_messages where id=p_id;
 if found then
  if m.room<>p_room or m.sender<>p_sender or m.body<>p_body or m.reply_to is distinct from p_reply or m.mentions<>p_mentions or m.files<>p_files then raise exception 'message conflict'; end if;
  return jsonb_build_object('message',to_jsonb(m),'created',false);
 end if;
 if p_reply is not null and not exists(select 1 from public.staff_messages where id=p_reply and room=p_room) then raise exception 'invalid reply'; end if;
 insert into public.staff_messages(id,room,sender,body,reply_to,mentions,files) values(p_id,p_room,p_sender,p_body,p_reply,p_mentions,p_files) returning * into m;
 return jsonb_build_object('message',to_jsonb(m),'created',true);
end $$;
create function public.staff_message_read(p_room text,p_employee text,p_seq bigint) returns void language sql security invoker set search_path=public as $$
 insert into public.staff_message_reads(room,employee,seq)
 select p_room,p_employee,seq from public.staff_messages where room=p_room and seq=p_seq
 on conflict(room,employee) do update set seq=greatest(staff_message_reads.seq,excluded.seq);
$$;
create function public.staff_message_counts(p_employee text,p_rooms text[]) returns table(room text,unread bigint,attention bigint,last_seq bigint) language sql security invoker set search_path=public as $$
 select m.room,count(*) filter(where m.seq>coalesce(r.seq,0) and m.sender<>p_employee),
 count(*) filter(where m.seq>coalesce(r.seq,0) and m.sender<>p_employee and (m.room<>'all' or p_employee=any(m.mentions))),max(m.seq)
 from public.staff_messages m left join public.staff_message_reads r on r.room=m.room and r.employee=p_employee
 where m.room=any(p_rooms) group by m.room;
$$;
revoke all on function public.staff_message_send(uuid,text,text,text,uuid,text[],jsonb),public.staff_message_read(text,text,bigint),public.staff_message_counts(text,text[]) from public,anon,authenticated;
grant execute on function public.staff_message_send(uuid,text,text,text,uuid,text[],jsonb),public.staff_message_read(text,text,bigint),public.staff_message_counts(text,text[]) to service_role;
