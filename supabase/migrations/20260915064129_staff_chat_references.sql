alter table public.staff_messages add column refs jsonb not null default '[]' check(jsonb_array_length(refs)<=5);
create function public.staff_message_send(p_id uuid,p_room text,p_sender text,p_body text,p_reply uuid,p_mentions text[],p_files jsonb,p_refs jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare m public.staff_messages;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_room,987));
 select * into m from public.staff_messages where id=p_id;
 if found then
  if m.room<>p_room or m.sender<>p_sender or m.body<>p_body or m.reply_to is distinct from p_reply or m.mentions<>p_mentions or m.files<>p_files or m.refs<>p_refs then raise exception 'message conflict'; end if;
  return jsonb_build_object('message',to_jsonb(m),'created',false);
 end if;
 if p_reply is not null and not exists(select 1 from public.staff_messages where id=p_reply and room=p_room) then raise exception 'invalid reply'; end if;
 insert into public.staff_messages(id,room,sender,body,reply_to,mentions,files,refs) values(p_id,p_room,p_sender,p_body,p_reply,p_mentions,p_files,p_refs) returning * into m;
 return jsonb_build_object('message',to_jsonb(m),'created',true);
end $$;
revoke all on function public.staff_message_send(uuid,text,text,text,uuid,text[],jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.staff_message_send(uuid,text,text,text,uuid,text[],jsonb,jsonb) to service_role;
drop function public.staff_message_send(uuid,text,text,text,uuid,text[],jsonb);
