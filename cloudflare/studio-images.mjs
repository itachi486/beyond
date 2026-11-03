import {createHash,randomUUID} from 'node:crypto';
import {workersImage,aiError,aiStatus,IMAGE_MODEL,assertCostProof} from './workers-ai.mjs';
import {runtime} from './context.mjs';import {verifyUserWrite,readUserJSON,memberResponse} from './user-auth.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
export async function studioImagesAPI(request,db,s,env){
 const verifyCompleted=c=>{const row=db.prepare('SELECT * FROM workers_ai_requests WHERE id=? AND actor=?').get('image:'+c.id,s.user_id);if(!row||row.status!=='success')throw Error('budget_precision_unverified');assertCostProof(db,row);};
 const u=new URL(request.url);if(!u.pathname.startsWith('/api/admin/studio/images'))return null;
 const parts=u.pathname.split('/').filter(Boolean),id=parts[4],json=memberResponse;
 try{
  const ownWorld=id=>db.prepare('SELECT data,version FROM user_worlds WHERE owner_id=? AND id=?').get(s.user_id,id);
  if(request.method==='GET'){
   const worldId=u.searchParams.get('worldId');if(!worldId||!ownWorld(worldId))return json({error:'World not found.'},404);
   return json({items:db.prepare('SELECT id,state,asset_id,data,created_at FROM admin_personal_image_candidates WHERE owner_id=? AND world_id=? ORDER BY created_at DESC LIMIT 30').all(s.user_id,worldId).map(r=>({id:r.id,state:r.state,assetId:r.asset_id,...JSON.parse(r.data),createdAt:r.created_at}))});
  }
  if(request.method!=='POST')return json({error:'Method not allowed.'},405);verifyUserWrite(request,env,s);const input=await readUserJSON(request,12*1024);
  if(id){const c=db.prepare('SELECT * FROM admin_personal_image_candidates WHERE owner_id=? AND id=?').get(s.user_id,id);if(!c||!ownWorld(c.world_id))return json({error:'Candidate not found.'},404);if(!['approve','reject'].includes(parts[5]))return json({error:'Not found.'},404);
   if(c.state==='pending'||c.state==='failed')return json({error:'Candidate is not ready. Do not repeat an uncertain inference.'},409);
   verifyCompleted(c);const next=parts[5]==='approve'?'approved':'rejected';if(c.state==='approved'&&next==='rejected'||c.state==='rejected'&&next==='approved')return json({error:'Candidate decision conflict.'},409);
   db.prepare('UPDATE admin_personal_image_candidates SET state=? WHERE owner_id=? AND id=?').run(next,s.user_id,id);await db.flush();const data=JSON.parse(c.data);return json({id,state:next,...data,assetId:c.asset_id,applied:false});
  }
  const world=ownWorld(input.worldId);if(!world)return json({error:'World not found.'},404);
  if(!/^[a-f0-9-]{36}$/.test(input.operationId||'')||!['world','character'].includes(input.target)||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>1500)return json({error:'Invalid image request.'},400);
  const w=JSON.parse(world.data).world;if(input.target==='character'&&!w.graph?.characters?.some(c=>c.id===input.characterId))return json({error:'Character not found in this world.'},404);
  const hash=sha(JSON.stringify(input)),old=db.prepare('SELECT * FROM admin_personal_image_candidates WHERE id=?').get(input.operationId);
  if(old){if(old.owner_id!==s.user_id||old.request_hash!==hash)return json({error:'request_conflict'},409);if(['candidate','approved','rejected'].includes(old.state))verifyCompleted(old);return json({id:old.id,state:old.state,...JSON.parse(old.data),assetId:old.asset_id||undefined,cached:true},old.state==='pending'?202:200);}
  const data={worldId:input.worldId,target:input.target,characterId:input.characterId||null,prompt:input.prompt,model:IMAGE_MODEL,sourceWorldRevision:world.version};
  db.exec('BEGIN IMMEDIATE');try{db.prepare('INSERT INTO admin_personal_image_candidates VALUES(?,?,?,?,NULL,?,?,?)').run(input.operationId,s.user_id,input.worldId,'pending',hash,JSON.stringify(data),new Date().toISOString());db.prepare('INSERT INTO ai_generations VALUES(?,?,?,?,?,?,?,?)').run(input.operationId,s.user_id,hash,new Date().toISOString().slice(0,10),'pending',null,null,Date.now());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}await db.flush();
  // Existing Workers AI model, reservation, proof and error rules. Never re-run
  // an operation left pending by an unknown provider or storage outcome.
  const bytes=await workersImage({requestId:input.operationId,studioLandscape:input.target==='world',name:input.target==='world'?'Fantasy landscape, wide terrain and architecture':'Fantasy character',type:input.target,description:input.prompt,appearancePrompt:input.target==='world'?'A coherent landscape painting with space for later additions. No portrait, plain backdrop or text.':input.prompt});
  await db.assertStudioOwner();await db.assertLegacyMediaAllowed();const assetId=randomUUID(),hashBytes=sha(bytes),key=`user-worlds/${s.user_id}/${assetId}/${hashBytes}/original.png`,meta={kind:'image',format:'png',mime:'image/png',bytes:bytes.length,studioLandscape:input.target==='world',name:input.target==='world'?'Generated world':'Generated character',description:input.prompt,filename:'original.png',tags:'',source:'',purpose:input.target==='world'?'starter-world':undefined,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  db.prepare('UPDATE admin_personal_image_candidates SET data=? WHERE owner_id=? AND id=?').run(JSON.stringify({...data,hash:hashBytes,assetId,recoveryKey:key}),s.user_id,input.operationId);await db.flush();
  const stored=await env.MEDIA.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'image/png'}});if(!stored)throw Error('storage_conflict');const readback=await env.MEDIA.get(key);if(!readback||sha(Buffer.from(await readback.arrayBuffer()))!==hashBytes)throw Error('image_storage_unavailable');
  db.exec('BEGIN IMMEDIATE');try{db.prepare('INSERT INTO user_world_assets VALUES(?,?,?,?,?,?,?)').run(s.user_id,assetId,'ready',key,hashBytes,JSON.stringify(meta),meta.createdAt);db.prepare('UPDATE admin_personal_image_candidates SET state=?,asset_id=?,data=? WHERE owner_id=? AND id=?').run('candidate',assetId,JSON.stringify({...data,hash:hashBytes}),s.user_id,input.operationId);db.prepare("UPDATE ai_generations SET status='success',asset_id=? WHERE id=? AND creator_id=?").run(assetId,input.operationId,s.user_id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}await db.flush();
  return json({id:input.operationId,state:'candidate',assetId,hash:hashBytes,...data,applied:false},201);
 }catch(e){const code=e.status?e.message:aiError(e);return json({error:code,recoveryRequired:!e.status},e.status||aiStatus(code));}
}
