import{companionActionIntent}from'../shared/companion-intent.mjs';
const parse=s=>{try{return JSON.parse(s||'{}');}catch{return{};}};
export function companionContext(db,session,input){
 const row=session?.role==='member'?db.prepare('SELECT data FROM user_worlds WHERE owner_id=? AND id=?').get(session.user_id,input.worldId):null,saved=parse(row?.data),world=saved.world||input.world||{},progress=parse(saved.sidecars?.progress),companion=progress.companion;
 const entries=companion?.characterId===input.characterId&&typeof companion.pointId==='string'?progress.conversations?.[companion.pointId+':'+input.characterId]:null;
 const savedHistory=(session.role==='member'?(Array.isArray(entries)?entries:Array.isArray(progress.conversations?.[companion?.pointId])?progress.conversations[companion.pointId]:[]):Array.isArray(input.history)?input.history:[]).filter(m=>m&&['visitor','character'].includes(m.role)&&typeof m.text==='string');
 const memory=savedHistory.filter(m=>m.role==='visitor').slice(-30).map(m=>m.text.slice(0,240)),history=savedHistory.slice(-12).map(m=>({role:m.role==='visitor'?'user':'assistant',content:m.text.slice(0,2000)}));
 const edits=db.prepare("SELECT response FROM workers_ai_requests WHERE actor=? AND id LIKE 'world-edit:%' AND status='success' ORDER BY created_at DESC LIMIT 100").all(session.admin_id).map(r=>parse(r.response)).filter(r=>r.worldId===input.worldId&&r.approved&&!r.rejected&&r.originalHash!==r.imageHash).slice(0,12);
 const landscape=world.starter&&session.role==='member'?parse(db.prepare("SELECT metadata FROM user_world_assets WHERE user_id=? AND id=? AND status='ready'").get(session.user_id,world.starter.assetId)?.metadata):{};
 const objectKind=label=>/별장|villa|cottage/i.test(label)?'villa':/공중다리|다리|skybridge|bridge/i.test(label)?'bridge':/농장|farm/i.test(label)?'farm':/정원|garden|jardín/i.test(label)?'garden':/폭포|waterfall/i.test(label)?'waterfall':/집|house|casa/i.test(label)?'house':'object';
 const seen=new Set(),anchors=edits.map((e,i)=>({id:e.objectId||e.imageHash||String(i),label:e.message,kind:e.objectKind||objectKind(e.message),x:e.position?.x,y:e.position?.y})).filter(a=>{if(seen.has(a.id))return false;seen.add(a.id);return true;});
 for(const o of (world.objects||[]).slice(0,20))anchors.push({id:o.id,label:o.name,kind:o.kind==='building'?'house':o.kind,x:o.x/1000,y:o.y/650});
 const pending=session.role==='member'?progress.companionTask||null:input.pending||null,intent=companionActionIntent(input.message,{pending,lastEdit:anchors.length>0});
 const valid=p=>p&&['x','y'].every(k=>Number.isFinite(p[k])&&p[k]>=0&&p[k]<=1),savedPosition=parse(saved.sidecars?.position),house=anchors.find(a=>a.kind==='house');
 let message=input.message,operationId=pending?.operationId||input.requestId,operation=pending?.operation||'create',targetId=pending?.targetId||null,object=pending?.objectKind||objectKind(message),position=valid(input.position)?input.position:valid(pending?.position)?pending.position:valid(savedPosition)?savedPosition:null,state=pending?.state||'IDLE',kind='chat';
 const contextual=intent==='CONFIRM_ACTION'||/더\s*(크|작)|bigger|smaller/i.test(message);
 if(contextual&&pending){message=/더\s*(크|작)|bigger|smaller/i.test(input.message)?pending.message+'; '+input.message:pending.message;object=pending.objectKind||objectKind(message);}
 if(contextual&&!pending&&intent==='EDIT_EXISTING_WORLD_OBJECT'&&anchors[0]){const last=anchors[0];object=last.kind;operation='edit';targetId=last.id;position=valid(last)?{x:last.x,y:last.y}:null;message=last.label+'; '+input.message;}
 if(intent==='CREATE_WORLD_OBJECT'||intent==='EDIT_EXISTING_WORLD_OBJECT'||intent==='NEEDS_CLARIFICATION'){
  if(!contextual){operationId=pending?.message===message?pending.operationId||input.requestId:input.requestId;object=objectKind(message);targetId=null;operation='create';}
  const target=anchors.find(a=>a.kind===object);
  if(intent==='EDIT_EXISTING_WORLD_OBJECT'){operation='edit';targetId=(contextual&&pending?.targetId)||target?.id||null;const actual=anchors.find(a=>a.id===targetId);position=actual&&valid(actual)?{x:actual.x,y:actual.y}:position;}
  if(operation==='create'&&['farm','garden'].includes(object)&&house&&(!position||Math.hypot(position.x-house.x,position.y-house.y)<.15||/옆|주변|beside|next to|around/.test(message)))position={x:house.x>.75?house.x-.18:Math.min(.95,house.x+.18),y:house.y};
 }
 if(operation==='edit'&&targetId){const actual=anchors.find(a=>a.id===targetId);position=actual&&valid(actual)?{x:actual.x,y:actual.y}:null;}
 if(['CREATE_WORLD_OBJECT','EDIT_EXISTING_WORLD_OBJECT','CONFIRM_ACTION'].includes(intent)){kind='edit';state=operation==='edit'&&!targetId||!position?'NEEDS_CLARIFICATION':'READY';}
 if(intent==='NEEDS_CLARIFICATION'){kind='clarify';state='NEEDS_CLARIFICATION';}
 if(intent==='CONFIRM_ACTION'&&(!pending||companionActionIntent(pending.message,{pending:null})==='CONFIRM_ACTION')){kind='clarify';state='NEEDS_CLARIFICATION';position=null;}
 if(intent==='CANCEL_ACTION'){kind='cancel';state='CANCELLED';}
 if(intent==='CHECK_USAGE')kind='usage';if(intent==='REPORT_ERROR')kind='error';if(intent==='INSPECT_WORLD')kind='inspect';
 if(intent==='EXPLORE_WORLD'){kind='explore';const target=anchors.find(a=>a.kind===object)||anchors[0];position=target&&valid(target)?{x:target.x,y:target.y}:null;}
 const task=operationId?db.prepare('SELECT status,response FROM workers_ai_requests WHERE actor=? AND id=?').get(session.admin_id,'world-edit:'+operationId):null;
 const versions=db.prepare("SELECT id,response FROM workers_ai_requests WHERE actor=? AND id LIKE 'world-edit:%' AND status='success' ORDER BY created_at DESC LIMIT 100").all(session.admin_id).map(r=>({...parse(r.response),requestId:r.id.slice(11)})).filter(r=>r.worldId===input.worldId);
 const candidate=versions.find(v=>!v.approved&&!v.rejected);
 if(kind==='cancel'&&task?.status==='pending')state='RUNNING';
 if(kind==='edit'||kind==='error'){
  if(task?.status==='pending')state='RUNNING';else if(task?.status==='error')state='FAILED';else if(task?.status==='success'){const v=parse(task.response);state=v.rejected?'CANCELLED':v.approved?'SAVED':'AWAITING_APPROVAL';}
  else if(candidate)state='AWAITING_APPROVAL';else if(kind==='error')state=pending?.state||'IDLE';
 }
 return{kind,intent,state,position,message:message.slice(0,1000),operationId,operation,objectKind:object,targetId,candidateId:candidate?.requestId||null,retrySafe:!task&&state!=='RUNNING',history,memory,world:{id:input.worldId,name:String(world.name||'').slice(0,100),description:String(world.description||world.lore||'').slice(0,2000),landscapeDescription:String(landscape.description||'').slice(0,2000),objects:(world.objects||[]).slice(0,20),approved:anchors},pending:pending?{message:String(pending.message||'').slice(0,1000)}:null};
}
// Tool observations/status are authoritative UI responses, never model inference.
export function companionToolReply(c,usage,actor){
 const ko=/[가-힣]/.test(c.message),say=(k,e)=>ko?k:e,point=c.position?`x=${c.position.x.toFixed(3)}, y=${c.position.y.toFixed(3)}`:'';
 if(c.kind==='usage'){
  const own=usage.rows.filter(r=>r.actor===actor),count=(kind,status,prefix)=>own.filter(r=>r.kind===kind&&r.status===status&&r.id.startsWith(prefix)).length;
  const data={chatSuccess:count('text','success','text:'),generationSuccess:count('image','success','image:'),editCandidates:count('image','success','world-edit:'),pendingImages:own.filter(r=>r.kind==='image'&&r.status==='pending'&&!r.id.startsWith('world-retry:')).length,imageDailyLimit:usage.policy.userImage,conversationDailyCountLimit:null,safetyReservations:usage.used,cloudflareActualNeurons:null};
  return{response:say(`오늘 저장된 대화 응답은 ${data.chatSuccess}건, 이미지 생성 추론 성공은 ${data.generationSuccess}건, 편집 후보 생성은 ${data.editCandidates}건, 대기 이미지 요청은 ${data.pendingImages}건입니다. 현재 계정별 이미지 생성·편집 공유 한도는 ${data.imageDailyLimit}회이며 대화 횟수 제한은 없습니다. 내부 예약량은 Cloudflare 실제 사용량이 아닙니다.`,`Today: ${data.chatSuccess} chat replies, ${data.generationSuccess} image generation inferences, ${data.editCandidates} edit candidates, ${data.pendingImages} pending image requests. The configured image limit is ${data.imageDailyLimit}; conversation has no per-user count limit. Reservations are not actual Cloudflare usage.`),usage:data};
 }
 if(c.kind==='inspect'){const houses=c.world.approved.filter(a=>a.kind==='house');return{response:houses.length?say(`저장된 세계에 승인된 집 기록이 있습니다 (${houses[0].x.toFixed(3)}, ${houses[0].y.toFixed(3)}). 승인 이미지와 위치 기록은 확인했지만, 지금 이미지를 시각 분석한 것은 아니므로 외형을 평가했다고 말할 수는 없습니다.`,`An approved house is saved at (${houses[0].x.toFixed(3)}, ${houses[0].y.toFixed(3)}). I checked saved records, not a new visual analysis.`):say('현재 세계에서 승인된 집이나 저장된 집 객체를 찾지 못했습니다. 생성 완료라고 말할 수 없습니다.','No approved house or saved house object was found in this world.' )};}
 if(c.kind==='error')return{response:say(`오류 보고로 확인했습니다. 저장된 작업 상태는 ${c.state}입니다. 현재 승인된 세계는 변경하지 않았습니다. ${c.retrySafe?'추론 중인 기록이 없어 같은 작업 ID로 요청을 다시 확인할 수 있습니다.':'기존 추론 기록이 있어 자동 재호출하지 않습니다. 완료된 후보 또는 실패 기록을 먼저 확인해야 합니다.'}`,`Error report: saved task state ${c.state}. The approved world is unchanged. ${c.retrySafe?'The same operation ID may be checked again.':'An existing inference record prevents automatic resubmission.'}`)};
 if(c.kind==='cancel'&&c.state==='RUNNING')return{response:say('제공자 추론이 아직 실행 중으로 기록돼 있습니다. 임의로 종료됐다고 표시하거나 재호출하지 않으며, 승인된 세계도 변경하지 않습니다. 완료 후 후보를 거절할 수 있습니다.','Provider inference is still pending. It cannot be claimed cancelled or resubmitted; the approved world remains unchanged.')};
 if(c.kind==='cancel')return{response:say('취소 요청을 확인했습니다. 미승인 후보는 거절 처리하며 승인된 세계는 되돌리지 않습니다. 실행 중인 제공자 추론을 중단했다고 주장하지 않습니다.','Cancellation requested. Unapproved previews will be rejected; approved changes remain. This does not claim to stop provider inference.')};
 if(c.kind==='explore')return{response:c.position?say(`저장된 장소 (${point})를 보여드리겠습니다. 새 지형을 생성하거나 발견했다고 주장하지 않습니다.`,`Viewing the saved place (${point}); no unseen terrain is generated.`):say('이동할 저장 위치가 없습니다. 보이지 않는 산 너머의 장소가 확인된 것처럼 설명하지 않겠습니다.','No saved destination exists beyond the visible world.')};
 if(c.state==='AWAITING_APPROVAL')return{response:say('이미 생성된 미승인 후보가 있습니다. 새 요청을 중복 실행하지 않고 기존 후보를 보여드리겠습니다. 승인하거나 거절해 주세요.','An unapproved preview already exists. Review it before another inference; no duplicate will run.')};
 if(c.state==='RUNNING'||c.state==='FAILED'||c.state==='SAVED'||c.state==='CANCELLED')return{response:say(`저장된 작업 상태는 ${c.state}입니다. 같은 작업을 새 ID로 중복 실행하지 않습니다.`,`Saved operation state: ${c.state}. No duplicate operation is submitted.`)};
 if(c.state==='NEEDS_CLARIFICATION'||c.kind==='clarify')return{response:say(c.operation==='edit'&&!c.targetId?'편집할 기존 객체를 찾지 못했습니다. 새로 만들려는 것인지 확인해 주세요.':!c.position?'세계 이미지에서 원하는 위치를 한 번 선택해 주세요. 선택하면 같은 요청으로 후보 생성을 진행합니다.':'이 위치에 실제 변경 후보를 만들어 볼까요?','Please confirm the target or choose a world location once; the saved request will continue.')};
 return{response:say(`${c.operation==='edit'?'기존 객체 편집':'새 객체 생성'} 요청을 준비했습니다 (${point}). 실제 실행 상태와 후보는 편집 서비스의 응답을 확인한 뒤 표시합니다. 승인 전에는 세계가 바뀌지 않습니다.`,`${c.operation==='edit'?'Existing-object edit':'New-object creation'} is ready (${point}). Execution and candidate status will follow the editing service response; approval is required.`)};
}
