import {expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {connectCatalog} from '../shared/connect-catalog.mjs';
// Creates real owned assets and worlds through the same APIs as CREATE.
export async function createFixtureWorld(api:any,origin:string,csrf:string,key:string){
 const image=connectCatalog.find(c=>c.key===key)!;
 const response=await api.get('/api/public/images/'+image.imageId+'/file?version=1');expect(response.status()).toBe(200);
 const bytes=await response.body(),assetId=crypto.randomUUID(),headers={Origin:origin,'X-CSRF-Token':csrf};
 const asset=await api.post('/api/user/assets',{headers,data:{id:assetId,name:image.name,purpose:'starter-world',file:{name:'starter.png',data:bytes.toString('base64')}}});expect(asset.status(),await asset.text()).toBe(201);
 const now=new Date().toISOString(),world={version:2,graph:{characters:[],connections:[],contents:[]},id:crypto.randomUUID(),name:image.name,description:'Disposable world fixture',createdAt:now,updatedAt:now,theme:'celestial',objects:[],starter:{imageId:image.imageId,version:1,assetId,hash:createHash('sha256').update(bytes).digest('hex')}};
 const saved=await api.put('/api/user/worlds/'+world.id,{headers,data:{world,sidecars:{},version:0,requestId:crypto.randomUUID()}});expect(saved.status(),await saved.text()).toBe(201);return saved.json();
}
