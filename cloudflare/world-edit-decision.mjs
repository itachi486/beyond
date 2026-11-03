import{createHash,randomUUID}from'node:crypto';
import{userToken,readUserJSON,memberResponse}from'./user-auth.mjs';
import{adminAllowedEmail}from'../server/auth.mjs';
import{studioEnabled,studioPrincipal}from'./admin-studio.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),tokenOK=t=>/^[A-Za-z0-9_-]{43}$/.test(t||''),fail=(status,error)=>{throw Object.assign(Error(error),{status});};
const clock="CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)";
const memberAuth=`SELECT s.*,u.id subject_id FROM user_sessions s JOIN user_accounts u ON u.id=s.user_id LEFT JOIN member_profiles p ON p.user_id=u.id WHERE s.token_hash=? AND s.expires_at>${clock} AND s.credential_version=u.credential_version AND COALESCE(p.status,'active')='active'`;
const adminAuth=`SELECT s.*,a.id subject_id FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>${clock} AND a.email=? AND (SELECT COUNT(*) FROM admins)=1`;
// Approval/rejection change only one existing ledger record. Never initialize sql.js,
// fetch/decode artwork, run a model, or rewrite a saved-world snapshot here.
export async function worldEditDecisionAPI(request,env){
 const url=new URL(request.url),match=url.pathname.match(/^\/api\/ai\/world-edits\/([^/]+)\/(approve|reject)$/);if(!match||env.BEYOND_STAGE!=='migration-preview')return null;
 const json=memberResponse,stmt=(sql,...args)=>env.DB.prepare(sql).bind(...args),batch=async list=>{const rows=await env.DB.batch(list);if(rows.some(r=>!r.success))throw Error('decision_storage_unavailable');return rows;},one=async(sql,...args)=>(await batch([stmt(sql,...args)]))[0].results[0];
 try{
  if(request.method!=='POST')fail(405,'method_not_allowed');
  if(!(await one('SELECT ready FROM cf_state WHERE id=1'))?.ready)fail(503,'decision_state_unavailable');
  let authSQL=memberAuth,params=[],kind='member',auth=null;const member=userToken(request,env);
  if(tokenOK(member)){params=[sha(member)];auth=await one(authSQL,...params);}
  if(!auth){const token=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-beyond_admin='))?.slice(20),allowed=adminAllowedEmail(env);if(allowed&&tokenOK(token)){authSQL=adminAuth;params=[sha(token),allowed];auth=await one(authSQL,...params);kind=studioEnabled(env)?'studio':'admin';}}
  if(!auth)fail(401,'sign_in_required');
  if(request.headers.get('origin')!==env.APP_ORIGIN||!request.headers.get('content-type')?.startsWith('application/json')||request.headers.get('x-csrf-token')!==auth.csrf)fail(403,'request_verification_failed');
  const input=await readUserJSON(request,1024);if(!input||typeof input!=='object'||Array.isArray(input)||input.confirm!==undefined&&input.confirm!==true)fail(400,'invalid_input');
  const id=decodeURIComponent(match[1]);if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))fail(404,'not_found');
  const actor=kind==='studio'?studioPrincipal(auth.subject_id):auth.subject_id,worldTable=kind==='studio'?'admin_personal_worlds':'user_worlds';
  const row=await one("SELECT response FROM workers_ai_requests WHERE id=? AND actor=? AND status='success'",'world-edit:'+id,actor);if(!row)fail(404,'not_found');
  const record=JSON.parse(row.response);if(typeof record.worldId!=='string')fail(404,'not_found');
  const world=kind==='admin'?null:await one(`SELECT version FROM ${worldTable} WHERE owner_id=? AND id=?`,actor,record.worldId);if(kind!=='admin'&&!world)fail(404,'not_found');
  const activeSQL="SELECT id FROM workers_ai_requests WHERE actor=? AND status='success' AND id LIKE 'world-edit:%' AND json_extract(response,'$.worldId')=? AND json_extract(response,'$.approved')=1 ORDER BY created_at DESC,rowid DESC LIMIT 1",activeArgs=[actor,record.worldId];
  const active=(await one(activeSQL,...activeArgs))?.id||'',approve=match[2]==='approve';
  if(approve){if(record.rejected)fail(409,'candidate_rejected');if(record.approved&&active!=='world-edit:'+id)fail(409,'world_version_conflict');if(!record.approved&&active!==(record.parentId?'world-edit:'+record.parentId:''))fail(409,'world_version_conflict');if(record.approved)return json({item:{...record,requestId:id},cached:true});}
  else{if(record.approved)fail(409,'approved_version_cannot_be_rejected');if(record.rejected)return json({item:{...record,requestId:id},cached:true});}
  const hasControl=!!await one("SELECT name FROM sqlite_master WHERE type='table' AND name='b10_control'");if(hasControl&&(await one('SELECT active FROM b10_control WHERE id=1'))?.active)fail(409,'native_writer_required');
  const guardId='world-decision:'+randomUUID(),checks=[`EXISTS(${authSQL} AND s.csrf=?)`,"EXISTS(SELECT 1 FROM workers_ai_requests WHERE id=? AND actor=? AND status='success' AND response=?)"],args=[...params,auth.csrf,'world-edit:'+id,actor,row.response];
  if(kind!=='admin'){checks.push(`EXISTS(SELECT 1 FROM ${worldTable} WHERE owner_id=? AND id=? AND version=?)`);args.push(actor,record.worldId,world.version);}
  if(approve){checks.push(`COALESCE((${activeSQL}),'')=?`);args.push(...activeArgs,active);}
  if(hasControl)checks.push('NOT EXISTS(SELECT 1 FROM b10_control WHERE active<>0)');
  checks.push('(SELECT ready=1 AND revision<9007199254740991 FROM cf_state WHERE id=1)');
  const next={...record,[approve?'approved':'rejected']:true};
  try{await batch([stmt(`INSERT INTO cf_commit_guards(id,ok) VALUES(?,CASE WHEN ${checks.join(' AND ')} THEN 1 ELSE 0 END)`,guardId,...args),stmt("UPDATE workers_ai_requests SET response=? WHERE id=? AND actor=? AND status='success' AND response=?",JSON.stringify(next),'world-edit:'+id,actor,row.response),stmt('UPDATE cf_state SET revision=revision+1 WHERE id=1'),stmt('DELETE FROM cf_commit_guards WHERE id=?',guardId)]);}
  catch{
   // A lost commit response is ambiguous. Do not report failure as proof of no save.
   if(!await one(authSQL,...params))fail(401,'sign_in_required');
   const current=await one("SELECT response FROM workers_ai_requests WHERE id=? AND actor=? AND status='success'",'world-edit:'+id,actor);
   if(current?.response===JSON.stringify(next)&&(!approve||(await one(activeSQL,...activeArgs))?.id==='world-edit:'+id))return json({item:{...next,requestId:id},cached:true});
   if(kind!=='admin'&&(await one(`SELECT version FROM ${worldTable} WHERE owner_id=? AND id=?`,actor,record.worldId))?.version!==world.version)fail(409,'world_version_conflict');
   if((current&&current.response!==row.response)||(approve&&((await one(activeSQL,...activeArgs))?.id||'')!==active))fail(409,'world_version_conflict');
   fail(503,'decision_outcome_unknown');
  }
  return json({item:{...next,requestId:id}});
 }catch(e){return json({error:e.status?e.message:'decision_outcome_unknown'},e.status||503);}
}
