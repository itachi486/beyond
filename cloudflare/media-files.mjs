// This is an Tigris key adapter, not an emulated persistent local filesystem.
import {runtime} from './context.mjs';
const root='/.local/character-assets';
export function keyFor(path){if(path===root)return '';if(!path.startsWith(root+'/'))throw Error('Unsafe private asset path');const key=path.slice(root.length+1);if(key.split('/').some(p=>!p||p==='.'||p==='..')||key.includes('\\'))throw Error('Unsafe Tigris key');return key;}
export async function realpath(path){if(typeof path!=='string'||!path.startsWith('/')||path.split('/').includes('..'))throw Error('Unsafe virtual path');return path;}
export async function mkdir(path){keyFor(path);}
export async function rmdir(path){keyFor(path);}
export async function writeFile(path,bytes){const key=keyFor(path),ctx=runtime();if(!key)throw Error('Missing key');const result=await ctx.env.MEDIA.put(key,bytes,{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:key.endsWith('.webp')?'image/webp':key.endsWith('.png')?'image/png':key.endsWith('.jpeg')?'image/jpeg':key.endsWith('.glb')?'model/gltf-binary':key.endsWith('.gltf')?'model/gltf+json':'application/octet-stream'}});if(!result)throw Error('Asset already exists');ctx.created.add(key);}
export async function readFile(path){const object=await runtime().env.MEDIA.get(keyFor(path));if(!object)throw Error('Asset unavailable');return Buffer.from(await object.arrayBuffer());}
export async function rm(path){const prefix=keyFor(path),ctx=runtime();for(const key of [...ctx.created])if(key===prefix||key.startsWith(prefix+'/')){await ctx.env.MEDIA.delete(key);ctx.created.delete(key);}}
