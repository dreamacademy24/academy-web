create table public.checkin_preparation_receipts (
 booking_id uuid not null references public.bookings(id),
 student_name text not null,
 paper_at timestamptz,
 medicine_at timestamptz,
 followup_due date not null,
 updated_by text not null default 'system',
 updated_at timestamptz not null default now(),
 revision integer not null default 0,
 primary key(booking_id,student_name)
);
alter table public.checkin_preparation_receipts enable row level security;
revoke all on public.checkin_preparation_receipts from anon,authenticated;
grant all on public.checkin_preparation_receipts to service_role;

create function public.sync_medication_followups() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; people text[]; tid text; safe_name text;
begin
 -- Create separate receipt records without changing legacy submitted flags.
 insert into public.checkin_preparation_receipts(booking_id,student_name,followup_due)
 select b.id,trim(coalesce(nullif(s->>'korName',''),nullif(s->>'name_kr',''),nullif(s->>'engName',''),s->>'name_en')),
 b.checkin_date::date+((3-extract(dow from b.checkin_date::date)::integer+7)%7)
 from public.bookings b cross join lateral jsonb_array_elements(case when jsonb_typeof(b.students)='array' then b.students else '[]'::jsonb end) s
 where b.checkin_date is not null and b.checkout_date::date>=(now() at time zone 'Asia/Manila')::date
 and coalesce(b.status,'') not ilike '%취소%' and coalesce(b.status,'') not in ('cancelled','canceled')
 and nullif(trim(coalesce(nullif(s->>'korName',''),nullif(s->>'name_kr',''),nullif(s->>'engName',''),s->>'name_en')),'') is not null
 on conflict do nothing;
 for r in select p.*,b.assignee,b.care_assignee,b.checkout_date,b.checkin_date,b.status from public.checkin_preparation_receipts p join public.bookings b on b.id=p.booking_id loop
  tid:='medication-followup:'||r.booking_id||':'||md5(r.student_name)||':'||r.followup_due;
  if r.medicine_at is not null or r.checkout_date::date<(now() at time zone 'Asia/Manila')::date or coalesce(r.status,'') ilike '%취소%' or coalesce(r.status,'') in ('cancelled','canceled') then
   update public.staff_tasks set done=true,progress=100 where id like 'medication-followup:'||r.booking_id||':'||md5(r.student_name)||':%' and not done;
   continue;
  end if;
  if r.followup_due>(now() at time zone 'Asia/Manila')::date or r.checkin_date::date>(now() at time zone 'Asia/Manila')::date then continue;end if;
  select coalesce(array_agg(distinct regexp_replace(a.username,'^admin-','')),'{}') into people from public.staff_accounts a where a.is_active and a.role='korean_admin'
  and exists(select 1 from unnest(array[r.assignee,r.care_assignee]) n where lower(trim(n)) in (lower(a.name),lower(a.username),lower(regexp_replace(a.username,'^admin-',''))));
  safe_name:=replace(replace(replace(r.student_name,'&','&amp;'),'<','&lt;'),'>','&gt;');
  insert into public.staff_tasks(id,title,assignee,assignees,due,created_at,note,done,shared,created_by)
  values(tid,'[상비약 수령 확인·재안내] '||r.student_name,coalesce(people[1],''),to_jsonb(people),r.followup_due::text,now()::text,
  '<p>'||safe_name||' 학생의 실제 약 수령이 아직 확인되지 않았습니다. 먼저 수령 여부를 확인하고, 미수령이면 보호자에게 다시 안내해주세요.</p><p><a href="/admin/med-forms?bookingId='||r.booking_id||'" target="_blank">전달·수령 확인하기</a></p><p>기존 제출 기록은 실제 약 수령 기록과 다릅니다. 재안내만 했다면 업무를 완료하고 다음 확인일을 지정하세요.</p>'||case when cardinality(people)=0 then '<p>담당 미배정: 예약 담당자를 지정해주세요.</p>' else '' end,false,true,'system')
  on conflict(id) do update set assignee=excluded.assignee,assignees=excluded.assignees where not staff_tasks.done;
 end loop;
end;$$;
revoke all on function public.sync_medication_followups() from public,anon,authenticated;
grant execute on function public.sync_medication_followups() to service_role;

create function public.checkin_receipt_changed() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.medicine_at is not null then
  update public.staff_tasks set done=true,progress=100 where id like 'medication-followup:'||new.booking_id||':'||md5(new.student_name)||':%' and not done;
 end if;
 return new;
end;$$;
revoke all on function public.checkin_receipt_changed() from public,anon,authenticated;
create trigger checkin_receipt_changed after update on public.checkin_preparation_receipts for each row execute function public.checkin_receipt_changed();
