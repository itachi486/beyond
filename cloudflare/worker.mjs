import {cleanDueMembers} from './member-management.mjs';
import {openD1Store} from './d1-store.mjs';
import {validWorld} from "../src/features/creation/worldStore.ts";
import {cloudflareFetch} from './handler.mjs';
import {sqlRuntime} from './runtime-sql.mjs';
import {imageRuntime} from './runtime-images.mjs';
import {createTigris} from './tigris.mjs';
export default {async fetch(request,env){
 if(new URL(request.url).pathname!=='/api'&&!new URL(request.url).pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 try{return await cloudflareFetch(request,{...env,MEDIA:createTigris(env)},{loadSQL:sqlRuntime,codecs:{decode:async(...args)=>(await imageRuntime()).decode(...args),encode:async(...args)=>(await imageRuntime()).encode(...args)},validateWorld:validWorld});}
 catch{console.warn('beyond_api_initialization_failed',{path:new URL(request.url).pathname});return Response.json({error:'Cloudflare runtime initialization failed.'},{status:500,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
},async scheduled(_event,env){if(env.BEYOND_STAGE!=="migration-preview"||env.TIGRIS_BUCKET_NAME!=="beyond-preview"||env.APP_ORIGIN!=="https://beyond-cloudflare-preview.itach9279.workers.dev")return;const db=await openD1Store(env.DB,await sqlRuntime());try{await cleanDueMembers(db,createTigris(env));}finally{db.close();}}};
