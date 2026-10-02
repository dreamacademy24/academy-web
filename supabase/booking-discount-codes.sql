create table public.booking_discount_codes (
 code text primary key check (code = lower(btrim(code)) and code ~ '^[a-z0-9_-]{3,40}$'),
 amount integer not null check (amount > 0 and amount <= 100000000),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.booking_discount_codes enable row level security;
revoke all on public.booking_discount_codes from anon, authenticated;
grant all on public.booking_discount_codes to service_role;
insert into public.booking_discount_codes(code,amount) values ('dreamhii',100000);
alter table public.bookings add column discount_code text, add column discount_code_amount integer not null default 0;
create function public.apply_booking_discount_code() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_amount integer; v_lines jsonb;
begin
 new.discount_code := nullif(lower(btrim(new.discount_code)), '');
 if TG_OP = 'INSERT' and new.discount_code is null then
   new.discount_code_amount := 0;
   return new;
 end if;
 if TG_OP = 'UPDATE' and new.discount_code is not distinct from old.discount_code then
   new.discount_code_amount := old.discount_code_amount;
   return new;
 end if;
 new.discount_code_amount := 0;
 if new.discount_code is not null then
   select amount into v_amount from public.booking_discount_codes where code=new.discount_code and active;
   if v_amount is null then raise exception '사용할 수 없는 할인코드입니다. 코드를 확인해주세요.' using errcode='22023'; end if;
   new.discount_code_amount := v_amount;
 end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_lines
 from jsonb_array_elements(case when jsonb_typeof(new.discounts)='array' then new.discounts else '[]'::jsonb end) x
 where coalesce(x->>'source','') <> 'booking_discount_code';
 if new.discount_code is not null then
   v_lines := v_lines || jsonb_build_array(jsonb_build_object('id',-100,'source','booking_discount_code','name','할인코드 ('||new.discount_code||')','amount',v_amount));
 end if;
 new.discounts := v_lines;
 new.total_discount := (select coalesce(sum((x->>'amount')::numeric),0) from jsonb_array_elements(v_lines) x);
 return new;
end $$;
revoke all on function public.apply_booking_discount_code() from public,anon,authenticated;
create trigger booking_discount_code_before before insert or update of discount_code,discount_code_amount on public.bookings for each row execute function public.apply_booking_discount_code();

