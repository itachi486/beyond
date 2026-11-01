/* Paste into DevTools on EACH actual BEYOND origin/profile after stopping edits.
 * Read-only to application stores; downloads a private JSON package. No cookies,
 * sessionStorage or credential values are printed. Existing data is not changed.
 */
(async () => {
  const local = () => Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('beyond:')).sort().map(k=>[k,localStorage.getItem(k)]));
  const start=local(), databases=await indexedDB.databases();
  const targets=databases.filter(d=>d.name?.startsWith('beyond'));
  if(targets.some(d=>d.name!=='beyond-character-assets')) throw Error('Unknown BEYOND database: export aborted rather than omit data.');
  const encode=async v=>{
    if(v instanceof Blob){ const b=new Uint8Array(await v.arrayBuffer()); if(b.length>64*1024*1024)throw Error('Asset too large for this exporter'); let s=''; for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return {$blob: true,type:v.type,name:v instanceof File?v.name:null,lastModified:v instanceof File?v.lastModified:null,base64:btoa(s),sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('')}; }
    if(Array.isArray(v))return Promise.all(v.map(encode));
    if(v && typeof v==='object'){if(Object.getPrototypeOf(v)!==Object.prototype)throw Error('Unsupported stored value');return Object.fromEntries(await Promise.all(Object.entries(v).map(async([k,x])=>[k,await encode(x)])));}
    return v;
  };
  const stores=[];
  for(const d of targets){
    const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(d.name,d.version);q.onupgradeneeded=()=>{q.transaction.abort();reject(Error('Database changed; nothing exported'));};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(Error('Cannot read database'));});
    try {
      if([...db.objectStoreNames].some(n=>n!=='assets'))throw Error('Unknown store; export aborted');
      const rows=await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readonly'),q=tx.objectStore('assets').getAll();let data;q.onsuccess=()=>{data=q.result;};tx.oncomplete=()=>resolve(data);tx.onerror=tx.onabort=()=>reject(Error('Asset snapshot failed'));});
      stores.push({name:d.name,version:d.version,store:'assets',keyPath:'id',records:await encode(rows)});
    } finally { db.close(); }
  }
  if(JSON.stringify(start)!==JSON.stringify(local()))throw Error('World data changed during export. Stop editing and retry.');
  const packageData={format:'beyond-browser-preservation',version:1,origin:location.origin,createdAt:new Date().toISOString(),localStorage:start,indexedDB:stores};
  const blob=new Blob([JSON.stringify(packageData)],{type:'application/json'});
  if(blob.size>256*1024*1024)throw Error('Package too large; use a streaming exporter');
  const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=`beyond-browser-${location.hostname}-${location.port||'https'}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(href),60000);
  console.info('Private BEYOND browser preservation download prepared. Check the downloaded file; do not share it publicly.');
})().catch(()=>console.error('Browser preservation export failed. Original data was not modified. Stop edits and inspect supported storage before retrying.'));
