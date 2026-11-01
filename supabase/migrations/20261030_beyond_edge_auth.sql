-- Additive edge-session infrastructure; never resets/imports admin credentials.
begin;
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
commit;
