let userId: string | null = null;
let authEpoch = 0;
let controller = new AbortController();
export type AccountContext = Readonly<{userId:string|null;authEpoch:number;signal:AbortSignal}>;
export const captureAccountContext = ():AccountContext => Object.freeze({userId,authEpoch,signal:controller.signal});
export const isAccountContextCurrent = (ctx:AccountContext) => ctx.userId===userId && ctx.authEpoch===authEpoch && !ctx.signal.aborted;
export function assertAccountContext(ctx:AccountContext){if(!isAccountContextCurrent(ctx))throw Error('account_context_stale');}
export function invalidateAccountContext(reason='session_changed',notify=false){
 controller.abort();controller=new AbortController();authEpoch++;
 if(reason==='unauthorized'||reason==='other_tab')userId=null;
 if(typeof window!=='undefined'){
  window.dispatchEvent(new CustomEvent('beyond-account-invalidated',{detail:reason}));
  if(notify)try{localStorage.setItem('beyond:auth-invalidation',crypto.randomUUID());}catch{/* notification is advisory */}
 }
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key==='beyond:auth-invalidation')invalidateAccountContext('other_tab');});
export const currentUserId = () => userId;
export function setAccountScope(id: string | null) { invalidateAccountContext();userId = id; }
export const scopedKeyFor = (ctx:Pick<AccountContext,'userId'>,key:string) => ctx.userId ? `account:${ctx.userId}:${key}` : key;
export const scopedKey = (key: string) => scopedKeyFor({userId},key);
/** Cookies remain server controlled; never reacquire another session's credentials on retry. */
export async function accountFetch(ctx:AccountContext,input:RequestInfo|URL,init:RequestInit={}){
 assertAccountContext(ctx);
 let response:Response;
 try{response=await fetch(input,{...init,signal:init.signal?AbortSignal.any([ctx.signal,init.signal]):ctx.signal});}catch(error){assertAccountContext(ctx);throw error;}
 assertAccountContext(ctx);
 if(response.status===401){invalidateAccountContext('unauthorized',true);throw Error('sign_in_required');}
 return response;
}
