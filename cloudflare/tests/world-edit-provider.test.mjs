import test from'node:test';import assert from'node:assert/strict';import initSQL from'sql.js';
import{fixture}from'./cloudflare.test.mjs';import{openD1Store}from'../d1-store.mjs';import{worldInference}from'../world-edit-inference.mjs';import{editInput,editOutput,INPAINT_MODEL,KLEIN_MODEL}from'../world-edit-model.mjs';
const SQL=await initSQL();
test('an uncertain provider failure never triggers automatic inference or a duplicate reservation',async()=>{
 let calls=0;await assert.rejects(()=>worldInference({env:{AI:{run:async()=>{calls++;throw Error('TLS handshake failed');}}},stage:'ai_klein_edit',model:'fixture',step:async(_name,task)=>task(),input:()=>({})}),/TLS handshake/);assert.equal(calls,1);
});
test('SD receives encoded PNG arrays; Klein receives reference images in correctly bounded multipart data',async()=>{
 const patch={width:512,height:512,data:new Uint8ClampedArray(512*512*4).fill(255)},sd=editInput(INPAINT_MODEL,{prompt:'house',patch,mask:patch});assert.deepEqual(sd.image.slice(0,8),[137,80,78,71,13,10,26,10]);assert.equal(sd.num_steps,20);assert.deepEqual(sd.mask,sd.image);
 const klein=editInput(KLEIN_MODEL,{prompt:'house',patch,mask:patch});assert.match(klein.multipart.contentType,/multipart\/form-data; boundary=/);const request=new Request('https://fixture.test',{method:'POST',body:klein.multipart.body,headers:{'Content-Type':klein.multipart.contentType},duplex:'half'}),form=await request.formData();assert.equal(form.get('width'),'512');assert.equal(form.get('input_image_1'),null);for(const name of ['input_image_0']){const bytes=Buffer.from(await form.get(name).arrayBuffer());assert.equal(bytes.readUInt32BE(16),504);assert.equal(bytes.readUInt32BE(20),504);}assert.ok(form.get('prompt').includes('No white disc'));
 assert.deepEqual(await editOutput({image:Buffer.from('fixture').toString('base64')}),Buffer.from('fixture'));assert.deepEqual(await editOutput(new Response('fixture').body),Buffer.from('fixture'));await assert.rejects(()=>editOutput({unexpected:true}),/invalid_image_response/);
});
