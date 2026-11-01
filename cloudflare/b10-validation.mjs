import {nestedWorld,nestedSidecar} from './b10-json-schema.mjs';
import {createHash} from 'node:crypto';
import {imageHeader} from './images.mjs';
const fail=code=>{throw Object.assign(Error(code),{status:400});};
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validateNativeJSON(world,sidecars,{legacy=false}={}){
 // Inspect descriptors before reading a wrapper value: getters must never run.
 if(!record(world)||!record(sidecars)||![Object.prototype,null].includes(Object.getPrototypeOf(sidecars)))fail('invalid_sidecars');
 for(const key of Reflect.ownKeys(sidecars)){
  const descriptor=Object.getOwnPropertyDescriptor(sidecars,key);
  if(typeof key!=='string'||!['progress','position','discoveries'].includes(key)||!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))fail('invalid_sidecars');
 }

 const visit=(v,depth=0)=>{if(['function','symbol','bigint'].includes(typeof v))fail('invalid_json_type');if(v&&typeof v==='object'&&(Object.getOwnPropertySymbols(v).length||Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>d.get||d.set)))fail('invalid_json_property');if(typeof v==='string'&&v.length>12000)fail('json_string_too_long');if(Array.isArray(v)&&v.length>200)fail('json_array_too_long');if(v&&typeof v==='object'&&![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(v)))fail('invalid_json_prototype');if(depth>32)fail('json_depth_exceeded');if(Array.isArray(v))for(const x of v)visit(x,depth+1);else if(record(v))for(const [k,x] of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))fail('invalid_json_key');visit(x,depth+1);}else if(typeof v==='number'&&!Number.isFinite(v))fail('invalid_json_number');};
 visit(world);nestedWorld(world);
 if((world?.graph?.characters||[]).some(c=>c.assetId||c.imageUrl))fail('legacy_private_asset_reference');
 for(const [kind,value]of Object.entries(sidecars)){
  if(typeof value!=='string')fail('invalid_sidecars');let parsed;try{parsed=JSON.parse(value);}catch{fail('invalid_sidecar_json');}
  if(!record(parsed))fail('invalid_sidecar_schema');visit(parsed);nestedSidecar(kind,parsed,{legacy});
  if(kind==='position'&&!['x','y'].every(k=>Number.isFinite(parsed[k])&&parsed[k]>=0&&parsed[k]<=1))fail('invalid_sidecar_schema');
  if(kind==='discoveries'&&(parsed.version!==1||!Array.isArray(parsed.points)||parsed.points.length>100))fail('invalid_sidecar_schema');
  if(!legacy&&kind==='progress'&&(parsed.version!==1||!Array.isArray(parsed.found)||!Array.isArray(parsed.completed)||!record(parsed.conversations)))fail('invalid_sidecar_schema');
  if(kind==='progress'&&Object.entries(parsed).some(([k,v])=>k==='version'?(!Number.isSafeInteger(v)||v<1):['found','completed'].includes(k)?!Array.isArray(v):k==='conversations'?!record(v):false))fail('invalid_sidecar_schema');
 }
 if(Buffer.byteLength(JSON.stringify({world,sidecars}))>512*1024)fail('world_record_too_large');
}
export async function validateNativeAssets(repo,actor,world,media){
 const validated=[];
 const ids=[...new Set([...(world.starter?[world.starter.assetId]:[]),...(world.graph?.characters||[]).map(c=>c.uploadedAssetId).filter(Boolean)])];
 for(const id of ids){
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))fail('invalid_asset_id');
  const row=await repo.one("SELECT * FROM user_world_assets WHERE user_id=? AND id=? AND status='ready'",actor.id,id);
  if(!row||!/^[a-f0-9]{64}$/.test(row.hash)||typeof row.file_key!=='string'||!row.file_key.startsWith('user-worlds/'+actor.id+'/')||row.file_key.includes('..'))fail('invalid_owned_asset');
  if(world.starter?.assetId===id&&world.starter.hash!==row.hash)fail('starter_integrity_mismatch');
  let metadata;try{metadata=JSON.parse(row.metadata);}catch{fail('invalid_asset_metadata');}
  if(!record(metadata)||!['png','jpeg','webp','glb','gltf'].includes(metadata.format)||!Number.isSafeInteger(metadata.bytes)||metadata.bytes<1||metadata.bytes>20*1024*1024)fail('invalid_asset_metadata');
  if(world.starter?.assetId===id&&!['png','jpeg','webp'].includes(metadata.format))fail('invalid_starter_format');
  const object=await media?.get(row.file_key);if(object?.size>20*1024*1024)fail('asset_file_too_large');if(!object)fail('asset_file_unavailable');
  const bytes=Buffer.from(await object.arrayBuffer());
  if(bytes.length!==metadata.bytes||createHash('sha256').update(bytes).digest('hex')!==row.hash)fail('asset_integrity_mismatch');
  if(['png','jpeg','webp'].includes(metadata.format)){try{imageHeader(bytes,metadata.format);}catch{fail('invalid_asset_format');}}
  else if(metadata.format==='glb'){if(bytes.length<12||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(8)!==bytes.length)fail('invalid_asset_format');}
  else {try{const model=JSON.parse(bytes.toString('utf8'));if(model.asset?.version!=='2.0')fail('invalid_asset_format');}catch{fail('invalid_asset_format');}}
  validated.push(row);
 }
 return validated;
}
