import{useEffect,useRef,useState,type ReactNode}from'react';
import{assertAccountContext,isAccountContextCurrent,scopedKeyFor,type AccountContext}from'../account/sessionScope';
import type{Version}from'./WorldImageEditor';
import './candidate-workspace.css';
export type CandidateAdjustment={scale:number;position:{x:number;y:number}};
type Request=(path:string,body?:unknown,signal?:AbortSignal)=>Promise<any>;
const base='/api/ai/world-edits';
const same=(a:CandidateAdjustment,b:CandidateAdjustment)=>Math.abs(a.scale-b.scale)<1e-8&&Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y)<1e-8;
const errors:Record<string,string>={candidate_not_editable:'This version is read-only. Its original is preserved.',candidate_source_conflict:'The source or world changed. Reload saved previews before continuing.',candidate_workspace_update_required:'This older preview has no verified description. Keep it, or send a new described request.',candidate_area_protected:'The requested area overlaps saved content. Reduce the size or choose another place.',candidate_region_out_of_bounds:'The requested area reaches outside the editable image. Move it inward or choose a smaller size.',candidate_target_position_locked:'The saved approved target keeps its position. Its size can still be refined.',edit_area_protected:'This place is protected by existing content. Choose another location.',world_version_conflict:'This world changed. Reload before creating a new preview.',request_pending:'This operation may still be running. Check its status; no new inference was submitted.',invalid_candidate_adjustments:'Choose a size from 50–150% and a valid image location.'};
export function CandidateWorkspace({candidate,scope,worldRevision,request,onResult,onRetained,onBusy,onDirty,imageReady,children}:{candidate:Version;scope:AccountContext;worldRevision:number|null;request:Request;onResult:(v:Version)=>void;onRetained:(v:Version)=>void|Promise<void>;onBusy:(v:boolean)=>void;onDirty:(v:boolean)=>void;imageReady:boolean;children:ReactNode}){
 const original:CandidateAdjustment={scale:candidate.previewScale||1,position:candidate.position};
 const key=scopedKeyFor(scope,'candidate-workspace:'+candidate.worldId+':'+candidate.requestId),opKey=key+':operation';
 const read=(k:string)=>{assertAccountContext(scope);try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}};
 const validDraft=(v:CandidateAdjustment|null):v is CandidateAdjustment=>!!v&&typeof v.scale==='number'&&Number.isFinite(v.scale)&&v.scale>=.5&&v.scale<=1.5&&!!v.position&&[v.position.x,v.position.y].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1);
 const [initial]=useState(()=>{const v=read(key)||candidate.workspaceDraft;return validDraft(v)?v:original;}),[adjust,setAdjust]=useState<CandidateAdjustment>(initial),[pending,setPending]=useState<{operationId:string;body:any}|null>(()=>read(opKey)),[running,setRunning]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),abort=useRef<AbortController|null>(null),editable=!candidate.approved&&!candidate.rejected,locked=candidate.actionType==='EDIT_EXISTING_WORLD_OBJECT',dirty=!same(adjust,original),enabled=editable&&!!candidate.visualPlan&&!!candidate.originalHash&&!!candidate.actionType;
 const w=candidate.width||1024,h=candidate.height||1024,rx=.09*adjust.scale,ry=.13*adjust.scale,areaFits=rx*w<=250&&ry*h<=250&&adjust.position.x>=rx&&adjust.position.x<=1-rx&&adjust.position.y>=ry&&adjust.position.y<=1-ry;
 useEffect(()=>{if(isAccountContextCurrent(scope))onDirty(dirty||!!pending);},[dirty,pending]);
 useEffect(()=>()=>{if(isAccountContextCurrent(scope))onDirty(false);abort.current?.abort();},[]);
 function change(next:CandidateAdjustment){assertAccountContext(scope);if(lock.current||pending)return;setAdjust(next);setError('');try{localStorage.setItem(key,JSON.stringify(next));}catch{setError('Local draft could not be stored. Use Save for later to keep it on the server.');}}
 async function act(kind:'create'|'retain'|'check'){
  if(lock.current)return;assertAccountContext(scope);lock.current=true;setRunning(true);onBusy(true);setError('');
  try{
   if(kind==='retain'){
    const d=await request(`${base}/${candidate.requestId}/retain`,{confirm:true,worldId:candidate.worldId,draft:adjust});assertAccountContext(scope);localStorage.removeItem(key);await onRetained(d.item);return;
   }
   if(kind==='check'){
    if(!pending)return;const d=await request(`${base}/${pending.operationId}/status?worldId=${encodeURIComponent(candidate.worldId)}`);assertAccountContext(scope);
    if(d.state!=='success'){setError('No completed version is confirmed yet. No automatic retry was made. Your original and this operation are preserved.');return;}
    if(d.item.derivedFrom!==candidate.requestId||d.item.worldId!==candidate.worldId)throw Error('candidate_source_conflict');
    localStorage.removeItem(opKey);localStorage.removeItem(key);setPending(null);onResult(d.item);return;
   }
   if(pending||!enabled||!dirty||!areaFits||!imageReady)return;
   const operationId=crypto.randomUUID(),body={contractVersion:1,semanticVersion:1,operationId,requestId:operationId,worldId:candidate.worldId,sourceHash:candidate.originalHash,expectedWorldRevision:worldRevision,parentId:candidate.parentId,targetId:candidate.targetId||null,actionType:candidate.actionType,objectKind:candidate.objectKind||'object',message:candidate.message,lore:candidate.lore,position:adjust.position,refinement:adjust};
   const op={operationId,body};localStorage.setItem(opKey,JSON.stringify(op));setPending(op);abort.current=new AbortController();
   const d=await request(`${base}/${candidate.requestId}/refine`,body,abort.current.signal);assertAccountContext(scope);localStorage.removeItem(opKey);localStorage.removeItem(key);setPending(null);onResult(d.item);
  }catch(e){
   if(isAccountContextCurrent(scope)){
    const code=e instanceof Error?e.message:'request_failed';
    const rejectedBeforeInference=['candidate_not_editable','candidate_source_conflict','candidate_workspace_update_required','candidate_region_out_of_bounds','candidate_area_protected','candidate_target_position_locked','edit_area_protected','world_version_conflict','invalid_candidate_adjustments','service_budget_exhausted','image_budget_exhausted','image_daily_limit_reached'].includes(code);
    if(rejectedBeforeInference){localStorage.removeItem(opKey);setPending(null);}
    setError(errors[code]||'The result could not be confirmed. The source is preserved; check the saved operation before any new inference.');
   }
  }finally{lock.current=false;abort.current=null;if(isAccountContextCurrent(scope)){setRunning(false);onBusy(false);}}
 }
 return <section className="candidate-workspace" aria-label="Candidate workspace">
  <div className="candidate-placement" style={{maxWidth:`${58*w/h}dvh`}} onClick={e=>{if(!enabled||locked||running||pending)return;const r=e.currentTarget.getBoundingClientRect();change({...adjust,position:{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}});}}>
   {children}{enabled&&dirty&&<span className="candidate-footprint" aria-hidden style={{left:`${adjust.position.x*100}%`,top:`${adjust.position.y*100}%`,width:`${rx*200}%`,height:`${ry*200}%`}}/>}
  </div>
  {editable&&<><p>Adjust the desired area, then create one new preview. This outline is an estimate, not an already resized object. AI results need review.</p>
   <fieldset disabled={running||!!pending||!enabled}><legend>Preview adjustments</legend>
    <label>Desired size: {Math.round(adjust.scale*100)}%<input aria-label="Desired preview size" type="range" min={50} max={150} step={5} value={Math.round(adjust.scale*100)} onChange={e=>change({...adjust,scale:Number(e.target.value)/100})}/></label>
    <label>Horizontal position: {(adjust.position.x*100).toFixed(1)}%<input aria-label="Preview horizontal position" type="range" min={0} max={1000} step={5} value={Math.round(adjust.position.x*1000)} disabled={locked} onChange={e=>change({...adjust,position:{...adjust.position,x:Number(e.target.value)/1000}})}/></label>
    <label>Vertical position: {(adjust.position.y*100).toFixed(1)}%<input aria-label="Preview vertical position" type="range" min={0} max={1000} step={5} value={Math.round(adjust.position.y*1000)} disabled={locked} onChange={e=>change({...adjust,position:{...adjust.position,y:Number(e.target.value)/1000}})}/></label>
    <button type="button" disabled={!dirty} onClick={()=>change(original)}>Reset adjustments</button>
   </fieldset>
   {!enabled&&<p>This older preview can be kept and reviewed. A new described request is needed for size/location refinement.</p>}
   {locked&&<p>The approved object's saved location stays fixed. Size changes remain a separate preview.</p>}
   {dirty&&!areaFits&&<p role="alert">Choose a smaller area or move it inward before generating.</p>}
   {dirty&&<p>These adjustments have not changed the saved image. Generate a new version before approving.</p>}
   <div className="candidate-workspace-actions"><button disabled={running||!!pending||!enabled||!dirty||!areaFits||!imageReady} onClick={()=>void act('create')}>Create adjusted preview</button><button disabled={running||!!pending} onClick={()=>void act('retain')}>Save for later</button>{pending&&<button disabled={running} onClick={()=>void act('check')}>Check refinement status</button>}{running&&abort.current&&<button onClick={()=>abort.current?.abort()}>Stop waiting</button>}</div>
   {running&&<p role="status">{abort.current?'Creating a new version; the original and prior preview are preserved…':'Saving or checking the preview…'}</p>}
  </>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
export function PreviewShelf({items,onOpen,disabled=false}:{items:Version[];onOpen:(v:Version)=>void;disabled?:boolean}){
 return <div className="candidate-shelf">{items.length?items.map(v=><button disabled={disabled} key={v.requestId} data-preview-id={v.requestId} onClick={()=>onOpen(v)}><strong>{v.message}</strong><span>{v.approved?'Approved':v.rejected?'Rejected':v.supersededBy?'Earlier preview':v.retained?'Saved for later':'Awaiting approval'} · {new Date(v.createdAt).toLocaleString()}</span>{v.derivedFrom&&<span>Adjusted version · requested size {Math.round((v.previewScale||1)*100)}%</span>}</button>):<p>No saved previews yet.</p>}</div>;
}
