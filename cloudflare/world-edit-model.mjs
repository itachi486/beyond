import {png} from './workers-ai.mjs';
export const INPAINT_MODEL='@cf/runwayml/stable-diffusion-v1-5-inpainting';
export const KLEIN_MODEL='@cf/black-forest-labs/flux-2-klein-4b';
// Klein's references must be smaller than 512px; the edited output remains 512px.
function reference(raster){const width=504,height=504,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(Math.floor(y*raster.height/height)*raster.width+Math.floor(x*raster.width/width))*4;data.set(raster.data.subarray(i,i+4),(y*width+x)*4);}return png({data,width,height});}
export function editModel(env){const model=env.AI_WORLD_EDIT_MODEL||INPAINT_MODEL;if(![INPAINT_MODEL,KLEIN_MODEL].includes(model))throw Error('unsupported_edit_model');return model;}
export function editInput(model,{prompt,patch,mask}){
 if(model===INPAINT_MODEL)return {prompt,image:[...png(patch)],mask:[...png(mask)],width:512,height:512,num_steps:20,guidance:7.5,strength:1,negative_prompt:'text, watermark, collage, floating house, distorted perspective'};
 if(model!==KLEIN_MODEL)throw Error('unsupported_edit_model');
 const form=new FormData();form.append('prompt',`Edit the provided landscape reference. Perform only the requested edit on the existing terrain near the center. For a style change, edit the existing object without adding a second object or changing its footprint. For a farm, add planted crop rows. Ground any new object directly in the existing grass and rocks. Match the original painted detail, light direction, scale and perspective. No white disc, white base, pedestal, circular platform, sticker, border or text. Keep surrounding terrain intact. ${prompt}`);form.append('width','512');form.append('height','512');form.append('input_image_0',new Blob([reference(patch)],{type:'image/png'}),'terrain.png');const response=new Response(form);return {multipart:{body:response.body,contentType:response.headers.get('content-type')}};
}
export async function editOutput(value){
 if(value&&typeof value.image==='string'){if(value.image.length>16*1024*1024)throw Error('invalid_image');return Buffer.from(value.image,'base64');}
 const reader=value?.getReader?.();if(!reader)throw Error('invalid_image_response');let size=0,chunks=[];for(;;){const{done,value:chunk}=await reader.read();if(done)break;size+=chunk.length;if(size>12*1024*1024){await reader.cancel();throw Error('invalid_image');}chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);
}
