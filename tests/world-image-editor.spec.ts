import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {authorizeLocalAuthor} from './author-fixture';
test('isolated legacy editor component: explicit contract, approval and reconnect preserve the original world',async({page})=>{
 await authorizeLocalAuthor(page);
 const items:any[]=[],art=await readFile('public/celestial-world.webp');let generations=0;const operationIds:string[]=[];let interruptOnce=true;
 await page.route('**/api/ai/capabilities',r=>r.fulfill({json:{provider:'workers-ai',configured:true,worldEditing:{previewOnly:true,mask:true}}}));
 await page.route('**/api/ai/world-edits**',async r=>{
  const request=r.request(),url=new URL(request.url());
  if(request.method()==='GET'&&/\/(image|original)$/.test(url.pathname))return r.fulfill({contentType:'image/webp',body:art});
  if(request.method()==='GET')return r.fulfill({json:{items}});
  if(url.pathname.endsWith('/reject')){items[0].rejected=true;return r.fulfill({json:{item:items[0]}});}
  if(url.pathname.endsWith('/approve')){items[0].approved=true;return r.fulfill({json:{item:items[0]}});}
  const body=request.postDataJSON();expect(body.contractVersion).toBe(1);expect(body.actionType).toBe('CREATE_WORLD_OBJECT');expect(body.operationId).toBe(body.requestId);expect(body.targetId).toBeNull();expect(body.sourceHash).toMatch(/^[a-f0-9]{64}$/);operationIds.push(body.operationId);if(interruptOnce){interruptOnce=false;return r.fulfill({status:503,json:{error:'network_error'}});}generations++;expect(body.position.x).toBeGreaterThan(.3);expect(body.position.y).toBeGreaterThan(.5);expect(body.format).toBe('webp');expect(body.lore).toBe('Original mountains and ancient buildings.');
  const item={...body,image:undefined,approved:false,analysis:'Fixture visual analysis; no actual inference.',createdAt:new Date().toISOString()};items.unshift(item);return r.fulfill({json:{item}});
 });
 await page.goto('/explore?world=realm-hidden-worlds&arrival=direct');
 await page.getByRole('button',{name:'CREATE',exact:true}).press('Enter');await page.getByLabel('World Name',{exact:true}).fill('Partial edit fixture');await page.getByLabel('World Description',{exact:true}).fill('Original mountains and ancient buildings.');await page.getByRole('button',{name:'Create World',exact:true}).click();
 await expect(page.getByRole('region',{name:'Spirit editor'})).toBeVisible({timeout:15000});await page.getByRole('button',{name:'Close world companion',exact:true}).click();
 const original=await page.evaluate(()=>localStorage.getItem('beyond:v1:created-worlds'));
 // WorldDiscoveries now opens WorldCompanion. Mount the still-supported legacy
 // component directly; navigation through the replacement UI has its own E2E test.
 async function openLegacyEditor(){
  await page.evaluate(async()=>{
   const {default:React}=await import('/node_modules/.vite/deps/react.js'),{default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js'),{default:Provider,useAccount}=await import('/src/features/account/AccountProvider.tsx'),{default:Editor}=await import('/src/features/creation/WorldImageEditor.tsx');
   const world=JSON.parse(localStorage.getItem('beyond:v1:created-worlds')!)[0],host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:10000;background:#201d32';document.body.append(host);
   function Fixture(){const account=useAccount();return account.loading?null:React.createElement(Editor,{key:account.epoch,worldId:world.id,lore:world.description});}
   ReactDOM.createRoot(host).render(React.createElement(Provider,null,React.createElement(Fixture)));
  });
  await page.getByRole('button',{name:'Shape this world'}).click();
 }

 await openLegacyEditor();
 const dialog=page.getByRole('dialog',{name:'Shape this world'}),target=dialog.getByRole('button',{name:'Select a world location',exact:true});await target.locator('img').evaluate((i:HTMLImageElement)=>i.decode());const box=(await target.boundingBox())!;await target.click({position:{x:box.width*.36,y:box.height*.64}});
 await dialog.getByRole('button',{name:'Zoom selected area'}).click();await expect(dialog.locator('.world-edit-canvas')).toHaveClass(/is-zoomed/);await dialog.getByRole('button',{name:'Zoom out',exact:true}).click();
 await dialog.getByLabel('World edit action',{exact:true}).selectOption('CREATE_WORLD_OBJECT');await dialog.getByLabel('Talk to the world guide').fill('여기에 아름다운 집을 만들어 줘');await dialog.getByRole('button',{name:'Create preview',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('network connection failed');await dialog.getByRole('button',{name:'Create preview',exact:true}).click();await expect(dialog.getByAltText('Generated world candidate')).toBeVisible();expect(operationIds[1]).toBe(operationIds[0]);await expect(page.locator('.world-approved-image')).toHaveCount(0);
 await dialog.getByRole('button',{name:'Keep current world',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Preview rejected');await expect(page.locator('.world-approved-image')).toHaveCount(0);
 await page.reload();await page.getByRole('button',{name:'Close world companion',exact:true}).click();await openLegacyEditor();await expect(dialog.getByAltText('Generated world candidate')).toHaveCount(0);await expect(page.locator('.world-location-mask')).toHaveCount(1);
 await dialog.getByLabel('World edit action',{exact:true}).selectOption('CREATE_WORLD_OBJECT');await dialog.getByLabel('Talk to the world guide').fill('여기에 아름다운 집을 만들어 줘');await dialog.getByRole('button',{name:'Create preview',exact:true}).click();await expect(dialog.getByAltText('Generated world candidate')).toBeVisible();
 await dialog.getByRole('button',{name:'Approve and save to world'}).click();await expect(page.locator('.world-approved-image')).toHaveCount(1);await expect(dialog.getByText('Added here: 여기에 아름다운 집을 만들어 줘')).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Close world companion',exact:true}).click();await openLegacyEditor();await expect(page.locator('.world-approved-image')).toHaveCount(1);await expect(page.locator('.world-location-mask')).toHaveCount(1);expect(generations).toBe(2);expect(operationIds).toHaveLength(3);expect(operationIds[2]).not.toBe(operationIds[0]);expect(await page.evaluate(()=>localStorage.getItem('beyond:v1:created-worlds'))).toBe(original);
 await page.setViewportSize({width:375,height:812});await expect(dialog).toBeVisible();expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});
