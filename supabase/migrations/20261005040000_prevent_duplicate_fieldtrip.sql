-- Legacy schedule tokens have no year; booking_id scopes them to one stay.
create or replace function public.fieldtrip_schedule_tokens(value text)
returns text[] language sql immutable set search_path = public as $$
  select coalesce(array_agg(distinct token), '{}'::text[]) from (
    select regexp_replace(lower(regexp_replace(btrim(t), '\s', '', 'g')),
      '^0*([0-9]+)-0*([0-9]+)-', '\1-\2-') as token
    from regexp_split_to_table(coalesce(value, ''), ',') t
  ) q where token <> '';
$$;

create or replace function public.prevent_duplicate_fieldtrip()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  active_tokens text[];
  previous_tokens text[] := '{}'::text[];
  added_tokens text[];
begin
  if new.booking_id is null or nullif(btrim(new.name), '') is null
     or lower(coalesce(new.status, '')) in ('cancelled', 'cancel') then
    return new;
  end if;
  select coalesce(array_agg(t), '{}'::text[]) into active_tokens
  from unnest(public.fieldtrip_schedule_tokens(new.date)) t
  where not (t = any(public.fieldtrip_schedule_tokens(new.cancelled_dates)));

  if TG_OP = 'UPDATE' then
    if old.booking_id is not distinct from new.booking_id
       and lower(regexp_replace(old.name, '\s', '', 'g')) = lower(regexp_replace(new.name, '\s', '', 'g'))
       and lower(coalesce(old.status, '')) not in ('cancelled', 'cancel') then
      select coalesce(array_agg(t), '{}'::text[]) into previous_tokens
      from unnest(public.fieldtrip_schedule_tokens(old.date)) t
      where not (t = any(public.fieldtrip_schedule_tokens(old.cancelled_dates)));
    end if;
  end if;
  select coalesce(array_agg(t), '{}'::text[]) into added_tokens
  from unnest(active_tokens) t where not (t = any(previous_tokens));
  if cardinality(added_tokens) = 0 then return new; end if;

  -- Serialize simultaneous submissions for a booking, including different devices.
  perform pg_advisory_xact_lock(hashtextextended('fieldtrip:' || new.booking_id::text, 0));
  if exists (
    select 1 from public.fieldtrip_applications a
    where a.booking_id = new.booking_id and a.id is distinct from new.id
      and lower(regexp_replace(a.name, '\s', '', 'g')) = lower(regexp_replace(new.name, '\s', '', 'g'))
      and lower(coalesce(a.status, '')) not in ('cancelled', 'cancel')
      and exists (
        select 1 from unnest(public.fieldtrip_schedule_tokens(a.date)) t
        where t = any(added_tokens)
          and not (t = any(public.fieldtrip_schedule_tokens(a.cancelled_dates)))
      )
  ) then
    raise exception using errcode = '23505', message = 'FIELDTRIP_ALREADY_APPLIED';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_duplicate_fieldtrip() from public;
drop trigger if exists prevent_duplicate_fieldtrip on public.fieldtrip_applications;
create trigger prevent_duplicate_fieldtrip
before insert or update of booking_id, name, date, status, cancelled_dates
on public.fieldtrip_applications for each row
execute function public.prevent_duplicate_fieldtrip();
