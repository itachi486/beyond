import {studioTables,studioSchema} from './studio-schema.mjs';
import {budgetCertificationSchema} from './budget-schema.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {schema,managedImageSchema,userSchema,memberSchema} from './schema.mjs';
export const tables=['admins','worlds','discoveries','connections','revisions','settings','central_characters','central_activity','sessions','login_limits','permanent_deletion_jobs','schema_versions','ai_generations','ai_character_assets','ai_asset_objects','workers_ai_requests','managed_images','user_accounts','user_sessions','user_tokens','user_limits','user_world_assets','user_worlds','user_world_revisions','member_profiles','member_audit','member_deletions'];
const bind=v=>v instanceof Uint8Array?Array.from(v):v;
export class CommitConflict extends Error {}
const templates=new WeakMap();
function emptyDatabase(SQL,hasBudgetUnits=false,hasProof=false){let variants=templates.get(SQL);if(!variants){variants=new Map();templates.set(SQL,variants);}let bytes=variants.get(`${hasBudgetUnits}:${hasProof}`);if(!bytes){const seed=new SQL.Database();try{seed.exec(schema+managedImageSchema+userSchema+memberSchema+studioSchema);if(hasBudgetUnits)seed.exec('ALTER TABLE workers_ai_requests ADD COLUMN reserved_units TEXT');if(hasProof)seed.exec(budgetCertificationSchema);bytes=seed.export();variants.set(`${hasBudgetUnits}:${hasProof}`,bytes);}finally{seed.close();}}return new SQL.Database(bytes);}
// A bounded synchronous compatibility view preserves the existing SQL contracts.
// D1 is authoritative; only captured parameterized writes are replayed atomically.
export async function openD1Store(binding,SQL,{authorization=null,maxRows=20000,selectedTables=tables}={}){
 const available=[...tables,...studioTables.filter(t=>selectedTables.includes(t))];
 const selected=available.filter(t=>selectedTables.includes(t));
 const [proofSchema]=await binding.batch([binding.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='b10_ledger_certifications'")]);
 const hasProof=!!proofSchema.results.length;
 if(hasProof&&selected.includes('workers_ai_requests'))selected.push('b10_ledger_certifications');
 const snapshot=await binding.batch([binding.prepare('SELECT revision,ready FROM cf_state WHERE id=1'),...selected.map(t=>binding.prepare(`SELECT rowid AS __rowid,* FROM ${t} ORDER BY rowid`)),...(selected.includes('workers_ai_requests')?[binding.prepare('PRAGMA table_info(workers_ai_requests)')]:[])]);
 if(snapshot.some(r=>!r.success))throw Error('D1 read failed');
 const state=snapshot[0].results[0];if(!state?.ready)throw Error('Migration not activated');
 if(snapshot.slice(1,selected.length+1).reduce((n,r)=>n+r.results.length,0)>maxRows)throw Error('Compatibility dataset exceeds configured safety budget');
 const hasUnits=selected.includes('workers_ai_requests')&&snapshot.at(-1).results.some(c=>c.name==='reserved_units');
 const memory=emptyDatabase(SQL,hasUnits,hasProof);memory.exec('PRAGMA foreign_keys=OFF');
 for(const [i,t] of selected.entries())for(const row of snapshot[i+1].results){const columns=Object.keys(row),values=columns.map(k=>k==='__rowid'?row[k]:row[k]);const stmt=memory.prepare(`INSERT INTO ${t}(${columns.map(k=>k==='__rowid'?'rowid':k).join(',')}) VALUES(${columns.map(()=>'?').join(',')})`);try{stmt.run(values);}finally{stmt.free();}}
 memory.exec('PRAGMA foreign_keys=ON');
 if(memory.exec('PRAGMA foreign_key_check').length)throw Error('D1 relationships are inconsistent');
 let pending=[],transactionStart=null,revision=state.revision,memberScope=null;
 const db={
   async assertLegacyMediaAllowed(){
     const [schema]=await binding.batch([binding.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='b10_control'")]);
     if(schema.results.length){const [control]=await binding.batch([binding.prepare('SELECT active FROM b10_control WHERE id=1')]);if(control.results[0]?.active)throw new CommitConflict('Native writer required; legacy media writes are paused.');}
   },
   async hasUnresolvedResults(owner){
     const [schema]=await binding.batch([binding.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_jobs'")]);
     const native=schema.results.length?" AND NOT EXISTS(SELECT 1 FROM ai_jobs j WHERE j.ledger_id=r.id AND j.state='QUEUED' AND j.provider_phase='NOT_DISPATCHED')":'';
     const [result]=await binding.batch([binding.prepare("SELECT 1 FROM workers_ai_requests r WHERE r.actor=? AND r.status='pending'"+native+" LIMIT 1").bind(owner)]);return !!result.results.length;
   },
   async resultGeneration(owner,worldId){
     const [schema]=await binding.batch([binding.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_world_heads'")]);if(!schema.results.length)return 0;
     const [rows]=await binding.batch([binding.prepare('SELECT cleanup_generation FROM ai_world_heads WHERE owner_id=? AND world_id=?').bind(owner,worldId)]);const generation=rows.results[0]?.cleanup_generation??0;
     if(!Number.isSafeInteger(generation)||generation<0)throw new CommitConflict('result_owner_unavailable');return generation;
   },
   async assertResultOwner(owner,worldId,expectedGeneration){
     const [rows]=await binding.batch([binding.prepare("SELECT 1 FROM user_accounts a JOIN member_profiles p ON p.user_id=a.id JOIN user_worlds w ON w.owner_id=a.id WHERE a.id=? AND w.id=? AND (p.status='active' OR p.status='deletion_pending' AND p.delete_after>strftime('%Y-%m-%dT%H:%M:%fZ','now')) AND NOT EXISTS(SELECT 1 FROM member_deletions d WHERE d.user_id=a.id AND d.phase IN ('cleaning','retry','done'))").bind(owner,worldId)]);
     if(!rows.results.length||await this.resultGeneration(owner,worldId)!==expectedGeneration)throw new CommitConflict('result_owner_unavailable');
   },
   async failOwnedResult(owner,id){
     // Terminal error only for the existing actor's reservation; never recreate
     // a row or infer/refund a provider charge. No session is needed to retain it.
     const [schema]=await binding.batch([binding.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='b10_control'")]);let active=false;
     if(schema.results.length){const [r]=await binding.batch([binding.prepare('SELECT active FROM b10_control WHERE id=1')]);active=!!r.results[0]?.active;}
     const guardId=randomUUID();const statements=[binding.prepare('INSERT INTO cf_commit_guards VALUES(?,CASE WHEN (SELECT ready=1 AND revision<9007199254740991 FROM cf_state WHERE id=1) THEN 1 ELSE 0 END)').bind(guardId)];if(active)statements.push(binding.prepare("INSERT INTO b10_context VALUES(1,'late-result-error')"));
     statements.push(binding.prepare("UPDATE workers_ai_requests SET status='error',response='result_owner_unavailable' WHERE actor=? AND id=? AND status='pending'").bind(owner,id),binding.prepare('UPDATE cf_state SET revision=revision+1 WHERE id=1 AND revision<9007199254740991'));
     if(active)statements.push(binding.prepare('DELETE FROM b10_context WHERE id=1'));statements.push(binding.prepare('DELETE FROM cf_commit_guards WHERE id=?').bind(guardId));await binding.batch(statements);
   },
   beginMemberMutation(id,{cleanup=false}={}){
     if(pending.length||transactionStart!==null||memberScope)throw new CommitConflict('Member mutation requires a fresh snapshot.');
     const profile=this.prepare('SELECT * FROM member_profiles WHERE user_id=?').get(id);
     if(!profile)throw new CommitConflict('Member not found.');
     const account=this.prepare('SELECT credential_version FROM user_accounts WHERE id=?').get(id);if(!account)throw new CommitConflict('Member not found.');
     memberScope={id,cleanup,version:profile.version,credentialVersion:account.credential_version};
   },
   endMemberMutation(){memberScope=null;},
   get isTransaction(){return transactionStart!==null;},
   prepare(sql){return {
     all(...params){const stmt=memory.prepare(sql);try{stmt.bind(params);const out=[];while(stmt.step())out.push(stmt.getAsObject());return out;}finally{stmt.free();}},
     get(...params){return this.all(...params)[0];},
     run(...params){const stmt=memory.prepare(sql);try{stmt.run(params);}finally{stmt.free();}const changes=memory.getRowsModified();pending.push({sql,params});return {changes};},
   };},
   exec(sql){
     const kind=sql.trim().toUpperCase();
     if(kind.startsWith('BEGIN')){if(transactionStart!==null)throw Error('Nested transaction');memory.exec(sql);transactionStart=pending.length;return;}
     if(kind==='COMMIT'){memory.exec(sql);transactionStart=null;return;}
     if(kind==='ROLLBACK'){memory.exec(sql);if(transactionStart!==null)pending=pending.slice(0,transactionStart);transactionStart=null;return;}
     // The complete schema was installed outside requests. Legacy ensure() is a no-op.
     if(kind.startsWith('CREATE TABLE IF NOT EXISTS')||kind.startsWith('CREATE INDEX IF NOT EXISTS'))return;
     throw Error('Unsupported runtime SQL exec');
   },
   async flush({force=false}={}){
     if(transactionStart!==null)throw Error('Unclosed transaction');
     if(!pending.length&&!force)return;
     if(!Number.isSafeInteger(revision)||revision<0||revision>=Number.MAX_SAFE_INTEGER)throw new CommitConflict('Invalid global revision range; data was not committed.');
     const id=randomUUID(),params=[id,revision];let guard='(SELECT revision=? AND ready=1 AND revision<9007199254740991 FROM cf_state WHERE id=1)';
     const authority=typeof authorization==='function'?authorization():authorization;
     if(authority?.kind==='user'){guard+=` AND EXISTS(SELECT 1 FROM user_sessions s JOIN user_accounts u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND NOT EXISTS(SELECT 1 FROM member_profiles p WHERE p.user_id=u.id AND p.status<>'active') AND s.credential_version=u.credential_version)`;params.push(authority.tokenHash);}
     else if(authority){guard+=` AND EXISTS(SELECT 1 FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND a.email=? AND (SELECT COUNT(*) FROM admins)=1)`;params.push(authority.tokenHash,authority.email);}
     let native=false;
     if(memberScope){
       const [schema]=await binding.batch([binding.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='b10_control'")]);
       if(schema.results.length){const [control]=await binding.batch([binding.prepare('SELECT active FROM b10_control WHERE id=1')]);native=!!control.results[0]?.active;}
       const {id:owner,cleanup,version,credentialVersion}=memberScope;
       guard+=cleanup?` AND EXISTS(SELECT 1 FROM member_profiles p JOIN member_deletions d ON d.user_id=p.user_id WHERE p.user_id=? AND p.status='deletion_pending' AND p.delete_after<=strftime('%Y-%m-%dT%H:%M:%fZ','now') AND d.phase IN ('pending','cleaning','retry'))`:` AND EXISTS(SELECT 1 FROM member_profiles p WHERE p.user_id=? AND p.version=? AND p.version<9007199254740991 AND EXISTS(SELECT 1 FROM user_accounts a WHERE a.id=p.user_id AND a.credential_version=? AND a.credential_version<9007199254740991) AND (p.status<>'deletion_pending' OR p.delete_after>strftime('%Y-%m-%dT%H:%M:%fZ','now')) AND NOT EXISTS(SELECT 1 FROM member_deletions d WHERE d.user_id=p.user_id AND d.phase IN ('cleaning','retry','done')))`;
       params.push(owner,...(cleanup?[]:[version,credentialVersion]));
       if(cleanup){guard+=" AND NOT EXISTS(SELECT 1 FROM workers_ai_requests r WHERE r.actor=? AND r.status='pending'"+(native?" AND NOT EXISTS(SELECT 1 FROM ai_jobs j WHERE j.ledger_id=r.id AND j.state='QUEUED' AND j.provider_phase='NOT_DISPATCHED')":'')+")";params.push(owner);}
       if(native&&cleanup){guard+=" AND NOT EXISTS(SELECT 1 FROM ai_world_heads WHERE owner_id=? AND (typeof(cleanup_generation)<>'integer' OR cleanup_generation<0 OR cleanup_generation>=9007199254740991))";params.push(owner);}
     }
     // Validate the final compatibility snapshot, not a SQL-text pattern.
     // This covers INSERT, REPLACE, UPDATE, quoted identifiers and CTE writers.
     // Reads stay compatible; only a write/forced commit requires valid revisions.
     const revisionChecks=[];
     for(const table of available){
       const columns=db.prepare('PRAGMA table_info('+table+')').all().filter(c=>['version','revision','credential_version','cleanup_generation'].includes(c.name));
       if(columns.length&&pending.some(({sql})=>new RegExp('(?:^|[^a-zA-Z0-9_])'+table+'(?:$|[^a-zA-Z0-9_])','i').test(sql))){
         const invalid=columns.map(c=>`typeof(${c.name})<>'integer' OR ${c.name}<0 OR ${c.name}>9007199254740991`).join(' OR ');
         revisionChecks.push(`NOT EXISTS(SELECT 1 FROM ${table} WHERE ${invalid})`);
       }
       for(const c of columns){
         const invalid=db.prepare(`SELECT 1 FROM ${table} WHERE typeof(${c.name})<>'integer' OR ${c.name}<0 OR ${c.name}>9007199254740991 LIMIT 1`).get();
         if(invalid)throw new CommitConflict('Invalid revision range; data was not committed.');
       }
     }
     // The route may write a table absent from selectedTables. Recheck its
     // actual post-write values inside the same atomic batch before commit.
     const revisionGuard=id+':revision';
     const revisionStatements=revisionChecks.length?[
       binding.prepare(`INSERT INTO cf_commit_guards(id,ok) VALUES(?,CASE WHEN ${revisionChecks.join(' AND ')} THEN 1 ELSE 0 END)`).bind(revisionGuard),
       binding.prepare('DELETE FROM cf_commit_guards WHERE id=?').bind(revisionGuard),
     ]:[];
     const statements=[binding.prepare(`INSERT INTO cf_commit_guards(id,ok) VALUES(?,CASE WHEN ${guard} THEN 1 ELSE 0 END)`).bind(...params),...pending.map(({sql,params})=>binding.prepare(sql).bind(...params.map(bind))),...revisionStatements,binding.prepare('UPDATE cf_state SET revision=revision+1 WHERE id=1'),binding.prepare('DELETE FROM cf_commit_guards WHERE id=?').bind(id)];
     if(native){
       // Capability is issued only by the member-management routines on a fresh
       // snapshot. Keep global CAS and fresh caller authorization; never expose
       // the marker to arbitrary legacy/world/ledger writers.
       statements.splice(1,0,binding.prepare('INSERT INTO b10_context VALUES(1,?)').bind(memberScope.cleanup?'member-cleanup':'member-change'));
       if(memberScope.cleanup){
         statements.splice(2,0,binding.prepare('UPDATE ai_world_heads SET cleanup_generation=cleanup_generation+1 WHERE owner_id=?').bind(memberScope.id));
         const purges=pending.some(p=>/^DELETE FROM user_accounts WHERE id=\?$/i.test(p.sql));
         if(purges)statements.push(binding.prepare('INSERT OR IGNORE INTO b10_deleted_owners VALUES(?,?)').bind(createHash('sha256').update(memberScope.id).digest('hex'),new Date().toISOString()));
       }
       statements.push(binding.prepare('DELETE FROM b10_context WHERE id=1'));
     }
     try{const result=await binding.batch(statements);if(result.some(r=>!r.success))throw Error();}catch{throw new CommitConflict('Concurrent change or expired authorization; retry after refreshing.');}
     revision++;pending=[];if(memberScope&&!memberScope.cleanup)memberScope=null;
   },
   close(){memory.close();},
 };
 return db;
}
