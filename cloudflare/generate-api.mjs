import {readFile,writeFile} from 'node:fs/promises';
async function rewrite(source,target,changes){let text=await readFile(source,'utf8');for(const [from,to] of changes){if(!text.includes(from))throw Error('Source contract changed: '+source);text=text.split(from).join(to);}await writeFile(target,'// Generated from '+source+' by cloudflare/generate-api.mjs. Do not edit by hand.\n'+text);}
await rewrite('server/api.mjs','cloudflare/generated/api.mjs',[
 ['"./permanent-delete.mjs"','"../permanent-delete.mjs"'],['"./central-library.mjs"','"./central-library.mjs"'],['"./ai-images.mjs"','"./ai-images.mjs"'],['"./store.mjs"','"../store.mjs"'],['"./auth.mjs"','"../../server/auth.mjs"'],['"./validation.mjs"','"../../server/validation.mjs"'],['"./fantasy-overview.mjs"','"../../server/fantasy-overview.mjs"'],['"./admin-inventory.mjs"','"./admin-inventory.mjs"'],['"./admin-setup-state.mjs"','"../../server/admin-setup-state.mjs"'],['permanentDelete(db, {','await permanentDelete(db, {'],['attempt("account:" + email, 6);','attempt("account:" + email, 6); await db.flush();'],['attempt("password:" + admin.id, 6);','attempt("password:" + admin.id, 6); await db.flush();'],
]);
await rewrite('server/central-library.mjs','cloudflare/generated/central-library.mjs',[
 ['"./permanent-delete.mjs"','"../permanent-delete.mjs"'],['"node:fs/promises"','"../media-files.mjs"'],['"./character-files.mjs"','"./character-files.mjs"'],['"./validation.mjs"','"../../server/validation.mjs"'],['permanentDelete(db, {','await permanentDelete(db, {'],
]);
let inventory=await readFile('server/admin-inventory.mjs','utf8');inventory=inventory.replace('"./auth.mjs"','"../../server/auth.mjs"').replace('"./validation.mjs"','"../../server/validation.mjs"').replace('SQLite editorial content / browser IndexedDB assets and localStorage worlds','Cloudflare D1/Tigris editorial content / browser IndexedDB assets and localStorage worlds').replace('length(a.bytes) AS bytes','COALESCE((SELECT byte_count FROM ai_asset_objects WHERE id=a.id),length(a.bytes)) AS bytes');await writeFile('cloudflare/generated/admin-inventory.mjs',inventory);
let files=await readFile('server/character-files.mjs','utf8');files=files.replace('import sharp from "sharp";','import {decodeRaster,makeThumbnail} from "../images.mjs";').replace('"../shared/model-validation.mjs"','"../../shared/model-validation.mjs"').replace('"./validation.mjs"','"../../server/validation.mjs"');
const start=files.indexOf('export async function decodeImage('),end=files.indexOf('async function validateModel(',start);files=files.slice(0,start)+'export async function decodeImage(bytes, format) { return decodeRaster(bytes, format); }\n'+files.slice(end);
files=files.slice(0,files.indexOf('export async function thumbnail('))+'export async function thumbnail(bytes) { return makeThumbnail(bytes); }\n';await writeFile('cloudflare/generated/character-files.mjs',files);
let ai=await readFile('server/ai-images.mjs','utf8');
ai='import {workersImage} from "../workers-ai.mjs";\nimport {runtime} from "../context.mjs";\nimport {decodeRaster} from "../images.mjs";\n'+ai.replace('"./auth.mjs"','"../../server/auth.mjs"');
ai=ai.replace('configured: !!(env.OPENAI_API_KEY?.trim() || env.AI_IMAGE_API_KEY?.trim()),','configured: !!env.AI?.run,');
ai=ai.replace('  const prompt = [','  if(runtime().env.AI?.run)return workersImage(input);\n  throw Error("image_service_not_configured");\n  const prompt = [');
ai=ai.replace('          "invalid_image",','          "unsupported_reference",\n          "daily_limit_reached",\n          "invalid_image",');
ai=ai.replace('res.end(asset.bytes);','const object=db.prepare("SELECT file_key FROM ai_asset_objects WHERE id=?").get(asset.id); const stored=object && await runtime().env.MEDIA.get(object.file_key); if(!stored) throw Error("asset_not_found"); res.end(Buffer.from(await stored.arrayBuffer()));');
ai=ai.replace('const bytes = await generateImage(input, policy, transport),','await db.flush();\n        const bytes = await generateImage(input, policy, transport),');
ai=ai.replace('asset = randomUUID();\n        db.exec("BEGIN IMMEDIATE");','asset = randomUUID();\n        await decodeRaster(bytes,"png");\n        const fileKey="ai/"+session.admin_id+"/"+asset+".png";\n        const stored=await runtime().env.MEDIA.put(fileKey,bytes,{onlyIf:new Headers({"If-None-Match":"*"}),httpMetadata:{contentType:"image/png"}}); if(!stored)throw Error("asset_conflict");runtime().created.add(fileKey);\n        db.exec("BEGIN IMMEDIATE");');
ai=ai.replace('            bytes,\n            now(),\n          );','            null,\n            now(),\n          );\n          db.prepare("INSERT INTO ai_asset_objects VALUES(?,?,?)").run(asset,fileKey,bytes.length);');
if(!ai.includes('INSERT INTO ai_asset_objects')||!ai.includes('await db.flush()'))throw Error('AI source contract changed');
// Preview bundle has no OpenAI SDK or external-provider execution path.
ai=ai.replace('import OpenAI, { toFile } from "openai";','');
const generationStart=ai.indexOf('export async function generateImage('),generationEnd=ai.indexOf('export function createImageAPI(',generationStart);
ai=ai.slice(0,generationStart)+'export async function generateImage(input) { return workersImage(input); }\n'+ai.slice(generationEnd);
ai=ai.replace('"missing_api_key"','"missing_ai_binding"');
// Preserve specific Preview AI safety/provider causes through the existing image API.
ai=ai.replace('import {workersImage}', 'import {workersImage,aiStatus}');
ai=ai.replace('error: "daily_limit_reached", usage: limit', 'error: limit.used >= limit.limit ? "image_daily_limit_reached" : "image_attempt_limit_reached", usage: limit');
ai=ai.replace('"unsupported_reference",', '"text_budget_exhausted", "image_budget_exhausted", "image_daily_limit_reached", "cloudflare_free_allocation_exhausted", "provider_quota_unconfirmed", "workers_cpu_limit", "service_unavailable", "network_error", "request_timeout", "unsupported_reference",');
ai=ai.replace('send(res, 502, { error: code, requestId: input.requestId });', 'send(res, aiStatus(code), { error: code, requestId: input.requestId });');
ai=ai.replace('send(res, 502, { error: row.error_code, requestId: row.id });', 'send(res, aiStatus(row.error_code), { error: row.error_code, requestId: row.id });');
await writeFile('cloudflare/generated/ai-images.mjs',ai);
