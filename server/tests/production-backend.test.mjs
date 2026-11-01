import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {hashPassword} from '../auth.mjs';
import {handle} from '../../worker/index.mjs';
import production from '../../worker/production.mjs';

const password='Disposable-production-restoration-123',hash=await hashPassword(password);
const batch='beyond-'+'a'.repeat(64),origin='https://beyond.itach9279.workers.dev';
const json=async(r,status)=>{assert.equal(r.status,status);assert.match(r.headers.get('content-type')||'',/^application\/json/);return r.json();};
function fixture(){
 const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture',ADMIN_ALLOWED_EMAIL:'editor@example.test',APP_ORIGIN:origin,SUPABASE_CHARACTER_BUCKET:'beyond-character-assets',BEYOND_BACKEND_MODE:'supabase-admin-production',SUPABASE_PROJECT_ORIGIN_SHA256:createHash('sha256').update('https://fixture.supabase.co').digest('hex'),SUPABASE_EXPECTED_BATCH:batch,ASSETS:{fetch:()=>new Response('<!doctype html>SPA',{headers:{'Content-Type':'text/html'}})}};
 const admin={id:'original-admin',email:env.ADMIN_ALLOWED_EMAIL,password_hash:hash};
 const world={id:'archive',slug:'archive',status:'published',version:1,created_at:'2026-01-01',updated_at:'2026-01-01',data:JSON.stringify({name:{en:'Archive',es:''},description:{en:'World',es:''},theme:'archive',color:'#123456',order:0,aliases:[]})};
 const sessions=new Map(),calls=[],state={active:batch,verified:true,credential:hash,world};
 const transport=async(url,opts={})=>{
  const u=new URL(url),input=opts.body?JSON.parse(opts.body):{};calls.push({path:u.pathname,method:opts.method||'GET'});
  if(u.pathname==='/rest/v1/beyond_active_batch')return Response.json([{batch_id:state.active}]);
  if(u.pathname==='/rest/v1/beyond_migration_batches')return Response.json([{id:batch,verified:state.verified}]);
  if(u.pathname==='/rest/v1/beyond_records')return Response.json([{collection:'central_characters',record:{id:'character',deleted:0}}],{headers:{'Content-Range':'0-0/1'}});
  const session=sessions.get(input.session_hash);
  const valid=session&&session.expires_at>Date.now()&&session.credential===state.credential;
  switch(u.pathname.split('/').pop()){
   case 'beyond_edge_context':return Response.json({ready:true,administrator:{...admin,password_hash:state.credential},session:valid?session:null});
   case 'beyond_edge_attempt':return Response.json(true);
   case 'beyond_edge_start_session':
    if(input.expected_credential!==state.credential)return Response.json({ok:false});
    if(input.previous_token_hash)sessions.delete(input.previous_token_hash);
    sessions.set(input.new_token_hash,{admin_id:admin.id,email:admin.email,credential:state.credential,csrf:input.new_csrf,expires_at:Date.now()+60000});
    return Response.json({ok:true});
   case 'beyond_edge_logout':if(!valid||session.csrf!==input.csrf_token)return Response.json(false);sessions.delete(input.session_hash);return Response.json(true);
   case 'beyond_edge_editorial':return Response.json(valid?{status:200,records:[{collection:'worlds',record:state.world}]}:{status:401});
   case 'beyond_edge_save_editorial':
    if(!valid||session.csrf!==input.csrf_token)return Response.json({status:401});
    if(input.expected_version!==state.world.version)return Response.json({status:409});
    state.world={...state.world,data:JSON.stringify(input.content),version:state.world.version+1};return Response.json({status:200,record:state.world});
   case 'beyond_public_records':return Response.json([{collection:'worlds',record:state.world},{collection:'settings',record:{id:1,data:JSON.stringify({defaultLanguage:'en'})}}]);
   case 'beyond_public_characters':return Response.json({items:input.character_id==='missing'?[]:[{id:'character',name:'Original',description:'Preserved',version:1,format:'png',preview_key:batch+'/preview.png',file_key:batch+'/original.png',creator_id:admin.id}],total:1,page:1,totalPages:1});
  }
  if(u.pathname.startsWith('/storage/v1/object/authenticated/'))return new Response(new Uint8Array([137,80,78,71]));
  throw Error('Unexpected fixture request');
 };
 const request=(path,method='GET',body,cookie,csrf)=>new Request(origin+path,{method,headers:{...(body?{'Content-Type':'application/json',Origin:origin}:{}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const run=(path,method,body,cookie,csrf)=>handle(request(path,method,body,cookie,csrf),env,transport);
 const login=async()=>{const r=await run('/api/admin/login','POST',{email:admin.email,password});await json(r,200);return r.headers.get('set-cookie').split(';')[0];};
 return {env,admin,state,calls,sessions,transport,request,run,login};
}

test('Production config includes the server entrypoint and both API worker-first routes without Preview resources',()=>{
 const text=readFileSync('wrangler.supabase.production.jsonc','utf8').replace(/^\/\/.*$/gm,'');const c=JSON.parse(text);
 assert.equal(c.name,'beyond');assert.equal(c.main,'worker/production.mjs');assert.equal(c.assets.binding,'ASSETS');assert.deepEqual(c.assets.run_worker_first,['/api','/api/*']);
 assert.equal(c.vars.BEYOND_BACKEND_MODE,'supabase-admin-production');assert.match(c.vars.SUPABASE_PROJECT_ORIGIN_SHA256,/^[a-f0-9]{64}$/);assert.match(c.vars.SUPABASE_EXPECTED_BATCH,/^beyond-[a-f0-9]{64}$/);
 for(const key of ['d1_databases','ai','triggers'])assert.equal(c[key],undefined);
 for(const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ADMIN_ALLOWED_EMAIL','BEYOND_B10_LOCAL_ENABLE','TIGRIS_BUCKET_NAME'])assert.equal(c.vars[key],undefined);
});
test('actual Production fetch entrypoint serves JSON and ignores ExecutionContext as transport',async()=>{
 const f=fixture(),saved=globalThis.fetch;globalThis.fetch=f.transport;
 try{const r=await production.fetch(f.request('/api/public/universe'),f.env,{waitUntil(){throw Error('not a transport');}});assert.ok((await json(r,200)).worlds.length);assert.ok(f.calls.length);}
 finally{globalThis.fetch=saved;}
});
test('login/session/logout lifecycle preserves credentials and denies the revoked token',async()=>{
 const f=fixture(),cookie=await f.login();assert.equal(f.state.credential,hash);const before=f.admin.password_hash;
 const s=await json(await f.run('/api/admin/session','GET',null,cookie),200);assert.equal(s.email,f.admin.email);assert.deepEqual(Object.keys(s).sort(),['csrf','email','expiresAt']);
 const logout=await f.run('/api/admin/logout','POST',{},cookie,s.csrf);await json(logout,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 await json(await f.run('/api/admin/session','GET',null,cookie),401);assert.equal(f.admin.password_hash,before);
});
test('setup metadata advertises the limited release without exposing account or secret data',async()=>{
 const f=fixture();const setup=await json(await f.run('/api/admin/setup-status'),200);
 assert.equal(setup.backendMode,'supabase-admin-production');
 assert.deepEqual(Object.keys(setup).sort(),['backendMode','method','state']);
});
test('wrong password and anonymous administrator APIs cannot create or modify sessions/content',async()=>{
 const f=fixture();await json(await f.run('/api/admin/login','POST',{email:f.admin.email,password:'wrong-fixture-password'}),401);
 for(const p of ['/api/admin','/api/admin/session','/api/admin/dashboard','/api/admin/worlds','/api/admin/library/characters'])await json(await f.run(p),401);
 assert.equal(f.sessions.size,0);assert.equal(f.state.world.version,1);
});
test('expired sessions and changed credentials reject formerly valid cookies',async()=>{
 for(const mode of ['expired','changed']){const f=fixture(),cookie=await f.login();if(mode==='expired')for(const s of f.sessions.values())s.expires_at=0;else f.state.credential='changed';await json(await f.run('/api/admin/session','GET',null,cookie),401);}
});
test('authenticated dashboard counts preserved server character assets instead of reporting zero',async()=>{
 const f=fixture(),cookie=await f.login();const dashboard=await json(await f.run('/api/admin/dashboard','GET',null,cookie),200);
 assert.equal(dashboard.serverCharacterAssets,1);assert.equal(dashboard.worlds,1);assert.equal(dashboard.administratorAccounts,1);
});
test('administrator world edits preserve IDs, require CSRF and reject stale versions in the fixture',async()=>{
 const f=fixture(),cookie=await f.login(),s=await json(await f.run('/api/admin/session','GET',null,cookie),200);
 const content={version:1,name:{en:'Restored',es:''},description:{en:'Description',es:''},slug:'archive',status:'published',theme:'archive',color:'#123456',order:0};
 await json(await f.run('/api/admin/worlds/archive','PUT',content,cookie,'wrong'),403);
 const d=await json(await f.run('/api/admin/worlds/archive','PUT',content,cookie,s.csrf),200);assert.equal(d.item.id,'archive');assert.equal(d.item.version,2);
 await json(await f.run('/api/admin/worlds/archive','PUT',content,cookie,s.csrf),409);assert.equal(f.state.world.version,2);
});
test('public catalog and private image proxy preserve data without exposing creator or storage keys',async()=>{
 const f=fixture();assert.ok((await json(await f.run('/api/public/universe'),200)).worlds.length);
 const catalog=await json(await f.run('/api/public/characters'),200);assert.equal(catalog.items[0].id,'character');assert.equal(catalog.items[0].file_key,undefined);assert.equal(catalog.items[0].creator_id,undefined);
 const image=await f.run('/api/public/characters/character/file?v=1');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual([...new Uint8Array(await image.arrayBuffer())],[137,80,78,71]);
 const before=f.calls.length;await json(await f.run('/api/public/characters/missing/file'),404);assert.equal(f.calls.length,before+3);assert.equal(f.calls.at(-1).path.endsWith('beyond_public_characters'),true);
});
test('dataset or project identity mismatch fails before authentication or file access',async()=>{
 for(const mode of ['project','active','verified']){const f=fixture();if(mode==='project')f.env.SUPABASE_PROJECT_ORIGIN_SHA256='0'.repeat(64);if(mode==='active')f.state.active='other';if(mode==='verified')f.state.verified=false;await json(await f.run('/api/admin/session'),503);assert.ok(!f.calls.some(x=>x.path.includes('beyond_edge_context')));}
});
test('Production entrypoint rejects Preview resource mixing without any network request',async()=>{
 const f=fixture();await json(await production.fetch(f.request('/api/admin/session'),{...f.env,DB:{}}),503);assert.equal(f.calls.length,0);
 await json(await production.fetch(f.request('/api/admin/session'),{...f.env,APP_ORIGIN:'https://preview.test'}),503);
});
test('API root/unknown paths never return SPA and member writes stay disabled',async()=>{
 const f=fixture();for(const path of ['/api','/api/no-such-route'])await json(await f.run(path),404);
 await json(await f.run('/api/user/auth/session'),401);assert.equal((await json(await f.run('/api/user/auth/status'),200)).registrationEnabled,false);
 await json(await f.run('/api/user/auth/register','POST',{email:'fixture@example.test',password}),503);
 const home=await f.run('/explore');assert.equal(home.status,200);assert.match(await home.text(),/<!doctype html>/);assert.equal(f.calls.length,0);
});
test('backend faults return JSON errors and unsupported administrator mutations remain closed',async()=>{
 const f=fixture();await json(await handle(f.request('/api/public/universe'),f.env,async()=>{throw Error('fixture failure');}),503);
 const cookie=await f.login();await json(await f.run('/api/admin/library/characters','POST',{},cookie,'unknown'),503);
 assert.equal(f.state.world.version,1);
});
