import{createHash,randomUUID}from'node:crypto';
import{userToken,verifyUserWrite,readUserJSON,memberResponse}from'./user-auth.mjs';
import{adminAllowedEmail}from'../server/auth.mjs';
import{studioEnabled,studioPrincipal}from'./admin-studio.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex'),validToken=t=>/^[A-Za-z0-9_-]{43}$/.test(t||''),fail=(status,error)=>{throw Object.assign(Error(error),{status});};
const memberSQL="SELECT s.*,u.id subject_id FROM user_sessions s JOIN user_accounts u ON u.id=s.user_id LEFT JOIN member_profiles p ON p.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND s.credential_version=u.credential_version AND COALESCE(p.status,'active')='active'";
const adminSQL='SELECT s.*,a.id subject_id FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>? AND a.email=? AND (SELECT COUNT(*) FROM admins)=1';
export async function connectAPI(request,env){
 const path=new URL(request.url).pathname;if(!path.startsWith('/api/connect')&&!path.startsWith('/api/user/create-starters'))return null;
 if(env.BEYOND_STAGE!=='migration-preview'||env.CONNECT_ENABLED!=='1')return memberResponse({error:'connect_unavailable'},503);
 const batch=async statements=>{const rows=await env.DB.batch(statements);if(rows.some(r=>!r.success))throw Error('connect_storage_unavailable');return rows;},statement=(sql,...p)=>env.DB.prepare(sql).bind(...p),all=async(sql,...p)=>(await batch([statement(sql,...p)]))[0].results,one=async(sql,...p)=>(await all(sql,...p))[0];
 try{
  if(!(await one('SELECT ready FROM cf_state WHERE id=1'))?.ready)fail(503,'connect_unavailable');
  let kind='member',token=userToken(request,env),params=validToken(token)?[digest(token),Date.now()]:[],auth=params.length?await one(memberSQL,...params):null,authSQL=memberSQL;
  if(!auth&&studioEnabled(env)){token=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-beyond_admin='))?.slice(20);const allowed=adminAllowedEmail(env);if(allowed&&validToken(token)){params=[digest(token),Date.now(),allowed];auth=await one(adminSQL,...params);if(auth){kind='admin';authSQL=adminSQL;}}}
  if(!auth)fail(401,'sign_in_required');
  const owner=kind==='admin'?studioPrincipal(auth.subject_id):auth.subject_id,worldTable=kind==='admin'?'admin_personal_worlds':'user_worlds',fresh=()=>[params[0],Date.now(),...params.slice(2)],guard=(extra='1',extraParams=[])=>statement(`INSERT INTO cf_commit_guards(id,ok) VALUES(?,CASE WHEN EXISTS(${authSQL}) AND ${extra} THEN 1 ELSE 0 END)`,guardId,...fresh(),...extraParams),guardId='connect:'+randomUUID();
  const catalog=async()=>all("SELECT g.*,i.version,i.data,i.status image_status,i.category image_category FROM connect_groups g LEFT JOIN managed_images i ON i.id=g.starter_image_id ORDER BY g.rowid");
  const dto=r=>{const d=r.data?JSON.parse(r.data):null,available=!!(r.starter_image_id&&r.image_status==='ready'&&r.image_category==='hidden-worlds'&&d?.published&&d?.natureReviewed&&d?.file);return{key:r.starter_key,id:r.starter_image_id,groupId:r.group_id,name:r.display_name,available,previewUrl:available?`/api/public/images/${r.starter_image_id}/preview?version=${r.version}`:null};};
  const state=async()=>{
   const profile=await one('SELECT * FROM create_starter_profiles WHERE owner_id=?',owner),rows=await catalog();let selections;
   if(profile)selections=await all('SELECT starter_key,starter_image_id,selected_at FROM create_starter_selections WHERE owner_id=? ORDER BY selected_at,starter_key',owner);
   else{const worlds=await all('SELECT data,created_at FROM '+worldTable+' WHERE owner_id=? ORDER BY created_at',owner),byId=new Map(rows.filter(r=>r.starter_image_id).map(r=>[r.starter_image_id,r]));const found=new Map();for(const w of worlds){const id=JSON.parse(w.data).world?.starter?.imageId,r=byId.get(id);if(r&&!found.has(r.starter_key))found.set(r.starter_key,{starter_key:r.starter_key,starter_image_id:id,selected_at:w.created_at});}selections=[...found.values()];}
   return{revision:profile?.revision||0,source:profile?'create':'saved-worlds',selections,catalog:rows.map(dto),needsReview:selections.length>3};
  };
  const responseState=s=>({revision:s.revision,source:s.source,selected:s.selections.map(r=>r.starter_key),selections:s.selections.map(r=>({key:r.starter_key,imageId:r.starter_image_id,selectedAt:r.selected_at})),catalog:s.catalog,needsReview:s.needsReview,maxSelections:3});
  async function save(input,{bootstrap=false}={}){
   if(!input||!Array.isArray(input.selected)||input.selected.length>3||new Set(input.selected).size!==input.selected.length||!input.selected.every(x=>typeof x==='string')||!Number.isSafeInteger(input.revision)||input.revision<0||input.revision>=Number.MAX_SAFE_INTEGER||!/^[A-Za-z0-9_-]{16,80}$/.test(input.operationId||''))fail(400,'invalid_create_selection');
   const keys=[...input.selected].sort(),hash=digest(JSON.stringify({keys,revision:input.revision})),existing=await one('SELECT * FROM create_starter_operations WHERE owner_id=? AND operation_id=?',owner,input.operationId);
   if(existing){if(existing.request_hash!==hash)fail(409,'operation_conflict');return{revision:existing.revision,selected:JSON.parse(existing.selections),cached:true};}
   const rows=await catalog(),chosen=keys.map(k=>rows.find(r=>r.starter_key===k));if(chosen.some(r=>!r||!dto(r).available))fail(400,'official_starter_unavailable');
   const now=new Date().toISOString(),rev=input.revision+1,statements=[guard('COALESCE((SELECT revision FROM create_starter_profiles WHERE owner_id=?),0)=?',[owner,input.revision]),statement('INSERT INTO create_starter_profiles VALUES(?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET revision=excluded.revision,updated_at=excluded.updated_at',owner,kind,auth.subject_id,rev,now),statement('DELETE FROM create_starter_selections WHERE owner_id=?',owner),...chosen.map(r=>statement('INSERT INTO create_starter_selections VALUES(?,?,?,?)',owner,r.starter_key,r.starter_image_id,bootstrap?input.times?.[r.starter_key]||now:now)),statement('INSERT INTO create_starter_operations VALUES(?,?,?,?,?,?)',owner,input.operationId,hash,rev,JSON.stringify(keys),now),statement('DELETE FROM cf_commit_guards WHERE id=?',guardId)];
   try{await batch(statements);}catch(e){const replay=await one('SELECT * FROM create_starter_operations WHERE owner_id=? AND operation_id=?',owner,input.operationId);if(replay&&replay.request_hash===hash)return{revision:replay.revision,selected:JSON.parse(replay.selections),cached:true};fail(409,'create_selection_conflict');}return{revision:rev,selected:keys,cached:false};
  }
  if(path==='/api/user/create-starters'){
   if(request.method==='GET')return memberResponse(responseState(await state()));
   if(request.method!=='PUT')fail(405,'method_not_allowed');verifyUserWrite(request,env,auth);return memberResponse(await save(await readUserJSON(request,8192)));
  }
  if(path==='/api/connect/sync'){
   if(request.method!=='POST')fail(405,'method_not_allowed');verifyUserWrite(request,env,auth);const input=await readUserJSON(request,1024);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)fail(400,'connect_reads_create_only');
   let s=await state();if(s.needsReview)fail(409,'create_selection_review_required');
   if(!s.revision&&s.selections.length){await save({selected:s.selections.map(r=>r.starter_key),revision:0,operationId:'bootstrap-'+digest(owner),times:Object.fromEntries(s.selections.map(r=>[r.starter_key,r.selected_at]))},{bootstrap:true});s=await state();}
   if(!s.revision)return memberResponse({groups:[],sourceRevision:0,requiresCreate:true});
   const now=new Date().toISOString();await batch([guard('(SELECT revision FROM create_starter_profiles WHERE owner_id=?)=?',[owner,s.revision]),statement("UPDATE connect_memberships SET active=0,left_at=? WHERE owner_id=? AND active=1 AND group_id NOT IN(SELECT g.group_id FROM create_starter_selections s JOIN connect_groups g ON g.starter_key=s.starter_key WHERE s.owner_id=?)",now,owner,owner),statement("INSERT INTO connect_memberships(owner_id,group_id,active,joined_at,left_at) SELECT s.owner_id,g.group_id,1,?,NULL FROM create_starter_selections s JOIN connect_groups g ON g.starter_key=s.starter_key WHERE s.owner_id=? ON CONFLICT(owner_id,group_id) DO UPDATE SET active=1,left_at=NULL,joined_at=CASE WHEN connect_memberships.active=0 THEN excluded.joined_at ELSE connect_memberships.joined_at END",now,owner),statement('DELETE FROM cf_commit_guards WHERE id=?',guardId)]);
   const selected=new Set(s.selections.map(r=>r.starter_key));return memberResponse({groups:s.catalog.filter(r=>selected.has(r.key)),sourceRevision:s.revision,requiresCreate:!selected.size});
  }
  const match=path.match(/^\/api\/connect\/groups\/([^/]+)$/);if(match&&request.method==='GET'){
   const id=decodeURIComponent(match[1]),r=await one('SELECT g.* FROM connect_groups g JOIN connect_memberships m ON m.group_id=g.group_id JOIN create_starter_selections s ON s.starter_key=g.starter_key AND s.owner_id=m.owner_id WHERE m.owner_id=? AND m.group_id=? AND m.active=1',owner,id);if(!r)fail(403,'group_membership_required');return memberResponse({group:{id:r.group_id,key:r.starter_key,name:r.display_name},chatAvailable:false});
  }
  fail(404,'not_found');
 }catch(e){return memberResponse({error:e.status?e.message:'connect_temporarily_unavailable'},e.status||503);}
}
