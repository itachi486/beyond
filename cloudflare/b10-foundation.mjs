import {validateNativeJSON,validateNativeAssets} from './b10-validation.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {budgetUnits,effectiveBudgetUnits,KLEIN_UNITS,SQL_EFFECTIVE_UNITS,SQL_IMAGE_POOL} from './budget-fixed.mjs';
import {validateEditContract} from '../shared/edit-contract.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value);
export class B10Error extends Error{constructor(code,status=409){super(code);this.status=status;}}
const safeRevision=v=>Number.isSafeInteger(v)&&v>=0&&v<Number.MAX_SAFE_INTEGER;
const validId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function nativeRequestHash(input){
 // B10 job identity only. No provider dispatch or candidate/approval processing.
 return sha(json([2,input.worldId,input.actionType,input.objectKind,[input.position.x,input.position.y],input.targetId,input.parentId,input.sourceHash,input.expectedWorldRevision,input.expectedImageHeadRevision,input.message,input.characterId||null]));
}
export class B10Repository{
 constructor(binding,{daily='9000',textDaily='8000',imageDaily='1000',userImageLimit=3,media=null}={}){this.binding=binding;this.media=media;this.limits={daily:budgetUnits(daily),text:budgetUnits(textDaily),image:budgetUnits(imageDaily)};this.userImageLimit=userImageLimit;if(this.limits.daily>budgetUnits('10000')||this.limits.text+this.limits.image>this.limits.daily||!Number.isSafeInteger(userImageLimit)||userImageLimit<0||userImageLimit>20)throw new B10Error('invalid_budget_policy',400);}
 statement(sql,...args){return this.binding.prepare(sql).bind(...args);}
 async rows(sql,...args){const r=await this.binding.batch([this.statement(sql,...args)]);if(!r[0]?.success)throw new B10Error('native_read_failed',503);return r[0].results;}
 async one(sql,...args){return(await this.rows(sql,...args))[0]||null;}
 async active(){return !!(await this.one('SELECT active FROM b10_control WHERE id=1'))?.active;}
 async transaction(actor,condition,params,statements,{internal=false,purpose='native'}={}){
  if(!validId(actor.id))throw new B10Error('invalid_owner',400);
  const id=randomUUID(),authority=internal?'1':`EXISTS(SELECT 1 FROM user_sessions s JOIN user_accounts a ON a.id=s.user_id JOIN member_profiles p ON p.user_id=a.id WHERE a.id=? AND s.token_hash=? AND s.credential_version=a.credential_version AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND p.status='active')`;
  const authorityArgs=internal?[]:[actor.id,actor.tokenHash];
  const guard=`(SELECT active FROM b10_control WHERE id=1)=1 AND (SELECT ready=1 AND revision<9007199254740991 FROM cf_state WHERE id=1) AND NOT EXISTS(SELECT 1 FROM b10_deleted_owners WHERE owner_hash=?) AND (${authority}) AND (${condition})`;
  try{const result=await this.binding.batch([
   this.statement('INSERT INTO b10_context VALUES(1,?)',purpose),
   this.statement(`INSERT INTO b10_guards VALUES(?,CASE WHEN ${guard} THEN 1 ELSE 0 END)`,id,sha(actor.id),...authorityArgs,...params),
   ...statements,this.statement('UPDATE cf_state SET revision=revision+1 WHERE id=1'),
   this.statement('DELETE FROM b10_guards WHERE id=?',id),this.statement('DELETE FROM b10_context WHERE id=1'),
  ]);if(result.some(r=>!r.success))throw Error('batch_failed');}catch{throw new B10Error('native_conflict_or_authorization');}
 }
 async head(actor,worldId){return this.one('SELECT * FROM ai_world_heads WHERE owner_id=? AND world_id=?',actor.id,worldId);}
 async seedHead(actor,{worldId,sourceHash,parentId=null,expectedWorldRevision}){
  if(!hash(sourceHash)||!safeRevision(expectedWorldRevision)||!validId(worldId)||parentId!==null&&!validId(parentId))throw new B10Error('invalid_head',400);
  const old=await this.head(actor,worldId);if(old){if(old.source_hash!==sourceHash||old.parent_id!==parentId)throw new B10Error('head_conflict');await this.assertActor(actor);return old;}
  const source=parentId?`EXISTS(SELECT 1 FROM workers_ai_requests WHERE id=? AND actor=? AND status='success' AND json_extract(response,'$.worldId')=? AND json_extract(response,'$.approved')=1 AND json_extract(response,'$.imageHash')=?) AND NOT EXISTS(SELECT 1 FROM workers_ai_requests WHERE actor=? AND status='success' AND json_extract(response,'$.worldId')=? AND json_extract(response,'$.approved')=1 AND created_at>=(SELECT created_at FROM workers_ai_requests WHERE id=?) AND id<>?)`:
   `json_extract(w.data,'$.world.starter.hash')=? AND EXISTS(SELECT 1 FROM user_world_assets a WHERE a.user_id=w.owner_id AND a.id=json_extract(w.data,'$.world.starter.assetId') AND a.status='ready' AND a.hash=?) AND NOT EXISTS(SELECT 1 FROM workers_ai_requests WHERE actor=? AND status='success' AND json_extract(response,'$.worldId')=? AND json_extract(response,'$.approved')=1)`;
  const args=parentId?['world-edit:'+parentId,actor.id,worldId,sourceHash,actor.id,worldId,'world-edit:'+parentId,'world-edit:'+parentId]:[sourceHash,sourceHash,actor.id,worldId];
  await this.transaction(actor,`EXISTS(SELECT 1 FROM user_worlds w WHERE owner_id=? AND id=? AND version=? AND ${source})`,[actor.id,worldId,expectedWorldRevision,...args],[this.statement('INSERT INTO ai_world_heads(owner_id,world_id,head_revision,source_hash,parent_id) VALUES(?,?,0,?,?)',actor.id,worldId,sourceHash,parentId)]);
  // Zero is a verified native-era baseline, never an inferred historical count.
  return this.head(actor,worldId);
 }
 async assertActor(actor){
  const row=await this.one(`SELECT a.id FROM user_accounts a JOIN user_sessions s ON s.user_id=a.id JOIN member_profiles p ON p.user_id=a.id WHERE a.id=? AND s.token_hash=? AND s.credential_version=a.credential_version AND s.expires_at>? AND p.status='active'`,actor.id,actor.tokenHash,Date.now());
  if(!row)throw new B10Error('sign_in_required',401);
 }
 async saveWorld(actor,{world,sidecars,expectedWorldRevision,expectedImageHeadRevision,operationId,validateWorld}){
  if(!validateWorld?.(world)||world?.graph&&!validateWorld({...world,version:2})||!validId(operationId)||!safeRevision(expectedWorldRevision)||!safeRevision(expectedImageHeadRevision))throw new B10Error('invalid_world',400);
  validateNativeJSON(world,sidecars);
  await this.assertActor(actor);
  const assets=await validateNativeAssets(this,actor,world,this.media);
  const clean=structuredClone(world);delete clean.ownerId;delete clean.cloudVersion;const data=json({world:clean,sidecars}),requestHash=sha(json([data,expectedWorldRevision,expectedImageHeadRevision])),old=await this.one('SELECT * FROM user_worlds WHERE owner_id=? AND id=?',actor.id,world.id);
  await this.assertActor(actor);
  if(old&&json(JSON.parse(old.data).world.starter)!==json(clean.starter))throw new B10Error('native_source_change_requires_image_apply',400);
  if(old?.last_op_id===operationId){if(old.last_op_hash!==requestHash)throw new B10Error('request_conflict');return old;}
  const now=new Date().toISOString(),assetCondition=assets.map(()=>"EXISTS(SELECT 1 FROM user_world_assets a WHERE a.user_id=? AND a.id=? AND a.status='ready' AND a.hash=? AND a.file_key=? AND a.metadata=?)").join(' AND ');
  await this.transaction(actor,`EXISTS(SELECT 1 FROM user_worlds w JOIN ai_world_heads h ON h.owner_id=w.owner_id AND h.world_id=w.id WHERE w.owner_id=? AND w.id=? AND w.version=? AND h.head_revision=?)${assetCondition?' AND '+assetCondition:''}`,[actor.id,world.id,expectedWorldRevision,expectedImageHeadRevision,...assets.flatMap(a=>[actor.id,a.id,a.hash,a.file_key,a.metadata])],[
   this.statement('UPDATE user_worlds SET data=?,version=version+1,last_op_id=?,last_op_hash=?,updated_at=? WHERE owner_id=? AND id=?',data,operationId,requestHash,now,actor.id,world.id),
   this.statement('INSERT INTO user_world_revisions VALUES(?,?,?,?,?,?)',randomUUID(),actor.id,world.id,expectedWorldRevision+1,data,now),
  ]);return this.one('SELECT * FROM user_worlds WHERE owner_id=? AND id=?',actor.id,world.id);
 }
 async job(actor,worldId,operationId){await this.assertActor(actor);return this.one('SELECT * FROM ai_jobs WHERE owner_id=? AND world_id=? AND operation_id=?',actor.id,worldId,operationId);}
 async admit(actor,input,{day=new Date().toISOString().slice(0,10),cost='109.40349853515625',cap='1000',userImageLimit=this.userImageLimit}={}){
  const {expectedImageHeadRevision,...base}=input;
  const invalid=validateEditContract({...base,contractVersion:1});if(invalid)throw new B10Error(invalid,400);
  if(input.contractVersion!==2||!validId(input.operationId)||input.operationId.length<16||!validId(input.worldId)||!safeRevision(input.expectedWorldRevision)||!safeRevision(input.expectedImageHeadRevision)||!hash(input.sourceHash)||!['CREATE_WORLD_OBJECT','EDIT_EXISTING_WORLD_OBJECT'].includes(input.actionType))throw new B10Error('invalid_native_contract',400);
  if(typeof input.message!=='string'||!input.message.trim()||input.message.length>1000)throw new B10Error('invalid_message',400);
  await this.assertActor(actor);
  const requestHash=nativeRequestHash(input),existing=await this.job(actor,input.worldId,input.operationId);
  if(existing){if(existing.request_hash!==requestHash)throw new B10Error('request_conflict');const proof=await this.one('SELECT * FROM b10_budget_ledger WHERE id=?',existing.ledger_id);if(!proof||proof.reserved_units!==budgetUnits(proof.reserved_neurons).toString())throw new B10Error('budget_precision_unverified',503);return existing;}
  const saved=await this.one('SELECT data FROM user_worlds WHERE owner_id=? AND id=?',actor.id,input.worldId);if(!saved)throw new B10Error('world_not_found',404);
  const approved=(await this.rows("SELECT response FROM workers_ai_requests WHERE actor=? AND status='success' AND id LIKE 'world-edit:%'",actor.id)).map(r=>JSON.parse(r.response)).filter(r=>r.worldId===input.worldId&&r.approved&&!r.rejected);
  const target=input.actionType==='EDIT_EXISTING_WORLD_OBJECT'?approved.find(r=>(r.objectId||r.imageHash)===input.targetId):null;
  if(input.actionType==='EDIT_EXISTING_WORLD_OBJECT'&&(!target||target.objectKind!==input.objectKind||Math.abs(target.position.x-input.position.x)>1e-6||Math.abs(target.position.y-input.position.y)>1e-6))throw new B10Error('edit_target_conflict');
  if(target)input={...input,position:{...target.position}};
  if(input.characterId&&!await this.one('SELECT id FROM central_characters WHERE id=? AND active=1 AND deleted=0',input.characterId))throw new B10Error('character_not_published',404);
  if(!/^\d{4}-\d\d-\d\d$/.test(day)||day!==new Date().toISOString().slice(0,10))throw new B10Error('invalid_budget_day',400);
  const protectedPositions=[...approved.filter(r=>r!==target).map(r=>r.position),...(JSON.parse(saved.data).world.objects||[]).map(o=>({x:o.x/1000,y:o.y/650}))];
  if(protectedPositions.some(p=>((input.position.x-p.x)/.09)**2+((input.position.y-p.y)/.13)**2<=1))throw new B10Error('edit_area_protected');
  const units=budgetUnits(cost),capUnits=budgetUnits(cap);if(units!==KLEIN_UNITS||capUnits>this.limits.image||!Number.isSafeInteger(userImageLimit)||userImageLimit<0||userImageLimit>this.userImageLimit)throw new B10Error('invalid_budget',400);
  const rows=await this.rows('SELECT * FROM b10_budget_ledger WHERE day=?',day);
  // Audit the REAL->decimal boundary without altering old rows. Admission never
  // trusts an uncertified raw/units pair, including a legacy post-certification update.
  for(const row of rows){budgetUnits(row.reserved_neurons);if(row.reserved_units!==budgetUnits(row.reserved_neurons).toString())throw new B10Error('budget_precision_unverified',503);effectiveBudgetUnits(row);}
  const id=randomUUID(),ledgerId='world-edit:native-'+sha(json([actor.id,input.worldId,input.operationId])),now=new Date().toISOString();
  const condition=`EXISTS(SELECT 1 FROM user_worlds w JOIN ai_world_heads h ON h.owner_id=w.owner_id AND h.world_id=w.id WHERE w.owner_id=? AND w.id=? AND w.version=? AND h.head_revision=? AND h.source_hash=? AND h.parent_id IS ?) AND NOT EXISTS(SELECT 1 FROM b10_budget_ledger WHERE day=? AND reserved_units IS NULL) AND (SELECT COALESCE(SUM(${SQL_EFFECTIVE_UNITS}),0) FROM b10_budget_ledger WHERE day=? AND ${SQL_IMAGE_POOL})<=CAST(? AS INTEGER)-CAST(? AS INTEGER) AND (SELECT COUNT(*) FROM workers_ai_requests WHERE day=? AND actor=? AND kind='image' AND substr(id,1,12)<>'world-retry:' AND status IN ('pending','success'))<?`;
  const extraCondition=` AND ?=strftime('%Y-%m-%d','now') AND (SELECT COALESCE(SUM(${SQL_EFFECTIVE_UNITS}),0) FROM b10_budget_ledger WHERE day=?)<=CAST(? AS INTEGER)-CAST(? AS INTEGER)`;
  const args=[actor.id,input.worldId,input.expectedWorldRevision,input.expectedImageHeadRevision,input.sourceHash,input.parentId,day,day,capUnits.toString(),units.toString(),day,actor.id,userImageLimit,day,day,this.limits.daily.toString(),units.toString()];
  try{await this.transaction(actor,condition+extraCondition,args,[
   this.statement(`INSERT INTO workers_ai_requests(id,actor,kind,request_hash,day,reserved_neurons,status,response,created_at) VALUES(?,?,'image',?,?,?,'pending',NULL,?)`,ledgerId,actor.id,requestHash,day,cost,Date.now()),
   this.statement('INSERT INTO b10_ledger_certifications VALUES(?,?,?)',ledgerId,cost,units.toString()),
   this.statement(`INSERT INTO ai_jobs(id,owner_id,world_id,operation_id,request_hash,contract_version,world_revision,head_revision,source_hash,parent_id,target_id,input,state,cleanup_generation,ledger_id,budget_day,created_at,updated_at) SELECT ?,?,?,?,?,2,?,?,?,?,?,?,'QUEUED',cleanup_generation,?,?,?,? FROM ai_world_heads WHERE owner_id=? AND world_id=?`,id,actor.id,input.worldId,input.operationId,requestHash,input.expectedWorldRevision,input.expectedImageHeadRevision,input.sourceHash,input.parentId,input.targetId,json(input),ledgerId,day,now,now,actor.id,input.worldId),
  ]);}catch(e){const duplicate=await this.job(actor,input.worldId,input.operationId);if(duplicate&&duplicate.request_hash===requestHash)return duplicate;
   const used=await this.one(`SELECT CAST(COALESCE(SUM(${SQL_EFFECTIVE_UNITS}),0) AS TEXT) total,CAST(COALESCE(SUM(CASE WHEN ${SQL_IMAGE_POOL} THEN ${SQL_EFFECTIVE_UNITS} ELSE 0 END),0) AS TEXT) image FROM b10_budget_ledger WHERE day=?`,day);
   if(BigInt(used.image)+units>capUnits||BigInt(used.total)+units>this.limits.daily)throw new B10Error('image_budget_exhausted',429);
   const count=await this.one("SELECT COUNT(*) n FROM workers_ai_requests WHERE day=? AND actor=? AND kind='image' AND substr(id,1,12)<>'world-retry:' AND status IN ('pending','success')",day,actor.id);if(count.n>=userImageLimit)throw new B10Error('image_daily_limit_reached',429);throw e;}
  return this.job(actor,input.worldId,input.operationId);
 }
 async canFinalizeResult(ownerId,worldId,generation){
  if(!Number.isSafeInteger(generation)||generation<0)return false;
  // Internal ownership check only; expired user sessions do not erase dispatched results.
  return !!await this.one(`SELECT h.world_id FROM ai_world_heads h JOIN user_accounts a ON a.id=h.owner_id WHERE h.owner_id=? AND h.world_id=? AND h.cleanup_generation=? AND NOT EXISTS(SELECT 1 FROM b10_deleted_owners WHERE owner_hash=?) AND NOT EXISTS(SELECT 1 FROM member_deletions WHERE user_id=? AND phase IN ('cleaning','retry','done'))`,ownerId,worldId,generation,sha(ownerId),ownerId);
 }
 async fenceDueCleanup(ownerId,{expectedGenerations}={}){
  const input=expectedGenerations===undefined?await this.rows('SELECT world_id,cleanup_generation FROM ai_world_heads WHERE owner_id=?',ownerId):expectedGenerations;
  if(!Array.isArray(input)||input.length>20000)throw new B10Error('invalid_cleanup_generation',400);
  const heads=[],seen=new Set();
  for(let i=0;i<input.length;i++){
   const item=Object.getOwnPropertyDescriptor(input,String(i));
   if(!Object.hasOwn(input,i)||!item||!Object.hasOwn(item,'value'))throw new B10Error('invalid_cleanup_generation',400);
   const value=item.value;
   const world=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'world_id'):null;
   const generation=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'cleanup_generation'):null;
   if(!world||!generation||!Object.hasOwn(world,'value')||!Object.hasOwn(generation,'value')||!validId(world.value)||!Number.isSafeInteger(generation.value)||generation.value<0||generation.value>=Number.MAX_SAFE_INTEGER||seen.has(world.value))throw new B10Error('invalid_cleanup_generation',400);
   seen.add(world.value);heads.push({world_id:world.value,cleanup_generation:generation.value});
  }
  const cas=heads.map(()=>"EXISTS(SELECT 1 FROM ai_world_heads WHERE owner_id=? AND world_id=? AND cleanup_generation=?)").join(' AND ');
  await this.transaction({id:ownerId},`EXISTS(SELECT 1 FROM member_profiles p JOIN member_deletions d ON d.user_id=p.user_id WHERE p.user_id=? AND p.status='deletion_pending' AND p.delete_after<=? AND d.phase IN ('cleaning','retry')) AND (SELECT COUNT(*) FROM ai_world_heads WHERE owner_id=?)=?${cas?' AND '+cas:''}`,[ownerId,new Date().toISOString(),ownerId,heads.length,...heads.flatMap(h=>[ownerId,h.world_id,h.cleanup_generation])],[this.statement('UPDATE ai_world_heads SET cleanup_generation=cleanup_generation+1 WHERE owner_id=?',ownerId)],{internal:true,purpose:'cleanup-fence'});
 }
 async recordDeletedOwner(ownerId){
  if(await this.one('SELECT owner_hash FROM b10_deleted_owners WHERE owner_hash=?',sha(ownerId)))return;
  if(await this.one('SELECT id FROM user_accounts WHERE id=?',ownerId))throw new B10Error('owner_not_deleted');
  await this.transaction({id:ownerId},'NOT EXISTS(SELECT 1 FROM user_accounts WHERE id=?)',[ownerId],[this.statement('INSERT INTO b10_deleted_owners VALUES(?,?)',sha(ownerId),new Date().toISOString())],{internal:true,purpose:'deletion-audit'});
 }
}
