import {AwsClient} from 'aws4fetch';
export class StorageError extends Error{constructor(status){super('Private media storage operation failed.');this.status=status;}}
const entity=s=>s.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9a-fA-F]+|[0-9]+);/g,v=>({ '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'" }[v]??String.fromCodePoint(v.startsWith('&#x')?parseInt(v.slice(3,-1),16):Number(v.slice(2,-1)))));
const value=(xml,key)=>entity(new RegExp('<'+key+'>([\\s\\S]*?)</'+key+'>').exec(xml)?.[1]||'');
export function createTigris(env,transport=fetch){
 const bucket=env.TIGRIS_BUCKET_NAME,endpoint=env.TIGRIS_ENDPOINT||'https://t3.storage.dev';
 if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket||'')||!env.TIGRIS_ACCESS_KEY_ID||!env.TIGRIS_SECRET_ACCESS_KEY)throw new StorageError(503);
 const base=new URL(endpoint);if(base.origin!=='https://t3.storage.dev'||base.pathname!=='/'||base.search||base.hash)throw new StorageError(503);
 const client=new AwsClient({accessKeyId:env.TIGRIS_ACCESS_KEY_ID,secretAccessKey:env.TIGRIS_SECRET_ACCESS_KEY,service:'s3',region:'auto',retries:0});
 const urlFor=key=>{if(key&&(key.startsWith('/')||key.includes('\\')||key.split('/').some(p=>!p||p==='.'||p==='..')))throw new StorageError(400);return new URL('/'+bucket+'/'+(key?key.split('/').map(encodeURIComponent).join('/'):''),base);};
 async function request(key,options={},query){
   const url=urlFor(key);if(query)for(const[k,v]of Object.entries(query))if(v!==undefined)url.searchParams.set(k,String(v));
   const signed=await client.sign(url,{...options,redirect:'manual'});
   return transport(signed,{redirect:'manual',signal:AbortSignal.timeout(120000)});
 }
 return {
   bucket,
   async headBucket(){const r=await request('',{method:'HEAD'});if(!r.ok)throw new StorageError(r.status);return true;},
   async privacy(){const r=await request('',{}, {acl:''});if(!r.ok)throw new StorageError(r.status);const xml=await r.text();return {private:!xml.includes('/groups/global/AllUsers')&&!xml.includes('/groups/global/AuthenticatedUsers')};},
   async head(key){const r=await request(key,{method:'HEAD'});if(r.status===404)return null;if(!r.ok)throw new StorageError(r.status);return {size:Number(r.headers.get('content-length')),etag:r.headers.get('etag'),httpMetadata:{contentType:r.headers.get('content-type')}};},
   async get(key){const r=await request(key);if(r.status===404)return null;if(!r.ok)throw new StorageError(r.status);return {key,size:Number(r.headers.get('content-length')||0),etag:r.headers.get('etag'),arrayBuffer:()=>r.arrayBuffer(),httpMetadata:{contentType:r.headers.get('content-type')}};},
   async put(key,bytes,options={}){const r=await request(key,{method:'PUT',headers:{'Content-Type':options.httpMetadata?.contentType||'application/octet-stream',...(options.onlyIf?{'If-None-Match':'*'}:{})},body:bytes});if(r.status===412)return null;if(!r.ok)throw new StorageError(r.status);return {key,size:bytes.byteLength};},
   async delete(key){const r=await request(key,{method:'DELETE'});if(!r.ok&&r.status!==404)throw new StorageError(r.status);},
   async list({prefix='',cursor,limit=500}={}){const r=await request('',{}, {'list-type':2,prefix,'continuation-token':cursor,'max-keys':Math.min(1000,limit)});if(!r.ok)throw new StorageError(r.status);const xml=await r.text();if(xml.length>4*1024*1024)throw new StorageError(503);const objects=[...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(m=>({key:value(m[1],'Key'),size:Number(value(m[1],'Size'))}));return {objects,truncated:value(xml,'IsTruncated')==='true',cursor:value(xml,'NextContinuationToken')||undefined};},
   async anonymousStatus(key){return (await transport(urlFor(key),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000)})).status;},
 };
}
