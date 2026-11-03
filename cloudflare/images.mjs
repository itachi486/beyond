import {runtime} from './context.mjs';
import {fail} from '../server/validation.mjs';
export function imageHeader(bytes,format){
 const b=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);let width,height;
 if(format==='png'){
   if(b.length<33||!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b.toString('ascii',12,16)!=='IHDR')fail(400,'Invalid PNG signature.');
   width=b.readUInt32BE(16);height=b.readUInt32BE(20);let offset=8,ended=false;
   while(offset+12<=b.length){const n=b.readUInt32BE(offset),kind=b.toString('ascii',offset+4,offset+8);if(n>b.length-offset-12)fail(400,'Damaged PNG chunk.');if(kind==='acTL')fail(400,'Animated images are not supported.');offset+=n+12;if(kind==='IEND'){ended=true;break;}}
   if(!ended)fail(400,'Incomplete PNG.');
 }else if(format==='jpeg'){
   if(b.length<4||b[0]!==255||b[1]!==216)fail(400,'Invalid JPEG signature.');
   let offset=2;while(offset+4<b.length){if(b[offset++]!==255)fail(400,'Damaged JPEG.');while(b[offset]===255)offset++;const marker=b[offset++];if(marker===0xda||marker===0xd9)break;const n=b.readUInt16BE(offset);if(n<2||offset+n>b.length)fail(400,'Damaged JPEG bounds.');if([0xc0,0xc1,0xc2].includes(marker)){height=b.readUInt16BE(offset+3);width=b.readUInt16BE(offset+5);break;}offset+=n;}
 }else if(format==='webp'){
   if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP'||b.readUInt32LE(4)+8>b.length)fail(400,'Invalid WebP signature.');
   const kind=b.toString('ascii',12,16);if(kind==='VP8X'){if(b[20]&2)fail(400,'Animated images are not supported.');width=1+b.readUIntLE(24,3);height=1+b.readUIntLE(27,3);}else if(kind==='VP8L'&&b[20]===0x2f){const v=b.readUInt32LE(21);width=1+(v&0x3fff);height=1+((v>>>14)&0x3fff);}else if(kind==='VP8 '&&b.subarray(23,26).equals(Buffer.from([0x9d,1,0x2a]))){width=b.readUInt16LE(26)&0x3fff;height=b.readUInt16LE(28)&0x3fff;}
 }else fail(400,'Unsupported image format.');
 if(!width||!height||width>4096||height>4096||width*height>16*1024*1024)fail(400,'Image exceeds 4096px or pixel budget.');
 return {width,height};
}
function formatOf(bytes){const b=Buffer.from(bytes);return b[0]===137?'png':b[0]===255?'jpeg':'webp';}
export async function decodeRaster(bytes,format){
 const expected=imageHeader(bytes,format);
 try{const raster=await runtime().codecs.decode(format,new Uint8Array(bytes));if(raster.width!==expected.width||raster.height!==expected.height||raster.data.length!==raster.width*raster.height*4)throw Error();return {...expected,pixels:expected.width*expected.height};}catch{fail(400,'Invalid or damaged image.');}
}
export async function makeThumbnail(bytes){
 const format=formatOf(bytes);imageHeader(bytes,format);const image=await runtime().codecs.decode(format,new Uint8Array(bytes));
 const ratio=Math.min(1,400/image.width,400/image.height),width=Math.max(1,Math.round(image.width*ratio)),height=Math.max(1,Math.round(image.height*ratio)),data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const from=(Math.min(image.height-1,Math.floor(y/ratio))*image.width+Math.min(image.width-1,Math.floor(x/ratio)))*4;data.set(image.data.subarray(from,from+4),(y*width+x)*4);}
 return Buffer.from(await runtime().codecs.encode({width,height,data}));
}
