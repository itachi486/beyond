/* Run in DevTools only on isolated Preview. Select the private preservation JSON.
 * Export destination first. Close other Preview tabs before using this tool.
 * Existing values are never overwritten; conflicts abort before writes.
 */
(async () => {
  if (location.origin !== 'https://beyond-cloudflare-preview.itach9279.workers.dev') throw Error('Preview origin required');
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  const file=await new Promise(resolve=>{input.onchange=()=>resolve(input.files?.[0]);input.oncancel=()=>resolve(null);input.click();});
  if(!file)return;
  if(file.size>256*1024*1024)throw Error('Backup exceeds 256 MB');
  const p=JSON.parse(await file.text());
  if(p.format!=='beyond-browser-preservation'||p.version!==1||!p.localStorage||!Array.isArray(p.indexedDB))throw Error('Unsupported backup');
  const entries=Object.entries(p.localStorage);
  for(const [k,v]of entries){if(!k.startsWith('beyond:')||typeof v!=='string')throw Error('Invalid storage key');if(localStorage.getItem(k)!==null&&localStorage.getItem(k)!==v)throw Error('Existing Preview data conflicts; use a separate browser profile');}
  const decode=async v=>{
    if(v&&typeof v==='object'&&v.$blob===true){if(typeof v.base64!=='string'||v.base64.length>90*1024*1024)throw Error('Invalid asset');const bytes=Uint8Array.from(atob(v.base64),c=>c.charCodeAt(0));const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==v.sha256)throw Error('Asset checksum mismatch');return v.name===null?new Blob([bytes],{type:v.type}):new File([bytes],v.name,{type:v.type,lastModified:v.lastModified});}
    if(Array.isArray(v))return Promise.all(v.map(decode));
    if(v&&typeof v==='object'){const out=Object.create(null);for(const[k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe metadata');out[k]=await decode(x);}return out;}return v;
  };
  if(p.indexedDB.length>1)throw Error('Unsupported database count');
  const spec=p.indexedDB[0];let rows=[];
  if(spec){if(spec.name!=='beyond-character-assets'||spec.version!==1||spec.store!=='assets'||spec.keyPath!=='id'||!Array.isArray(spec.records))throw Error('Unsupported asset schema');rows=await decode(spec.records);if(rows.some(r=>typeof r.id!=='string'||!r.id)||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Invalid asset IDs');}
  const estimate=await navigator.storage.estimate();if(estimate.quota&&estimate.quota-(estimate.usage||0)<file.size)throw Error('Insufficient estimated storage');
  // Existing nonempty asset stores are rejected, even when IDs appear equal.
  let db;
  if(spec){db=await new Promise((resolve,reject)=>{const q=indexedDB.open(spec.name,1);q.onupgradeneeded=()=>q.result.createObjectStore('assets',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(Error('Cannot open assets'));});const count=await new Promise((resolve,reject)=>{const q=db.transaction('assets').objectStore('assets').count();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(Error('Cannot inspect assets'));});if(count){db.close();throw Error('Preview assets already exist; use a fresh browser profile');}}
  if(!confirm(`Restore ${entries.length} storage records and ${rows.length} assets into isolated Preview? Original IDs and personal content are retained. Close all other Preview tabs first.`)){db?.close();return;}
  const added=[];
  try{
    // One atomic IDB transaction; add() refuses duplicate IDs.
    if(db)await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');for(const r of rows)tx.objectStore('assets').add(r);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(Error('Asset restore failed'));});
    for(const[k,v]of entries){const current=localStorage.getItem(k);if(current!==null&&current!==v)throw Error('Preview changed during restore');if(current===null){localStorage.setItem(k,v);added.push(k);}}
    if(entries.some(([k,v])=>localStorage.getItem(k)!==v))throw Error('Storage verification failed');
    console.info(`Preview restoration verified: ${entries.length} storage records, ${rows.length} assets. Export Preview again and compare checksums before use.`);
  }catch(e){for(const k of added){if(localStorage.getItem(k)===p.localStorage[k])localStorage.removeItem(k);} // Only keys created by this operation.
    // Retain successfully imported assets on failure; never clear a shared store.
    throw Error('Restore interrupted. Existing values were preserved; newly imported assets may remain. Keep the backup and use a fresh profile to retry.');
  }finally{db?.close();}
})().catch(e=>console.error(e.message));
