import {MigrationError} from './batch.mjs';
import {supabase} from '../worker/supabase.mjs';
export function createRemoteIO(env,transport=fetch){
 const backend=supabase(env,transport),bucket=env.SUPABASE_CHARACTER_BUCKET||'beyond-character-assets';
 if(!/^[a-z0-9-]+$/.test(bucket))throw new MigrationError('Invalid private bucket');
 const retry=async fn=>{for(let attempt=0;;attempt++){try{return await fn();}catch(error){if(attempt>=2||error instanceof MigrationError)throw error;await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}}};
 const get=path=>retry(async()=>(await backend('/rest/v1/'+path,{timeoutMs:60000})).json());
 const insert=(table,rows)=>backend('/rest/v1/'+table,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(rows)});
 const keyPath=key=>key.split('/').map(encodeURIComponent).join('/');
 return {
   storage:async()=>{const r=await backend('/storage/v1/bucket/'+bucket);const b=await r.json();return {private:b.id===bucket&&b.public===false,limit:b.file_size_limit};},
   active:()=>get('beyond_active_batch?select=batch_id'),
   batch:async id=>(await get('beyond_migration_batches?select=id,source_sha256,verified&id=eq.'+encodeURIComponent(id)))[0]||null,
   rows:async id=>{
     const rows=[];
     for(let offset=0;;){const r=await backend(`/rest/v1/beyond_records?select=batch_id,collection,row_key,ordinal,record&batch_id=eq.${encodeURIComponent(id)}&order=ordinal.asc,collection.asc,row_key.asc`,{headers:{Range:`${offset}-${offset+499}`,'Range-Unit':'items',Prefer:'count=exact'}});const page=await r.json();const range=r.headers.get('content-range'),total=range&&range.split('/')[1];if(!Array.isArray(page)||!total||total==='*')throw new MigrationError('Cannot verify exact remote row count');rows.push(...page);if(rows.length===Number(total))break;if(!page.length||rows.length>Number(total))throw new MigrationError('Remote pagination changed during verification');offset+=page.length;}
     return rows;
   },
   createBatch:row=>insert('beyond_migration_batches',row),
   createRows:rows=>insert('beyond_records',rows),
   file:key=>retry(async()=>{
     const r=await backend(`/storage/v1/object/authenticated/${bucket}/${keyPath(key)}`,{allowedStatuses:[400,404],timeoutMs:60000});
     if(r.status===404)return null;
     if(r.status===400){const error=await r.json();if(error.code==='NoSuchKey'&&String(error.statusCode)==='404')return null;throw new MigrationError('Storage read failed; object absence is not established');}
     return new Uint8Array(await r.arrayBuffer());
   }),
   createFile:(key,bytes)=>backend(`/storage/v1/object/${bucket}/${keyPath(key)}`,{method:'POST',headers:{'Content-Type':'application/octet-stream','x-upsert':'false'},body:bytes,timeoutMs:60000}),
 };
}
