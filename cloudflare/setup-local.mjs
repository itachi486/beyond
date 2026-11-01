import{readFile,writeFile,mkdir,chmod}from'node:fs/promises';import{parseEnv}from'node:util';import{resolve}from'node:path';
const env={...parseEnv(await readFile('.env.local','utf8')),...process.env},dir=resolve('.local/cloudflare-runtime');await mkdir(dir,{recursive:true,mode:0o700});await chmod(dir,0o700);
const config=JSON.parse(await readFile('wrangler.cloudflare.local.jsonc','utf8'));config.main=resolve('cloudflare/worker.mjs');config.assets.directory=resolve('dist');config.d1_databases[0].migrations_dir=resolve('cloudflare/migrations');
await writeFile(dir+'/wrangler.jsonc',JSON.stringify(config,null,2),{mode:0o600});
const names=['ADMIN_ALLOWED_EMAIL','TIGRIS_ACCESS_KEY_ID','TIGRIS_SECRET_ACCESS_KEY'];for(const name of names)if(!env[name])throw Error('Required server configuration missing: '+name);
await writeFile(dir+'/.dev.vars',names.map(k=>k+'='+JSON.stringify(env[k])).join('\n')+'\n',{mode:0o600});
console.info('Private local Workers configuration prepared; no secret values printed.');
