import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword} from '../auth.mjs';
import {handle} from '../../worker/index.mjs';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture',APP_ORIGIN:'https://beyond.test',ADMIN_ALLOWED_EMAIL:'editor@example.test'};
const password='Disposable-fixture-only-123';
const hash=await hashPassword(password);
const session={admin_id:'admin-fixture',email:env.ADMIN_ALLOWED_EMAIL,csrf:'fixture-csrf',expires_at:Date.now()+100000};
const world={id:'archive',slug:'archive',status:'published',version:1,created_at:'2026-01-01',updated_at:'2026-01-01',data:JSON.stringify({name:{en:'Archive',es:''},description:{en:'World',es:''},theme:'archive',color:'#123456',order:0,aliases:[]})};
function transport({signedIn=false,rateAllowed=true,saveStatus=200,ready=true}={}){
 const calls=[];
 const fetch=async(url,options)=>{
   const name=new URL(url).pathname.split('/').pop(),input=JSON.parse(options.body);calls.push({name});
   if(name==='beyond_edge_context')return Response.json({ready,administrator:{id:'admin-fixture',email:env.ADMIN_ALLOWED_EMAIL,password_hash:hash},session:signedIn?session:null});
   if(name==='beyond_edge_attempt')return Response.json(rateAllowed);
   if(name==='beyond_edge_start_session')return Response.json({ok:true});
   if(name==='beyond_edge_logout')return Response.json(true);
   if(name==='beyond_edge_editorial')return Response.json({status:200,records:[{collection:'worlds',record:world}]});
   if(name==='beyond_edge_save_editorial')return Response.json({status:saveStatus,record:{...world,version:2,data:JSON.stringify(input.content)}});
   throw Error('Unexpected RPC');
 };return {fetch,calls};
}
function request(path,method='GET',body,headers={}){return new Request('https://beyond.test/api/admin/'+path,{method,headers:{...(body?{'content-type':'application/json',origin:env.APP_ORIGIN}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});}
test('allowlist missing fails closed before network',async()=>{
 const t=transport();const r=await handle(request('session'),{...env,ADMIN_ALLOWED_EMAIL:''},t.fetch);assert.equal(r.status,503);assert.equal(t.calls.length,0);
});
test('unauthenticated direct read and write requests are denied',async()=>{
 for(const req of [request('session'),request('worlds','POST',{slug:'test'})]){const t=transport();const r=await handle(req,env,t.fetch);assert.equal(r.status,401);assert.equal(t.calls.length,1);}
});
test('existing scrypt credentials authenticate without account reset or disclosure',async()=>{
 const t=transport();const r=await handle(request('login','POST',{email:env.ADMIN_ALLOWED_EMAIL,password}),env,t.fetch);
 assert.equal(r.status,200);const c=r.headers.get('set-cookie');assert.ok(c.startsWith('__Host-beyond_admin='));assert.ok(c.includes('HttpOnly'));assert.ok(c.includes('Secure'));assert.ok(c.includes('SameSite=Strict'));assert.deepEqual(await r.json(),{ok:true});
 assert.equal(t.calls.filter(c=>c.name==='beyond_edge_start_session').length,1);
});
test('wrong password and disallowed email never create a session',async()=>{
 for(const body of [{email:env.ADMIN_ALLOWED_EMAIL,password:'Wrong-password-fixture'},{email:'stranger@example.test',password}]){const t=transport();const r=await handle(request('login','POST',body),env,t.fetch);assert.equal(r.status,401);assert.ok(!t.calls.some(c=>c.name==='beyond_edge_start_session'));}
});
test('login rate limit stops credential evaluation/session creation',async()=>{
 const t=transport({rateAllowed:false});const r=await handle(request('login','POST',{email:env.ADMIN_ALLOWED_EMAIL,password}),env,t.fetch);assert.equal(r.status,429);assert.ok(!t.calls.some(c=>c.name==='beyond_edge_start_session'));
});
test('origin and CSRF protection deny writes before save RPC',async()=>{
 for(const headers of [{origin:'https://evil.test','x-csrf-token':session.csrf},{'x-csrf-token':'wrong'}]){
 const t=transport({signedIn:true});const r=await handle(request('worlds/archive','PUT',{version:1},headers),env,t.fetch);assert.equal(r.status,403);assert.ok(!t.calls.some(c=>c.name==='beyond_edge_save_editorial'));
 }
});
test('session response exposes only existing session DTO, not credential',async()=>{
 const t=transport({signedIn:true});const r=await handle(request('session'),env,t.fetch);assert.equal(r.status,200);assert.deepEqual(Object.keys(await r.json()).sort(),['csrf','email','expiresAt']);
});
test('world validation, version preservation and conflict responses',async()=>{
 const content={version:1,name:{en:'Changed',es:''},description:{en:'Description',es:''},slug:'archive',status:'published',theme:'archive',color:'#123456',order:0};
 for(const status of [200,409]){const t=transport({signedIn:true,saveStatus:status});const r=await handle(request('worlds/archive','PUT',content,{'x-csrf-token':session.csrf}),env,t.fetch);assert.equal(r.status,status);if(status===200)assert.equal((await r.json()).item.version,2);}
 const t=transport({signedIn:true});const r=await handle(request('worlds/archive','PUT',{...content,version:0},{'x-csrf-token':session.csrf}),env,t.fetch);assert.equal(r.status,409);assert.ok(!t.calls.some(c=>c.name==='beyond_edge_save_editorial'));
});
test('logout requires CSRF and expires secure cookie',async()=>{
 const t=transport({signedIn:true});const r=await handle(request('logout','POST',{}, {'x-csrf-token':session.csrf}),env,t.fetch);assert.equal(r.status,200);assert.ok(r.headers.get('set-cookie').includes('Max-Age=0'));
});
