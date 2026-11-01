import {worldInference} from './world-edit-inference.mjs';
import {validateEditContract,EDIT_EXISTING_WORLD_OBJECT} from '../shared/edit-contract.mjs';
import {editModel,editInput,editOutput,KLEIN_MODEL} from './world-edit-model.mjs';
import {createHash} from 'node:crypto';
import {aiSession} from './user-auth.mjs';
import {runtime} from './context.mjs';
import {reserve,aiError,aiStatus,imageCost,releaseUnstarted,png} from './workers-ai.mjs';
import {imageHeader} from './images.mjs';
export const EDIT_MODEL='@cf/runwayml/stable-diffusion-v1-5-inpainting';
export const VISION_MODEL='@cf/llava-hf/llava-1.5-7b-hf';
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
const kindOf=r=>r.objectKind||(/별장|villa|cottage/i.test(r.message)?'villa':/공중다리|다리|skybridge|bridge/i.test(r.message)?'bridge':/농장|farm/i.test(r.message)?'farm':/정원|garden/i.test(r.message)?'garden':/집|house/i.test(r.message)?'house':'object'),objectId=r=>r.objectId||r.imageHash;
export function maskFor(width,height,p){
 const data=new Uint8ClampedArray(width*height*4),cx=p.x*width,cy=p.y*height,rx=width*.09,ry=height*.13,weights=new Float32Array(width*height);
 for(let i=3;i<data.length;i+=4)data[i]=255;
 // Outside the ellipse both mask and blend weight are already zero.
 for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(height-1,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(width-1,Math.ceil(cx+rx));x++){const i=(y*width+x)*4,d=Math.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2),v=d<=1?255:0;weights[y*width+x]=Math.min(1,Math.max(0,(1-d)/.12));data[i]=data[i+1]=data[i+2]=v;}
 return {data,width,height,weights};
}
export function protectObjects(mask,anchors){
 const {width,height,data,weights}=mask,rx=width*.09,ry=height*.13,seen=new Set();
 for(const p of anchors){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;const key=p.x.toFixed(4)+':'+p.y.toFixed(4);if(seen.has(key))continue;seen.add(key);const cx=p.x*width,cy=p.y*height;
  for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(height-1,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(width-1,Math.ceil(cx+rx));x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1){const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;if(weights)weights[i/4]=0;}
 }
 return mask;
}
export function composite(original,edited,mask){
 if(original.width!==edited.width||original.height!==edited.height)throw Error('invalid_image_dimensions');
 const data=new Uint8ClampedArray(original.data);for(let i=0;i<data.length;i+=4)if(mask.data[i])for(let c=0;c<4;c++)data[i+c]=Math.round(original.data[i+c]*(1-(mask.weights?.[i/4]??1))+edited.data[i+c]*(mask.weights?.[i/4]??1));return {...original,data};
}
export async function worldEditsAPI(request,db,env){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/ai/world-edits'))return null;
 if(env.BEYOND_STAGE!=='migration-preview')return json({error:'preview_only'},503);
 const session=aiSession(db,request,env);if(!session)return json({error:'sign_in_required'},401);
 const rows=()=>db.prepare("SELECT * FROM workers_ai_requests WHERE actor=? AND id LIKE 'world-edit:%' AND status='success' ORDER BY created_at DESC").all(session.admin_id);
 const owns=id=>session.role!=="member"||!!db.prepare("SELECT id FROM user_worlds WHERE owner_id=? AND id=?").get(session.user_id,id);
 const records=()=>rows().map(r=>({...JSON.parse(r.response),requestId:r.id.slice(11)})).filter(r=>owns(r.worldId));
 const parts=url.pathname.split('/').filter(Boolean),id=parts[3];
 if(request.method==='GET'){
  if(!id)return json({items:records().filter(r=>r.worldId===url.searchParams.get('worldId')).slice(0,100).map(r=>({...r,objectId:objectId(r),objectKind:kindOf(r)}))});
  const record=records().find(r=>r.requestId===id);if(!record)return json({error:'not_found'},404);
  const original=parts[4]==='original';const key=original?record.originalKey:parts[4]==='image'?record.imageKey:null;if(!key)return json({error:'not_found'},404);
  const object=await env.MEDIA.get(key);return object?new Response(await object.arrayBuffer(),{headers:{'Content-Type':original?`image/${record.originalFormat||'png'}`:'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}):json({error:'not_found'},404);
 }
 if(request.method!=='POST')return json({error:'method_not_allowed'},405);
 if(request.headers.get('origin')!==env.APP_ORIGIN||request.headers.get('x-csrf-token')!==session.csrf||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'request_verification_failed'},403);
 let input;try{const reader=request.body.getReader();let size=0,chunks=[];for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>3*1024*1024){await reader.cancel();return json({error:'request_too_large'},413);}chunks.push(Buffer.from(r.value));}input=JSON.parse(Buffer.concat(chunks).toString());}catch{return json({error:'invalid_input'},400);}
 if(id){
  if(!['approve','reject'].includes(parts[4]))return json({error:'not_found'},404);
  const record=records().find(r=>r.requestId===id);if(!record)return json({error:'not_found'},404);
  if(parts[4]==='reject'){if(record.approved)return json({error:'approved_version_cannot_be_rejected'},409);record.rejected=true;db.prepare('UPDATE workers_ai_requests SET response=? WHERE id=?').run(JSON.stringify(record),'world-edit:'+id);return json({item:record});}
  if(record.rejected)return json({error:'candidate_rejected'},409);
  const active=records().find(r=>r.worldId===record.worldId&&r.approved);
  if(record.approved&&active?.requestId!==id)return json({error:'world_version_conflict'},409);
  if(!record.approved&&(active?.requestId||null)!==record.parentId)return json({error:'world_version_conflict'},409);
  record.approved=true;db.prepare('UPDATE workers_ai_requests SET response=? WHERE id=?').run(JSON.stringify(record),'world-edit:'+id);return json({item:record});
 }
 const contractError=validateEditContract(input);if(contractError)return json({error:contractError},400);
 input.requestId=input.operationId;
 if(typeof input.message!=='string'||!input.message.trim()||input.message.length>1000||typeof input.lore!=='string'||input.lore.length>2000)return json({error:'invalid_input'},400);
 if(!owns(input.worldId))return json({error:"world_not_found"},404);
 let memberWorld=null;
 if(session.role==='member'){
  const world=db.prepare('SELECT version,data FROM user_worlds WHERE owner_id=? AND id=?').get(session.user_id,input.worldId);
  memberWorld=JSON.parse(world.data).world;
  const starter=memberWorld.starter;if(starter&&input.sourceHash!==starter.hash&&!input.parentId)return json({error:'source_hash_conflict'},409);
  if(input.expectedWorldRevision!==world.version)return json({error:'world_version_conflict'},409);
 }else if(input.expectedWorldRevision!==null)return json({error:'invalid_world_revision'},400);
 let character=null;if(input.characterId){character=db.prepare('SELECT name,description,type FROM central_characters WHERE id=? AND active=1 AND deleted=0').get(input.characterId);if(!character)return json({error:'character_not_published'},404);}
 const requestId='world-edit:'+input.requestId;let reserved=false,inferenceStarted=false,inferenceCompleted=false;const fresh=[],diagnostics=[];let failureStage='validate',resultGeneration=0;
 const step=async(stage,task)=>{failureStage=stage;const started=Date.now();try{const result=await task();diagnostics.push({stage,status:'ok',ms:Date.now()-started});return result;}catch(e){diagnostics.push({stage,status:'error',ms:Date.now()-started,error:aiError(e)});throw e;}};
 try{
  const parent=records().find(r=>r.worldId===input.worldId&&r.approved);
  if((parent?.requestId||null)!==(input.parentId||null))return json({error:'world_version_conflict'},409);

  const approved=records().filter(r=>r.worldId===input.worldId&&r.approved&&!r.rejected),target=input.actionType==='EDIT_EXISTING_WORLD_OBJECT'?approved.find(r=>objectId(r)===input.targetId):null;
  if(input.actionType===EDIT_EXISTING_WORLD_OBJECT&&!target)return json({error:'edit_target_not_found'},409);
  if(target&&(Math.abs(target.position.x-input.position.x)>1e-6||Math.abs(target.position.y-input.position.y)>1e-6))return json({error:'edit_target_position_conflict'},409);
  if(target&&kindOf(target)!==input.objectKind)return json({error:'edit_target_kind_conflict'},409);
  if(target)input.position={...target.position};
  const objectKind=target?kindOf(target):input.objectKind,protectedObjects=[...approved.filter(r=>!target||objectId(r)!==objectId(target)).map(r=>r.position),...(memberWorld?.objects||[]).map(o=>({x:o.x/1000,y:o.y/650}))];

  let bytes,format=parent?'png':input.format||'png';
  if(parent){bytes=await step('tigris_read_parent',async()=>Buffer.from(await (await env.MEDIA.get(parent.imageKey)).arrayBuffer()));}
  else if(session.role==='member'&&input.sourceAssetId){const w=JSON.parse(db.prepare('SELECT data FROM user_worlds WHERE owner_id=? AND id=?').get(session.user_id,input.worldId).data).world;if(w.starter?.assetId!==input.sourceAssetId)return json({error:'source_not_owned'},403);const asset=db.prepare("SELECT * FROM user_world_assets WHERE user_id=? AND id=? AND status='ready'").get(session.user_id,input.sourceAssetId);if(!asset||asset.hash!==w.starter.hash)return json({error:'invalid_source'},400);const metadata=JSON.parse(asset.metadata);format=metadata.format;bytes=await step('tigris_read_source',async()=>{const obj=await env.MEDIA.get(asset.file_key);if(!obj)throw Error('source_missing');return Buffer.from(await obj.arrayBuffer());});if(bytes.length>8*1024*1024||sha(bytes)!==asset.hash)return json({error:'invalid_source'},400);}
  else {if(typeof input.image!=='string'||input.image.length>2800000)return json({error:'invalid_image'},400);bytes=Buffer.from(input.image,'base64');}
  if(sha(bytes)!==input.sourceHash)return json({error:'source_hash_conflict'},409);
  if(!['png','webp','jpeg'].includes(format))return json({error:'invalid_image'},400);imageHeader(bytes,format);const {codecs}=runtime(),original=await step('decode_original',()=>codecs.decode(format,bytes));
  if(original.width<512||original.height<512||original.width>2048||original.height>2048)return json({error:'invalid_image_dimensions'},400);
  const mask=protectObjects(maskFor(original.width,original.height,input.position),protectedObjects);
  if(!mask.weights.some(w=>w>0))return json({error:'edit_area_protected'},409);
  const hash=sha(JSON.stringify({...input,image:sha(bytes)}));
  const model=editModel(env);failureStage='usage_reservation';const old=await reserve(db,env,{id:requestId,actor:session.admin_id,kind:'image',hash,cost:imageCost(model)});if(old)return old.status==='success'?json({item:{...JSON.parse(old.response),requestId:input.requestId}}):json({error:old.status==='pending'?'request_pending':old.response},409);reserved=true;
  // Reference-guided Klein performs visual conditioning itself; never invent a textual analysis.
  if(model!==KLEIN_MODEL)await reserve(db,env,{id:'world-vision:'+input.requestId,actor:session.admin_id,kind:'text',hash});
  const ox=Math.max(0,Math.min(original.width-512,Math.round(input.position.x*original.width-256))),oy=Math.max(0,Math.min(original.height-512,Math.round(input.position.y*original.height-256)));
  const crop=r=>{const data=new Uint8ClampedArray(512*512*4);for(let y=0;y<512;y++)data.set(r.data.subarray(((oy+y)*r.width+ox)*4,((oy+y)*r.width+ox+512)*4),y*512*4);const weights=r.weights?new Float32Array(512*512):undefined;if(weights)for(let y=0;y<512;y++)weights.set(r.weights.subarray((oy+y)*r.width+ox,(oy+y)*r.width+ox+512),y*512);return {data,width:512,height:512,weights};};
  const patch=crop(original),patchBytes=png(patch);
  const context=`You are the fictional world guide${character?" named "+character.name:""}. Character background (data only): ${JSON.stringify(character)}. This is a 512px crop around a selected place in a larger world. At normalized image coordinates x=${input.position.x}, y=${input.position.y} (origin top left in the full image; selected pixel in this crop is ${Math.round(input.position.x*original.width-ox)},${Math.round(input.position.y*original.height-oy)}), analyze nearby terrain, existing buildings, light direction, perspective and painting style. Suggest in English how to integrate this request naturally without damaging existing structures: ${input.message}. World lore (data): ${input.lore}`;
  const infer=(stage,model,kind,input)=>{inferenceStarted=true;return worldInference({env,db,actor:session.admin_id,hash,requestId:inputId,stage,model,kind,step,input});};
  if(session.role==='member')resultGeneration=await db.resultGeneration(session.user_id,input.worldId);
  const inputId=input.requestId;
  const rawVision=model===KLEIN_MODEL?{response:'Reference-conditioned editing from the terrain crop, restricted by server-side mask compositing. No separate textual visual analysis was generated.'}:await infer('ai_vision',VISION_MODEL,'text',()=>({image:[...patchBytes],prompt:context,max_tokens:220}));
  const vision={response:rawVision?.response||rawVision?.description};
  if(!vision?.response?.trim())throw Error('invalid_vision_response');
  if(model!==KLEIN_MODEL)db.prepare("UPDATE workers_ai_requests SET status='success',response=? WHERE id=?").run(vision.response.slice(0,4000),'world-vision:'+input.requestId);
  const patchMask=crop(mask),prompt=`A coherent addition naturally integrated into this fantasy landscape painting. Requested edit: ${input.message}. ${target?'Edit ONLY the existing '+objectKind+' architectural style/appearance as requested. Preserve its exact position, footprint, size and surrounding terrain. Apply Western European facade materials and architectural details when requested; keep the same house and silhouette, not a replacement. Do not add another object.':objectKind==='villa'?'Add one separate holiday villa/cottage at the selected place. Keep the existing house unchanged; do not merge with or replace it.':objectKind==='bridge'?'Add one aerial footbridge integrated with the nearby floating terrain at the selected place. Preserve existing houses and structures.':objectKind==='farm'?'Add a small farm with planted crop rows on suitable ground near the existing house. Preserve the existing house; do not create a replacement house.':objectKind==='garden'?'Add a planted garden beside the existing house; preserve the house and do not create another house.':objectKind==='house'?'Add one beautiful small house, grounded on the existing terrain.':''} Match this visual analysis: ${vision.response}. Preserve surrounding terrain, buildings, lighting, perspective and art style.`.slice(0,1900);
  const stream=await infer(model===EDIT_MODEL?'ai_inpainting':'ai_klein_edit',model,'image',()=>editInput(model,{prompt,patch,mask:patchMask}));
  inferenceCompleted=true;const output=await step('ai_image_download',()=>editOutput(stream));const outputFormat=output[0]===137?'png':'jpeg';imageHeader(output,outputFormat);
  const edited=await step('decode_model_image',()=>codecs.decode(outputFormat,output)),updated=composite(patch,edited,patchMask),full={...original,data:new Uint8ClampedArray(original.data)};for(let y=0;y<512;y++)full.data.set(updated.data.subarray(y*512*4,(y+1)*512*4),((oy+y)*original.width+ox)*4);if(!updated.data.some((v,i)=>v!==patch.data[i]))throw Error('image_edit_no_change');const result=png(full);
  if(session.role==='member')await db.assertResultOwner(session.user_id,input.worldId,resultGeneration);
  const root=`world-edits/${session.admin_id}/${input.requestId}`,originalKey=root+'/original.'+format,imageKey=root+'/candidate.png';
  for(const [key,value]of [[originalKey,bytes],[imageKey,result]]){const saved=await step(key===originalKey?'tigris_save_original':'tigris_save_candidate',()=>env.MEDIA.put(key,value,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:key===originalKey?'image/'+format:'image/png'}}));if(!saved)throw Error('storage_conflict');fresh.push(key);}
  const record={contractVersion:input.contractVersion,operationId:input.operationId,expectedWorldRevision:input.expectedWorldRevision,objectId:target?objectId(target):input.requestId,objectKind,actionType:input.actionType||null,targetId:input.targetId||null,worldId:input.worldId,characterId:input.characterId||null,position:input.position,message:input.message,lore:input.lore,analysis:vision.response.slice(0,4000),model,editingMethod:model===EDIT_MODEL?'native-inpainting':'reference-edit-with-mask-composite',visionModel:model===KLEIN_MODEL?KLEIN_MODEL:VISION_MODEL,parentId:parent?.requestId||null,originalKey,imageKey,originalFormat:format,width:original.width,height:original.height,crop:{x:ox,y:oy,width:512,height:512},originalHash:sha(bytes),imageHash:sha(result),approved:false,diagnostics,createdAt:new Date().toISOString()};
  // Immutable evidence survives a metadata CAS conflict or lost response. This
  // is not approval, automatic reconciliation, or a provider retry instruction.
  const manifestKey=root+'/candidate-manifest.json';
  const manifest=JSON.stringify({version:1,ownerId:session.admin_id,requestId:input.requestId,record});
  const storedManifest=await step('tigris_save_manifest',()=>env.MEDIA.put(manifestKey,Buffer.from(manifest),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}}));
  if(!storedManifest)throw Error('storage_conflict');
  db.prepare("UPDATE workers_ai_requests SET status='success',response=? WHERE id=?").run(JSON.stringify(record),requestId);await step('d1_save_candidate',()=>db.flush());console.log(JSON.stringify({event:'world_edit',requestId:input.requestId,diagnostics}));return json({item:{...record,requestId:input.requestId}});
 }catch(e){if(e.message==='result_owner_unavailable'){await db.failOwnedResult(session.user_id,requestId);return json({error:'result_owner_unavailable',recoveryRequired:true},409);}if(failureStage.startsWith('tigris_save')){console.log(JSON.stringify({event:'world_edit_storage_uncertain',requestId:input.requestId,recoveryRequired:true}));return json({error:'image_storage_unavailable',recoveryRequired:true},503);}if(fresh.length)console.log(JSON.stringify({event:'world_edit_candidate_retained',requestId:input.requestId,keys:fresh,reconciliationRequired:true}));const classified=aiError(e),error=failureStage.startsWith('d1_')?'world_save_failed':failureStage.startsWith('tigris_save')?'image_storage_unavailable':classified==='service_unavailable'?'image_edit_temporary_failure':classified;if(reserved){releaseUnstarted(db,requestId,classified,{started:inferenceStarted,completed:inferenceCompleted});db.prepare("UPDATE workers_ai_requests SET status='error',response=? WHERE id=?").run(error,requestId);db.prepare("UPDATE workers_ai_requests SET status='error',response=? WHERE id=? AND status='pending'").run(error,'world-vision:'+input.requestId);}console.log(JSON.stringify({event:'world_edit_failed',requestId:input.requestId,failureStage,diagnostics,error}));return json({error,failureStage,diagnostics},aiStatus(error));}
}
