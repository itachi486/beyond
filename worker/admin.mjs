import {randomBytes} from 'node:crypto';
import {adminAllowedEmail, normalizeEmail, validEmail, verifyPassword, digest, cookie} from '../server/auth.mjs';
import {BackendError} from './supabase.mjs';
import {handleEditorial} from './editorial.mjs';
import {handleOperations} from './operations.mjs';
export const rpc = async (backend,name,input) => (await backend(`/rest/v1/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).json();
const json=(status,value,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export function tokenHash(request){
 const token=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('__Host-beyond_admin='))?.slice('__Host-beyond_admin='.length);
 return token && /^[A-Za-z0-9_-]{43}$/.test(token)?digest(token):null;
}
export async function adminContext(request,env,backend){
 const allowed=adminAllowedEmail(env);
 if(!allowed)throw new BackendError(503,'Configure one valid ADMIN_ALLOWED_EMAIL on the server.');
 return {allowed,hash:tokenHash(request),...await rpc(backend,'beyond_edge_context',{allowed_email:allowed,session_hash:tokenHash(request)})};
}
export async function adminBody(request,env,session,login=false){
 let expected;
 try { expected=new URL(env.APP_ORIGIN).origin; if(!expected.startsWith('https://'))throw Error(); }catch{throw new BackendError(503,'Configure the HTTPS application origin.');}
 if(request.headers.get('origin')!==expected)throw new BackendError(403,'Request origin rejected.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new BackendError(415,'Use application/json.');
 if(!login&&(!session||request.headers.get('x-csrf-token')!==session.csrf))throw new BackendError(403,'Request verification failed. Refresh and try again.');
 if(Number(request.headers.get('content-length')||0)>131072)throw new BackendError(413,'Request is too large.');
 const reader=request.body?.getReader();let bytes=0,chunks=[];
 if(reader)for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>131072){await reader.cancel();throw new BackendError(413,'Request is too large.');}chunks.push(value);}
 try{const buffer=new Uint8Array(bytes);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}const v=JSON.parse(new TextDecoder().decode(buffer));if(!v||typeof v!=='object'||Array.isArray(v))throw Error();return v;}catch{throw new BackendError(400,'Send a valid JSON object.');}
}
export async function handleAdmin(request,env,backend){
 const path=new URL(request.url).pathname;
 const ctx=await adminContext(request,env,backend);
 if(path==='/api/admin/setup-status'&&request.method==='GET')return json(200,{state:ctx.ready?'ready':'operator_review_required',method:'local_command'});
 if(path==='/api/admin/login'){
   if(request.method!=='POST')throw new BackendError(405,'Method not allowed.');
   const input=await adminBody(request,env,null,true);
   if(!ctx.ready)throw new BackendError(503,'Administrator migration is not ready. Existing account must be preserved.');
   const email=normalizeEmail(input.email),ip=request.headers.get('CF-Connecting-IP')||'unknown';
   for(const [key,maximum] of [['ip:'+ip,20],['account:'+email,6]])if(!await rpc(backend,'beyond_edge_attempt',{limit_key:digest(key),maximum}))throw new BackendError(429,'Too many login attempts. Try again later.');
   const hash=ctx.administrator.password_hash;
   if(!/^scrypt\$32768\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash))throw new BackendError(503,'Existing credential format requires operator review.');
   const valid=await verifyPassword(input.password,hash);
   if(!validEmail(email)||email!==ctx.allowed||email!==ctx.administrator.email||!valid)throw new BackendError(401,'Email or password is incorrect.');
   const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');
   const started=await rpc(backend,'beyond_edge_start_session',{allowed_email:ctx.allowed,expected_credential:hash,new_token_hash:digest(token),new_csrf:csrf,previous_token_hash:ctx.hash});
   if(!started.ok)throw new BackendError(401,'Credentials changed. Sign in again.');
   return json(200,{ok:true},{'Set-Cookie':cookie(token,true)});
 }
 if(!ctx.session)throw new BackendError(401,'Administrator sign-in required.');
 if(path==='/api/admin/session'&&request.method==='GET')return json(200,{email:ctx.session.email,csrf:ctx.session.csrf,expiresAt:ctx.session.expires_at});
 if(path==='/api/admin/logout'&&request.method==='POST'){
   await adminBody(request,env,ctx.session);
   const ok=await rpc(backend,'beyond_edge_logout',{allowed_email:ctx.allowed,session_hash:ctx.hash,csrf_token:ctx.session.csrf});
   if(!ok)throw new BackendError(401,'Administrator session expired.');
   return json(200,{ok:true},{'Set-Cookie':cookie('',true,0)});
 }
 const editorial=await handleEditorial(request,ctx,backend,rpc,adminBody,env);
 if(editorial)return editorial;
 const operations=await handleOperations(request,ctx,backend,rpc);
 if(operations)return operations;
 // No unsupported endpoint can fall through to public data.
 throw new BackendError(503,'This administrator operation has not completed cloud migration. Existing local service is preserved.');
}
