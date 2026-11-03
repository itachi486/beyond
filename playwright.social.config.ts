import{defineConfig}from'@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:['social.spec.ts'],workers:1,timeout:120000,expect:{timeout:20000},use:{baseURL:process.env.BEYOND_SOCIAL_ORIGIN||'http://127.0.0.1:5191',headless:true,launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}}});
