// Server-only REST transport. No Node, filesystem or SQLite dependency.
export class BackendError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function supabase(env, transport = fetch) {
  let base;
  try { base = new URL(env.SUPABASE_URL); } catch { throw new BackendError(503, "Supabase is not configured."); }
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new BackendError(503, "Server database configuration is incomplete.");
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
