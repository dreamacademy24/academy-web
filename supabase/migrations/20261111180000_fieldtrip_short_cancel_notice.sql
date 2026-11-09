create or replace function public.inform_fieldtrip_cancellation() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  today date := (statement_timestamp() at time zone 'Asia/Manila')::date;
  event_day date; token text; new_tokens text[]; prior_tokens text[];
  guest text; person text; title_text text; task_key text; saved text; stay_start date; stay_end date;
begin
  select b.booker_name,b.checkin_date,b.checkout_date into guest,stay_start,stay_end from public.bookings b where b.id=new.booking_id;
  guest:=coalesce(nullif(guest,''),nullif(new.portal_name,''),nullif(new.name,''),'이름 미등록');
  person:=coalesce(nullif(new.name,''),guest);
  new_tokens:=regexp_split_to_array(coalesce(new.cancel_requested_dates,'')||','||coalesce(new.cancelled_dates,''),'\s*,\s*');
  prior_tokens:=regexp_split_to_array(coalesce(old.cancel_requested_dates,'')||','||coalesce(old.cancelled_dates,''),'\s*,\s*');
  if new.status in ('cancel_requested','cancelled','canceled','취소','취소요청') then new_tokens:=new_tokens||regexp_split_to_array(coalesce(new.date,''),'\s*,\s*'); end if;
  if old.status in ('cancel_requested','cancelled','canceled','취소','취소요청') then prior_tokens:=prior_tokens||regexp_split_to_array(coalesce(old.date,''),'\s*,\s*'); end if;
  for token in select distinct trim(x) from unnest(new_tokens) x where trim(x)<>'' and not(trim(x)=any(prior_tokens)) loop
    -- Only dates present on this application are eligible.
    if not(token=any(regexp_split_to_array(trim(coalesce(new.date,'')),'\s*,\s*'))) then continue;end if;
    select d::date into event_day from generate_series(today::timestamp,(today+7)::timestamp,interval '1 day') d
      where token like (extract(month from d)::int||'-'||extract(day from d)::int||'-%') and
      (stay_start is null or d::date>=stay_start) and (stay_end is null or d::date<=stay_end) limit 1;
    if event_day is null then continue;end if;
    select s.title into title_text from public.schedule_items s where s.date=event_day and s.type='fieldtrip' order by s.is_deployed desc nulls last limit 1;
    if token !~ '-(ft|nimobrew|smskating|shrine|magellan)$' and (token ~ '-as$' or title_text is null) then continue;end if;
    task_key:='fieldtrip-short-cancel:'||new.id||':'||event_day||':'||md5(token);
    insert into public.staff_tasks(id,title,created_by,assignee,assignees,note,created_at,done,progress,shared,secret,priority,files,checklist)
      values(task_key,'[필드트립 취소 접수] '||person||' · '||to_char(event_day,'MM/DD'),'system','candice','["candice"]',
      format('캔디스님, %s님 예약에서 %s 학생의 %s 필드트립 취소가 접수됐어요. 행사일은 %s, 접수일은 %s예요. 신청 내역을 확인하고 참가 명단과 차량·티처 배정에 반영한 뒤 이 글에 처리 결과를 남겨 주세요.',guest,person,coalesce(title_text,'예정'),event_day,today),now(),false,0,false,true,'normal','[]','[]')
      on conflict(id) do nothing returning id into saved;
    if saved is not null then insert into public.staff_notifications(id,to_id,type,ref_id,message,is_read,created_at)
      values(task_key||':candice','candice','task',task_key,'dream이 행사 7일 이내 필드트립 취소 접수를 알려드려요.',false,now()) on conflict(id) do nothing; end if;
  end loop;
  return new;
end $$;
revoke all on function public.inform_fieldtrip_cancellation() from public,anon,authenticated;
create or replace trigger inform_fieldtrip_short_cancel after update of cancel_requested_dates,cancelled_dates,status on public.fieldtrip_applications
for each row when (old.cancel_requested_dates is distinct from new.cancel_requested_dates or old.cancelled_dates is distinct from new.cancelled_dates or old.status is distinct from new.status)
execute function public.inform_fieldtrip_cancellation();
