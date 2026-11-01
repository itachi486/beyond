// Export ONLY an approved backup, never openStore() or the running source DB.
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
export function collect(db) {
  if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) throw Error('Backup integrity failed');
  const records = [];
  for (const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
    if (!/^[a-z_]+$/.test(name)) throw Error('Unsupported table name');
    const keys = db.prepare(`PRAGMA table_info("${name}")`).all().filter(c => c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);
    if (!keys.length) throw Error('Table without a stable primary key');
    for (const row of db.prepare(`SELECT * FROM "${name}"`).all()) {
      const record = Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Uint8Array ? {encoding:'base64',data:Buffer.from(v).toString('base64')} : v]));
      records.push({collection:name,row_key:JSON.stringify(keys.map(k=>row[k])),record});
    }
  }
  return records;
}
if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const [source,target] = process.argv.slice(2);
  if (!source || !target) throw Error('Usage: node migration/export-sqlite.mjs BACKUP.sqlite NEW_PRIVATE_EXPORT.json');
  const bytes = await readFile(source); const db = new DatabaseSync(resolve(source),{readOnly:true});
  try {
    const records = collect(db);
    await writeFile(target, JSON.stringify({version:1,sourceSha256:createHash('sha256').update(bytes).digest('hex'),records}), {flag:'wx',mode:0o600});
    console.info('Private preservation export written; row values are not logged.');
  } finally { db.close(); }
}
