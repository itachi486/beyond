// Server-only REST transport. No filesystem or SQLite dependency.
import {createHash} from 'node:crypto';
export class BackendError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function supabase(env, transport = fetch) {
  let base;
  try { base = new URL(env.SUPABASE_URL); } catch { throw new BackendError(503, "Supabase is not configured."); }
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new BackendError(503, "Server database configuration is incomplete.");
  if(env.BEYOND_BACKEND_MODE==='supabase-admin-production' &&
     (!/^[a-f0-9]{64}$/.test(env.SUPABASE_PROJECT_ORIGIN_SHA256||'') ||
      createHash('sha256').update(base.origin).digest('hex')!==env.SUPABASE_PROJECT_ORIGIN_SHA256))
    throw new BackendError(503,'Production database identity requires operator review.');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  let serviceRole = false;
  try { serviceRole = JSON.parse(atob(key.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).role === "service_role"; } catch { /* Not a legacy JWT. */ }
  if (!key.startsWith("sb_secret_") && !serviceRole)
    throw new BackendError(503, "A server secret or service_role key is required; a publishable key cannot migrate private data.");
  return async function request(path, options = {}) {
    const {allowedStatuses = [], timeoutMs = 15000, ...requestOptions} = options;
    if (!path.startsWith("/rest/v1/") && !path.startsWith("/storage/v1/object/") && !(path.startsWith('/storage/v1/bucket/') && (!options.method || options.method === 'GET'))) throw new BackendError(500, "Invalid backend operation.");
    let response;
    try {
      response = await transport(new URL(path, base), {
        ...requestOptions, redirect: "manual", signal: AbortSignal.timeout(timeoutMs),
        headers: { ...options.headers, apikey: key, ...(serviceRole ? {Authorization: `Bearer ${key}`} : {}) },
      });
    } catch { throw new BackendError(503, "Database connection unavailable. Try again later."); }
    if (!response.ok && !allowedStatuses.includes(response.status)) throw new BackendError(503, "Database or private asset unavailable. Contact the operator.");
    return response;
  };
}

// Never infer a Production dataset from a project name or silently follow a
// changed active pointer. These are GET-only checks, with no cross-request cache.
export async function verifyProductionDataset(backend,env){
 if(env.BEYOND_BACKEND_MODE!=='supabase-admin-production')return;
 const expected=env.SUPABASE_EXPECTED_BATCH;
 if(!/^beyond-[a-f0-9]{64}$/.test(expected||''))throw new BackendError(503,'Production dataset identity requires operator review.');
 const active=await(await backend('/rest/v1/beyond_active_batch?select=batch_id')).json();
 if(!Array.isArray(active)||active.length!==1||active[0].batch_id!==expected)throw new BackendError(503,'Production dataset changed; operator review is required.');
 const batches=await(await backend('/rest/v1/beyond_migration_batches?select=id,verified&id=eq.'+encodeURIComponent(expected))).json();
 if(!Array.isArray(batches)||batches.length!==1||batches[0].id!==expected||batches[0].verified!==true)throw new BackendError(503,'Production dataset is not verified.');
}
