import {randomUUID,createHash}from'node:crypto';
import {findSession}from'../server/auth.mjs';
import {runtime}from'./context.mjs';
import {imageHeader,decodeRaster,makeThumbnail}from'./images.mjs';
import {imageCategories}from'../shared/image-categories.mjs';
const limit=8*1024*1024,sha=b=>createHash('sha256').update(b).digest('hex');
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function fail(status,message){throw Object.assign(Error(message),{status});}
const validCategory=id=>imageCategories.some(c=>c.id===id);
function meta(input,category){
 const string=(value,max,required=false)=>{if(typeof value!=='string'||value.length>max||required&&!value.trim())fail(400,'Invalid image metadata.');return value.trim();};
 if(typeof input.published!=='boolean'||typeof input.natureReviewed!=='boolean')fail(400,'Publication and review state required.');
 if(category==='hidden-worlds'&&input.published&&!input.natureReviewed)fail(400,'Review HIDDEN WORLDS nature-only rules before publishing.');
 return {name:string(input.name,100,true),description:string(input.description,2000),published:input.published,natureReviewed:input.natureReviewed,rights:{creator:string(input.creator||'',200),copyright:string(input.copyright||'',500),license:string(input.license||'',1000)},imageType:string(input.imageType||'environment',80),marketplaceEligible:false};
}
function dto(row,privateView=false){const d=JSON.parse(row.data);return {id:row.id,category:row.category,status:row.status,version:row.version,name:d.name,description:d.description,published:d.published,natureReviewed:d.natureReviewed,rights:d.rights,imageType:d.imageType,marketplaceEligible:false,createdAt:row.created_at,updatedAt:row.updated_at,file:d.file?{format:d.file.format,mime:d.file.mime,bytes:d.file.bytes,width:d.file.width,height:d.file.height,hash:d.file.hash}:null,fileUrl:`/api/${privateView?'admin':'public'}/images/${row.id}/file?version=${row.version}`,previewUrl:row.status==='ready'&&d.file?`/api/${privateView?'admin':'public'}/images/${row.id}/preview?version=${row.version}`:null,...(privateView?{pending:!!d.pendingUpload,canCleanup:['uploading','cleanup','deleting'].includes(row.status)||!!d.pendingUpload}: {})};}
async function read(request,max){const reader=request.body?.getReader();if(!reader)fail(400,'JSON body required.');let chunks=[],size=0;for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>max){await reader.cancel();fail(413,'Image exceeds the 8 MiB limit.');}chunks.push(Buffer.from(r.value));}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'Invalid JSON.');}}
export async function managedImagesAPI(request,db,env){
 const u=new URL(request.url),parts=u.pathname.split('/').filter(Boolean),privateView=parts[1]==='admin';if(!['admin','public'].includes(parts[1])||parts[2]!=='images')return null;
 if(env.BEYOND_STAGE!=='migration-preview')return json({error:'Image Management is available in Preview only.'},503);
 const session=findSession(db,{headers:Object.fromEntries(request.headers)},true,Date.now(),env);
 if(privateView&&!session)return json({error:'Sign in required.'},401);
 if(!['GET','HEAD'].includes(request.method)&&(!privateView||!session))return json({error:'Administrator required.'},401);
 if(!['GET','HEAD'].includes(request.method)&&(request.headers.get('origin')!==env.APP_ORIGIN||request.headers.get('x-csrf-token')!==session.csrf||!request.headers.get('content-type')?.startsWith('application/json')))return json({error:'Request verification failed.'},403);
 const {codecs}=runtime(),id=parts[3];
 const rowFor=()=>{if(!/^[a-f0-9-]{36}$/.test(id||''))fail(404,'Image not found.');const row=db.prepare('SELECT * FROM managed_images WHERE id=?').get(id);if(!row)fail(404,'Image not found.');return row;};
 const accessible=row=>{const d=JSON.parse(row.data);return row.status==='ready'&&d.file&&d.published&&(row.category!=='hidden-worlds'||d.natureReviewed);};
 const save=(row,data,status=row.status)=>{const version=row.version+1,stamp=new Date().toISOString();db.prepare('UPDATE managed_images SET data=?,status=?,version=?,updated_at=? WHERE id=? AND version=?').run(JSON.stringify(data),status,version,stamp,row.id,row.version);return {...row,data:JSON.stringify(data),status,version,updated_at:stamp};};
 async function cleanup(row){const d=JSON.parse(row.data),files=row.status==='deleting'?[d.file,...(d.retainedFiles||[]),d.pendingUpload?.file].filter(Boolean):[d.pendingUpload?.file].filter(Boolean);try{for(const f of files)for(const key of [f.key,f.previewKey]){if(!new RegExp('^managed-images/'+row.id+'/[a-f0-9-]{36}/(?:original\\.(?:png|jpeg|webp)|preview\\.webp)$').test(key))fail(503,'Unsafe cleanup receipt; operator review required.');await env.MEDIA.delete(key);}}catch{fail(503,'Private file cleanup is pending. Retry cleanup; originals remain tracked.');}
  if(row.status==='deleting'||!d.file){db.prepare('DELETE FROM managed_images WHERE id=? AND version=?').run(row.id,row.version);await db.flush();return null;}
  delete d.pendingUpload;const kept=save(row,d,'ready');await db.flush();return kept;
 }
 try{
  if(request.method==='GET'){
   if(id){const row=rowFor(),d=JSON.parse(row.data);if(!privateView&&!accessible(row))fail(404,'Image not found.');if(parts[4]){if(!['file','preview'].includes(parts[4])||!d.file||row.status!=='ready')fail(404,'Image not available.');if(Number(u.searchParams.get('version'))!==row.version)fail(409,'Image changed. Refresh before selecting it.');const preview=parts[4]==='preview',object=await env.MEDIA.get(preview?d.file.previewKey:d.file.key);if(!object)fail(503,'Private image unavailable.');return new Response(await object.arrayBuffer(),{headers:{'Content-Type':preview?'image/webp':d.file.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}return json({item:dto(row,privateView)});}
   const category=u.searchParams.get('category');if(!validCategory(category))fail(400,'Choose one of the six world categories.');const search=(u.searchParams.get('search')||'').slice(0,100).toLowerCase(),page=Math.max(1,Math.min(10000,Number(u.searchParams.get('page'))||1)),order=u.searchParams.get('sort')==='name'?'name':'newest';
   let rows=db.prepare('SELECT * FROM managed_images WHERE category=? ORDER BY created_at DESC').all(category).filter(r=>privateView||accessible(r));if(search)rows=rows.filter(r=>{const d=JSON.parse(r.data);return(d.name+' '+d.description).toLowerCase().includes(search);});if(order==='name')rows.sort((a,b)=>JSON.parse(a.data).name.localeCompare(JSON.parse(b.data).name));const total=rows.length;return json({items:rows.slice((page-1)*12,page*12).map(r=>dto(r,privateView)),page,total,totalPages:Math.max(1,Math.ceil(total/12)),categories:imageCategories});
  }
  if(!['POST','PUT'].includes(request.method))return json({error:'Method not allowed.'},405);
  const input=await read(request,12*1024*1024);let row=id?rowFor():null;
  if(row&&input.version!==row.version)fail(409,'Image changed. Refresh before saving.');
  if(parts[4]==='cleanup'){const item=await cleanup(row);return json({item:item?dto(item,true):null,cleaned:true});}
  if(parts[4]==='delete'){if(input.confirm!=='DELETE IMAGE')fail(400,'Confirm DELETE IMAGE to remove this image and its private files.');const d=JSON.parse(row.data);d.published=false;row=save(row,d,'deleting');await db.flush();await cleanup(row);return json({deleted:true});}
  if(parts[4])fail(404,'Endpoint not found.');
  const category=row?.category||input.category;if(!validCategory(category))fail(400,'Invalid world category.');const metadata=meta(input,category),old=row?JSON.parse(row.data):null;if(row&&(row.status!=='ready'||old.pendingUpload))fail(409,'Finish pending file cleanup before editing.');
  if(!input.file){if(!row)fail(400,'Select an image file.');row=save(row,{...old,...metadata});await db.flush();return json({item:dto(row,true)});}
  const f=input.file;if(!['image/png','image/jpeg','image/webp'].includes(f.mime)||typeof f.data!=='string'||f.data.length>Math.ceil(limit/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.data))fail(400,'Use PNG, JPEG or WebP up to 8 MiB.');const format=f.mime.split('/')[1],bytes=Buffer.from(f.data,'base64');if(!bytes.length||bytes.length>limit)fail(413,'Image exceeds the 8 MiB limit.');const header=imageHeader(bytes,format);if(category==='hidden-worlds'&&(header.width<512||header.height<512||header.width>2048||header.height>2048))fail(400,'Starter images must be 512–2048px per side for world editing.');await decodeRaster(bytes,format);const thumbnail=await makeThumbnail(bytes),imageId=row?.id||randomUUID(),revision=randomUUID(),root=`managed-images/${imageId}/${revision}`,file={key:root+'/original.'+format,previewKey:root+'/preview.webp',mime:f.mime,format,bytes:bytes.length,width:header.width,height:header.height,hash:sha(bytes)};
  const pending={file,metadata},d=old?{...old,pendingUpload:pending}:{...metadata,published:false,file:null,retainedFiles:[],pendingUpload:pending};
  if(row)row=save(row,d);else{const stamp=new Date().toISOString();row={id:imageId,category,status:'uploading',data:JSON.stringify(d),version:1,creator_id:session.admin_id,created_at:stamp,updated_at:stamp};db.prepare('INSERT INTO managed_images VALUES(?,?,?,?,?,?,?,?)').run(row.id,category,row.status,row.data,row.version,row.creator_id,stamp,stamp);}
  // Persist the intent before any object write. Even an interrupted Worker leaves recoverable keys.
  await db.flush();
  try{for(const [key,b,mime]of [[file.key,bytes,f.mime],[file.previewKey,thumbnail,'image/webp']]){const stored=await env.MEDIA.put(key,b,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:mime}});if(!stored)throw Error('Private object conflict.');}
   const complete={...d,...metadata,file,retainedFiles:[...(d.retainedFiles||[]),...(old?.file?[old.file]:[])]};delete complete.pendingUpload;row=save(row,complete,'ready');await db.flush();return json({item:dto(row,true)},old?200:201);
  }catch{try{await cleanup(row);}catch{}fail(503,'Upload did not complete. Refresh the gallery and retry any pending cleanup.');}
 }catch(e){if(e.status)return json({error:e.message},e.status);throw e;}
}
// Shared DTO for the lightweight read-only D1 route; never exposes private keys.
export {dto as managedImageDTO};
