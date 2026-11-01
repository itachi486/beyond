import {createHash} from 'node:crypto';
import {B10Repository} from './b10-foundation.mjs';
import {userToken,readUserJSON,verifyUserWrite,memberResponse} from './user-auth.mjs';
import {policy} from './workers-ai.mjs';
// Backend foundation only. No UI, provider dispatch, result handling or approval.
export async function b10API(request,env,{validateWorld}={}){
 const path=new URL(request.url).pathname;
 if(!/^\/api\/user\/native-(?:worlds|jobs)(?:\/|$)/.test(path))return null;
 if(env.BEYOND_STAGE!=='migration-preview'||env.BEYOND_B10_LOCAL_ENABLE!=='1')return memberResponse({error:'native_b10_not_activated'},503);
 try{
  const p=policy(env),repo=new B10Repository(env.DB,{daily:String(p.daily),textDaily:String(p.textDaily),imageDaily:String(p.imageDaily),userImageLimit:p.userImage,media:env.MEDIA});
  if(!await repo.active())return memberResponse({error:'native_b10_not_activated'},503);
  const token=userToken(request,env);if(!/^[a-zA-Z0-9_-]{43}$/.test(token||''))return memberResponse({error:'sign_in_required'},401);
  const tokenHash=createHash('sha256').update(token).digest('hex'),session=await repo.one('SELECT user_id,csrf FROM user_sessions WHERE token_hash=?',tokenHash);
  if(!session)return memberResponse({error:'sign_in_required'},401);
  const actor={id:session.user_id,tokenHash};await repo.assertActor(actor);
  const parts=path.split('/'),worldId=parts[4];
  if(parts[3]==='native-worlds'&&worldId){
   if(request.method==='GET'){const head=await repo.head(actor,worldId);return head?memberResponse({head}):memberResponse({error:'head_not_found'},404);}
   verifyUserWrite(request,env,session);const body=await readUserJSON(request,512*1024);
   if(request.method==='POST'&&parts[5]==='head')return memberResponse({head:await repo.seedHead(actor,{...body,worldId})});
   if(request.method==='PUT'&&parts.length===5&&body.world?.id===worldId){
    if(!body.sidecars||Object.entries(body.sidecars).some(([k,v])=>!['progress','position','discoveries'].includes(k)||typeof v!=='string'))return memberResponse({error:'invalid_sidecars'},400);
    const row=await repo.saveWorld(actor,{...body,validateWorld});return memberResponse({world:{...JSON.parse(row.data).world,ownerId:row.owner_id,cloudVersion:row.version},sidecars:JSON.parse(row.data).sidecars});
   }
  }
  if(parts[3]==='native-jobs'){
   if(request.method==='GET'){const url=new URL(request.url),job=await repo.job(actor,url.searchParams.get('worldId'),url.searchParams.get('operationId'));return job?memberResponse({job}):memberResponse({error:'job_not_found'},404);}
   if(request.method==='POST'&&parts.length===4){verifyUserWrite(request,env,session);const input=await readUserJSON(request);return memberResponse({job:await repo.admit(actor,input,{cap:String(p.imageDaily),userImageLimit:p.userImage})},202);}
  }
  return memberResponse({error:'method_not_allowed'},405);
 }catch(e){return memberResponse({error:e.status||e.message==='budget_precision_unverified'?e.message:'native_b10_unavailable'},e.status||503);}
}
