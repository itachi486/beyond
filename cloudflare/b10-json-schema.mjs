import {OBJECT_KINDS} from '../shared/edit-contract.mjs';
const bad=()=>{throw Object.assign(Error('invalid_nested_json'),{status:400});};
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,allowed)=>{if(!obj(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.keys(v).some(k=>!allowed.split(' ').includes(k)))bad();};
const text=(v,max)=>typeof v==='string'&&v.length<=max;
const optionalText=(v,max)=>v===undefined||text(v,max);
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
const range=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const ids=(v,max=100)=>Array.isArray(v)&&v.length<=max&&v.every(uuid)&&new Set(v).size===v.length;
const point=v=>{keys(v,'x y');if(!range(v.x,0,1)||!range(v.y,0,1))bad();};
export function nestedWorld(w){
 keys(w,'version id name description introduction visibility createdAt updatedAt theme objects graph starter backupFingerprint ownerId cloudVersion');
 if(!optionalText(w.introduction,2000)||w.visibility!==undefined&&w.visibility!=='private')bad();
 if(!optionalText(w.backupFingerprint,64))bad();
 if(w.ownerId!==undefined&&(typeof w.ownerId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(w.ownerId)))bad();
 if(w.cloudVersion!==undefined&&(!Number.isSafeInteger(w.cloudVersion)||w.cloudVersion<0))bad();
 if(w.starter!==undefined){keys(w.starter,'imageId version assetId hash');if(!['imageId','assetId','hash'].every(k=>optionalText(w.starter[k],k==='hash'?64:100)))bad();if(!Number.isSafeInteger(w.starter.version??1)||(w.starter.version??1)<1)bad();}
 for(const o of w.objects||[])keys(o,'id kind name x y size rotation layer');
 if(w.graph!==undefined){keys(w.graph,'characters connections contents');
 for(const c of w.graph.characters||[]){keys(c,'id worldId type name description position appearance contentIds createdAt updatedAt portalWorldId role centralCharacterId centralVersion uploadedAssetId uploadedKind tags sourceUrl creatorId personality appearancePrompt abilities visibility assetId imageUrl animationPreset');if(!optionalText(c.sourceUrl,12000)||!['centralCharacterId','uploadedAssetId','assetId','imageUrl'].every(k=>optionalText(c[k],k==='imageUrl'?2048:100)))bad();keys(c.position,'x y z');keys(c.appearance,'preset color scale rotation');if(c.appearance.rotation!==undefined)keys(c.appearance.rotation,'x y z');}
 for(const c of w.graph.connections||[])keys(c,'id worldId sourceCharacterId targetCharacterId type label description visibility');
 for(const c of w.graph.contents||[]){keys(c,'id worldId characterId type title body url sourceUrl referenceId createdAt updatedAt');if(!optionalText(c.referenceId,100))bad();}}
}
export function nestedSidecar(kind,v,{legacy=false}={}){
 if(kind==='position'){point(v);return;}
 if(kind==='discoveries'){keys(v,'version points');if(v.version!==1||!Array.isArray(v.points)||v.points.length>12)bad();const seen=new Set();for(const p of v.points){keys(p,'id characterId x y objective requires');if(!uuid(p.id)||seen.has(p.id)||!uuid(p.characterId)||!range(p.x,5,95)||!range(p.y,5,95)||p.objective!==undefined&&!text(p.objective,160)||p.requires!==undefined&&(!ids(p.requires,12)||!p.requires.every(id=>seen.has(id))))bad();seen.add(p.id);}return;}
 keys(v,'version found completed conversations clues currentPoint companion companionTask');
 if(!legacy&&['version','found','completed','conversations'].some(k=>!Object.hasOwn(v,k)))bad();
 if(v.version!==undefined&&v.version!==1)bad();for(const k of ['found','completed','clues'])if(v[k]!==undefined&&!ids(v[k]))bad();
 if(v.currentPoint!==undefined&&v.currentPoint!==null&&!uuid(v.currentPoint))bad();
 if(v.conversations!==undefined){if(!obj(v.conversations)||Object.keys(v.conversations).length>100)bad();for(const [id,messages]of Object.entries(v.conversations)){if(!/^[a-f0-9-]{36}(?::[a-f0-9-]{36})?$/.test(id)||!Array.isArray(messages)||messages.length>200)bad();for(const m of messages){keys(m,'role text');if(!['visitor','character'].includes(m.role)||!text(m.text,2000))bad();}}}
 if(v.companion!==undefined){const c=v.companion;keys(c,'characterId pointId assetId x y scale name description');if(!['characterId','pointId','assetId'].every(k=>uuid(c[k]))||!['x','y','scale'].every(k=>range(c[k],0,1))||!text(c.name,100)||(c.description===undefined?!legacy:!text(c.description,2000)))bad();}
 if(v.companionTask!==undefined&&v.companionTask!==null){const t=v.companionTask;keys(t,'message kind position operationId operation objectKind targetId state lastError');if(!text(t.message,1000)||!['edit','clarify'].includes(t.kind))bad();if(t.position!==undefined&&t.position!==null)point(t.position);if(t.operationId!==undefined&&(!text(t.operationId,100)||!/^[a-zA-Z0-9_-]{16,100}$/.test(t.operationId)))bad();if(t.operation!==undefined&&!['create','edit'].includes(t.operation))bad();if(t.objectKind!==undefined&&!OBJECT_KINDS.includes(t.objectKind))bad();if(t.targetId!==undefined&&t.targetId!==null&&!/^[a-zA-Z0-9_-]{1,100}$/.test(t.targetId))bad();if(t.state!==undefined&&!['IDLE','NEEDS_CLARIFICATION','READY','QUEUED','RUNNING','AWAITING_APPROVAL','APPROVED','SAVED','CANCELLED','FAILED','EXPIRED','RECOVERY_REQUIRED'].includes(t.state))bad();for(const k of ['objectKind','targetId','state','lastError'])if(t[k]!==undefined&&t[k]!==null&&!text(t[k],k==='lastError'?200:100))bad();}
}
