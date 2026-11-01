-- SQL Editor: run the WHOLE file once in the confirmed Supabase project.
-- New names only. Abort on collisions. No source/admin data is reset.
begin;
do $$
begin
 if exists(select 1 from information_schema.tables where table_schema='public' and table_name in ('beyond_migration_batches','beyond_records','beyond_active_batch','beyond_browser_archives','beyond_edge_sessions','beyond_edge_limits'))
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'beyond_edge_%' or p.proname in ('beyond_public_records','beyond_public_characters')))
 then raise exception 'BEYOND migration names already exist; stop and review before applying.'; end if;
end $$;

-- 20261029_beyond_preservation.sql
-- Additive migration staging area; preserves original SQLite row types and IDs.
-- Run only in the confirmed target project. Never expose these tables to clients.
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

-- 20261030_beyond_edge_auth.sql
-- Additive edge-session infrastructure; never resets/imports admin credentials.
create table if not exists public.beyond_edge_sessions (
 token_hash text primary key, admin_id text not null, email text not null,
 credential_hash text not null, csrf text not null, expires_at bigint not null
);
create table if not exists public.beyond_edge_limits (
 key_hash text primary key, attempts integer not null, reset_at bigint not null
);
alter table public.beyond_edge_sessions enable row level security;
alter table public.beyond_edge_limits enable row level security;
revoke all on public.beyond_edge_sessions,public.beyond_edge_limits from public,anon,authenticated;
grant all on public.beyond_edge_sessions,public.beyond_edge_limits to service_role;

