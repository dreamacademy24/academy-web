-- Non-destructive extension. Run after existing may_ledger migrations.
-- Existing ledger rows, FX settings and personal book are not rewritten.
begin;
create table if not exists public.expense_claims (
 id uuid primary key default gen_random_uuid(),
 idempotency_key uuid not null,
 payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
 submitted_by uuid not null references public.staff_accounts(id),
 staff_username text not null, staff_name text not null,
 entry_date date not null, applicable_period text not null default '',
 unit text not null check(unit in ('academy','dreamhouse','shared')),
 kind text not null check(kind in ('operating_expense','operating_funding','internal_transfer','staff_advance','business_advance','customer_collection','student_passthrough','mori_settlement','loan_principal')),
 direction text not null check(direction in ('in','out')),
 category_id text, category_label text not null default '', legacy_division text not null default '',
 merchant text not null default '', memo text not null,
 amount numeric(14,2) not null check(amount>0), currency text not null check(currency in ('PHP','KRW')),
 house_scope text not null check(house_scope in ('none','single','multiple','common','unconfirmed')),
 house_ids text[] not null default '{}', house_snapshot jsonb not null default '[]', house_note text not null default '',
 allocations jsonb not null default '[]' check(jsonb_typeof(allocations)='array'),
 receipts jsonb not null default '[]' check(jsonb_typeof(receipts)='array' and jsonb_array_length(receipts)<=2),
 receipt_note text not null default '', review_flags text[] not null default '{}',
 replaces_claim_id uuid references public.expense_claims(id),
 status text not null default 'submitted' check(status in ('submitted','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_by uuid references public.staff_accounts(id), reviewed_at timestamptz, review_note text not null default '',
 resolved_review_flags boolean not null default false,
 reporting_amount_php numeric(14,2), krw_per_php numeric(16,8),
 ledger_entry_id text unique references public.may_ledger(id) on delete restrict,
 unique(submitted_by,idempotency_key),
 check((kind='operating_expense' and category_id is not null) or (kind<>'operating_expense' and category_id is null)),
 check(currency<>'KRW' or amount=trunc(amount)),
 check(kind not in ('operating_expense','mori_settlement','loan_principal') or direction='out')
);
create index if not exists expense_claims_own_date on public.expense_claims(submitted_by,created_at desc);
create index if not exists expense_claims_review on public.expense_claims(status,created_at);
create index if not exists expense_claims_receipt_hashes on public.expense_claims using gin(receipts);
create table if not exists public.expense_claim_events (
 id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.expense_claims(id) on delete restrict,
 actor_id uuid not null references public.staff_accounts(id), action text not null,
 note text not null default '', data jsonb not null default '{}', created_at timestamptz not null default now()
);
-- Existing private ledger also must not be readable directly with a browser Supabase key.
alter table public.may_ledger enable row level security;
alter table public.may_ledger_config enable row level security;
revoke all on public.may_ledger,public.may_ledger_config from public,anon,authenticated;
grant select,insert,update,delete on public.may_ledger,public.may_ledger_config to service_role;
-- Service-role APIs authenticate before every query. Defense in depth: no direct browser access.
alter table public.expense_claims enable row level security;
alter table public.expense_claim_events enable row level security;
revoke all on public.expense_claims,public.expense_claim_events from public,anon,authenticated;
grant select,insert,update on public.expense_claims to service_role;
grant select,insert on public.expense_claim_events to service_role;

create or replace function public.expense_claim_insert_guard() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
declare s public.staff_accounts%rowtype; a jsonb; n integer;
begin
 select * into s from public.staff_accounts where id=new.submitted_by and is_active=true;
 if not found or s.role<>'local_teacher' or s.username not in ('admin-abby','admin-bella') then raise exception 'SUBMITTER_DENIED'; end if;
 if new.status<>'submitted' or new.reviewed_by is not null or new.reviewed_at is not null or new.ledger_entry_id is not null or new.reporting_amount_php is not null then raise exception 'INVALID_INITIAL_STATUS'; end if;
 new.staff_username:=s.username; new.staff_name:=s.name;
 if jsonb_array_length(new.receipts)=0 and not ('missing_receipt'=any(new.review_flags)) then new.review_flags:=array_append(new.review_flags,'missing_receipt'); end if;
 if new.house_scope='unconfirmed' and not ('house_unconfirmed'=any(new.review_flags)) then new.review_flags:=array_append(new.review_flags,'house_unconfirmed'); end if;
 if (new.category_id='equipment.work_equipment' or new.category_id='other.other') and not ('classification_uncertain'=any(new.review_flags)) then new.review_flags:=array_append(new.review_flags,'classification_uncertain'); end if;
 if new.replaces_claim_id is not null and not exists(select 1 from public.expense_claims where id=new.replaces_claim_id and submitted_by=new.submitted_by and status='rejected') then raise exception 'INVALID_REPLACED_CLAIM'; end if;
 if length(new.memo)<2 or (jsonb_array_length(new.receipts)=0 and length(new.receipt_note)<3) then raise exception 'MISSING_PURPOSE_OR_RECEIPT_REASON'; end if;
 if new.unit='dreamhouse' then
  if new.house_scope='none' or (new.house_scope='single' and cardinality(new.house_ids)<>1) or (new.house_scope='multiple' and cardinality(new.house_ids)<2) then raise exception 'INVALID_HOUSE_SCOPE'; end if;
  if new.house_scope in ('common','unconfirmed') and (cardinality(new.house_ids)<>0 or jsonb_array_length(new.allocations)<>0 or length(new.house_note)<3) then raise exception 'INVALID_COMMON_ATTRIBUTION'; end if;
 elsif new.house_scope<>'none' or cardinality(new.house_ids)<>0 or jsonb_array_length(new.allocations)<>0 then raise exception 'INVALID_UNIT_HOUSE_SCOPE'; end if;
 select count(distinct x) into n from unnest(new.house_ids) x;
 if n<>cardinality(new.house_ids) then raise exception 'DUPLICATE_HOUSE'; end if;
 if jsonb_array_length(new.allocations)>0 then
  if new.house_scope<>'multiple' or jsonb_array_length(new.allocations)<>cardinality(new.house_ids) then raise exception 'INVALID_ALLOCATION_COUNT'; end if;
  select count(distinct x->>'house_id') into n from jsonb_array_elements(new.allocations) x;
  if n<>cardinality(new.house_ids) or (select sum((x->>'amount')::numeric) from jsonb_array_elements(new.allocations) x)<>new.amount then raise exception 'ALLOCATION_TOTAL_MISMATCH'; end if;
  for a in select * from jsonb_array_elements(new.allocations) loop
   if not ((a->>'house_id')=any(new.house_ids)) or (a->>'amount')::numeric<=0 then raise exception 'INVALID_ALLOCATION_TARGET'; end if;
  end loop;
 end if;
 for a in select * from jsonb_array_elements(new.receipts) loop
  if not (a ?& array['object_key','sha256','mime','bytes']) or (a->>'object_key') not like (new.submitted_by::text||'/'||new.id::text||'/%') or (a->>'sha256')!~'^[0-9a-f]{64}$' or (a->>'mime') not in ('image/jpeg','image/png','image/webp') or (a->>'bytes')::integer not between 1 and 1572864 then raise exception 'INVALID_PRIVATE_RECEIPT'; end if;
 end loop;
 return new;
end $$;
drop trigger if exists expense_claim_insert_guard on public.expense_claims;
create trigger expense_claim_insert_guard before insert on public.expense_claims for each row execute function public.expense_claim_insert_guard();
create or replace function public.expense_claim_created_event() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin insert into public.expense_claim_events(claim_id,actor_id,action) values(new.id,new.submitted_by,'submitted'); return new;end $$;
drop trigger if exists expense_claim_created_event on public.expense_claims;
create trigger expense_claim_created_event after insert on public.expense_claims for each row execute function public.expense_claim_created_event();
create or replace function public.expense_claim_immutable() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
 if old.status<>'submitted' then raise exception 'REVIEWED_CLAIM_IMMUTABLE'; end if;
 if (to_jsonb(new)-array['status','reviewed_by','reviewed_at','review_note','resolved_review_flags','reporting_amount_php','krw_per_php','ledger_entry_id']) is distinct from (to_jsonb(old)-array['status','reviewed_by','reviewed_at','review_note','resolved_review_flags','reporting_amount_php','krw_per_php','ledger_entry_id']) then raise exception 'CLAIM_PAYLOAD_IMMUTABLE'; end if;
 if new.status not in ('approved','rejected') then raise exception 'INVALID_REVIEW_TRANSITION'; end if;
 return new;
end $$;
drop trigger if exists expense_claim_immutable on public.expense_claims;
create trigger expense_claim_immutable before update on public.expense_claims for each row execute function public.expense_claim_immutable();

create or replace function public.review_expense_claim(
 p_claim_id uuid,p_reviewer_id uuid,p_action text,p_review_note text default '',
 p_confirm_review_flags boolean default false,p_link_ledger_id text default null,
 p_confirm_distinct_transaction boolean default false
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare c public.expense_claims%rowtype; l public.may_ledger%rowtype; v_rate numeric; v_php numeric; v_ledger text; v_div text; v_source text; v_has_duplicate boolean;
begin
 if p_reviewer_id<>'34ebbb26-9142-4a34-b35f-4fcc4426e27c'::uuid or not exists(select 1 from public.staff_accounts where id=p_reviewer_id and role='korean_admin' and is_active=true) then raise exception 'OWNER_ONLY'; end if;
 if p_action not in ('approve','reject') or length(coalesce(p_review_note,''))>2000 then raise exception 'INVALID_REVIEW'; end if;
 select * into c from public.expense_claims where id=p_claim_id for update;
 if not found then raise exception 'CLAIM_NOT_FOUND'; end if;
 if (c.status='approved' and p_action='approve') or (c.status='rejected' and p_action='reject') then return to_jsonb(c); end if;
 if c.status<>'submitted' then raise exception 'CLAIM_ALREADY_REVIEWED'; end if;
 if p_action='reject' then
  if length(trim(coalesce(p_review_note,'')))<3 then raise exception 'REVIEW_NOTE_REQUIRED'; end if;
  update public.expense_claims set status='rejected',reviewed_by=p_reviewer_id,reviewed_at=now(),review_note=trim(p_review_note) where id=c.id returning * into c;
 else
  if cardinality(c.review_flags)>0 and (not p_confirm_review_flags or length(trim(coalesce(p_review_note,'')))<3) then raise exception 'REVIEW_FLAGS_REQUIRE_CONFIRMATION'; end if;
  select krw_per_php into v_rate from public.may_ledger_config where id='settings'; v_rate:=coalesce(v_rate,23);
  if v_rate<=0 or v_rate::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_FX_RATE'; end if;
  v_php:=case when c.currency='PHP' then c.amount else round(c.amount/v_rate,2) end;
  if v_php<=0 then raise exception 'INVALID_REPORTING_AMOUNT'; end if;
  if c.kind in ('operating_expense','mori_settlement') then
   v_div:=case when c.kind='mori_settlement' then '모리' else c.legacy_division end;
   v_source:=case when c.kind='mori_settlement' then 'mori_settle' else 'expense_claim' end;
   if c.kind='operating_expense' and v_div not in ('드림하우스','재료비','인건비','비품','기타') then raise exception 'INVALID_LEDGER_DIVISION'; end if;
   -- Serialize equal-date/amount reviews so concurrent approvals cannot bypass duplicate checks.
   perform pg_advisory_xact_lock(hashtextextended('expense:'||c.entry_date::text||':'||v_php::text,0));
   if nullif(p_link_ledger_id,'') is not null then
    select * into l from public.may_ledger where id=p_link_ledger_id for update;
    if not found or l.book<>'회사' or l.type<>'expense' or l.entry_date<>c.entry_date or l.division<>v_div or not ((l.currency=c.currency and l.amount=c.amount) or (l.currency='PHP' and l.amount=v_php)) then raise exception 'LINKED_LEDGER_MISMATCH'; end if;
    if c.kind='mori_settlement' and (l.source in ('mori_accrue','auto_meal') or left(l.id,10)='mori_lunch') then raise exception 'CANNOT_LINK_MEAL_ACCRUAL_AS_PAYMENT'; end if;
    if exists(select 1 from public.expense_claims where ledger_entry_id=l.id and id<>c.id) then raise exception 'LEDGER_ALREADY_LINKED'; end if;
    v_ledger:=l.id;
   else
    select exists(select 1 from public.may_ledger m where m.book='회사' and m.type='expense' and m.entry_date=c.entry_date
      and ((m.currency=c.currency and m.amount=c.amount) or (m.currency='PHP' and m.amount=v_php))
      and ((c.kind='operating_expense' and m.division<>'모리') or (c.kind='mori_settlement' and m.division='모리' and coalesce(m.source,'') not in ('mori_accrue','auto_meal') and left(m.id,10)<>'mori_lunch'))) into v_has_duplicate;
    if v_has_duplicate and (not p_confirm_distinct_transaction or length(trim(coalesce(p_review_note,'')))<3) then raise exception 'POSSIBLE_DUPLICATE'; end if;
    v_ledger:='expense_claim_'||c.id::text;
    insert into public.may_ledger(id,entry_date,book,type,division,detail,memo,amount,currency,source)
    values(v_ledger,c.entry_date,'회사','expense',v_div,case when c.kind='mori_settlement' then '식대 지급·정산' else c.category_label end,
      concat_ws(' · ',nullif(c.merchant,''),c.memo,'제출: '||c.staff_name,'원금: '||c.amount::text||' '||c.currency,case when c.applicable_period<>'' then '해당 기간: '||c.applicable_period end),v_php,'PHP',v_source);
   end if;
  elsif nullif(p_link_ledger_id,'') is not null then raise exception 'NON_EXPENSE_CANNOT_LINK_LEDGER';
  end if;
  update public.expense_claims set status='approved',reviewed_by=p_reviewer_id,reviewed_at=now(),review_note=trim(coalesce(p_review_note,'')),resolved_review_flags=p_confirm_review_flags,reporting_amount_php=v_php,krw_per_php=v_rate,ledger_entry_id=v_ledger where id=c.id returning * into c;
 end if;
 insert into public.expense_claim_events(claim_id,actor_id,action,note,data) values(c.id,p_reviewer_id,p_action,coalesce(p_review_note,''),jsonb_build_object('ledger_entry_id',c.ledger_entry_id,'linked_existing',nullif(p_link_ledger_id,'') is not null,'confirmed_distinct',p_confirm_distinct_transaction,'confirmed_flags',p_confirm_review_flags));
 return to_jsonb(c);
end $$;
revoke all on function public.review_expense_claim(uuid,uuid,text,text,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.review_expense_claim(uuid,uuid,text,text,boolean,text,boolean) to service_role;

-- Private by default, no browser policies. APIs issue short-lived reads after authorization.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('expense-receipts-v1','expense-receipts-v1',false,1572864,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=1572864,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
-- A pre-existing broad storage policy must not accidentally expose this private bucket.
drop policy if exists expense_receipts_private_wall on storage.objects;
create policy expense_receipts_private_wall on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id<>'expense-receipts-v1') with check(bucket_id<>'expense-receipts-v1');
commit;
