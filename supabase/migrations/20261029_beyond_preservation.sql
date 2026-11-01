-- Additive migration staging area; preserves original SQLite row types and IDs.
-- Run only in the confirmed target project. Never expose these tables to clients.
begin;
create table if not exists public.beyond_migration_batches (
 id text primary key, created_at timestamptz not null default now(),
 verified boolean not null default false,
 source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$')
);
create table if not exists public.beyond_records (
 batch_id text not null references public.beyond_migration_batches(id),
 collection text not null check (collection ~ '^[a-z_]+$'),
 row_key text not null, ordinal integer not null check(ordinal>=0), record jsonb not null check (jsonb_typeof(record)='object'),
 primary key(batch_id,collection,row_key)
);
create table if not exists public.beyond_active_batch (
 singleton boolean primary key default true check(singleton),
 batch_id text not null references public.beyond_migration_batches(id)
);
-- Browser snapshots are private, origin-scoped preservation records, not an
-- anonymous upload endpoint or a claim that visitors have authenticated accounts.
create table if not exists public.beyond_browser_archives (
 id text primary key, origin text not null, profile_label text not null,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 private_storage_key text not null, created_at timestamptz not null default now()
);
alter table public.beyond_migration_batches enable row level security;
alter table public.beyond_records enable row level security;
alter table public.beyond_active_batch enable row level security;
alter table public.beyond_browser_archives enable row level security;
revoke all on public.beyond_migration_batches, public.beyond_records, public.beyond_active_batch, public.beyond_browser_archives from public, anon, authenticated;
grant all on public.beyond_migration_batches, public.beyond_records, public.beyond_active_batch, public.beyond_browser_archives to service_role;

create or replace function public.beyond_public_records() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('collection',r.collection,'record',r.record) order by r.ordinal), '[]'::jsonb)
 from public.beyond_records r
 join public.beyond_active_batch a on a.batch_id=r.batch_id
 join public.beyond_migration_batches b on b.id=a.batch_id and b.verified
 where r.collection in ('worlds','discoveries','connections','settings')
$$;
create or replace function public.beyond_public_characters(requested_page integer default 1, search_text text default '', character_id text default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
 declare n integer; p integer; pages integer; result jsonb;
 begin
 if requested_page < 1 or requested_page > 100000 or length(search_text)>200 then raise exception 'Invalid page'; end if;
 select count(*) into n from public.beyond_records r join public.beyond_active_batch a on a.batch_id=r.batch_id
 join public.beyond_migration_batches b on b.id=a.batch_id and b.verified
 where r.collection='central_characters' and (r.record->>'active')::integer=1 and (r.record->>'deleted')::integer=0
 and (character_id is null or r.record->>'id'=character_id)
 and (strpos(lower(r.record->>'name'),lower(search_text))>0 or strpos(lower(r.record->>'tags'),lower(search_text))>0);
 pages:=greatest(1,ceil(n/10.0)::integer); p:=least(requested_page,pages);
 select coalesce(jsonb_agg(record),'[]'::jsonb) into result from (
 select r.record from public.beyond_records r join public.beyond_active_batch a on a.batch_id=r.batch_id
 join public.beyond_migration_batches b on b.id=a.batch_id and b.verified
 where r.collection='central_characters' and (r.record->>'active')::integer=1 and (r.record->>'deleted')::integer=0
 and (character_id is null or r.record->>'id'=character_id)
 and (strpos(lower(r.record->>'name'),lower(search_text))>0 or strpos(lower(r.record->>'tags'),lower(search_text))>0)
 order by r.record->>'updated_at' desc,r.record->>'id' limit 10 offset (p-1)*10
 ) selected;
 return jsonb_build_object('items',result,'total',n,'page',p,'totalPages',pages);
 end $$;
revoke all on function public.beyond_public_records() from public,anon,authenticated;
revoke all on function public.beyond_public_characters(integer,text,text) from public,anon,authenticated;
grant execute on function public.beyond_public_records() to service_role;
grant execute on function public.beyond_public_characters(integer,text,text) to service_role;
commit;
