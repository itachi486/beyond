import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore,publicUniverse} from '../store.mjs';
import {collect} from '../../migration/export-sqlite.mjs';
import {universeFromRecords} from '../../worker/universe.mjs';
import worker, {handle} from '../../worker/index.mjs';
import {supabase} from '../../worker/supabase.mjs';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test_fixture',SUPABASE_CHARACTER_BUCKET:'private-characters'};
test('preservation projection matches existing public DTO, stable IDs and eligibility',()=>{
 const db=openStore(':memory:');
 try {const records=collect(db);assert.deepEqual(JSON.parse(JSON.stringify(universeFromRecords(records))),JSON.parse(JSON.stringify(publicUniverse(db))));assert.ok(records.some(r=>r.collection==='worlds'));} finally {db.close();}
});
test('missing and public credentials fail closed before network',()=>{
 assert.throws(()=>supabase({}),/not configured/);
 assert.throws(()=>supabase({...env,SUPABASE_SERVICE_ROLE_KEY:'sb_publishable_fixture'}),/publishable/);
});
test('Worker universe returns real adapter data, not SPA HTML',async()=>{
 const db=openStore(':memory:');const records=collect(db),expected=publicUniverse(db);db.close();
 const response=await handle(new Request('https://beyond.test/api/public/universe'),env,async()=>Response.json(records));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),JSON.parse(JSON.stringify(expected)));
});
test('upstream secret response is never forwarded',async()=>{
 const r=await handle(new Request('https://beyond.test/api/public/universe'),env,async()=>new Response('private upstream diagnostic',{status:401}));
 assert.equal(r.status,503);assert.ok(!(await r.text()).includes('private upstream'));
});
test('Workers-compatible redirects do not forward credentials to another host',async()=>{
 let calls=0;const client=supabase(env,async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://other.example/'}});});
 await assert.rejects(client('/rest/v1/rpc/beyond_public_records'),/unavailable/);assert.equal(calls,1);
});
test('actual Workers entrypoint does not treat ExecutionContext as a transport',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;return Response.json({ready:false});};const response=await worker.fetch(new Request('https://beyond.test/api/admin/setup-status'),{...env,ADMIN_ALLOWED_EMAIL:'editor@example.test'},{waitUntil(){}});assert.equal(response.status,200);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('unmigrated admin is explicitly unavailable, not bypassed',async()=>{
 const r=await handle(new Request('https://beyond.test/api/admin/session'),env,()=>{throw Error('must not call');});
 assert.equal(r.status,503);
});
test('library is paginated and strips private object paths',async()=>{
 const r=await handle(new Request('https://beyond.test/api/public/characters'),env,async()=>Response.json({items:[{id:'character',version:1,file_key:'private-file',preview_key:null}],total:1,page:1,totalPages:1}));
 const body=await r.json();assert.equal(body.items[0].fileUrl,'/api/public/characters/character/file?v=1');assert.equal(body.items[0].file_key,undefined);
});
test('unpublished asset is denied before private storage access',async()=>{
 let calls=0;const r=await handle(new Request('https://beyond.test/api/public/characters/character/file'),env,async()=>{calls++;return Response.json({items:[]});});
 assert.equal(r.status,404);assert.equal(calls,1);
});
test('stale version denied before private storage access',async()=>{
 const r=await handle(new Request('https://beyond.test/api/public/characters/character/file?v=1'),env,async()=>Response.json({items:[{id:'character',version:2}]}));assert.equal(r.status,409);
});
test('static routes delegate to ASSETS; API writes cannot mutate',async()=>{
 assert.equal(await(await handle(new Request('https://beyond.test/explore'),{ASSETS:{fetch:()=>new Response('app')}})).text(),'app');
 assert.equal((await handle(new Request('https://beyond.test/api/public/universe',{method:'POST'}),env)).status,405);
});
