-- One confirmation task per application; creation participates in the application transaction.
alter table public.staff_tasks add column if not exists application_source jsonb;
create index if not exists staff_tasks_pending_application on public.staff_tasks(id) where application_source is not null and done=false;

create or replace function public.sync_class_application_task(p_table text,p_row jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 sid text:=p_row->>'id'; tid text; kind text; student text; dest text; bids text[]:='{}'; people text[]:='{}'; closed boolean; safe_student text;
begin
 if p_table='tutor_requests' then
  kind:='tutor';student:=coalesce(nullif(p_row->>'student_name_kr',''),nullif(p_row->>'student_name',''),'학생');
  bids:=array_remove(array[p_row->>'booking_id'],null);dest:='/admin/tutor-class';
  closed:=coalesce(p_row->>'status','pending') not in ('pending','reviewing');
 elsif p_table='online_applications' then
  kind:='online';student:=coalesce(p_row#>>'{payload,student}','학생');dest:='/admin/online-class?tab=applications';
  closed:=coalesce(p_row->>'status','pending') not in ('pending','processing');
 elsif p_table='online_enrollments' then
  if p_row->>'enrollment_type'<>'free_package' or coalesce(p_row->>'notes','') not like '%엄마 앱 신청%' then return;end if;
  kind:='online';student:=coalesce(p_row->>'student_name','학생');dest:='/admin/online-class/'||sid;
  closed:=p_row->>'status' in ('cancelled','completed','inactive') or nullif(p_row->>'tutor_id','') is not null;
  select coalesce(array_agg(value),'{}') into bids from jsonb_array_elements_text(coalesce(p_row#>'{package_plan,bookingIds}','[]'));
  if cardinality(bids)=0 and nullif(p_row->>'package_booking_id','') is not null then bids:=array[p_row->>'package_booking_id'];end if;
 else raise exception 'Unsupported application source';end if;
 tid:='class-application:'||p_table||':'||sid;
 if closed then update public.staff_tasks set done=true,progress=100 where id=tid and done=false;return;end if;
 -- Prefer exact source bookings. For signed-in standalone applications, match the student within that family's bookings.
 if cardinality(bids)=0 and p_table='online_applications' and nullif(p_row->>'existing_user_id','') is not null then
  select coalesce(array_agg(b.id::text),'{}') into bids from public.bookings b
   where b.portal_user_id::text=p_row->>'existing_user_id' and coalesce(b.status,'') not like '%취소%'
   and exists(select 1 from jsonb_array_elements(coalesce(b.students,'[]')) s where regexp_replace(lower(coalesce(s->>'name_kr',s->>'name','')),'\s','','g')=regexp_replace(lower(student),'\s','','g'));
 end if;
 select coalesce(array_agg(distinct regexp_replace(a.username,'^admin-','')),'{}') into people
 from public.bookings b cross join lateral unnest(array[b.assignee,b.care_assignee]) owner(name)
 join public.staff_accounts a on (lower(trim(owner.name))=lower(a.name) or lower(trim(owner.name))=lower(a.username) or lower(trim(owner.name))=lower(regexp_replace(a.username,'^admin-','')))
 where b.id::text=any(bids) and a.is_active and a.role='korean_admin';
 safe_student:=replace(replace(replace(student,'&','&amp;'),'<','&lt;'),'>','&gt;');
 insert into public.staff_tasks(id,title,assignee,assignees,due,created_at,note,done,shared,created_by,application_source)
 values(tid,'[신규 신청 확인] '||case kind when 'tutor' then '튜터' else '화상영어' end||' · '||student,
 coalesce(people[1],''),to_jsonb(people),(now() at time zone 'Asia/Seoul')::date::text,coalesce(p_row->>'created_at',now()::text),
 '<p><b>'||safe_student||'</b> 학생의 새 수업 신청입니다.</p><p><a href="'||dest||'" target="_top">신청 내용 확인하기 →</a></p><p>희망 일정·회차·레벨과 담당 선생님 배정 여부를 확인해주세요. 확인을 마치면 이 업무의 <b>업무 완료</b>를 누르세요. 신청 승인이나 수강권 발급은 해당 신청 화면에서 진행합니다.</p>'||case when cardinality(people)=0 then '<p><b>담당 미지정:</b> 담당 직원을 배정해주세요.</p>' else '' end,
 false,true,'system',jsonb_build_object('kind',kind,'table',p_table,'id',sid,'student',student,'url',dest,'bookingIds',bids))
 on conflict(id) do nothing;
end;$$;
revoke all on function public.sync_class_application_task(text,jsonb) from public,anon,authenticated;
grant execute on function public.sync_class_application_task(text,jsonb) to service_role;
create or replace function public.class_application_task_trigger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_OP='DELETE' then
  update public.staff_tasks set done=true,progress=100 where id='class-application:'||TG_TABLE_NAME||':'||old.id::text and done=false;return old;
 end if;
 perform public.sync_class_application_task(TG_TABLE_NAME,to_jsonb(new));return new;
end;$$;
revoke all on function public.class_application_task_trigger() from public,anon,authenticated;
create trigger class_application_staff_task after insert or update of status on public.tutor_requests for each row execute function public.class_application_task_trigger();
create trigger class_application_staff_task after insert or update of status on public.online_applications for each row execute function public.class_application_task_trigger();
create trigger class_application_staff_task after insert or update of status,tutor_id on public.online_enrollments for each row execute function public.class_application_task_trigger();
create trigger class_application_staff_task_delete after delete on public.tutor_requests for each row execute function public.class_application_task_trigger();
create trigger class_application_staff_task_delete after delete on public.online_applications for each row execute function public.class_application_task_trigger();
create trigger class_application_staff_task_delete after delete on public.online_enrollments for each row execute function public.class_application_task_trigger();
-- Recover only outstanding applications; never alter pre-existing completed work or notice reads.
select public.sync_class_application_task('tutor_requests',to_jsonb(r)) from public.tutor_requests r where status in ('pending','reviewing');
select public.sync_class_application_task('online_applications',to_jsonb(r)) from public.online_applications r where status in ('pending','processing');
select public.sync_class_application_task('online_enrollments',to_jsonb(r)) from public.online_enrollments r where enrollment_type='free_package' and notes like '%엄마 앱 신청%' and tutor_id is null and status in ('active','scheduled');
