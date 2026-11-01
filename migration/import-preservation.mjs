// Default is offline planning. --check is read-only; --apply stages INACTIVE data.
import {readFile} from 'node:fs/promises';
import {prepareBatch,compareRows,stageBatch,MigrationError} from './batch.mjs';
import {createRemoteIO} from './remote.mjs';
const [input,directory,...args]=process.argv.slice(2);
const mode=args[0]||'--plan';
if(!input||!directory||!['--plan','--check','--apply'].includes(mode)||args.length>1)throw Error('Usage: node --env-file=.env.local migration/import-preservation.mjs PRIVATE_EXPORT.json COPIED_ASSETS [--plan|--check|--apply]');
try{
 const plan=await prepareBatch(JSON.parse(await readFile(input,'utf8')),directory);
 console.info(JSON.stringify({mode,batchId:plan.batchId,records:plan.records.length,collections:plan.counts,referencedFiles:plan.objects.length,bytes:plan.objects.reduce((n,o)=>n+o.bytes,0)}));
 if(mode!=='--plan'){
   const io=createRemoteIO(process.env);
   if(mode==='--check'){
     const storage=await io.storage();if(!storage.private)throw new MigrationError('Target bucket is not verified private');
     const active=await io.active(),batch=await io.batch(plan.batchId),rows=await io.rows(plan.batchId);
     compareRows(plan.records,rows);
     if(batch&&batch.source_sha256!==plan.sourceSha256)throw new MigrationError('Batch metadata conflict');
     console.info(JSON.stringify({readOnly:true,existingBatch:!!batch,existingRows:rows.length,targetBatchActive:active.some(r=>r.batch_id===plan.batchId),existingActiveBatches:active.length,conflictingRows:0,applyExecuted:false}));
   }else {io.progress=(done,total)=>{if(done%5===0||done===total)console.info(JSON.stringify({verifiedFiles:done,totalFiles:total}));};console.info(JSON.stringify(await stageBatch(plan,io)));}
 }
}catch(error){console.error(error instanceof MigrationError ? error.message : error instanceof SyntaxError ? 'Invalid preservation JSON; file content is not logged.' : 'Preservation file or remote check failed; credentials, file contents and server response are not logged.');process.exitCode=1;}
