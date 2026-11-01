import {createHash} from 'node:crypto';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
export class MigrationError extends Error {}
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
const keys={admins:'id',central_activity:'id',central_characters:'id',connections:'id',discoveries:'id',login_limits:'key_hash',permanent_deletion_jobs:'id',revisions:'id',schema_versions:'version',sessions:'token_hash',settings:'id',worlds:'id',ai_generations:'id',ai_character_assets:'id'};
const links=[['discoveries','world_id','worlds'],['connections','from_id','discoveries'],['connections','to_id','discoveries'],['revisions','actor','admins'],['sessions','admin_id','admins'],['central_characters','creator_id','admins'],['central_activity','actor_id','admins'],['ai_generations','creator_id','admins'],['ai_character_assets','creator_id','admins']];
export async function prepareBatch(document,directory){
 if(document?.version!==1||!/^[a-f0-9]{64}$/.test(document.sourceSha256)||!Array.isArray(document.records))throw new MigrationError('Invalid preservation export');
 const seen=new Set(),tables=new Map(),assetKeys=new Set();
 const records=document.records.map((r,ordinal)=>{
   if(!r||!Object.hasOwn(keys,r.collection)||!r.record||typeof r.record!=='object'||Array.isArray(r.record))throw new MigrationError('Unsupported collection or record; nothing omitted');
   const row_key=JSON.stringify([r.record[keys[r.collection]]]);
   if(r.record[keys[r.collection]]===undefined||r.row_key!==row_key)throw new MigrationError('Primary key does not match the preserved record');
   const key=r.collection+'\0'+row_key;if(seen.has(key))throw new MigrationError('Duplicate preserved primary key');seen.add(key);
   if(!tables.has(r.collection))tables.set(r.collection,new Map());tables.get(r.collection).set(r.record[keys[r.collection]],r.record);
   if(r.collection==='central_characters')for(const k of [r.record.file_key,r.record.preview_key])if(k)assetKeys.add(k);
   return {collection:r.collection,row_key,ordinal,record:r.record};
 });
 for(const [table,column,target] of links)for(const r of tables.get(table)?.values()||[]){if(!tables.get(target)?.has(r[column]))throw new MigrationError('Broken preserved relationship: '+table+'.'+column);}
 for(const r of tables.get('connections')?.values()||[]){if(r.from_id===r.to_id)throw new MigrationError('Self connection is invalid');}
 const root=await realpath(directory),objects=[];
 for(const key of [...assetKeys].sort()){
   if(typeof key!=='string'||key.includes('\\')||isAbsolute(key)||key.split('/').some(p=>!p||p==='.'||p==='..'))throw new MigrationError('Unsafe asset reference');
   const file=await realpath(resolve(root,key)),rel=relative(root,file);
   if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw new MigrationError('Asset escaped its private root');
   if(!(await stat(file)).isFile())throw new MigrationError('Asset is not a regular file');
   const bytes=await readFile(file);objects.push({key,file,bytes:bytes.length,sha256:sha256(bytes)});
 }
 const fingerprint=sha256(canonical({version:1,sourceSha256:document.sourceSha256,records,objects:objects.map(({key,bytes,sha256})=>({key,bytes,sha256}))}));
 const batchId='beyond-'+fingerprint;
 const remoteRecords=records.map(r=>({...r,batch_id:batchId,record:r.collection==='central_characters'?{...r.record,file_key:`${batchId}/${r.record.file_key}`,preview_key:r.record.preview_key?`${batchId}/${r.record.preview_key}`:null}:r.record}));
 return {version:1,batchId,sourceSha256:document.sourceSha256,fingerprint,records:remoteRecords,objects,counts:Object.fromEntries([...tables].map(([name,rows])=>[name,rows.size])),active:false};
}
export function compareRows(expected,actual,{complete=false}={}){
 const wanted=new Map(expected.map(r=>[r.collection+'\0'+r.row_key,r])),found=new Set();
 for(const r of actual){const key=r.collection+'\0'+r.row_key;if(found.has(key)||!wanted.has(key)||canonical(r)!==canonical(wanted.get(key)))throw new MigrationError('Existing batch conflicts with the preservation plan; no overwrite allowed');found.add(key);}
 if(complete&&found.size!==wanted.size)throw new MigrationError('Remote row count is incomplete');
 return found;
}
// IO adapter has no update/delete/activation method. Retries only insert missing data.
export async function stageBatch(plan,io){
 const storage=await io.storage();if(!storage.private)throw new MigrationError('Target bucket is not verified private');
 if(storage.limit&&plan.objects.some(o=>o.bytes>storage.limit))throw new MigrationError('Asset exceeds the configured private bucket size limit');
 const active=await io.active();if(active.some(r=>r.batch_id===plan.batchId))throw new MigrationError('This batch is active; migration writes are forbidden');
 const existing=await io.batch(plan.batchId);
 if(existing&&(existing.source_sha256!==plan.sourceSha256||existing.id!==plan.batchId))throw new MigrationError('Existing batch metadata conflicts');
 let current=await io.rows(plan.batchId);compareRows(plan.records,current);
 if(existing?.verified)throw new MigrationError('Batch is already verified; preserve it and review before retrying');
 if(!existing){await io.createBatch({id:plan.batchId,source_sha256:plan.sourceSha256,verified:false});const created=await io.batch(plan.batchId);if(!created||created.verified||created.source_sha256!==plan.sourceSha256)throw new MigrationError('Batch creation could not be verified');}
 let nextObject=0,doneObjects=0;
 await Promise.all(Array.from({length:Math.min(3,plan.objects.length)},async()=>{while(nextObject<plan.objects.length){
   const object=plan.objects[nextObject++];
   const key=plan.batchId+'/'+object.key,previous=await io.file(key);
   if(previous!==null){if(sha256(previous)!==object.sha256)throw new MigrationError('Existing object differs; no overwrite allowed');doneObjects++;io.progress?.(doneObjects,plan.objects.length);continue;}
   const bytes=await readFile(object.file);if(sha256(bytes)!==object.sha256)throw new MigrationError('Source asset changed after planning');
   try{await io.createFile(key,bytes);}catch{/* Interrupted/conflicting insert is resolved by read-back, never overwrite. */}
   const copied=await io.file(key);if(copied===null||sha256(copied)!==object.sha256)throw new MigrationError('File upload incomplete or conflicting; inactive batch retained');
   doneObjects++;io.progress?.(doneObjects,plan.objects.length);
 }}));
 current=await io.rows(plan.batchId);const present=compareRows(plan.records,current);
 const missing=plan.records.filter(r=>!present.has(r.collection+'\0'+r.row_key));
 for(let i=0;i<missing.length;i+=100)await io.createRows(missing.slice(i,i+100));
 compareRows(plan.records,await io.rows(plan.batchId),{complete:true});
 if((await io.active()).some(r=>r.batch_id===plan.batchId)||(await io.batch(plan.batchId))?.verified)throw new MigrationError('Batch state changed during staging; operator review required');
 return {batchId:plan.batchId,rowsVerified:plan.records.length,filesVerified:plan.objects.length,activated:false,verifiedFlagChanged:false};
}
