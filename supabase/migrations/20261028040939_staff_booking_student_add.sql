-- Staff-only RPC: the row and booking JSON must commit together.
create or replace function public.staff_add_booking_student(p_booking_id uuid,p_fields jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare b record; items jsonb; added public.students; named text;
begin
 select * into b from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'booking not found'; end if;
 named:=trim(p_fields->>'name_kr');
 if coalesce(named,'')='' then raise exception 'name required'; end if;
 items:=case when jsonb_typeof(b.students)='array' then b.students when jsonb_typeof(b.students)='string' then (b.students#>>'{}')::jsonb else '[]'::jsonb end;
 if exists(select 1 from jsonb_array_elements(items) s where trim(coalesce(s->>'name_kr',s->>'korName',''))=named)
 or exists(select 1 from public.students where booking_id=p_booking_id and trim(name_kr)=named) then
  raise exception 'duplicate student' using errcode='23505';
 end if;
 insert into public.students(booking_id,name_kr,name_en,age,level,academy_start,academy_end)
 values(p_booking_id,named,nullif(trim(p_fields->>'name_en'),''),nullif(p_fields->>'age',''),
 case when p_fields->>'level'='kinder' then 'kinder' else 'junior' end,
 nullif(p_fields->>'academy_start','')::date,nullif(p_fields->>'academy_end','')::date) returning * into added;
 items:=items || jsonb_build_array(to_jsonb(added)||jsonb_build_object('korName',added.name_kr,'engName',added.name_en,'academyStart',added.academy_start,'academyEnd',added.academy_end));
 update public.bookings set students=items,children=greatest(coalesce(children,0),jsonb_array_length(items)) where id=p_booking_id;
 return to_jsonb(added);
end;$$;
revoke all on function public.staff_add_booking_student(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.staff_add_booking_student(uuid,jsonb) to service_role;
