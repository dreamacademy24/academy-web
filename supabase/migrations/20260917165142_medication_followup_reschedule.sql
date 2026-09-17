create or replace function public.checkin_receipt_changed() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.medicine_at is not null or new.followup_due is distinct from old.followup_due then
  update public.staff_tasks set done=true,progress=100 where id like 'medication-followup:'||new.booking_id||':'||md5(new.student_name)||':%' and not done;
 end if;
 return new;
end;$$;
revoke all on function public.checkin_receipt_changed() from public,anon,authenticated;
