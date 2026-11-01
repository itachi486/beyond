import pngDecode,{init as pngInit} from '@jsquash/png/decode.js';
import jpegDecode,{init as jpegInit} from '@jsquash/jpeg/decode.js';
import webpDecode,{init as webpInit} from '@jsquash/webp/decode.js';
import factory from '@jsquash/webp/codec/enc/webp_enc.js';
import {initEmscriptenModule} from '@jsquash/webp/utils.js';
import {defaultOptions} from '@jsquash/webp/meta.js';
export async function createCodecs({png,jpeg,webp,encoder}){await Promise.all([pngInit(png),jpegInit(jpeg),webpInit(webp)]);const enc=await initEmscriptenModule(factory,encoder);return {decode:(format,bytes)=>({png:pngDecode,jpeg:jpegDecode,webp:webpDecode}[format])(bytes),encode:async data=>{const value=enc.encode(data.data,data.width,data.height,defaultOptions);if(!value)throw Error('WebP encoding failed');return value.buffer;}};}