create or replace function public.beyond_edge_context(allowed_email text, session_hash text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare administrator jsonb; total integer; sess jsonb; stamp bigint;
begin
 stamp:=(extract(epoch from clock_timestamp())*1000)::bigint;
 select count(*) into total from public.beyond_records r
 join public.beyond_active_batch a on a.batch_id=r.batch_id
 join public.beyond_migration_batches b on b.id=a.batch_id and b.verified
 where collection='admins';
 if total<>1 then return jsonb_build_object('ready',false); end if;
 select r.record into administrator from public.beyond_records r
 join public.beyond_active_batch a on a.batch_id=r.batch_id
 join public.beyond_migration_batches b on b.id=a.batch_id and b.verified
 where collection='admins' and record->>'email'=allowed_email;
 if administrator is null then return jsonb_build_object('ready',false); end if;
 select jsonb_build_object('admin_id',s.admin_id,'email',s.email,'csrf',s.csrf,'expires_at',s.expires_at)
 into sess from public.beyond_edge_sessions s
 where s.token_hash=session_hash and s.email=allowed_email and s.expires_at>stamp
 and s.admin_id=administrator->>'id' and s.credential_hash=administrator->>'password_hash';
 return jsonb_build_object('ready',true,'administrator',administrator,'session',sess);
end $$;

create or replace function public.beyond_edge_attempt(limit_key text, maximum integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare stamp bigint; attempts_now integer;
begin
 if maximum not in (6,20) or limit_key !~ '^[a-f0-9]{64}$' then raise exception 'Invalid limiter'; end if;
 stamp:=(extract(epoch from clock_timestamp())*1000)::bigint;
 insert into public.beyond_edge_limits values(limit_key,1,stamp+900000)
 on conflict(key_hash) do update set attempts=case when beyond_edge_limits.reset_at<=stamp then 1 else beyond_edge_limits.attempts+1 end,
 reset_at=case when beyond_edge_limits.reset_at<=stamp then stamp+900000 else beyond_edge_limits.reset_at end
 returning attempts into attempts_now;
 return attempts_now<=maximum;
end $$;

create or replace function public.beyond_edge_start_session(allowed_email text, expected_credential text, new_token_hash text, new_csrf text, previous_token_hash text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare ctx jsonb; expiry bigint;
begin
 -- Lock credential row against simultaneous password changes.
 perform 1 from public.beyond_records r join public.beyond_active_batch a on a.batch_id=r.batch_id
 where r.collection='admins' for update of r;
 ctx:=public.beyond_edge_context(allowed_email,null);
 if not (ctx->>'ready')::boolean or expected_credential is null or (ctx->'administrator'->>'password_hash') is distinct from expected_credential then
 return jsonb_build_object('ok',false); end if;
 if new_token_hash !~ '^[a-f0-9]{64}$' or new_csrf !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Invalid session'; end if;
 expiry:=(extract(epoch from clock_timestamp())*1000)::bigint+28800000;
 insert into public.beyond_edge_sessions values(new_token_hash,ctx->'administrator'->>'id',allowed_email,expected_credential,new_csrf,expiry);
 if previous_token_hash is not null then delete from public.beyond_edge_sessions where token_hash=previous_token_hash; end if;
 return jsonb_build_object('ok',true,'expiresAt',expiry);
end $$;

create or replace function public.beyond_edge_logout(allowed_email text, session_hash text, csrf_token text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare ctx jsonb;
begin
 ctx:=public.beyond_edge_context(allowed_email,session_hash);
 if ctx->'session' is null or ctx->'session'='null'::jsonb or (ctx->'session'->>'csrf') is distinct from csrf_token then return false; end if;
 delete from public.beyond_edge_sessions where token_hash=session_hash;
 return true;
end $$;
revoke all on function public.beyond_edge_context(text,text),public.beyond_edge_attempt(text,integer),public.beyond_edge_start_session(text,text,text,text,text),public.beyond_edge_logout(text,text,text) from public,anon,authenticated;
grant execute on function public.beyond_edge_context(text,text),public.beyond_edge_attempt(text,integer),public.beyond_edge_start_session(text,text,text,text,text),public.beyond_edge_logout(text,text,text) to service_role;

-- 20261030_beyond_editorial.sql
create or replace function public.beyond_edge_editorial(allowed_email text, session_hash text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare ctx jsonb; result jsonb;
begin
 ctx:=public.beyond_edge_context(allowed_email,session_hash);
 if ctx->'session' is null or ctx->'session'='null'::jsonb then return jsonb_build_object('status',401); end if;
 select coalesce(jsonb_agg(jsonb_build_object('collection',r.collection,'record',r.record) order by r.ordinal),'[]'::jsonb)
 into result from public.beyond_records r join public.beyond_active_batch a on a.batch_id=r.batch_id
 where r.collection in ('worlds','discoveries','connections','revisions','settings');
 return jsonb_build_object('status',200,'records',result);
end $$;

create or replace function public.beyond_edge_save_editorial(
 allowed_email text, session_hash text, csrf_token text, target_collection text,
 target_id text, expected_version integer, content jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare ctx jsonb; batch text; previous jsonb; result jsonb; rev bigint; stamp text; ordinal_next integer;
begin
 -- Serialize editorial writes and active-batch switches. Recheck auth at commit.
 select batch_id into batch from public.beyond_active_batch where singleton for update;
 perform 1 from public.beyond_records where batch_id=batch and collection='admins' for update;
 perform 1 from public.beyond_edge_sessions where token_hash=session_hash for update;
 ctx:=public.beyond_edge_context(allowed_email,session_hash);
 if ctx->'session' is null or ctx->'session'='null'::jsonb then return jsonb_build_object('status',401); end if;
 if (ctx->'session'->>'csrf') is distinct from csrf_token then return jsonb_build_object('status',403); end if;
 if target_collection not in ('worlds','discoveries') or target_id !~ '^[a-zA-Z0-9-]{1,100}$' or jsonb_typeof(content)<>'object'
 then return jsonb_build_object('status',400); end if;
 select record into previous from public.beyond_records where batch_id=batch and collection=target_collection and record->>'id'=target_id;
 if (expected_version is null and previous is not null) or (expected_version is not null and (previous is null or (previous->>'version')::integer<>expected_version))
 then return jsonb_build_object('status',409); end if;
 if content->>'status' not in ('draft','review','published','archived') or coalesce(content->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
 then return jsonb_build_object('status',400); end if;
 if exists(select 1 from public.beyond_records r where r.batch_id=batch and r.collection=target_collection and r.record->>'id'<>target_id
 and (r.record->>'slug'=content->>'slug' or (r.record->>'data')::jsonb->'aliases' ? (content->>'slug')))
 then return jsonb_build_object('status',409); end if;
 if target_collection='discoveries' and not exists(select 1 from public.beyond_records r where r.batch_id=batch and r.collection='worlds'
 and r.record->>'id'=content->>'worldId' and (content->>'status'<>'published' or r.record->>'status'='published'))
 then return jsonb_build_object('status',409); end if;
 stamp:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 select coalesce(max(ordinal),0)+1 into ordinal_next from public.beyond_records where batch_id=batch;
 result:=jsonb_build_object('id',target_id,'slug',content->>'slug','status',content->>'status','data',content::text,
 'version',coalesce((previous->>'version')::integer,0)+1,'created_at',coalesce(previous->>'created_at',stamp),'updated_at',stamp);
 if target_collection='discoveries' then result:=result||jsonb_build_object('world_id',content->>'worldId'); end if;
 if previous is not null then
 select coalesce(max((record->>'id')::bigint),0)+1 into rev from public.beyond_records where batch_id=batch and collection='revisions';
 insert into public.beyond_records values(batch,'revisions',jsonb_build_array(rev)::text,ordinal_next,jsonb_build_object('id',rev,'kind',target_collection,'record_id',target_id,
 'actor',ctx->'session'->>'admin_id','snapshot',((previous->>'data')::jsonb||jsonb_build_object('id',previous->>'id','slug',previous->>'slug','status',previous->>'status','version',(previous->>'version')::integer,'createdAt',previous->>'created_at','updatedAt',previous->>'updated_at'))::text,'created_at',stamp));
 update public.beyond_records set record=result where batch_id=batch and collection=target_collection and record->>'id'=target_id;
 else
 insert into public.beyond_records values(batch,target_collection,jsonb_build_array(target_id)::text,ordinal_next,result);
 end if;
 return jsonb_build_object('status',case when previous is null then 201 else 200 end,'record',result);
end $$;
revoke all on function public.beyond_edge_editorial(text,text),public.beyond_edge_save_editorial(text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.beyond_edge_editorial(text,text),public.beyond_edge_save_editorial(text,text,text,text,text,integer,jsonb) to service_role;
commit;
