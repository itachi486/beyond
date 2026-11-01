import {test,expect} from '@playwright/test';
import {authorizeLocalAuthor} from './author-fixture';

test('limited administrator release disables unfinished sections and destructive UI',async({page})=>{
 await authorizeLocalAuthor(page);
 // The backend is the disposable real Node/SQLite fixture. Only release
 // capability metadata is supplied here; authorization is never mocked.
 await page.route('**/api/admin/setup-status',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,json:{...await response.json(),backendMode:'supabase-admin-production'}});
 });
 await page.goto('/admin');
 const nav=page.getByRole('navigation',{name:'Administrator navigation'});
 await expect(nav.getByRole('button',{name:'Worlds',exact:true})).toBeEnabled();
 await expect(nav.getByRole('button',{name:'Image Management',exact:true})).toBeDisabled();
 await expect(nav.getByRole('button',{name:'Characters',exact:true})).toBeDisabled();
 await expect(nav.getByRole('button',{name:'System Settings',exact:true})).toBeDisabled();
 await nav.getByRole('button',{name:'Worlds',exact:true}).click();
 await expect(page).toHaveURL(/\/admin\/worlds$/);
 await expect(page.getByRole('heading',{name:'Worlds',exact:true})).toBeVisible();
 await expect(page.locator('table')).toBeVisible();
 await expect(page.getByRole('button',{name:/permanently delete/i})).toHaveCount(0);
 await page.goto('/admin/images');
 await expect(page.getByRole('heading',{name:'This section is not available in this release.'})).toBeVisible();
 await page.getByRole('button',{name:'Return to Dashboard'}).click();
 await expect(page).toHaveURL(/\/admin$/);
});

test('default backend keeps existing administrator navigation available',async({page})=>{
 await authorizeLocalAuthor(page);await page.goto('/admin');
 const nav=page.getByRole('navigation',{name:'Administrator navigation'});
 await expect(nav.getByRole('button',{name:'Image Management',exact:true})).toBeEnabled();
 await expect(nav.getByRole('button',{name:'Characters',exact:true})).toBeEnabled();
});
