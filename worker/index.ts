interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: { changes: number; [key: string]: unknown };
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
interface Fetcher {
  fetch(request: Request): Promise<Response>;
}
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  ADMIN_SETUP_TOKEN: string;
}

const SESSION_TTL = 8 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 600_000;
const originalOrder = new Map([
  ["a-day-longer-than-a-year", 0], ["worlds-around-other-suns", 1],
  ["an-island-of-its-own", 2], ["cities-inside-stone", 3],
  ["the-invisible-scaffolding", 4], ["an-ocean-under-ice", 5],
  ["the-animals-that-build-reefs", 6], ["light-written-in-the-sky", 7],
]);

function json(value: unknown, status = 200, extra: HeadersInit = {}): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  return new Response(JSON.stringify(value), { status, headers });
}
function parseRow(row: Record<string, unknown>) {
  const data = JSON.parse(String(row.data));
  return { ...data, id: row.id, slug: row.slug, status: row.status,
    version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
}
function eligible(d: Record<string, any>): boolean {
  if (d.verificationStatus === "rejected") return false;
  if (d.truthType === "factual") return d.verificationStatus === "verified" || d.legacyPublished === true;
  return ["hypothesis", "fictional"].includes(d.truthType) && d.verificationStatus === "hypothetical";
}
async function publicUniverse(db: D1Database) {
  const [wr, dr, cr, sr] = await Promise.all([
    db.prepare("SELECT id,slug,status,data,version,created_at,updated_at FROM worlds WHERE status='published'").all(),
    db.prepare("SELECT id,slug,world_id,status,data,version,created_at,updated_at FROM discoveries WHERE status='published'").all(),
    db.prepare("SELECT id,from_id,to_id,explanation FROM connections ORDER BY rowid").all(),
    db.prepare("SELECT data FROM settings WHERE id=1").first<{data:string}>(),
  ]);
  const worlds = (wr.results || []).map(parseRow).sort((a:any,b:any)=>a.order-b.order)
    .map(({status,version,createdAt,updatedAt,...w}:any)=>({...w,
      name:{en:w.name.en,es:w.name.es||w.name.en},
      description:{en:w.description.en,es:w.description.es||w.description.en}}));
  const visible = new Set(worlds.map((w:any)=>w.id));
  const records = (dr.results || []).map(parseRow).filter((d:any)=>visible.has(d.worldId)&&eligible(d))
    .sort((a:any,b:any)=>(originalOrder.get(a.id)??999999)-(originalOrder.get(b.id)??999999)
      ||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  const ids = new Set(records.map((d:any)=>d.id));
  const connections = (cr.results||[]).filter((c:any)=>ids.has(c.from_id)&&ids.has(c.to_id));
  const discoveries = records.map((d:any)=>({
    id:d.id,slug:d.slug,aliases:d.aliases,title:{en:d.title.en,es:d.title.es||d.title.en},
    summary:{en:d.summary.en,es:d.summary.es||d.summary.en},
    body:d.body.map((p:any)=>({en:p.en,es:p.es||p.en})),
    category:worlds.find((w:any)=>w.id===d.worldId)?.name,worldId:d.worldId,position:d.position,
    relatedIds:connections.filter((c:any)=>c.from_id===d.id).map((c:any)=>c.to_id),
    sourceUrls:d.sources.map((s:any)=>s.url),contentType:d.contentType,
    fictionLabel:d.truthType==="fictional",truthType:d.truthType,
    verificationStatus:d.verificationStatus,uncertainty:d.uncertainty,sources:d.sources,
    shareImage:d.shareImage||"/og.svg",createdAt:d.createdAt,evidence:d.evidence,
    interpretation:d.interpretation,questions:d.questions,media:d.media,
  }));
  return {worlds,discoveries,connections,defaultLanguage:sr?.data?JSON.parse(sr.data).defaultLanguage:"en"};
}

const encoder = new TextEncoder();
function b64(bytes: Uint8Array): string {
  let s=""; for (const b of bytes) s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function unb64(value:string):Uint8Array {
  const s=value.replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(s+"=".repeat((4-s.length%4)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function randomToken():string { const a=new Uint8Array(32); crypto.getRandomValues(a); return b64(a); }
function constantTimeEqual(a:string,b:string):boolean {
  const x=encoder.encode(a),y=encoder.encode(b);
  let diff=x.length^y.length;
  for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i%x.length]||0)^(y[i%y.length]||0);
  return diff===0;
}
async function sha256(value:string):Promise<string> {
  const digest=await crypto.subtle.digest("SHA-256",encoder.encode(value));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function normalizeEmail(v:unknown):string { return typeof v==="string"?v.trim().toLowerCase():""; }
function validEmail(v:string):boolean { return v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
function passwordPolicy(v:unknown):v is string { return typeof v==="string"&&v.length>=12&&encoder.encode(v).length<=256; }
async function hashPassword(password:string):Promise<string> {
  if(!passwordPolicy(password)) throw new Error("Use a password of at least 12 characters and at most 256 bytes.");
  const salt=new Uint8Array(16); crypto.getRandomValues(salt);
  const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:PBKDF2_ITERATIONS},key,256);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}
async function verifyPassword(password:unknown,stored:string):Promise<boolean> {
  if(typeof password!=="string"||encoder.encode(password).length>256) return false;
  const p=stored.split("$");
  if(p.length!==4||p[0]!=="pbkdf2-sha256"||Number(p[1])!==PBKDF2_ITERATIONS) return false;
  try {
    const salt=unb64(p[2]), expected=unb64(p[3]);
    const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
    const bits=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:PBKDF2_ITERATIONS},key,256));
    if(bits.length!==expected.length)return false;
    let diff=0; for(let i=0;i<bits.length;i++)diff|=bits[i]^expected[i];
    return diff===0;
  } catch { return false; }
}
function cookieName():string { return "__Host-beyond_admin"; }
function cookie(token:string,maxAge:number):string {
  return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=${maxAge}`;
}
function getCookie(request:Request):string|null {
  const part=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName()+"="));
  const token=part?.slice(cookieName().length+1);
  return token&&/^[A-Za-z0-9_-]{43}$/.test(token)?token:null;
}
async function getSession(request:Request,db:D1Database) {
  const token=getCookie(request); if(!token)return null;
  return await db.prepare("SELECT s.token_hash,s.admin_id,s.csrf,s.expires_at,a.email FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>?")
    .bind(await sha256(token),Date.now()).first<any>();
}
async function createSession(db:D1Database,adminId:string) {
  const token=randomToken(),csrf=randomToken(),expires=Date.now()+SESSION_TTL;
  await db.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(Date.now()).run();
  await db.prepare("INSERT INTO sessions(token_hash,admin_id,csrf,expires_at) VALUES(?,?,?,?)")
    .bind(await sha256(token),adminId,csrf,expires).run();
  return {token,csrf,expires};
}
async function readBody(request:Request):Promise<any> {
  const text=await request.text(); if(text.length>128*1024)throw new HttpError(413,"Request is too large.");
  try {const value=JSON.parse(text);if(!value||Array.isArray(value)||typeof value!=="object")throw 0;return value;}
  catch {throw new HttpError(400,"Send a valid JSON object.");}
}
class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
function fail(status:number,message:string):never {throw new HttpError(status,message);}
async function rateLimit(db:D1Database,key:string,max:number) {
  const hash=await sha256(key),now=Date.now();
  await db.prepare("DELETE FROM login_limits WHERE reset_at<=?").bind(now).run();
  const row=await db.prepare("SELECT attempts,reset_at FROM login_limits WHERE key_hash=?").bind(hash).first<any>();
  if(row&&row.reset_at>now&&row.attempts>=max)fail(429,"Too many attempts. Try again later.");
  await db.prepare("INSERT INTO login_limits(key_hash,attempts,reset_at) VALUES(?,?,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=excluded.attempts,reset_at=excluded.reset_at")
    .bind(hash,row&&row.reset_at>now?row.attempts+1:1,row&&row.reset_at>now?row.reset_at:now+15*60*1000).run();
}

const STATES = ["draft","review","published","archived"];
const THEMES = ["archive","elsewhere","unsolved","natural"];
function textField(v:unknown,max=20000):string {
  if(typeof v!=="string"||v.length>max)fail(400,"Invalid or oversized text field.");
  return v.trim();
}
function localized(v:any,max:number) {
  if(!v||typeof v!=="object"||Array.isArray(v))fail(400,"English content is required.");
  return {en:textField(v.en??"",max),es:textField(v.es??"",max)};
}
function slugField(v:unknown):string {
  const value=textField(v,90);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))fail(400,"Use a lowercase slug with letters, numbers and hyphens.");
  return value;
}
function safeUrl(v:unknown,local=false):string {
  const value=textField(v,2048);
  if(local&&/^\/(?!\/)[a-zA-Z0-9_./-]+$/.test(value)&&!value.includes(".."))return value;
  try {const u=new URL(value);if(u.protocol==="https:"&&!u.username&&!u.password)return u.href;}catch{}
  fail(400,"Use a valid HTTPS URL or supported local image path.");
}
function validateWorld(input:any,old:any) {
  const name=localized(input.name,160),description=localized(input.description,2000);
  if(!name.en)fail(400,"An English world name is required.");
  const status=input.status??"draft";
  if(!STATES.includes(status)||!THEMES.includes(input.theme))fail(400,"Invalid publication state or presentation theme.");
  if(status==="published"&&!description.en)fail(400,"A published world requires an English description.");
  if(typeof input.color!=="string"||!/^#[0-9a-fA-F]{6}$/.test(input.color))fail(400,"Use a six-digit hex color.");
  const order=Number(input.order??0);
  if(!Number.isInteger(order)||order<0||order>999)fail(400,"World order must be 0–999.");
  let hubPosition=old?.hubPosition;
  if(old?.hubKey) {
    hubPosition=input.hubPosition||old.hubPosition;
    if(!Array.isArray(hubPosition)||hubPosition.length!==3||hubPosition[1]!==0||
      hubPosition.some((n:any)=>typeof n!=="number"||!Number.isFinite(n)||Math.abs(n)>60))
      fail(400,"Hub placement requires X/Z within ±60 and Y=0.");
  }
  return {hubKey:old?.hubKey,hubPosition,name,description,slug:slugField(input.slug),theme:input.theme,
    color:input.color,symbol:String(input.symbol||"05").slice(0,3),order,status,aliases:old?.aliases||[]};
}
async function validateDiscovery(input:any,db:D1Database,old:any) {
  const title=localized(input.title,200),summary=localized(input.summary,500);
  if(!title.en)fail(400,"An English title is required.");
  const status=input.status??"draft";
  if(!STATES.includes(status))fail(400,"Invalid publication state.");
  const world=await db.prepare("SELECT status,data FROM worlds WHERE id=?").bind(input.worldId).first<any>();
  if(!world)fail(400,"Choose an existing world.");
  if(!Array.isArray(input.body)||input.body.length>30)fail(400,"Body must contain up to 30 paragraphs.");
  const body=input.body.map((p:any)=>localized(p,10000));
  const sources=input.sources??[];
  if(!Array.isArray(sources)||sources.length>20)fail(400,"Use up to 20 sources.");
  const normalized=sources.map((s:any)=>({url:safeUrl(s.url),description:textField(s.description??"",500),
    verification:s.verification==="verified"?"verified":"unverified"}));
  const position=input.position;
  if(!Array.isArray(position)||position.length!==3||position.some((n:any)=>typeof n!=="number"||!Number.isFinite(n)||Math.abs(n)>100))
    fail(400,"Position requires three numbers between -100 and 100.");
  if(JSON.parse(world.data).hubKey&&(Math.abs(position[0])>4||Math.abs(position[2])>4||position[1]<0||position[1]>6))
    fail(400,"Hub discovery placement requires local X/Z within ±4 and Y within 0–6.");
  if(!["article","question"].includes(input.contentType))fail(400,"Invalid content type.");
  if(status==="published"&&(world.status!=="published"||!summary.en||!body.some((p:any)=>p.en)||
    (input.truthType!=="fictional"&&!normalized.length)||normalized.some((s:any)=>!s.description)))
    fail(400,"Publication requires a published world, hint, English body and described sources.");
  const truthType=input.truthType||"factual",verificationStatus=input.verificationStatus||"needs_review";
  if(!["factual","hypothesis","fictional"].includes(truthType)||
    !["needs_review","verified","hypothetical","rejected"].includes(verificationStatus))
    fail(400,"Invalid content classification or editorial status.");
  const uncertainty=textField(input.uncertainty??"",3000);
  const sameLegacy=old?.legacyPublished===true&&old.status==="published"&&status==="published"&&
    JSON.stringify({title,summary,body,sources:normalized,worldId:input.worldId})===
    JSON.stringify({title:old.title,summary:old.summary,body:old.body,sources:old.sources,worldId:old.worldId});
  if(status==="published"&&verificationStatus==="rejected")fail(400,"Rejected content cannot be published.");
  if(status==="published"&&truthType==="factual"&&verificationStatus!=="verified"&&!sameLegacy)
    fail(400,"An authorized editor must verify factual content before publication.");
  if(status==="published"&&truthType!=="factual"&&(verificationStatus!=="hypothetical"||!uncertainty))
    fail(400,"Hypotheses and fictional scenarios require a hypothetical label and uncertainty note.");
  return {truthType,verificationStatus,uncertainty,legacyPublished:sameLegacy,title,summary,body,
    slug:slugField(input.slug),worldId:input.worldId,contentType:input.contentType,sources:normalized,position,
    evidence:textField(input.evidence??"",10000),interpretation:textField(input.interpretation??"",10000),
    questions:textField(input.questions??"",10000),media:input.media?safeUrl(input.media,true):"",
    fictionLabel:false,shareImage:"/og.svg",status,aliases:old?.aliases||[]};
}
async function allRows(db:D1Database,table:"worlds"|"discoveries") {
  const r=await db.prepare(`SELECT * FROM ${table} ORDER BY updated_at DESC,id`).all<any>();
  return (r.results||[]).map(parseRow);
}
async function getItem(db:D1Database,table:"worlds"|"discoveries",id:string) {
  const row=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first<any>();
  if(!row)fail(404,"Record not found.");
  return parseRow(row);
}
async function writeRevision(db:D1Database,kind:"worlds"|"discoveries",id:string,actor:string,snapshot:any) {
  return db.prepare(`INSERT INTO revisions(kind,record_id,actor,snapshot,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM ${kind} WHERE id=? AND version=?)`)
    .bind(kind,id,actor,JSON.stringify(snapshot),new Date().toISOString(),id,snapshot.version??-1);
}
async function listRecords(db:D1Database,table:"worlds"|"discoveries",params:URLSearchParams) {
  const all=await allRows(db,table),search=(params.get("search")||"").toLowerCase(),
    state=params.get("status"),worldId=params.get("worldId");
  const filtered=all.filter((r:any)=>(!state||r.status===state)&&(!worldId||r.worldId===worldId)&&
    (!search||[r.title?.en,r.title?.es,r.name?.en,r.name?.es,r.slug].some((s:any)=>s?.toLowerCase().includes(search))));
  const requested=Number(params.get("page")||1);
  if(!Number.isInteger(requested)||requested<1||requested>100000)fail(400,"Invalid page number.");
  const totalPages=Math.max(1,Math.ceil(filtered.length/10)),page=Math.min(requested,totalPages);
  return {items:filtered.slice((page-1)*10,page*10),total:filtered.length,page,totalPages};
}
\nasync function authRoutes(request:Request,env:Env,url:URL):Promise<Response|null> {
  const path=url.pathname,method=request.method;
  if(path==="/api/admin/bootstrap-password") {
    if(method!=="POST")return json({error:"Method not allowed."},405);
    if(!env.ADMIN_SETUP_TOKEN||!env.APP_ORIGIN)fail(503,"Admin bootstrap is not configured.");
    if(request.headers.get("Origin")!==new URL(env.APP_ORIGIN).origin)fail(403,"Request origin rejected.");
    const input=await readBody(request);
    const supplied=typeof input.setupToken==="string"?input.setupToken:"";
    if(!constantTimeEqual(supplied,env.ADMIN_SETUP_TOKEN))fail(403,"Setup authorization rejected.");
    if(!passwordPolicy(input.newPassword))fail(400,"Use a password of at least 12 characters and at most 256 bytes.");
    const admin=await env.DB.prepare("SELECT id,email,password_hash FROM admins ORDER BY created_at LIMIT 1").first<any>();
    if(!admin||!admin.password_hash.startsWith("scrypt$"))fail(409,"The existing administrator is missing or has already been migrated.");
    const replacement=await hashPassword(input.newPassword);
    const result=await env.DB.prepare("UPDATE admins SET password_hash=? WHERE id=? AND password_hash=?")
      .bind(replacement,admin.id,admin.password_hash).run();
    if(!result.meta.changes)fail(409,"Administrator credentials changed. Retry only after checking the account.");
    await env.DB.prepare("DELETE FROM sessions").run();
    await env.DB.prepare("DELETE FROM login_limits").run();
    const created=await createSession(env.DB,admin.id);
    return json({ok:true,email:admin.email,passwordUpdated:true},200,{"Set-Cookie":cookie(created.token,Math.floor(SESSION_TTL/1000))});
  }
  if(path==="/api/admin/login"&&method==="POST") {
    if(request.headers.get("Origin")!==new URL(env.APP_ORIGIN).origin)fail(403,"Request origin rejected.");
    const input=await readBody(request),email=normalizeEmail(input.email);
    await rateLimit(env.DB,"account:"+email,6);
    await rateLimit(env.DB,"ip:"+((request.headers.get("CF-Connecting-IP"))||"unknown"),20);
    const admin=await env.DB.prepare("SELECT * FROM admins WHERE email=?").bind(email).first<any>();
    const dummyHash="pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const valid=await verifyPassword(input.password,admin?.password_hash||dummyHash);
    if(!validEmail(email)||!admin||!valid)fail(401,"Email or password is incorrect.");
    const old=await getSession(request,env.DB);
    if(old)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(old.token_hash).run();
    const created=await createSession(env.DB,admin.id);
    return json({ok:true},200,{"Set-Cookie":cookie(created.token,Math.floor(SESSION_TTL/1000))});
  }
  if(!path.startsWith("/api/admin/"))return null;
  const session=await getSession(request,env.DB);
  if(!session)fail(401,"Administrator sign-in required.");
  let input:any={};
  if(method!=="GET"&&method!=="HEAD") {
    if(request.headers.get("Origin")!==new URL(env.APP_ORIGIN).origin)fail(403,"Request origin rejected.");
    if(request.headers.get("Content-Type")?.split(";")[0]!=="application/json")fail(415,"Use application/json.");
    if(request.headers.get("X-CSRF-Token")!==session.csrf)fail(403,"Request verification failed. Refresh and try again.");
    input=await readBody(request);
  }
  if(path==="/api/admin/session"&&method==="GET")return json({email:session.email,csrf:session.csrf,expiresAt:session.expires_at});
  if(path==="/api/admin/logout"&&method==="POST") {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(session.token_hash).run();
    return json({ok:true},200,{"Set-Cookie":cookie("",0)});
  }
  if(path==="/api/admin/password"&&method==="POST") {
    const admin=await env.DB.prepare("SELECT password_hash FROM admins WHERE id=?").bind(session.admin_id).first<any>();
    await rateLimit(env.DB,"password:"+session.admin_id,6);
    if(!admin||!(await verifyPassword(input.currentPassword,admin.password_hash)))fail(400,"Current password is incorrect.");
    if(!passwordPolicy(input.newPassword))fail(400,"Use a password of at least 12 characters and at most 256 bytes.");
    const next=await hashPassword(input.newPassword);
    await env.DB.prepare("UPDATE admins SET password_hash=? WHERE id=?").bind(next,session.admin_id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE admin_id=?").bind(session.admin_id).run();
    const created=await createSession(env.DB,session.admin_id);
    return json({ok:true},200,{"Set-Cookie":cookie(created.token,Math.floor(SESSION_TTL/1000))});
  }

  if(path==="/api/admin/dashboard"&&method==="GET") {
    const worlds=await allRows(env.DB,"worlds"),discoveries=await allRows(env.DB,"discoveries"),published=await publicUniverse(env.DB);
    return json({worlds:worlds.length,totalDiscoveries:discoveries.length,
      needsReview:discoveries.filter((d:any)=>d.verificationStatus==="needs_review").length,
      verified:discoveries.filter((d:any)=>d.verificationStatus==="verified").length,
      published:published.discoveries.length,drafts:discoveries.filter((d:any)=>d.status==="draft").length,
      review:discoveries.filter((d:any)=>d.status==="review").length,
      recent:[...worlds.map((w:any)=>({...w,kind:"world"})),...discoveries.map((d:any)=>({...d,kind:"discovery"}))]
        .sort((a:any,b:any)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,6)});
  }
  if(path==="/api/admin/catalog"&&method==="GET") {
    const [worlds,discoveries,connections]=await Promise.all([
      allRows(env.DB,"worlds"),allRows(env.DB,"discoveries"),
      env.DB.prepare("SELECT * FROM connections ORDER BY id").all<any>()]);
    return json({worlds:worlds.map((w:any)=>({id:w.id,name:w.name,status:w.status,hubKey:w.hubKey})),
      discoveries:discoveries.map((d:any)=>({id:d.id,title:d.title,worldId:d.worldId,status:d.status})),
      connections:connections.results||[]});
  }
  const recordMatch=path.match(/^\/api\/admin\/(worlds|discoveries)(?:\/([a-zA-Z0-9-]+))?$/);
  if(recordMatch) {
    const table=recordMatch[1] as "worlds"|"discoveries",id=recordMatch[2];
    if(method==="GET") {
      if(id) {
        const [record,history]=await Promise.all([getItem(env.DB,table,id),
          env.DB.prepare("SELECT id,actor,snapshot,created_at FROM revisions WHERE kind=? AND record_id=? ORDER BY id DESC LIMIT 20").bind(table,id).all()]);
        return json({item:record,history:history.results||[]});
      }
      return json(await listRecords(env.DB,table,url.searchParams));
    }
    if(method!=="POST"&&method!=="PUT")fail(405,"Use archive rather than deleting content.");
    if((method==="POST"&&id)||(method==="PUT"&&!id))fail(405,"Method not allowed.");
    const old=id?await getItem(env.DB,table,id):null;
    const data=table==="worlds"?validateWorld(input,old):await validateDiscovery(input,env.DB,old);
    if(old&&input.version!==old.version)fail(409,"This record changed. Reload before saving.");
    const recordId=id||crypto.randomUUID(),timestamp=new Date().toISOString();
    if(old&&old.slug!==data.slug)data.aliases=[...new Set([...(old.aliases||[]),old.slug])];
    const all=await allRows(env.DB,table);
    if(all.some((r:any)=>r.id!==recordId&&(r.slug===data.slug||(r.aliases||[]).includes(data.slug))))
      fail(409,"This slug is already used.");
    const statements=[];
    if(old) {
      statements.push(await writeRevision(env.DB,table,recordId,session.admin_id,old));
      if(table==="worlds")statements.push(env.DB.prepare("UPDATE worlds SET slug=?,status=?,data=?,version=version+1,updated_at=? WHERE id=? AND version=?")
        .bind(data.slug,data.status,JSON.stringify(data),timestamp,recordId,old.version));
      else statements.push(env.DB.prepare("UPDATE discoveries SET slug=?,status=?,data=?,version=version+1,updated_at=?,world_id=? WHERE id=? AND version=?")
        .bind(data.slug,data.status,JSON.stringify(data),timestamp,data.worldId,recordId,old.version));
    } else if(table==="worlds")statements.push(env.DB.prepare("INSERT INTO worlds(id,slug,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?)")
      .bind(recordId,data.slug,data.status,JSON.stringify(data),timestamp,timestamp));
    else statements.push(env.DB.prepare("INSERT INTO discoveries(id,slug,world_id,status,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
      .bind(recordId,data.slug,data.worldId,data.status,JSON.stringify(data),timestamp,timestamp));
    const results=await env.DB.batch(statements);
    if(old&&results[results.length-1].meta.changes!==1)fail(409,"This record changed. Reload before saving.");
    return json({item:await getItem(env.DB,table,recordId)},old?200:201);
  }
  if(path==="/api/admin/connections"&&method==="POST") {
    if(input.fromId===input.toId)fail(400,"A discovery cannot link to itself.");
    for(const id of [input.fromId,input.toId]) {
      const row=await env.DB.prepare("SELECT status FROM discoveries WHERE id=?").bind(id).first<any>();
      if(!row||row.status==="archived")fail(400,"Choose existing, non-archived discoveries.");
    }
    if(typeof input.explanation!=="string"||!input.explanation.trim()||input.explanation.length>1000)
      fail(400,"Explain this connection in 1–1000 characters.");
    const id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO connections(id,from_id,to_id,explanation) VALUES(?,?,?,?)")
      .bind(id,input.fromId,input.toId,input.explanation.trim()).run();
    return json({id},201);
  }
  const link=path.match(/^\/api\/admin\/connections\/([a-zA-Z0-9-]+)$/);
  if(link) {
    const old=await env.DB.prepare("SELECT * FROM connections WHERE id=?").bind(link[1]).first<any>();
    if(!old)fail(404,"Connection not found.");
    if(method==="PUT") {
      if(typeof input.explanation!=="string"||!input.explanation.trim()||input.explanation.length>1000)
        fail(400,"Explain this connection in 1–1000 characters.");
      await env.DB.batch([env.DB.prepare("INSERT INTO revisions(kind,record_id,actor,snapshot,created_at) VALUES(?,?,?,?,?)")
        .bind("connections",old.id,session.admin_id,JSON.stringify(old),new Date().toISOString()),
        env.DB.prepare("UPDATE connections SET explanation=? WHERE id=?").bind(input.explanation.trim(),old.id)]);
      return json({ok:true});
    }
    if(method==="DELETE") {
      await env.DB.batch([env.DB.prepare("INSERT INTO revisions(kind,record_id,actor,snapshot,created_at) VALUES(?,?,?,?,?)")
        .bind("connections",old.id,session.admin_id,JSON.stringify(old),new Date().toISOString()),
        env.DB.prepare("DELETE FROM connections WHERE id=?").bind(old.id)]);
      return json({ok:true});
    }
    fail(405,"Method not allowed.");
  }
  if(path==="/api/admin/settings") {
    if(method==="GET") {
      const row=await env.DB.prepare("SELECT data FROM settings WHERE id=1").first<any>();
      if(!row)fail(500,"Settings have not been initialized.");
      return json(JSON.parse(row.data));
    }
    if(method==="PUT") {
      if(!["en","es"].includes(input.defaultLanguage))fail(400,"Choose English or Spanish.");
      await env.DB.prepare("UPDATE settings SET data=? WHERE id=1").bind(JSON.stringify({defaultLanguage:input.defaultLanguage})).run();
      return json({ok:true});
    }
  }
  return json({error:"Endpoint not found."},404);
}

export default {
  async fetch(request:Request,env:Env):Promise<Response> {
    const url=new URL(request.url);
    try {
      if(url.pathname==="/api/public/universe"&&request.method==="GET")return json(await publicUniverse(env.DB));
      if(url.pathname.startsWith("/api/admin/")) {
        const response=await authRoutes(request,env,url);
        if(response)return response;
      }
      if(url.pathname.startsWith("/api/"))return json({error:"API endpoint not available."},404);
      const privatePage=url.pathname==="/admin"||(url.pathname.startsWith("/admin/")&&url.pathname!=="/admin/login");
      if(privatePage) {
        const session=await getSession(request,env.DB);
        if(!session)return new Response(null,{status:302,headers:{Location:"/admin/login","Cache-Control":"no-store"}});
      }
      return env.ASSETS.fetch(request);
    } catch(error) {
      if(error instanceof HttpError)return json({error:error.message},error.status);
      if(String((error as Error)?.message||"").includes("UNIQUE constraint"))return json({error:"That record already exists."},409);
      return json({error:"The request could not be completed."},500);
    }
  },
};