import {readAPIResponse,readJSON} from "../../lib/apiResponse";
import {verifyAuthor} from "../creation/authorAccess";
import {saveWorld} from "../creation/worldStore";
import {currentUserId,scopedKey,scopedKeyFor,captureAccountContext,assertAccountContext,accountFetch,invalidateAccountContext,type AccountContext} from './sessionScope';
import {getAsset,getLegacyAsset,saveAsset,type ImportedAsset} from '../creation/uploadAssets';
import {validWorld,type CreatedWorld} from '../creation/worldStore';
import {PREFIX} from '../../lib/storage';
let csrf='';
const uploaded=new Map<string,string>();
const versions=new Map<string,string>();
function content(w:CreatedWorld){const {cloudVersion,ownerId,updatedAt,...data}=w;return JSON.stringify(data);}
export function setMemberCSRF(value:string){if(csrf!==value)invalidateAccountContext('session_binding_changed');csrf=value;}
export function memberWriteCredentials(){return currentUserId()&&csrf?{csrf}:null;}
export async function memberAPI(path:string,body?:unknown,method='POST',ctx:AccountContext=captureAccountContext()){
 assertAccountContext(ctx);const token=csrf;
 if(['auth/login','auth/register','auth/logout','auth/recover-deletion','auth/verify','auth/reset'].includes(path)){invalidateAccountContext('auth_change',true);ctx=captureAccountContext();}
 if(body===undefined){const data=await readJSON('/api/user/'+path,(input,init)=>accountFetch(ctx,input,init));assertAccountContext(ctx);return data;}
 const r=await accountFetch(ctx,'/api/user/'+path,{credentials:'same-origin',cache:'no-store',...(body===undefined?{}:{method,headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify(body)})});
 const data=await readAPIResponse(r,'/api/user/'+path);assertAccountContext(ctx);if(path.startsWith('auth/'))invalidateAccountContext('auth_completed',true);return data;
}
type Envelope={world:CreatedWorld;sidecars:Record<string,string>;assets:(Omit<ImportedAsset,'file'>&{fileUrl:string;hash:string})[]};
export function sidecarKey(kind:string,id:string,ctx:AccountContext=captureAccountContext()){return scopedKeyFor(ctx,kind==='position'?'beyond:world-edit-position:'+id:kind==='progress'?'beyond:v1:world-discovery-progress:'+id:'beyond:v1:world-discoveries:'+id);}
export function cachedWorlds(ctx:AccountContext=captureAccountContext()):CreatedWorld[]{assertAccountContext(ctx);try{return JSON.parse(localStorage.getItem(PREFIX+scopedKeyFor(ctx,'created-worlds'))||'[]').filter(validWorld);}catch{return [];}}
function cache(world:CreatedWorld,ctx:AccountContext){assertAccountContext(ctx);if(world.ownerId!==ctx.userId)throw Error('world_owner_mismatch');versions.set(ctx.userId+':'+world.id+":"+world.cloudVersion,content(world));localStorage.setItem(PREFIX+scopedKeyFor(ctx,'created-worlds'),JSON.stringify([world,...cachedWorlds(ctx).filter(w=>w.id!==world.id)]));window.dispatchEvent(new Event('beyond-worlds'));}
function assertWorldResponse(item:Envelope,ctx:AccountContext){assertAccountContext(ctx);const newer=cachedWorlds(ctx).find(w=>w.id===item.world.id);if(newer&&(newer.cloudVersion||0)>(item.world.cloudVersion||0))throw Error('world_response_stale');}
async function hydrate(item:Envelope,ctx:AccountContext){assertWorldResponse(item,ctx);if(item.world.ownerId!==ctx.userId)throw Error('world_owner_mismatch');for(const a of item.assets){if(await getAsset(a.id,ctx)){assertAccountContext(ctx);uploaded.set(ctx.userId+":"+a.id,a.hash);continue;}const r=await accountFetch(ctx,a.fileUrl,{cache:'no-store'});if(!r.ok)throw Error('Cloud media could not load. Retry before editing.');const file=await r.blob(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');assertAccountContext(ctx);if(hash!==a.hash)throw Error('Cloud media integrity check failed.');await saveAsset({...a,file},ctx);assertAccountContext(ctx);uploaded.set(ctx.userId+":"+a.id,a.hash);}assertWorldResponse(item,ctx);for(const [k,v]of Object.entries(item.sidecars||{}))localStorage.setItem(sidecarKey(k,item.world.id,ctx),v);cache(item.world,ctx);return item.world;}
export async function fetchWorld(id:string,ctx:AccountContext=captureAccountContext()){return hydrate(await memberAPI("worlds/"+encodeURIComponent(id),undefined,'GET',ctx),ctx);}
export async function refreshWorlds(ctx:AccountContext=captureAccountContext()){assertAccountContext(ctx);const user=ctx.userId;if(!user)return [];const data=await memberAPI('worlds',undefined,'GET',ctx);for(const item of data.items){assertAccountContext(ctx);await hydrate(item,ctx);}return data.items.map((i:Envelope)=>i.world) as CreatedWorld[];}
const assetIds=(w:CreatedWorld)=>Array.from(new Set([w.starter?.assetId,...(w.graph?.characters||[]).map(c=>c.uploadedAssetId)].filter(Boolean))) as string[];
async function upload(a:ImportedAsset,ctx:AccountContext){assertAccountContext(ctx);const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await a.file.arrayBuffer())),v=>v.toString(16).padStart(2,"0")).join("");assertAccountContext(ctx);if(uploaded.get(ctx.userId+":"+a.id)===hash)return;const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(a.file);});const result=await memberAPI('assets',{id:a.id,name:a.name,description:a.description,tags:a.tags,purpose:a.purpose,file:{name:a.filename,data}},'POST',ctx);uploaded.set(ctx.userId+":"+a.id,result.asset.hash);return result;}
const inFlight=new Set<string>();
export async function persistWorld(world:CreatedWorld,_expected?:string,sidecars?:Record<string,string>,ctx:AccountContext=captureAccountContext()):Promise<CreatedWorld>{
 assertAccountContext(ctx);const user=ctx.userId,key=user+':'+ctx.authEpoch+':'+world.id;if(!user){const allowed=await verifyAuthor();assertAccountContext(ctx);if(!allowed)throw Error('Sign in with a verified free account to save this world.');const local=saveWorld(world,_expected);if(!local)throw Error('Local administrator save failed.');return local;}if(inFlight.has(key))throw Error('A save is already in progress.');inFlight.add(key);
 const draftKey=PREFIX+scopedKeyFor(ctx,'pending-world:'+world.id);
 try{
 for(const id of assetIds(world)){const asset=await getAsset(id,ctx);if(!asset)throw Error('A world image is missing. Original local data is preserved.');await upload(asset,ctx);}
 assertAccountContext(ctx);const history:Record<string,string>={};for(const kind of ['discoveries','progress','position']){const raw=localStorage.getItem(sidecarKey(kind,world.id,ctx));if(raw)history[kind]=raw;}
 const latest=cachedWorlds(ctx).find(w=>w.id===world.id);
 const version=latest&&versions.get(ctx.userId+':'+world.id+":"+world.cloudVersion)===content(latest)?latest.cloudVersion||0:world.cloudVersion||0;
 const body={world,version,requestId:crypto.randomUUID(),sidecars:{...history,...sidecars}};
 // Retain the same operation ID when a connection fails after the server may have committed.
 const prior=localStorage.getItem(draftKey);if(prior){const parsed=JSON.parse(prior);if(JSON.stringify({...parsed,requestId:''})===JSON.stringify({...body,requestId:''}))body.requestId=parsed.requestId;}
 localStorage.setItem(draftKey,JSON.stringify(body));const data=await memberAPI('worlds/'+encodeURIComponent(world.id),body,'PUT',ctx);assertAccountContext(ctx);const saved=await hydrate(data,ctx);localStorage.removeItem(draftKey);return saved;
 }finally{inFlight.delete(key);}
}
export function legacyWorlds():CreatedWorld[]{try{return JSON.parse(localStorage.getItem(PREFIX+'created-worlds')||'[]').filter(validWorld);}catch{return [];}}
export async function importLegacy(world:CreatedWorld,ctx:AccountContext=captureAccountContext()){assertAccountContext(ctx);if(cachedWorlds(ctx).some(w=>w.id===world.id))throw Error('This world is already in your account.');if(world.graph?.characters.some(c=>c.assetId||c.imageUrl))throw Error('This world contains private administrator AI links. Export and preserve its original backup; automatic import is blocked to avoid losing images.');for(const id of assetIds(world)){const a=await getLegacyAsset(id,ctx);if(!a)throw Error('An original local image is missing; import stopped.');await saveAsset(a,ctx);}assertAccountContext(ctx);const sidecars:Record<string,string>={};for(const k of ['discoveries','progress','position']){const old=k==='position'?'beyond:world-edit-position:'+world.id:k==='progress'?'beyond:v1:world-discovery-progress:'+world.id:'beyond:v1:world-discoveries:'+world.id;const raw=localStorage.getItem(old);if(raw)sidecars[k]=raw;}return persistWorld({...world,cloudVersion:0,ownerId:undefined},undefined,sidecars,ctx);}
export async function persistSidecar(id:string,kind:string,value:string,ctx:AccountContext=captureAccountContext()){const world=cachedWorlds(ctx).find(w=>w.id===id);if(!world)throw Error('Save this world to your account first.');return persistWorld(world,undefined,{[kind]:value},ctx);}

export function pendingWorlds():{key:string;name:string}[]{const prefix=PREFIX+scopedKey('pending-world:');const result=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)!;if(key.startsWith(prefix)){try{result.push({key,name:JSON.parse(localStorage.getItem(key)!).world.name});}catch{}}}return result;}
export async function retryPending(key:string,ctx:AccountContext=captureAccountContext()){assertAccountContext(ctx);if(!currentUserId()||!key.startsWith(PREFIX+scopedKeyFor(ctx,'pending-world:')))throw Error('Invalid draft.');const body=JSON.parse(localStorage.getItem(key)||'null');if(!body||!validWorld(body.world))throw Error('Invalid draft; original retained.');const data=await memberAPI('worlds/'+encodeURIComponent(body.world.id),body,'PUT',ctx);await hydrate(data,ctx);localStorage.removeItem(key);return data.world as CreatedWorld;}
