import{membershipSQL,resolveConnectIdentity}from'./connect-access.mjs';
import{connectCatalog}from'../shared/connect-catalog.mjs';
import{createHash,randomUUID}from'node:crypto';
import{verifyUserWrite,readUserJSON,memberResponse}from'./user-auth.mjs';
import{adminAllowedEmail}from'../server/auth.mjs';
import{studioPrincipal}from'./admin-studio.mjs';
const fail=(status,error)=>{throw Object.assign(Error(error),{status});};
export async function connectAPI(request,env){
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/connect')&&!path.startsWith('/api/user/create-starters'))return null;
 if(env.BEYOND_STAGE!=='migration-preview'||env.CONNECT_ENABLED!=='1')return memberResponse({error:'connect_unavailable'},503);
 const batch=async statements=>{const rows=await env.DB.batch(statements);if(rows.some(r=>!r.success))throw Error('connect_storage_unavailable');return rows;},statement=(sql,...p)=>env.DB.prepare(sql).bind(...p),all=async(sql,...p)=>(await batch([statement(sql,...p)]))[0].results,one=async(sql,...p)=>(await all(sql,...p))[0];
 try{
  if(!(await one('SELECT ready FROM cf_state WHERE id=1'))?.ready)fail(503,'connect_unavailable');
  const identity=await resolveConnectIdentity(request,env);if(!identity)fail(401,'sign_in_required');const{kind,params,auth,authSQL}=identity;
  const owner=kind==='admin'?studioPrincipal(auth.subject_id):auth.subject_id,worldTable=kind==='admin'?'admin_personal_worlds':'user_worlds',fresh=()=>[params[0],Date.now(),...params.slice(2)],guard=(extra='1',extraParams=[])=>statement(`INSERT INTO cf_commit_guards(id,ok) VALUES(?,CASE WHEN EXISTS(${authSQL}) AND ${extra} THEN 1 ELSE 0 END)`,guardId,...fresh(),...extraParams),guardId='connect:'+randomUUID();
  if(path==='/api/connect/constellation'){
   if(request.method!=='GET')fail(405,'method_not_allowed');
   const sky=await one('SELECT star_count,last_growth_at FROM connect_constellations WHERE owner_id=?',owner);
   return memberResponse({stars:sky?.star_count||1,seed:createHash('sha256').update('personal-sky:'+owner).digest('hex').slice(0,16),updatedAt:sky?.last_growth_at||null});
  }
  const catalog=async()=>all("SELECT g.*,i.version,i.data,i.status image_status,i.category image_category FROM connect_groups g LEFT JOIN managed_images i ON i.id=g.starter_image_id WHERE g.starter_key IN('floating-islands','lost-island','endless-desert','deep-ocean','green-valley','alien-planet') ORDER BY g.rowid");
  const dto=r=>{const d=r.data?JSON.parse(r.data):null,available=!!(r.starter_image_id&&r.image_status==='ready'&&r.image_category==='hidden-worlds'&&d?.published&&d?.natureReviewed&&d?.file);return{key:r.starter_key,id:r.starter_image_id,groupId:r.group_id,name:r.display_name,available,previewUrl:available?`/api/public/images/${r.starter_image_id}/preview?version=${r.version}`:null};};
  // CREATE worlds are authoritative. Legacy manual selections are never read.
  const worldSelections=`SELECT g.starter_key,g.starter_image_id,MIN(w.created_at) selected_at FROM ${worldTable} w JOIN connect_groups g ON g.starter_image_id=json_extract(w.data,'$.world.starter.imageId') WHERE w.owner_id=? GROUP BY g.starter_key,g.starter_image_id`;
  const state=async()=>({revision:0,source:'saved-worlds',selections:await all(worldSelections,owner),catalog:(await catalog()).map(dto)});
  if(path==='/api/user/create-starters'){
   if(request.method!=='GET')fail(405,'world_based_membership_only');
   const s=await state();return memberResponse({...s,selected:s.selections.map(r=>r.starter_key),needsReview:false,maxWorlds:3});
  }
  if(path==='/api/connect/sync'){
   if(request.method!=='POST')fail(405,'method_not_allowed');verifyUserWrite(request,env,auth);const input=await readUserJSON(request,1024);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)fail(400,'connect_reads_worlds_only');
   const now=new Date().toISOString();
   // Derive and reconcile within one atomic batch, including an empty world list.
   await batch([guard(),
    statement('INSERT INTO create_starter_profiles VALUES(?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET revision=create_starter_profiles.revision+1,updated_at=excluded.updated_at',owner,kind,auth.subject_id,1,now),
    statement('DELETE FROM create_starter_selections WHERE owner_id=?',owner),
    statement('INSERT INTO create_starter_selections(owner_id,starter_key,starter_image_id,selected_at) SELECT ?,derived.* FROM ('+worldSelections+') derived',owner,owner),
    statement("UPDATE connect_memberships SET active=0,left_at=? WHERE owner_id=? AND active=1 AND group_id NOT IN(SELECT g.group_id FROM create_starter_selections s JOIN connect_groups g ON g.starter_key=s.starter_key WHERE s.owner_id=?)",now,owner,owner),
    statement("INSERT INTO connect_memberships(owner_id,group_id,active,joined_at,left_at) SELECT s.owner_id,g.group_id,1,?,NULL FROM create_starter_selections s JOIN connect_groups g ON g.starter_key=s.starter_key WHERE s.owner_id=? ON CONFLICT(owner_id,group_id) DO UPDATE SET active=1,left_at=NULL,joined_at=CASE WHEN connect_memberships.active=0 THEN excluded.joined_at ELSE connect_memberships.joined_at END",now,owner),statement('DELETE FROM cf_commit_guards WHERE id=?',guardId)]);
   const rows=await all('SELECT g.*,i.version,i.data,i.status image_status,i.category image_category FROM connect_groups g JOIN connect_memberships m ON m.group_id=g.group_id LEFT JOIN managed_images i ON i.id=g.starter_image_id WHERE m.owner_id=? AND m.active=1',owner);
   return memberResponse({groups:rows.map(dto),source:'saved-worlds',requiresCreate:!rows.length});
  }
  const match=path.match(/^\/api\/connect\/groups\/([^/]+)$/);if(match&&request.method==='GET'){
   const id=decodeURIComponent(match[1]);if(!connectCatalog.some(c=>c.groupId===id))fail(403,'group_membership_required');if(!await one(membershipSQL,owner,id))fail(403,'group_membership_required');const r=await one('SELECT g.* FROM connect_groups g JOIN connect_memberships m ON m.group_id=g.group_id JOIN create_starter_selections s ON s.starter_key=g.starter_key AND s.owner_id=m.owner_id WHERE m.owner_id=? AND m.group_id=? AND m.active=1',owner,id);if(!r)fail(403,'group_membership_required');const count=await one("SELECT COUNT(*) member_count FROM connect_memberships m JOIN connect_groups g ON g.group_id=m.group_id JOIN create_starter_selections s ON s.owner_id=m.owner_id AND s.starter_key=g.starter_key AND s.starter_image_id=g.starter_image_id JOIN create_starter_profiles p ON p.owner_id=m.owner_id LEFT JOIN user_accounts u ON p.owner_kind='member' AND u.id=p.subject_id LEFT JOIN member_profiles mp ON mp.user_id=u.id LEFT JOIN admins a ON p.owner_kind='admin' AND a.id=p.subject_id WHERE m.group_id=? AND m.active=1 AND (EXISTS(SELECT 1 FROM user_worlds w WHERE w.owner_id=m.owner_id AND json_extract(w.data,'$.world.starter.imageId')=g.starter_image_id) OR EXISTS(SELECT 1 FROM admin_personal_worlds w WHERE w.owner_id=m.owner_id AND json_extract(w.data,'$.world.starter.imageId')=g.starter_image_id)) AND ((p.owner_kind='member' AND u.id IS NOT NULL AND COALESCE(mp.status,'active')='active') OR (p.owner_kind='admin' AND a.email=?))",id,adminAllowedEmail(env)||'');return memberResponse({group:{id:r.group_id,key:r.starter_key,name:r.display_name},memberCount:count.member_count,chatAvailable:env.CONNECT_REALTIME_ENABLED==='1'});
  }
  fail(404,'not_found');
 }catch(e){return memberResponse({error:e.status?e.message:'connect_temporarily_unavailable'},e.status||503);}
}
