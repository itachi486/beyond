begin;
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
