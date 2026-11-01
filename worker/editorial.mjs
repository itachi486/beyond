import {randomUUID} from 'node:crypto';
import {validateWorld,validateDiscovery,Problem} from '../server/validation.mjs';
import {BackendError} from './supabase.mjs';
const item=r=>({...JSON.parse(r.data),id:r.id,slug:r.slug,status:r.status,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at});
const json=(status,value)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handleEditorial(request,ctx,backend,rpc,readBody,env){
 const url=new URL(request.url),path=url.pathname;
 const match=path.match(/^\/api\/admin\/(worlds|discoveries)(?:\/([a-zA-Z0-9-]{1,100}))?$/);
 if(!match&&path!=='/api/admin/catalog')return null;
 const snapshot=await rpc(backend,'beyond_edge_editorial',{allowed_email:ctx.allowed,session_hash:ctx.hash});
 if(snapshot.status!==200)throw new BackendError(401,'Administrator session expired.');
 const tables=Object.groupBy(snapshot.records,r=>r.collection),rows=kind=>(tables[kind]||[]).map(r=>r.record);
 if(path==='/api/admin/catalog'){
   if(request.method!=='GET')throw new BackendError(405,'Method not allowed.');
   return json(200,{worlds:rows('worlds').map(item).map(w=>({id:w.id,name:w.name,status:w.status,hubKey:w.hubKey})),discoveries:rows('discoveries').map(item).map(d=>({id:d.id,title:d.title,worldId:d.worldId,status:d.status})),connections:rows('connections')});
 }
 const [,kind,id]=match,records=rows(kind).map(item),old=id?records.find(r=>r.id===id):null;
 if(id&&!old)throw new BackendError(404,'Record not found.');
 if(request.method==='GET'){
   if(id)return json(200,{item:old,history:rows('revisions').filter(r=>r.kind===kind&&r.record_id===id).sort((a,b)=>b.id-a.id).slice(0,20).map(({id,actor,snapshot,created_at})=>({id,actor,snapshot,created_at}))});
   const page=Number(url.searchParams.get('page')||1),search=(url.searchParams.get('search')||'').toLowerCase(),state=url.searchParams.get('status'),worldId=url.searchParams.get('worldId');
   if(!Number.isInteger(page)||page<1||page>100000||search.length>200)throw new BackendError(400,'Invalid search or page.');
   const filtered=records.filter(r=>(!state||r.status===state)&&(!worldId||r.worldId===worldId)&&(!search||[r.title?.en,r.title?.es,r.name?.en,r.name?.es,r.slug].some(s=>s?.toLowerCase().includes(search)))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
   const totalPages=Math.max(1,Math.ceil(filtered.length/10)),p=Math.min(page,totalPages);
   return json(200,{items:filtered.slice((p-1)*10,p*10),total:filtered.length,page:p,totalPages});
 }
 if(!((request.method==='POST'&&!id)||(request.method==='PUT'&&id)))throw new BackendError(405,'Method not allowed.');
 const input=await readBody(request,env,ctx.session);
 if(old&&input.version!==old.version)throw new BackendError(409,'This record changed. Reload before saving.');
 let data;
 try{data=kind==='worlds'?validateWorld(input,old):validateDiscovery(input,{prepare(){return {get(worldId){return rows('worlds').find(w=>w.id===worldId);}};}},old);}catch(error){if(error instanceof Problem)throw new BackendError(error.status,error.message);throw error;}
 if(old&&old.slug!==data.slug)data.aliases=[...new Set([...(old.aliases||[]),old.slug])];
 const saved=await rpc(backend,'beyond_edge_save_editorial',{allowed_email:ctx.allowed,session_hash:ctx.hash,csrf_token:ctx.session.csrf,target_collection:kind,target_id:id||randomUUID(),expected_version:old?.version??null,content:data});
 if(![200,201].includes(saved.status))throw new BackendError([400,401,403,409].includes(saved.status)?saved.status:503,'Save rejected. Refresh the record and check your session.');
 return json(saved.status,{item:item(saved.record)});
}
