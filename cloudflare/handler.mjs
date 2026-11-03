import{connectSocialAPI}from'./connect-social-api.mjs';
import {connectAPI} from './connect-api.mjs';
import {readAPI} from './read-api.mjs';
import {b10API} from './b10-api.mjs';
import {memberManagementAPI} from "./member-management.mjs";
import {userAuthAPI,findUserSession,userToken} from "./user-auth.mjs";
import {userWorldAPI} from "./user-worlds.mjs";
import {managedImagesAPI} from './managed-images.mjs';
import {worldEditsAPI} from './world-edits.mjs';
import {textAPI} from './workers-ai.mjs';
import {createHash} from 'node:crypto';
import {openD1Store,CommitConflict} from './d1-store.mjs';
import {requestContext} from './context.mjs';
import {createAPI} from './generated/api.mjs';
import {adminAllowedEmail} from '../server/auth.mjs';
export async function cloudflareFetch(request,env,{SQL,loadSQL,codecs,aiTransport=fetch,emailTransport=fetch,validateWorld}){
 const url=new URL(request.url);
 if(url.pathname!=='/api'&&!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 if(!env.DB||!env.MEDIA||!env.APP_ORIGIN)return Response.json({error:'Cloudflare bindings are not configured.'},{status:503});
 const social=await connectSocialAPI(request,env);if(social)return social;
 const connected=await connectAPI(request,env);if(connected)return connected;
 const native=await b10API(request,env,{validateWorld});if(native)return native;
 if(url.pathname==='/api/ai/capabilities')return textAPI(request,null,env);
 if(url.pathname==='/api/user/auth/status'&&request.method==='GET')return userAuthAPI(request,null,env);
 const read=await readAPI(request,env);if(read)return read;
 const cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-beyond_admin='))?.slice(20);
 const protectedWrite=!['GET','HEAD'].includes(request.method)&&url.pathname!=='/api/admin/login'&&url.pathname!=='/api/ai/status'&&url.pathname!=='/api/ai/text';
 let authorization=url.pathname.startsWith('/api/user/')?null:protectedWrite?{email:adminAllowedEmail(env),tokenHash:cookie?createHash('sha256').update(cookie).digest('hex'):''}:null;
 let db;const context={env,codecs,validateWorld,created:new Set()};
 return requestContext.run(context,async()=>{
   try{
     const path=url.pathname;let selectedTables;
     if(path==='/api/admin/session')selectedTables=['admins','sessions'];
     else if(path==='/api/admin/setup-status')selectedTables=['admins'];
     else if(path==='/api/public/universe')selectedTables=['worlds','discoveries','connections','settings'];
     else if(path.startsWith('/api/public/characters')&&request.method==='GET')selectedTables=['admins','sessions','central_characters'];
     else if(path.startsWith('/api/user/auth/'))selectedTables=['user_accounts','user_sessions','member_profiles','user_tokens','user_limits','member_deletions','member_audit'];
     else if(path.startsWith('/api/user/worlds'))selectedTables=['user_accounts','user_sessions','member_profiles','user_worlds','user_world_assets'];
     else if(path.startsWith('/api/user/assets'))selectedTables=['user_accounts','user_sessions','member_profiles','user_world_assets'];
     else if(path.startsWith('/api/ai/world-edits')||path==='/api/ai/text')selectedTables=['admins','sessions','user_accounts','user_sessions','member_profiles','user_worlds','user_world_assets','workers_ai_requests','central_characters'];
     db=await openD1Store(env.DB,SQL||await loadSQL(),{authorization:()=>authorization,selectedTables});context.db=db;
     if((url.pathname.startsWith('/api/user/')&&!url.pathname.startsWith('/api/user/auth/'))||['/api/ai/world-edits','/api/ai/text'].some(p=>url.pathname.startsWith(p))){const user=findUserSession(db,request,env);if(user)authorization={kind:'user',tokenHash:createHash('sha256').update(userToken(request,env)).digest('hex')};}

     const aiResponse=await memberManagementAPI(request,db,env)||await userAuthAPI(request,db,env,{emailTransport})||await userWorldAPI(request,db,env)||await managedImagesAPI(request,db,env)||await worldEditsAPI(request,db,env)||await textAPI(request,db,env);if(aiResponse){await db.flush();return aiResponse;}
     const req={url:url.pathname+url.search,method:request.method,headers:Object.fromEntries(request.headers),socket:{remoteAddress:request.headers.get('CF-Connecting-IP')||'unknown'},async *[Symbol.asyncIterator](){const reader=request.body?.getReader();if(!reader)return;try{for(;;){const {value,done}=await reader.read();if(done)break;yield Buffer.from(value);}}finally{reader.releaseLock();}}};
     const headers=new Headers();let status=200,body=null,started=false,ended=false;
     const res={get headersSent(){return started;},writeHead(code,values={}){status=code;for(const [k,v]of Object.entries(values))headers.set(k,String(v));started=true;},setHeader(k,v){headers.set(k,String(v));},end(value){if(ended)return;ended=true;body=value??null;}};
     let fallthrough=false;
     const api=createAPI(db,{origin:env.APP_ORIGIN,production:true,authEnv:env,aiEnv:env,aiTransport,assetRoot:'/.local/character-assets'});
     await api(req,res,()=>{fallthrough=true;});
     await db.flush();
     // Clean only fresh, unregistered objects from THIS request, never old assets.
     for(const key of context.created){if(!db.prepare('SELECT 1 FROM central_characters WHERE file_key=? OR preview_key=? UNION ALL SELECT 1 FROM ai_asset_objects WHERE file_key=? LIMIT 1').get(key,key,key))await env.MEDIA.delete(key);}
     context.created.clear();
     if(fallthrough&&!ended)return Response.json({error:'Endpoint not found.'},{status:404});
     if(typeof body==='string'&&headers.get('Content-Type')?.includes('json')){try{const value=JSON.parse(body);for(const field of ['scope','storage'])if(typeof value[field]==='string')value[field]=value[field].replaceAll('SQLite','Cloudflare D1').replace('private persistent','private R2');body=JSON.stringify(value);}catch{}}
     return new Response(body,{status,headers});
   }catch(error){
     console.warn('beyond_api_failure',{path:url.pathname,status:error instanceof CommitConflict?409:500,kind:error instanceof CommitConflict?'commit_conflict':'server_error'});
     // Keys are random request-owned objects, never pre-existing R2 originals.
     for(const key of context.created)await env.MEDIA.delete(key).catch(()=>{});
     return Response.json({error:error instanceof CommitConflict?'A concurrent change or expired session prevented this request. Refresh and retry.':'Cloudflare data unavailable. No success was reported.'},{status:error instanceof CommitConflict?409:500,headers:{'Cache-Control':'no-store'}});
   }finally{db?.close();}
 });
}
