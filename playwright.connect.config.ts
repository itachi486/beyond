import{defineConfig}from'@playwright/test';import base from'./playwright.member.config';
process.env.BEYOND_CONNECT_FIXTURE='1';
export default defineConfig({...base,testMatch:['connect.spec.ts'],expect:{timeout:20000},timeout:90000});
