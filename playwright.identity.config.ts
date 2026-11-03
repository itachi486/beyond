import{defineConfig}from'@playwright/test';import base from'./playwright.member.config';
process.env.BEYOND_CONNECT_FIXTURE='1';process.env.BEYOND_IDENTITY_FIXTURE='1';
export default defineConfig({...base,testMatch:['character-identity.spec.ts'],use:{...base.use,actionTimeout:20000},timeout:150000,expect:{timeout:20000}});
