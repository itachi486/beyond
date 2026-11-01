import {handle} from './index.mjs';

export default {async fetch(request,env){
 // This entrypoint cannot be used as the D1/AI Preview backend. No resource is
 // inferred or copied from Preview, and unsupported member writes stay closed.
 if(env.BEYOND_BACKEND_MODE!=='supabase-admin-production' ||
    env.APP_ORIGIN!=='https://beyond.itach9279.workers.dev' ||
    env.SUPABASE_CHARACTER_BUCKET!=='beyond-character-assets' ||
    env.DB || env.MEDIA || env.TIGRIS_BUCKET_NAME || !env.ASSETS?.fetch)
   return Response.json({error:'Production backend configuration requires operator review.'},{status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 return handle(request,env);
}};
