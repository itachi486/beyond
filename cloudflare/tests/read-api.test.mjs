import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,req} from './cloudflare.test.mjs';
import {setup,newWorld} from './companion.test.mjs';
import {cloudflareFetch} from '../handler.mjs';
const native=(request,env)=>cloudflareFetch(request,env,{loadSQL:()=>{throw Error('Read must not initialize sql.js');}});
test('native read routes preserve universe, authentication, ownership and revision history without sql.js',async()=>{
 const f=await setup();try{
 assert.deepEqual(await(await native(req('/api/public/universe'),f.env)).json(),JSON.parse(JSON.stringify(f.expected)));
 const catalog=await(await native(req('/api/public/characters'),f.env)).json();assert.equal(catalog.items[0].id,f.id);assert.equal(catalog.items[0].active,true);assert.equal((await native(req('/api/public/characters/'+f.id+'?v=1'),f.env)).status,200);f.d1.db.prepare('UPDATE central_characters SET active=0 WHERE id=?').run(f.id);assert.equal((await native(req('/api/public/characters/'+f.id),f.env)).status,404);f.d1.db.prepare('UPDATE central_characters SET active=1 WHERE id=?').run(f.id);
 assert.equal((await native(req('/api/user/auth/session'),f.env)).status,401);
 assert.equal((await native(req('/api/admin/session','GET',null,f.user.cookie),f.env)).status,401);
 const s=await(await native(req('/api/user/auth/session','GET',null,f.user.cookie),f.env)).json();assert.equal(s.user.id,f.user.id);assert.equal(s.csrf,f.user.csrf);
 const world=newWorld('Scoped read','Keep all revisions');for(let version=0;version<3;version++){const r=await f.run('/api/user/worlds/'+world.id,{world,version,requestId:randomUUID()},f.user.cookie,f.user.csrf,'PUT');assert.equal(r.status,version?200:201);}
 const read=await native(req('/api/user/worlds/'+world.id,'GET',null,f.user.cookie),f.env),saved=await read.json();assert.equal(read.status,200);assert.equal(saved.version,3);assert.equal(saved.world.name,world.name);
 const history=await(await native(req('/api/user/worlds/'+world.id+'/history','GET',null,f.user.cookie),f.env)).json();assert.deepEqual(history.items.map(x=>x.version),[3,2,1]);assert.equal(f.d1.db.prepare('SELECT COUNT(*) AS n FROM user_world_revisions WHERE world_id=?').get(world.id).n,3);
 assert.equal((await native(req('/api/user/worlds/'+randomUUID(),'GET',null,f.user.cookie),f.env)).status,404);
 assert.equal((await native(req('/api/ai/world-edits?worldId='+randomUUID(),'GET',null,f.user.cookie),f.env)).status,404);
 const b=await f.run('/api/user/auth/register',{email:'second@example.test',username:'second_reader',password:'Second-test-password-123'}),other=b.headers.get('set-cookie').split(';')[0];assert.equal(b.status,200);assert.equal((await native(req('/api/user/worlds/'+world.id,'GET',null,other),f.env)).status,404);
 f.d1.db.prepare('UPDATE user_sessions SET expires_at=0 WHERE user_id=?').run(f.user.id);assert.equal((await native(req('/api/user/auth/session','GET',null,f.user.cookie),f.env)).status,401);
 }finally{f.d1.close();}
});
test('native D1 failures return retryable JSON503 without masquerading as authentication or AI quota',async()=>{const f=await fixture();try{const r=await native(req('/api/public/universe'),{...f.env,BEYOND_STAGE:'migration-preview',DB:{batch:()=>{throw Error('offline')},prepare:()=>({})}});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'read_service_unavailable',retryable:true});}finally{f.d1.close();}});
