import {randomUUID} from 'node:crypto';
import {fail} from '../server/validation.mjs';
import {runtime} from './context.mjs';
const keyPattern=/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/(?:original\.(?:png|jpeg|webp|glb|gltf)|preview\.webp)$/;
export async function permanentDelete(db,{kind,id,input,session,now=Date.now,authorized}){
 if(!['world','character'].includes(kind)||!/^[a-zA-Z0-9-]{1,80}$/.test(id))fail(400,'Invalid deletion target.');
 if(input.confirm!=='DELETE PERMANENTLY'||!Number.isSafeInteger(input.version)||input.version<1)fail(400,'Explicit permanent deletion confirmation and version are required.');
 if(!authorized())fail(401,'Session expired.');
 const ctx=runtime(),prior=db.prepare('SELECT * FROM permanent_deletion_jobs WHERE kind=? AND target_id=?').get(kind,id);
 if(prior){if(prior.version!==input.version)fail(409,'Deletion version does not match.');await purge(prior);return {deleted:true,id,retried:true};}
 const table=kind==='world'?'worlds':'central_characters',row=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
 if(!row)fail(404,'Deletion target not found.');if(row.version!==input.version)fail(409,'Record changed. Refresh before deleting.');
 const stamp=new Date(now()).toISOString(),job=randomUUID(),keys=[];let shared=0,removedConnections=0,removedDiscoveries=0;
 if(kind==='character'){
   if(db.prepare("SELECT 1 FROM worlds WHERE instr(data,?)>0 UNION ALL SELECT 1 FROM discoveries WHERE instr(data,?)>0 LIMIT 1").get('/characters/'+id+'/','/characters/'+id+'/'))fail(409,'Server content still links to this source. Remove links before permanent deletion.');
   const used=new Set(db.prepare('SELECT file_key,preview_key FROM central_characters WHERE id<>?').all(id).flatMap(r=>[r.file_key,r.preview_key]).filter(Boolean));
   let cursor;do{const page=await ctx.env.MEDIA.list({prefix:id+'/',cursor,limit:500});for(const o of page.objects){if(!keyPattern.test(o.key))fail(409,'Unexpected owned asset key.');if(used.has(o.key))shared++;else keys.push(o.key);if(keys.length>2048)fail(409,'Too many revisions; operator review required.');}cursor=page.truncated?page.cursor:undefined;}while(cursor);
   for(const key of [row.file_key,row.preview_key].filter(Boolean))if(!keyPattern.test(key))fail(409,'Invalid stored file path.');
 }
 db.exec('BEGIN IMMEDIATE');try{
   if(!authorized())fail(401,'Session expired.');
   if(kind==='world'){removedConnections=db.prepare('DELETE FROM connections WHERE from_id IN (SELECT id FROM discoveries WHERE world_id=?) OR to_id IN (SELECT id FROM discoveries WHERE world_id=?)').run(id,id).changes;removedDiscoveries=db.prepare('DELETE FROM discoveries WHERE world_id=?').run(id).changes;}
   db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
   db.prepare('INSERT INTO revisions(kind,record_id,actor,snapshot,created_at) VALUES(?,?,?,?,?)').run('permanent_deletion',id,session.admin_id,JSON.stringify({kind,name:kind==='world'?JSON.parse(row.data).name:row.name,removedDiscoveries,removedConnections,sharedFilesRetained:shared}),stamp);
   if(kind==='character')db.prepare('INSERT INTO central_activity VALUES(?,?,?,?,?,?)').run(randomUUID(),'Permanently deleted character',id,row.name,session.admin_id,stamp);
   if(keys.length)db.prepare('INSERT INTO permanent_deletion_jobs VALUES(?,?,?,?,?,?)').run(job,kind,id,input.version,JSON.stringify({keys}),stamp);
   db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 // Persist metadata removal + durable receipt BEFORE touching Tigris. A failure is retryable.
 await db.flush();ctx.created.clear();
 if(keys.length)await purge({id:job,paths:JSON.stringify({keys})});
 return {deleted:true,id,removedFiles:keys.length,sharedFilesRetained:shared,removedDiscoveries,removedConnections};
 async function purge(receipt){
   const paths=JSON.parse(receipt.paths).keys;if(!Array.isArray(paths)||paths.length>2048||paths.some(k=>!keyPattern.test(k)||!k.startsWith(id+'/')))fail(503,'Deletion receipt requires operator review.');
   try{for(const key of paths){if(db.prepare('SELECT 1 FROM central_characters WHERE file_key=? OR preview_key=? LIMIT 1').get(key,key))continue;await ctx.env.MEDIA.delete(key);}}catch{fail(503,'Metadata removed; private Tigris cleanup pending. Retry the same deletion.');}
   db.prepare('DELETE FROM permanent_deletion_jobs WHERE id=?').run(receipt.id);await db.flush({force:true});
 }
}
