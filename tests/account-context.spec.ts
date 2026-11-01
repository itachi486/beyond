import {test,expect} from '@playwright/test';
test('real IndexedDB: fixed namespaces, ABA and abort before transaction commit',async({page})=>{
 const status=page.waitForResponse(r=>r.url().endsWith('/api/user/auth/status'));await page.goto('/login');await status;await expect(page.getByRole('heading',{name:'Log In',exact:true})).toBeVisible();
 const result=await page.evaluate(async()=>{
  const scope=await import('/src/features/account/sessionScope.ts'),assets=await import('/src/features/creation/uploadAssets.ts');
  const stamp=new Date().toISOString(),asset={id:'original',kind:'image',format:'png',file:new Blob(['original']),filename:'original.png',name:'A original',description:'',tags:'',source:'',createdAt:stamp,updatedAt:stamp};
  scope.setAccountScope('fixture-A');const a=scope.captureAccountContext();await assets.saveAsset(asset,a);
  scope.setAccountScope('fixture-B');const absent=await assets.getAsset(asset.id);
  scope.setAccountScope('fixture-A');let aba='';try{await assets.saveAsset({...asset,id:'late'},a);}catch(e){aba=(e as Error).message;}
  const fresh=scope.captureAccountContext(),put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){const r=put.apply(this,args);scope.setAccountScope('fixture-B');return r;};
  let aborted='';try{await assets.saveAsset({...asset,id:'during-transaction'},fresh);}catch(e){aborted=(e as Error).message;}finally{IDBObjectStore.prototype.put=put;}
  const b=await assets.listAssets();scope.setAccountScope('fixture-A');const retained=await assets.listAssets();
  return{absent:!!absent,aba,aborted,b:b.map(a=>a.id),a:retained.map(a=>a.id)};
 });
 expect(result).toEqual({absent:false,aba:'account_context_stale',aborted:'account_context_stale',b:[],a:['original']});
});
test('two real tabs: session invalidation prevents an old account response commit',async({page,context})=>{
 await page.goto('/login');await expect(page.getByRole('heading',{name:'Log In',exact:true})).toBeVisible();
 const other=await context.newPage();await other.goto('/login');await expect(other.getByRole('heading',{name:'Log In',exact:true})).toBeVisible();
 await other.evaluate(async()=>{const s=await import('/src/features/account/sessionScope.ts');s.setAccountScope('fixture-A');(window as any).capturedAccount=s.captureAccountContext();});
 await page.evaluate(async()=>{const s=await import('/src/features/account/sessionScope.ts');s.invalidateAccountContext('auth_change',true);});
 await expect.poll(()=>other.evaluate(async()=>{const s=await import('/src/features/account/sessionScope.ts');return s.isAccountContextCurrent((window as any).capturedAccount);})).toBe(false);
});
test('real local HTTP accounts: late A world read cannot populate B cache or change B server worlds',async({page})=>{
 const origin='http://127.0.0.1:5187',suffix=Date.now(),headers={Origin:origin};
 const a=await page.request.post('/api/user/auth/register',{headers,data:{email:`isolation-a-${suffix}@example.test`,username:`isolation_a_${suffix}`,password:'Disposable-isolation-password-123'}});expect(a.status()).toBe(200);
 const authA=await a.json(),cookieA=a.headers()['set-cookie'].split(';')[0];
 await page.goto('/my-worlds');await expect(page.getByText('No personal worlds yet.',{exact:true})).toBeVisible();
 const world=await page.evaluate(async()=>{const {newWorld}=await import('/src/features/creation/worldStore.ts');return newWorld('Private A world','Original A content.');});
 expect((await page.request.put('/api/user/worlds/'+world.id,{headers:{...headers,'X-CSRF-Token':authA.csrf},data:{world,version:0,requestId:crypto.randomUUID()}})).status()).toBe(201);
 let release!:()=>void,arrived!:()=>void;const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>arrived=r);
 await page.route('**/api/user/worlds/'+world.id,async route=>{const response=await route.fetch();arrived();await gate;await route.fulfill({response}).catch(()=>{});});
 await page.evaluate(async id=>{const {fetchWorld}=await import('/src/features/account/cloudWorlds.ts');(window as any).lateRead=fetchWorld(id).then(()=> 'unexpected success',(e:Error)=>e.message);},world.id);await ready;
 const b=await page.request.post('/api/user/auth/register',{headers,data:{email:`isolation-b-${suffix}@example.test`,username:`isolation_b_${suffix}`,password:'Disposable-isolation-password-123'}});expect(b.status()).toBe(200);const authB=await b.json();
 await page.evaluate(async auth=>{const scope=await import('/src/features/account/sessionScope.ts'),cloud=await import('/src/features/account/cloudWorlds.ts');scope.setAccountScope(auth.user.id);cloud.setMemberCSRF(auth.csrf);},authB);release();
 expect(await page.evaluate(()=>(window as any).lateRead)).toBe('account_context_stale');
 expect(await page.evaluate(async()=>{const c=await import('/src/features/account/cloudWorlds.ts');return c.cachedWorlds();})).toEqual([]);
 expect((await(await page.request.get('/api/user/worlds')).json()).items).toEqual([]);
 const preserved=await page.request.get('/api/user/worlds/'+world.id,{headers:{Cookie:cookieA}});expect(preserved.status()).toBe(200);expect((await preserved.json()).world.name).toBe(world.name);
 const login=await page.request.post('/api/user/auth/login',{headers,data:{email:authA.user.email,password:'Disposable-isolation-password-123'}});expect(login.status()).toBe(200);const freshA=await login.json();
 const restored=await page.evaluate(async({auth,id})=>{const s=await import('/src/features/account/sessionScope.ts'),c=await import('/src/features/account/cloudWorlds.ts');s.setAccountScope(auth.user.id);c.setMemberCSRF(auth.csrf);await c.fetchWorld(id);return c.cachedWorlds().map(w=>w.name);},{auth:freshA,id:world.id});
 expect(restored).toEqual(['Private A world']);
});
