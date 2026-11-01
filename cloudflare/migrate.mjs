// Isolated preview only. Never accepts a production database/bucket override.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createTigris} from './tigris.mjs';
import {prepareBatch,canonical} from '../migration/batch.mjs';
const [mode='--inspect']=process.argv.slice(2);
if(!['--inspect','--d1','--media','--activate','--verify','--preview'].includes(mode))throw Error('Unknown migration mode');
const root='/home/administrator/beyond-backups/cloudflare-preview',resources=JSON.parse(await readFile(root+'/resources.json','utf8'));
if(resources.d1?.name!=='beyond-migration-preview')throw Error('Isolated D1 target not confirmed');
const bucket='beyond-preview',source='/home/administrator/beyond-backups/migration-prep-20261029T214455Z';
const document=JSON.parse(await readFile(source+'/preservation-export.json','utf8')),plan=await prepareBatch(document,source+'/character-assets');
const token=process.env.CLOUDFLARE_API_TOKEN;if(!token)throw Error('Cloudflare authentication missing');
const headers={Authorization:`Bearer ${token}`},base=`https://api.cloudflare.com/client/v4/accounts/${resources.account}`;
async function api(path,options={}){const r=await fetch(base+path,{...options,headers:{...headers,...options.headers},redirect:'manual',signal:AbortSignal.timeout(120000)});let d;try{d=await r.json()}catch{throw Error('Cloudflare response unavailable');}if(!r.ok||!d.success)throw Error('Cloudflare operation failed; codes '+JSON.stringify(d.errors?.map(e=>e.code)));return d.result;}
async function sql(text){const result=await api('/d1/database/'+resources.d1.uuid+'/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql:text})});if(result.some(r=>!r.success))throw Error('D1 SQL failed; no sensitive statement logged');return result;}
const quote=v=>v===null?'NULL':typeof v==='number'&&Number.isFinite(v)?String(v):typeof v==='string'?"'"+v.replaceAll("'","''")+"'":v?.encoding==='base64'?"X'"+Buffer.from(v.data,'base64').toString('hex')+"'":(()=>{throw Error('Unsupported cell')})();
const target=c=>c==='sessions'?'legacy_sessions':c==='login_limits'?'legacy_login_limits':c;
const tables=['admins','worlds','discoveries','connections','revisions','settings','central_characters','central_activity','schema_versions','sessions','login_limits','permanent_deletion_jobs','ai_generations','ai_character_assets'];
async function compare(){const counts={};for(const collection of tables){const expected=document.records.filter(r=>r.collection===collection).map(r=>r.record),actual=(await sql('SELECT * FROM '+target(collection)))[0].results;const key=collection==='sessions'?'token_hash':collection==='login_limits'?'key_hash':collection==='schema_versions'?'version':'id';const by=new Map(expected.map(r=>[r[key],r]));for(const row of actual){if(!by.has(row[key])||canonical(row)!==canonical(by.get(row[key])))throw Error('D1 row conflict in '+collection+'; nothing overwritten');}counts[collection]={expected:expected.length,actual:actual.length};}return counts;}
const storage=createTigris(process.env);if(storage.bucket!==bucket)throw Error('Isolated Tigris bucket not confirmed');
async function checkFiles(){let checked=0;for(const object of plan.objects){const r=await storage.get(object.key);if(!r||createHash('sha256').update(new Uint8Array(await r.arrayBuffer())).digest('hex')!==object.sha256)throw Error('Tigris object unavailable or hash mismatch');checked++;}return checked;}

try{
 if(mode==='--inspect'){console.log(JSON.stringify({target:'isolated-preview',records:plan.records.length,files:plan.objects.length,source:plan.sourceSha256}));process.exit(0);}
 if(mode==='--d1'){
   await sql(await readFile('cloudflare/migrations/0001_application.sql','utf8'));
   const state=(await sql('SELECT * FROM cf_state WHERE id=1'))[0].results[0];if(state.ready)throw Error('Preview already active; no migration writes allowed');if(state.source_sha256&&state.source_sha256!==document.sourceSha256)throw Error('Different snapshot already staged');
   await compare();
   for(const collection of tables){const rows=document.records.filter(r=>r.collection===collection).map(r=>r.record);if(!rows.length)continue;const columns=Object.keys(rows[0]);for(let i=0;i<rows.length;i+=20){await sql(`INSERT OR IGNORE INTO ${target(collection)}(${columns.join(',')}) VALUES `+rows.slice(i,i+20).map(r=>'('+columns.map(c=>quote(r[c])).join(',')+')').join(','));}}
   await sql('UPDATE cf_state SET source_sha256='+quote(document.sourceSha256)+' WHERE id=1 AND ready=0');
 }
 let transferredFiles=null;
 if(mode==='--media'||mode==='--preview'){
   await storage.headBucket();const privacy=await storage.privacy();if(!privacy.private)throw Error('Private bucket required');
   let next=0,checked=0;await Promise.all(Array.from({length:3},async()=>{while(next<plan.objects.length){const object=plan.objects[next++],old=await storage.get(object.key);if(old){if(createHash('sha256').update(new Uint8Array(await old.arrayBuffer())).digest('hex')!==object.sha256)throw Error('Existing Tigris content conflict');}else{const bytes=await readFile(object.file);if(createHash('sha256').update(bytes).digest('hex')!==object.sha256)throw Error('Source file changed');const put=await storage.put(object.key,bytes,{onlyIf:new Headers({'If-None-Match':'*'})});if(!put)throw Error('Concurrent Tigris write conflict');const copied=await storage.get(object.key);if(!copied||createHash('sha256').update(new Uint8Array(await copied.arrayBuffer())).digest('hex')!==object.sha256)throw Error('Tigris verification failed');}checked++;if(checked%10===0||checked===plan.objects.length)console.log(JSON.stringify({verifiedMedia:checked,total:plan.objects.length}));}}));transferredFiles=checked;
 }

 const counts=await compare();if(Object.values(counts).some(c=>c.expected!==c.actual))throw Error('D1 import incomplete');
 const live=(await sql('SELECT (SELECT count(*) FROM sessions) sessions,(SELECT count(*) FROM login_limits) limits'))[0].results[0];if(live.sessions||live.limits)throw Error('Old security records were not isolated');
 let files=transferredFiles;if(mode==='--verify'||mode==='--activate')files=await checkFiles();
 if(mode==='--activate'||mode==='--preview'){if(files!==plan.objects.length)throw Error('Files not verified');await sql('UPDATE cf_state SET ready=1,revision=revision+1 WHERE id=1 AND ready=0');}
 const report={mode,target:'isolated-preview',counts,activeSessions:live.sessions,activeRateLimits:live.limits,verifiedFiles:files,productionChanged:false};await writeFile(root+'/result-'+mode.slice(2)+'-'+Date.now()+'.json',JSON.stringify(report,null,2),{mode:0o600,flag:'wx'});console.log(JSON.stringify(report));
}catch(e){console.error(e.message.startsWith('Cloudflare operation failed;')?e.message:'Isolated migration stopped safely: '+(e.message.includes('conflict')?'conflicting data':e.message.includes('incomplete')?'incomplete import':e.message.includes('active')?'already-active target':'operation not verified; no source or production data overwritten'));process.exitCode=1;}
