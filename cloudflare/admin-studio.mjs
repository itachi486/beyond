import {createHash} from 'node:crypto';
import {findSession,adminAllowedEmail} from '../server/auth.mjs';
import {verifyUserWrite,memberResponse} from './user-auth.mjs';
export const studioEnabled=env=>env.BEYOND_STAGE==='migration-preview'&&env.ADMIN_PERSONAL_STUDIO_ENABLED==='1';
export const studioPrincipal=id=>'admin-personal-'+createHash('sha256').update('d1-admin-studio\0'+id).digest('hex');
export function studioSession(db,request,env){
 if(!studioEnabled(env))return null;
 const s=findSession(db,{headers:Object.fromEntries(request.headers)},true,Date.now(),env);
 return s?{...s,owner_admin_id:s.admin_id,user_id:studioPrincipal(s.admin_id),admin_id:studioPrincipal(s.admin_id),role:'member',studio:true}:null;
}
export async function studioAuthAPI(request,db,s,env){
 const path=new URL(request.url).pathname,json=memberResponse;
 if(path==='/api/admin/session'&&request.method==='GET')return json({email:s.email,csrf:s.csrf,expiresAt:s.expires_at,personalPrincipalId:s.user_id,personalWorldsRequired:true});
 if(path==='/api/user/auth/session'&&request.method==='GET')return json({user:{id:s.user_id,email:s.email,kind:'administrator',studio:'d1',verified:true,settings:{displayName:'Creator'}},csrf:s.csrf,expiresAt:s.expires_at});
 if(path==='/api/user/auth/logout'&&request.method==='POST'){
  try{verifyUserWrite(request,env,s);db.prepare('DELETE FROM sessions WHERE token_hash=?').run(s.token_hash);return json({loggedOut:true},200,'__Host-beyond_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');}catch(e){return json({error:e.message},e.status||500);}
 }
 if(path==='/api/user/account')return json({error:'Use administrator settings; member account mutation is unavailable for this identity.'},403);
 return null;
}
// Only static internal SQL identifiers are adapted. All values stay bound. The
// administrator session is never inserted into member account/session tables.
const mapping={user_worlds:'admin_personal_worlds',user_world_assets:'admin_personal_world_assets',user_world_revisions:'admin_personal_world_revisions'};
export function studioDatabase(db,s,env){
 const allowed=adminAllowedEmail(env),rewrite=sql=>sql.replace(/\b(user_worlds|user_world_assets|user_world_revisions)\b/g,t=>mapping[t]);
 const alive=async worldId=>{
  const [r]=await env.DB.batch([env.DB.prepare('SELECT 1 FROM admins a JOIN admin_studio_owners o ON o.admin_id=a.id WHERE a.id=? AND o.id=? AND a.email=? AND (SELECT COUNT(*) FROM admins)=1'+(worldId?' AND EXISTS(SELECT 1 FROM admin_personal_worlds w WHERE w.owner_id=o.id AND w.id=?)':'')).bind(s.owner_admin_id,s.user_id,allowed,...(worldId?[worldId]:[]))]);
  if(!r.success||!r.results.length)throw Error('result_owner_unavailable');
 };
 const view={...db,prepare:sql=>db.prepare(rewrite(sql)),validateReferences(world){const ids=[world.starter?.assetId,...(world.graph?.characters||[]).map(c=>c.uploadedAssetId)].filter(Boolean);for(const id of ids){const c=db.prepare('SELECT state FROM admin_personal_image_candidates WHERE owner_id=? AND asset_id=?').get(s.user_id,id);if(c&&c.state!=='approved')throw Object.assign(Error('image_approval_required'),{status:409});}},ensureOwner(){db.prepare('INSERT OR IGNORE INTO admin_studio_owners VALUES(?,?,?)').run(s.user_id,s.owner_admin_id,new Date().toISOString());},async resultGeneration(_owner,world){await alive(world);return 0;},async assertResultOwner(owner,world,generation){if(owner!==s.user_id||generation!==0)throw Error('result_owner_unavailable');await alive(world);},async assertStudioOwner(){await alive();}};Object.defineProperty(view,'isTransaction',{get:()=>db.isTransaction});return view;
}
export async function studioMedia(db,s,env){
 const scoped=studioDatabase(db,s,env),prefixes=['user-worlds/'+s.user_id+'/','world-edits/'+s.user_id+'/'];
 return {...env.MEDIA, get:env.MEDIA.get.bind(env.MEDIA),delete:env.MEDIA.delete.bind(env.MEDIA),async put(key,bytes,options){if(!prefixes.some(p=>key.startsWith(p))||key.includes('..'))throw Error('invalid_studio_media_namespace');await scoped.assertStudioOwner();return env.MEDIA.put(key,bytes,options);}};
}

export function studioCharacter(db,session,worldId,id){
 if(!session?.studio)return null;
 const row=db.prepare('SELECT data FROM user_worlds WHERE owner_id=? AND id=?').get(session.user_id,worldId);if(!row)return null;
 const saved=JSON.parse(row.data),w=saved.world,c=w.graph?.characters?.find(c=>c.id===id||c.centralCharacterId===id);
 if(!c){const p=JSON.parse(saved.sidecars?.progress||'{}');if(p.companion?.characterId===id)return db.prepare('SELECT name,description,type FROM central_characters WHERE id=? AND active=1 AND deleted=0').get(id)||null;}
 return c?{name:c.name,description:c.description,type:c.type,personality:c.personality||'',background:c.abilities||''}:null;
}
export function studioChatContext(db,session,input){
 const row=db.prepare('SELECT data FROM user_worlds WHERE owner_id=? AND id=?').get(session.user_id,input.worldId),saved=JSON.parse(row.data),p=JSON.parse(saved.sidecars?.progress||'{}');
 const entries=Object.entries(p.conversations||{}).filter(([key])=>key.endsWith(':'+input.characterId)).flatMap(([,v])=>Array.isArray(v)?v:[]).filter(m=>['visitor','character'].includes(m.role)&&typeof m.text==='string').slice(-12);
 return {kind:'chat',world:{name:saved.world.name,description:saved.world.description},memory:entries.filter(m=>m.role==='visitor').map(m=>m.text.slice(0,240)),history:entries.map(m=>({role:m.role==='visitor'?'user':'assistant',content:m.text.slice(0,2000)}))};
}
