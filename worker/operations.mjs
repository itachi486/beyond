import {BackendError} from './supabase.mjs';
const json=value=>Response.json(value,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const editorial=r=>({...JSON.parse(r.data),id:r.id,slug:r.slug,status:r.status,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at});
export async function handleOperations(request,ctx,backend,rpc){
 const url=new URL(request.url),path=url.pathname;
 const supported=['dashboard','fantasy-overview','activity','settings','deletion-jobs'];
 const key=path.slice('/api/admin/'.length);
 if(request.method!=='GET'||!supported.includes(key))return null;
 const result=await rpc(backend,'beyond_edge_editorial',{allowed_email:ctx.allowed,session_hash:ctx.hash});
 if(result.status!==200)throw new BackendError(401,'Administrator session expired.');
 const grouped=Object.groupBy(result.records,r=>r.collection),rows=kind=>(grouped[kind]||[]).map(r=>r.record);
 const worlds=rows('worlds').map(editorial),discoveries=rows('discoveries').map(editorial),revisions=rows('revisions');
 if(key==='settings'){const settings=rows('settings').find(r=>r.id===1);return json(settings?JSON.parse(settings.data):{defaultLanguage:'en'});}
 if(key==='deletion-jobs')return json({items:[],scope:'Local deletion recovery journal preserved in migration; cloud permanent deletion is disabled.'});
 const active=await(await backend('/rest/v1/beyond_active_batch?select=batch_id')).json();
 if(active.length!==1)throw new BackendError(503,'Active cloud dataset unavailable.');
 const batch=encodeURIComponent(active[0].batch_id),additional=[];
 for(let offset=0;;){
   const response=await backend(`/rest/v1/beyond_records?select=collection,record&batch_id=eq.${batch}&collection=in.(central_characters,central_activity,ai_character_assets)&order=ordinal.asc`,{headers:{Range:`${offset}-${offset+499}`,Prefer:'count=exact'}});
   const page=await response.json(),total=Number(response.headers.get('content-range')?.split('/')[1]);
   if(!Number.isFinite(total))throw new BackendError(503,'Cannot verify cloud totals.');additional.push(...page);if(additional.length===total)break;if(!page.length)throw new BackendError(503,'Cloud inventory incomplete.');offset+=page.length;
 }
 const characters=additional.filter(r=>r.collection==='central_characters').map(r=>r.record).filter(r=>!r.deleted),centralActivity=additional.filter(r=>r.collection==='central_activity').map(r=>r.record);
 if(key==='dashboard')return json({administratorAccounts:1,serverCharacterAssets:characters.length+additional.filter(r=>r.collection==='ai_character_assets').length,browserCharacters:null,browserWorlds:null,worlds:worlds.length,totalDiscoveries:discoveries.length,needsReview:discoveries.filter(d=>d.verificationStatus==='needs_review').length,verified:discoveries.filter(d=>d.verificationStatus==='verified').length,published:discoveries.filter(d=>d.status==='published').length,drafts:discoveries.filter(d=>d.status==='draft').length,review:discoveries.filter(d=>d.status==='review').length,recent:[...worlds.map(w=>({...w,kind:'world'})),...discoveries.map(d=>({...d,kind:'discovery'}))].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,6)});
 const events=[...revisions.map(r=>({id:'revision-'+r.id,action:'Saved '+r.kind,name:'Saved revision',createdAt:r.created_at})),...centralActivity.map(r=>({id:r.id,action:r.action,name:r.name,createdAt:r.created_at}))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 if(key==='activity'){
   const search=(url.searchParams.get('search')||'').toLowerCase(),requested=Number(url.searchParams.get('page')||1);
   if(!Number.isInteger(requested)||requested<1||requested>100000||search.length>200)throw new BackendError(400,'Invalid search or page.');
   const filtered=events.filter(r=>(r.action+' '+r.name).toLowerCase().includes(search)),totalPages=Math.max(1,Math.ceil(filtered.length/10)),page=Math.min(requested,totalPages);
   return json({items:filtered.slice((page-1)*10,page*10),total:filtered.length,totalPages,page});
 }
 const now=Date.now();
 return json({generatedAt:new Date(now).toISOString(),totals:{users:1,characters:characters.length,worlds:worlds.length,connections:rows('connections').length,storageBytes:null},days:Array.from({length:7},(_,i)=>{const date=new Date(now-(6-i)*86400000).toISOString().slice(0,10);return {date,characters:centralActivity.filter(r=>r.created_at.startsWith(date)).length,worlds:revisions.filter(r=>r.kind==='worlds'&&r.created_at.startsWith(date)).length,content:revisions.filter(r=>r.kind!=='worlds'&&r.created_at.startsWith(date)).length};}),characters:characters.sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,4).map(r=>({id:r.id,name:r.name,type:r.type,format:r.format,createdAt:r.created_at,previewUrl:r.active&&r.preview_key?`/api/public/characters/${r.id}/preview?v=${r.version}`:null})),worlds:worlds.slice(0,4),activity:events.slice(0,4),system:{database:true,api:true,lastBackup:null},scope:'Supabase editorial worlds and administrator-published character catalog. Personal worlds remain in this browser; cloud personal-world synchronization is not enabled.'});
}
