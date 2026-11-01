import {currentUserId,captureAccountContext,assertAccountContext,accountFetch} from "../account/sessionScope";
import {validWorld} from "./worldStore";
import {persistWorld} from "../account/cloudWorlds";
import{getAsset,saveAsset,removeAsset,type ImportedAsset}from'./uploadAssets';
import{newWorld,saveWorld,type CreatedWorld}from'./worldStore';
export type PublishedImage={id:string;category:string;name:string;description:string;version:number;file:{format:'png'|'jpeg'|'webp';mime:string;hash:string};previewUrl:string;fileUrl:string};
export async function createStarterWorld(name:string,description:string,starter?:PublishedImage){
 const ctx=captureAccountContext();const key='beyond:creation-draft:'+ (currentUserId()||'legacy'),signature=JSON.stringify([name,description,starter?.id,starter?.version,starter?.file.hash]);
 let prior:{signature:string;world:CreatedWorld}|null=null;try{prior=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 if(prior?.signature===signature&&validWorld(prior.world)){const saved=await persistWorld(prior.world,undefined,undefined,ctx);localStorage.removeItem(key);return saved;}
 const world=newWorld(name,description);
 if(starter){if(starter.category!=='hidden-worlds')throw Error('Invalid starter category.');const response=await accountFetch(ctx,starter.fileUrl,{cache:'no-store'});if(!response.ok)throw Error('Starter changed or is unavailable. Select it again.');const file=await response.blob(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');assertAccountContext(ctx);if(hash!==starter.file.hash)throw Error('Starter image integrity check failed.');const id=crypto.randomUUID(),stamp=new Date().toISOString();await saveAsset({id,kind:'image',format:starter.file.format,file,filename:'starter.'+starter.file.format,name:starter.name,description:starter.description,tags:'',source:'',createdAt:stamp,updatedAt:stamp,purpose:'starter-world'},ctx);world.starter={imageId:starter.id,version:starter.version,assetId:id,hash};}
 assertAccountContext(ctx);localStorage.setItem(key,JSON.stringify({signature,world}));const saved=await persistWorld(world,undefined,undefined,ctx);localStorage.removeItem(key);return saved;
}
export async function starterAsset(starter:CreatedWorld['starter']):Promise<ImportedAsset|undefined>{return starter?getAsset(starter.assetId):undefined;}
