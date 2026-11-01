import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareBatch,stageBatch,canonical} from '../../migration/batch.mjs';
import {createRemoteIO} from '../../migration/remote.mjs';
const root=await mkdtemp(join(tmpdir(),'beyond-batch-fixture-'));
await writeFile(join(root,'fixture.png'),new Uint8Array([137,80,78,71]));
const row=(collection,record)=>({collection,row_key:JSON.stringify([record.id]),record});
const document=()=>({version:1,sourceSha256:'0'.repeat(64),records:[row('admins',{id:'admin',email:'fixture@example.test'}),row('worlds',{id:'world'}),row('discoveries',{id:'discovery',world_id:'world'}),row('central_characters',{id:'character',creator_id:'admin',file_key:'fixture.png',preview_key:null})]});
function memoryIO(){
 const batches=new Map(),rows=new Map(),files=new Map(),active=[];const writes={batch:0,rows:0,files:0};
 return {batches,data:rows,files,activeRows:active,writes,
 storage:async()=>({private:true,limit:26214400}),
 active:async()=>active,batch:async id=>batches.get(id)||null,rows:async id=>[...rows.values()].filter(r=>r.batch_id===id),
 createBatch:async r=>{writes.batch++;if(!batches.has(r.id))batches.set(r.id,structuredClone(r));},
 createRows:async rs=>{writes.rows++;for(const r of rs){const key=r.batch_id+r.collection+r.row_key;if(!rows.has(key))rows.set(key,structuredClone(r));}},
 file:async k=>files.get(k)||null,createFile:async(k,b)=>{writes.files++;if(files.has(k))throw Error('Conflict');files.set(k,new Uint8Array(b));},
 };
}
test('deterministic plan preserves every record ID and rekeys only storage paths',async()=>{
 const a=await prepareBatch(document(),root),b=await prepareBatch(document(),root);
 assert.equal(a.batchId,b.batchId);assert.equal(a.records[1].record.id,'world');assert.equal(a.records[2].record.world_id,'world');assert.equal(a.records[3].record.id,'character');assert.ok(a.records[3].record.file_key.startsWith(a.batchId+'/'));assert.equal(a.records[3].record.creator_id,'admin');
});
test('repeat staging does not duplicate rows, files or batches and never activates',async()=>{
 const plan=await prepareBatch(document(),root),io=memoryIO();await stageBatch(plan,io);const first={...io.writes};const result=await stageBatch(plan,io);
 assert.deepEqual(io.writes,first);assert.equal(io.data.size,4);assert.equal(io.files.size,1);assert.equal(io.batches.size,1);assert.equal(result.activated,false);assert.equal(io.batches.get(plan.batchId).verified,false);
});
test('partial row insertion resumes, preserving already committed records',async()=>{
 const plan=await prepareBatch(document(),root),io=memoryIO(),insert=io.createRows;let first=true;
 io.createRows=async rows=>{if(first){first=false;await insert(rows.slice(0,1));throw Error('Interrupted');}return insert(rows);};
 await assert.rejects(stageBatch(plan,io),/Interrupted/);assert.equal(io.data.size,1);await stageBatch(plan,io);assert.equal(io.data.size,4);assert.equal(io.writes.files,1);
});
test('interrupted successful file upload is verified rather than uploaded again',async()=>{
 const plan=await prepareBatch(document(),root),io=memoryIO(),insert=io.createFile;io.createFile=async(k,b)=>{await insert(k,b);throw Error('Connection lost');};await stageBatch(plan,io);assert.equal(io.writes.files,1);
});
test('conflicting remote row is rejected before any writes',async()=>{
 const plan=await prepareBatch(document(),root),io=memoryIO();await io.createBatch({id:plan.batchId,source_sha256:plan.sourceSha256,verified:false});await io.createRows([{...plan.records[0],record:{id:'different'}}]);const before={...io.writes};await assert.rejects(stageBatch(plan,io),/conflicts/);assert.deepEqual(io.writes,before);
});
test('conflicting file is retained without overwrite',async()=>{
 const plan=await prepareBatch(document(),root),io=memoryIO();io.files.set(plan.batchId+'/fixture.png',new Uint8Array([0]));await assert.rejects(stageBatch(plan,io),/object differs/);assert.equal(io.writes.files,0);assert.equal(io.files.get(plan.batchId+'/fixture.png')[0],0);
});
test('active and verified batches are never written',async()=>{
 const plan=await prepareBatch(document(),root);
 const a=memoryIO();a.activeRows.push({batch_id:plan.batchId});await assert.rejects(stageBatch(plan,a),/active/);assert.equal(a.writes.batch,0);
 const b=memoryIO();b.batches.set(plan.batchId,{id:plan.batchId,source_sha256:plan.sourceSha256,verified:true});await assert.rejects(stageBatch(plan,b),/verified/);assert.equal(b.writes.rows,0);
});
test('duplicate primary keys and broken relationships are rejected',async()=>{
 const a=document();a.records.push(a.records[0]);await assert.rejects(prepareBatch(a,root),/Duplicate/);
 const b=document();b.records[2].record.world_id='missing';await assert.rejects(prepareBatch(b,root),/relationship/);
});
test('missing file, traversal and symlink escape are rejected',async()=>{
 for(const key of ['missing.png','../outside.png']){const d=document();d.records[3].record.file_key=key;await assert.rejects(prepareBatch(d,root));}
 const outside=await mkdtemp(join(tmpdir(),'beyond-outside-'));await writeFile(join(outside,'asset'),'outside');await symlink(join(outside,'asset'),join(root,'escape.png'));
 const d=document();d.records[3].record.file_key='escape.png';await assert.rejects(prepareBatch(d,root),/escaped/);
});
test('source asset change after plan cannot be uploaded',async()=>{
 const plan=await prepareBatch(document(),root),io=memoryIO();await writeFile(join(root,'fixture.png'),new Uint8Array([1]));await assert.rejects(stageBatch(plan,io),/changed after planning/);assert.equal(io.writes.files,0);await writeFile(join(root,'fixture.png'),new Uint8Array([137,80,78,71]));
});
test('remote adapter counts pages and uses insert-ignore, never merge/update/delete',async()=>{
 const methods=[];let calls=0;
 const io=createRemoteIO({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture'},async(url,opts)=>{
   methods.push(opts.method||'GET');assert.equal(opts.allowedStatuses,undefined);
   if(opts.method==='POST'){assert.ok(opts.headers.Prefer.includes('ignore-duplicates'));return new Response(null,{status:201});}
   calls++;return Response.json(calls===1?[{ordinal:0}]:[{ordinal:1}],{headers:{'content-range':calls===1?'0-0/2':'1-1/2'}});
 });
 assert.equal((await io.rows('batch')).length,2);await io.createRows([{collection:'worlds'}]);assert.deepEqual(methods,['GET','GET','POST']);
});
test('public or undersized target bucket is rejected before writes',async()=>{
 const plan=await prepareBatch(document(),root);
 for(const storage of [{private:false},{private:true,limit:1}]){const io=memoryIO();io.storage=async()=>storage;await assert.rejects(stageBatch(plan,io));assert.equal(io.writes.batch,0);assert.equal(io.writes.files,0);assert.equal(io.writes.rows,0);}
});
test('Storage NoSuchKey 400 is absent, other 400 errors are not treated as missing',async()=>{
 const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture'};
 const missing=createRemoteIO(env,async()=>Response.json({code:'NoSuchKey',statusCode:'404'},{status:400}));assert.equal(await missing.file('fixture/key'),null);
 const denied=createRemoteIO(env,async()=>Response.json({code:'AccessDenied',statusCode:'403'},{status:400}));await assert.rejects(denied.file('fixture/key'),/absence is not established/);
});
