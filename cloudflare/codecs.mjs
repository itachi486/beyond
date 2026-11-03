import pngDecode,{init as pngInit} from '@jsquash/png/decode.js';
import jpegDecode,{init as jpegInit} from '@jsquash/jpeg/decode.js';
import webpDecode,{init as webpInit} from '@jsquash/webp/decode.js';
import factory from '@jsquash/webp/codec/enc/webp_enc.js';
import {initEmscriptenModule} from '@jsquash/webp/utils.js';
import {defaultOptions} from '@jsquash/webp/meta.js';
export async function createCodecs({png,jpeg,webp,encoder}){
 const ready={};const decodeFns={png:pngDecode,jpeg:jpegDecode,webp:webpDecode},init={png:()=>pngInit(png),jpeg:()=>jpegInit(jpeg),webp:()=>webpInit(webp)};let enc;
 return {decode:async(format,bytes)=>{if(!init[format])throw Error('Unsupported raster format');await(ready[format]||=(Promise.resolve().then(init[format])));return decodeFns[format](bytes);},encode:async data=>{enc||=initEmscriptenModule(factory,encoder);const module=await enc,value=module.encode(data.data,data.width,data.height,defaultOptions);if(!value)throw Error('WebP encoding failed');return value.buffer;}};
}
