import {editContract} from './edit-contract-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';import initSQL from 'sql.js';
import {fixture,req,login} from './cloudflare.test.mjs';import {cloudflareFetch} from '../handler.mjs';import {maskFor,composite,EDIT_MODEL,VISION_MODEL} from '../world-edits.mjs';
const SQL=await initSQL();const codecs={decode:async(format,bytes)=>{const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data:new Uint8ClampedArray(data),width:info.width,height:info.height};}};
const run=(r,env)=>cloudflareFetch(r,env,{SQL,codecs});
test('masked edits preserve originals, require approval, persist after reconnect and reject stale parents',async()=>{
 const f=await fixture();try{const s=await login(f.env),original=await sharp({create:{width:768,height:512,channels:4,background:'#28394a'}}).png().toBuffer(),generated=await sharp({create:{width:512,height:512,channels:4,background:'#ffbb88'}}).png().toBuffer();let calls=0;
 const env={...f.env,BEYOND_STAGE:'migration-preview',AI:{run:async(model,input)=>{calls++;if(model===VISION_MODEL){assert.ok(input.prompt.includes('x=0.3'));assert.ok(input.image.length>0);return {response:'Mountain foothill, warm light from left, painted perspective.'};}assert.equal(model,EDIT_MODEL);assert.ok(input.mask.length);assert.ok(input.image.length);return new Response(generated).body;}}};
 const body=editContract({requestId:'world-edit-fixture-12345',worldId:'fixture-world',position:{x:.3,y:.6},message:'여기에 아름다운 집을 만들어 줘',lore:'Original lore',image:original.toString('base64')},original);
 assert.equal((await run(req('/api/ai/world-edits','POST',body),env)).status,401);
 assert.equal((await run(req('/api/ai/world-edits','POST',body,s.cookie,'wrong'),env)).status,403);
 const first=await run(req('/api/ai/world-edits','POST',body,s.cookie,s.csrf),env);assert.equal(first.status,200);const item=(await first.json()).item;assert.equal(item.approved,false);assert.equal(calls,2);
 assert.equal((await run(req('/api/ai/world-edits','POST',body,s.cookie,s.csrf),env)).status,200);assert.equal(calls,2);
 const read=path=>run(req(path,'GET',null,s.cookie),env);
 assert.deepEqual(Buffer.from(await (await read(`/api/ai/world-edits/${item.requestId}/original`)).arrayBuffer()),original);
 const image=Buffer.from(await (await read(`/api/ai/world-edits/${item.requestId}/image`)).arrayBuffer()),a=await codecs.decode('png',original),b=await codecs.decode('png',image),mask=maskFor(768,512,body.position);let changed=0;
 for(let i=0;i<a.data.length;i+=4){if(!mask.data[i])assert.deepEqual(b.data.slice(i,i+4),a.data.slice(i,i+4));else if(b.data[i]!==a.data[i])changed++;}assert.ok(changed>0);
 assert.equal((await run(req(`/api/ai/world-edits/${item.requestId}/approve`,'POST',{},s.cookie,s.csrf),env)).status,200);
 const restored=(await (await read('/api/ai/world-edits?worldId=fixture-world')).json()).items[0];assert.equal(restored.approved,true);assert.deepEqual(restored.position,body.position);assert.equal(restored.lore,body.lore);
 assert.equal((await run(req('/api/ai/world-edits','POST',{...body,requestId:'world-edit-stale-12345',operationId:'world-edit-stale-12345'},s.cookie,s.csrf),env)).status,409);
 assert.equal((await run(req('/api/ai/world-edits/'+item.requestId+'/image'),env)).status,401);
 }finally{f.d1.close();}
});
test('composite rejects output size changes',()=>assert.throws(()=>composite({width:2,height:2},{width:3,height:2},{})));
test('Klein reference editing requires no separate vision model and still stores an unapproved preserved version',async()=>{
 const f=await fixture();try{const s=await login(f.env),original=await sharp({create:{width:768,height:512,channels:4,background:'#28394a'}}).png().toBuffer(),output=await sharp({create:{width:512,height:512,channels:4,background:'#776644'}}).png().toBuffer();let calls=0;const env={...f.env,BEYOND_STAGE:'migration-preview',AI_WORLD_EDIT_MODEL:'@cf/black-forest-labs/flux-2-klein-4b',AI:{run:async(model,input)=>{calls++;assert.equal(model,env.AI_WORLD_EDIT_MODEL);assert.ok(input.multipart);return{image:output.toString('base64')};}}};
 const response=await run(req('/api/ai/world-edits','POST',editContract({requestId:'klein-integration-fixture',worldId:'klein-world',position:{x:.4,y:.7},message:'여기에 집을 만들어 줘',lore:'Original',image:original.toString('base64')},original),s.cookie,s.csrf),env);assert.equal(response.status,200);const item=(await response.json()).item;assert.equal(calls,1);assert.equal(item.approved,false);assert.equal(item.editingMethod,'reference-edit-with-mask-composite');assert.equal(item.visionModel,env.AI_WORLD_EDIT_MODEL);assert.ok(item.analysis.includes('No separate textual'));assert.equal(f.d1.db.prepare("SELECT COUNT(*) n FROM workers_ai_requests WHERE id LIKE 'world-vision:%'").get().n,0);assert.equal(f.env.MEDIA.data.size,3);const manifest=JSON.parse(Buffer.from(f.env.MEDIA.data.get(item.imageKey.replace('/candidate.png','/candidate-manifest.json'))).toString());assert.equal(manifest.record.imageHash,item.imageHash);assert.equal(manifest.record.originalHash,item.originalHash);assert.equal(manifest.record.approved,false);
 const rejectPath='/api/ai/world-edits/'+item.requestId+'/reject';assert.equal((await run(req(rejectPath,'POST',{},s.cookie,'wrong'),env)).status,403);assert.equal((await run(req(rejectPath,'POST',{},s.cookie,s.csrf),env)).status,200);const reopened=await run(req('/api/ai/world-edits?worldId=klein-world','GET',null,s.cookie),env);assert.equal((await reopened.json()).items[0].rejected,true);assert.equal((await run(req('/api/ai/world-edits/'+item.requestId+'/approve','POST',{},s.cookie,s.csrf),env)).status,409);assert.equal(calls,1);
 }finally{f.d1.close();}
});
