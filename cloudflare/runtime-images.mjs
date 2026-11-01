import {createCodecs} from './codecs.mjs';
import png from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
import jpeg from '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';
import webp from '@jsquash/webp/codec/dec/webp_dec.wasm';
import encoder from '@jsquash/webp/codec/enc/webp_enc.wasm';
let ready;
export const imageRuntime=()=>ready ||= createCodecs({png,jpeg,webp,encoder});
