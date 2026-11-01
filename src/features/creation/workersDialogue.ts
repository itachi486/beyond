import {memberWriteCredentials} from '../account/cloudWorlds';
import {captureAccountContext,assertAccountContext,accountFetch,invalidateAccountContext,type AccountContext} from '../account/sessionScope';
import {aiErrors,readAIResponse} from './aiErrors';
import {type CharacterDialogueService} from './worldDiscoveryProgress';
export function aiMessage(code:string,es:boolean){
 if(aiErrors[code])return aiErrors[code];
 if(code==='character_not_published')return es?'Este personaje no está publicado para conversaciones con IA.':'This character is not published for AI conversations.';
 if(code==='sign_in_required'||code==='request_verification_failed')return es?'Inicia sesión de nuevo para usar esta función.':'Sign in again to use this feature.';
 return es?'La IA no pudo responder. No se guardó ninguna respuesta generada.':'AI could not respond. No generated reply was saved.';
}
export async function workersCapabilities(ctx:AccountContext=captureAccountContext()){const r=await accountFetch(ctx,'/api/ai/capabilities',{credentials:'same-origin'});if(r.status===404)return null;if(!r.ok)throw Error('ai_unavailable');const c=await r.json();assertAccountContext(ctx);return c.provider==='workers-ai'?c:null;}
export async function resolveAISession(ctx:AccountContext=captureAccountContext()){assertAccountContext(ctx);const cached=memberWriteCredentials();if(cached)return {...cached};let r=await fetch('/api/user/auth/session',{cache:'no-store',signal:ctx.signal});assertAccountContext(ctx);if([401,404].includes(r.status)&&!ctx.userId){r=await fetch('/api/admin/session',{cache:'no-store',signal:ctx.signal});assertAccountContext(ctx);}if(r.status===401){invalidateAccountContext('unauthorized',true);throw Error('sign_in_required');}const session=await readAIResponse(r);assertAccountContext(ctx);if(session.user&&session.user.id!==ctx.userId){invalidateAccountContext('unauthorized',true);throw Error('sign_in_required');}return session;}
export async function requestText(input:{kind:'chat'|'plan'|'understand';message:string;characterId?:string;locale?:string;worldId?:string},ctx:AccountContext=captureAccountContext()){
 const session=await resolveAISession(ctx);
 const r=await accountFetch(ctx,'/api/ai/text',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(session?.csrf?{'X-CSRF-Token':session.csrf}:{})},body:JSON.stringify({...input,requestId:crypto.randomUUID()}),signal:AbortSignal.timeout(115000)});
 const data=await readAIResponse(r);assertAccountContext(ctx);if(typeof data.response!=='string')throw Error(data.error||'ai_unavailable');return data.response as string;
}
export const workersDialogue:CharacterDialogueService={kind:'server',async reply(input){const ctx=captureAccountContext(),c=await workersCapabilities(ctx);if(!c?.configured)throw Error('ai_not_configured');return requestText({kind:'chat',message:input.message,worldId:input.world?.id,characterId:input.character?.id,locale:input.es?'es':'en'},ctx);}};

export type CompanionAction={kind:'chat'|'edit'|'clarify'|'explore'|'cancel'|'inspect'|'usage'|'error';intent?:import('../../../shared/companion-intent.mjs').ActionIntent;state?:string;operationId?:string;operation?:'create'|'edit';objectKind?:string;targetId?:string|null;candidateId?:string|null;retrySafe?:boolean;position:{x:number;y:number}|null;message:string};
export async function requestCompanion(input:{requestId:string;message:string;worldId:string;characterId:string;world:{name:string;lore:string};history:import('./worldDiscoveryProgress').DialogueMessage[];position?:{x:number;y:number}|null;pending?:{message:string}|null},ctx:AccountContext=captureAccountContext()){const session=await resolveAISession(ctx);const r=await accountFetch(ctx,'/api/ai/text',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({...input,kind:'companion'}),signal:AbortSignal.timeout(115000)});const data=await readAIResponse(r);assertAccountContext(ctx);if(typeof data.response!=='string'||!data.action)throw Error(data.error||'ai_unavailable');return data as {response:string;action:CompanionAction;provider:string};}
