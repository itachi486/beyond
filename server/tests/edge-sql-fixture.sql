-- Only for a disposable PostgreSQL fixture. Never run on the real project.
insert into public.beyond_migration_batches(id,verified,source_sha256) values('fixture',true,repeat('0',64));
insert into public.beyond_active_batch values(true,'fixture');
insert into public.beyond_records values('fixture','admins','["fixture-admin"]',0,'{"id":"fixture-admin","email":"editor@example.test","password_hash":"fixture-credential","created_at":"2026-01-01"}');
insert into public.beyond_records values('fixture','worlds','["world"]',1,jsonb_build_object('id','world','version',1,'slug','world','status','draft','data','{"name":{"en":"Fixture"},"aliases":[]}','created_at','2026-01-01','updated_at','2026-01-01'));
set role service_role;
do $$
declare result jsonb;
begin
 if has_table_privilege('anon','public.beyond_records','SELECT') or has_table_privilege('authenticated','public.beyond_records','SELECT')
 or has_function_privilege('anon','public.beyond_edge_context(text,text)','EXECUTE') then raise exception 'Public privilege regression'; end if;
 if (public.beyond_edge_context('wrong@example.test',null)->>'ready')::boolean then raise exception 'Allowlist failed'; end if;
 if public.beyond_edge_editorial('editor@example.test',repeat('a',64))->>'status'<>'401' then raise exception 'Missing session accepted'; end if;
 result:=public.beyond_edge_start_session('editor@example.test','wrong',repeat('a',64),repeat('A',43),null);
 if (result->>'ok')::boolean then raise exception 'Wrong credential accepted'; end if;
 result:=public.beyond_edge_start_session('editor@example.test','fixture-credential',repeat('a',64),repeat('A',43),null);
 if not (result->>'ok')::boolean then raise exception 'Session start failed'; end if;
 if public.beyond_edge_editorial('editor@example.test',repeat('a',64))->>'status'<>'200' then raise exception 'Valid session denied'; end if;
 result:=public.beyond_edge_save_editorial('editor@example.test',repeat('a',64),'bad','worlds','world',1,'{"slug":"world","status":"draft"}');
 if result->>'status'<>'403' then raise exception 'CSRF rejected incorrectly'; end if;
 result:=public.beyond_edge_save_editorial('editor@example.test',repeat('a',64),repeat('A',43),'worlds','world',1,'{"slug":"world","status":"draft","name":{"en":"Updated"},"aliases":[]}');
 if result->>'status'<>'200' or result->'record'->>'version'<>'2' then raise exception 'Versioned write failed'; end if;
 if (select count(*) from public.beyond_records where collection='revisions')<>1 then raise exception 'Audit revision missing'; end if;
 result:=public.beyond_edge_save_editorial('editor@example.test',repeat('a',64),repeat('A',43),'worlds','world',1,'{"slug":"world","status":"draft"}');
 if result->>'status'<>'409' then raise exception 'Stale write accepted'; end if;
 if public.beyond_edge_logout('editor@example.test',repeat('a',64),null) then raise exception 'Null CSRF accepted'; end if;
 if not public.beyond_edge_logout('editor@example.test',repeat('a',64),repeat('A',43)) then raise exception 'Logout failed'; end if;
 if public.beyond_edge_editorial('editor@example.test',repeat('a',64))->>'status'<>'401' then raise exception 'Revocation failed'; end if;
 if (select count(*) from public.beyond_records where collection='admins')<>1 then raise exception 'Administrator lost'; end if;
end $$;
reset role;
