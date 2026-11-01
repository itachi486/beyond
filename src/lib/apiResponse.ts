/** Do not parse SPA HTML or expose response bodies in API diagnostics. */
export async function readAPIResponse(response:Response,route:string){
 const path=route.split('?')[0],type=response.headers.get('content-type')||'',json=/^application\/(?:[\w.+-]+\+)?json(?:;|$)/i.test(type);
 if(response.status===204)return null;
 if(!json){console.warn('beyond_api_response',{path,status:response.status,contentType:type.slice(0,80)});throw Error(`API returned ${type.includes('html')?'HTML':'an unexpected response'} for ${path} (HTTP ${response.status}). Retry; check that this page uses the Preview API host.`);}
 let data;try{data=await response.json();}catch{console.warn('beyond_api_response',{path,status:response.status,reason:'invalid_json'});throw Error(`Invalid JSON response for ${path} (HTTP ${response.status}). Retry this operation.`);}
 if(!response.ok){const message=typeof data?.error==='string'&&data.error.length<=400&&!/[<>]|\n\s+at /.test(data.error)?data.error:`Request failed for ${path} (HTTP ${response.status}).`;throw Error(message);}
 return data;
}
/** Retry only idempotent reads once; never retry auth denials or writes. */
export async function readJSON(path:string,fetcher:typeof fetch=fetch){
 for(let attempt=0;attempt<2;attempt++){
  try{const response=await fetcher(path,{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});if(attempt===0&&[502,503,504].includes(response.status)){await new Promise(r=>setTimeout(r,300));continue;}return await readAPIResponse(response,path);}
  catch(error){if(attempt===0&&(error instanceof TypeError||error instanceof DOMException)){await new Promise(r=>setTimeout(r,300));continue;}throw error;}
 }
 throw Error('Read service unavailable. Retry; saved data is preserved.');
}
