// Explicit isolation guard: this tool cannot deploy the existing production worker.
import{readFile,writeFile,mkdtemp,unlink}from'node:fs/promises';import{parseEnv}from'node:util';import{spawn}from'node:child_process';import{resolve}from'node:path';
const config=JSON.parse(await readFile('wrangler.cloudflare.preview.jsonc','utf8'));
const resources=JSON.parse(await readFile('/home/administrator/beyond-backups/cloudflare-preview/resources.json','utf8'));
if(config.name!=='beyond-cloudflare-preview'||config.d1_databases?.[0]?.database_name!=='beyond-migration-preview'||config.d1_databases[0].database_id!==resources.d1.uuid||config.vars?.TIGRIS_BUCKET_NAME!=='beyond-preview'||config.r2_buckets)throw Error('Isolated target guard failed');
const env={...parseEnv(await readFile('.env.local','utf8')),...process.env,CLOUDFLARE_ACCOUNT_ID:resources.account,WRANGLER_SEND_METRICS:'false'};
for(const name of ['ADMIN_ALLOWED_EMAIL','TIGRIS_ACCESS_KEY_ID','TIGRIS_SECRET_ACCESS_KEY','CLOUDFLARE_API_TOKEN'])if(!env[name])throw Error('Required server configuration missing: '+name);
const run=args=>new Promise((ok,no)=>{const child=spawn(resolve('node_modules/.bin/wrangler'),args,{env,stdio:'inherit'});child.on('exit',code=>code===0?ok():no(Error('Preview CLI operation failed')));});
// Preserve existing secret values; upload only bindings that are actually missing.
const settingsResponse=await fetch(`https://api.cloudflare.com/client/v4/accounts/${resources.account}/workers/scripts/beyond-cloudflare-preview/settings`,{headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`}});
const settings=await settingsResponse.json();if(!settingsResponse.ok||!settings.success)throw Error('Cannot verify Preview secret names; no deployment attempted');
const existing=new Set((settings.result.bindings||[]).filter(b=>b.type==='secret_text').map(b=>b.name));
const pending=Object.fromEntries(['ADMIN_ALLOWED_EMAIL','TIGRIS_ACCESS_KEY_ID','TIGRIS_SECRET_ACCESS_KEY','RESEND_API_KEY','AUTH_EMAIL_FROM'].filter(name=>env[name]&&!existing.has(name)).map(name=>[name,env[name]]));
await run(['deploy','--config','wrangler.cloudflare.preview.jsonc']);
if(!Object.keys(pending).length){console.log('Existing Preview secret bindings preserved; no secret writes needed.');process.exit(0);}
const dir=await mkdtemp('/tmp/beyond-preview-server-secrets-'),file=dir+'/secrets.json';await writeFile(file,JSON.stringify(pending),{mode:0o600,flag:'wx'});
try{await run(['secret','bulk',file,'--config','wrangler.cloudflare.preview.jsonc']);}finally{await unlink(file);}
