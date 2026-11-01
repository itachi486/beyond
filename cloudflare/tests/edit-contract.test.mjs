import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {setup,newWorld,codecs} from './companion.test.mjs';
import {editContract} from './edit-contract-fixture.mjs';
import {maskFor} from '../world-edits.mjs';
test('A09 actual handler: strict admission, owned target, protected pixels and approval-only application',async()=>{
 const f=await setup();try{
  const world=newWorld('Contract valley','Preserve the original world.'),other=newWorld('Other valley','Separate world.');
  world.objects.push({id:randomUUID(),kind:'building',name:'Existing world object',x:800,y:195,size:1,rotation:0,layer:0});
  for(const w of [world,other])assert.equal((await f.run('/api/user/worlds/'+w.id,{world:w,version:0,requestId:randomUUID()},f.user.cookie,f.user.csrf,'PUT')).status,201);
  const original=await sharp({create:{width:768,height:512,channels:4,background:'#284966'}}).png().toBuffer();
  const body=editContract({requestId:randomUUID(),worldId:world.id,position:{x:.4,y:.7},message:'Build a house',lore:world.description,image:original.toString('base64')},original,1);
  const post=b=>f.run('/api/ai/world-edits',b,f.user.cookie,f.user.csrf);
  for(const key of ['contractVersion','operationId','actionType','objectKind','position','targetId','parentId','sourceHash','expectedWorldRevision']){
   const bad={...body};delete bad[key];const r=await post(bad);assert.equal(r.status,400,key);assert.equal(f.calls.length,0);
  }
  for(const patch of [{actionType:'EDIT_EXISTING_OBJECT'},{actionType:'unknown'},{position:{x:NaN,y:.5}},{position:{x:-.1,y:.5}},{position:{x:'0.4',y:.7}},{targetId:'occupied'},{requestId:randomUUID()}])assert.equal((await post({...body,...patch})).status,400);
  assert.equal((await post({...body,sourceHash:'0'.repeat(64)})).status,409);
  assert.equal((await post({...body,expectedWorldRevision:0})).status,409);
  assert.equal((await post({...body,position:{x:.8,y:.3}})).status,409);
  assert.equal(f.d1.db.prepare("SELECT COUNT(*) n FROM workers_ai_requests WHERE id LIKE 'world-edit:%'").get().n,0);
  const created=await post(body);assert.equal(created.status,200);const house=(await created.json()).item;
  const list=async()=> (await(await f.run('/api/ai/world-edits?worldId='+world.id,undefined,f.user.cookie)).json()).items;
  assert.equal((await list()).filter(v=>v.approved).length,0);
  assert.equal((await f.run('/api/ai/world-edits/'+house.requestId+'/approve',{},f.user.cookie,f.user.csrf)).status,200);
  const read=async(id,kind)=>Buffer.from(await(await f.run('/api/ai/world-edits/'+id+'/'+kind,undefined,f.user.cookie)).arrayBuffer());
  const source=await read(house.requestId,'image'),edit=editContract({requestId:randomUUID(),worldId:world.id,position:house.position,message:'Change this house to Western style',lore:world.description,parentId:house.requestId,actionType:'EDIT_EXISTING_WORLD_OBJECT',objectKind:'house',targetId:house.objectId},source,1);
  const calls=f.calls.length;
  for(const patch of [{targetId:randomUUID()},{worldId:other.id,parentId:null},{position:{x:.9,y:.1}},{objectKind:'farm'},{actionType:'CREATE_WORLD_OBJECT',targetId:null}]){const r=await post({...edit,...patch});assert.equal(r.status,409,JSON.stringify(await r.clone().json()));}
  assert.equal(f.calls.length,calls);
  const edited=await post(edit);assert.equal(edited.status,200);const candidate=(await edited.json()).item;
  assert.equal(candidate.objectId,house.objectId);assert.equal(candidate.originalHash,house.imageHash);assert.equal(candidate.approved,false);assert.equal((await list()).find(v=>v.approved).requestId,house.requestId);
  assert.deepEqual(await read(house.requestId,'original'),original);assert.deepEqual(await read(candidate.requestId,'original'),source);
  const before=await codecs.decode('png',source),after=await codecs.decode('png',await read(candidate.requestId,'image')),mask=maskFor(before.width,before.height,house.position);let outside=0;
  for(let i=0;i<before.data.length;i+=4)if(!mask.data[i])for(let c=0;c<4;c++)outside+=before.data[i+c]!==after.data[i+c];assert.equal(outside,0);
  const saved=(await(await f.run('/api/user/worlds/'+world.id,undefined,f.user.cookie)).json()).world;assert.deepEqual(saved.objects,world.objects);assert.equal(saved.cloudVersion,1);
  assert.equal((await f.run('/api/ai/world-edits/'+candidate.requestId+'/approve',{},f.user.cookie,f.user.csrf)).status,200);
  assert.equal((await list()).find(v=>v.approved).requestId,candidate.requestId);
 }finally{f.d1.close();}
});
