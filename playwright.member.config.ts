import {defineConfig} from '@playwright/test';
process.env.BEYOND_MEMBER_MAIL||='/tmp/beyond-member-mail-'+process.pid+'.json';
export default defineConfig({testDir:'./tests',testMatch:['account-context.spec.ts','member-accounts.spec.ts','world-companion.spec.ts','world-loading-recovery.spec.ts'],workers:1,timeout:45000,use:{baseURL:'http://127.0.0.1:5187',headless:true,launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},webServer:{command:'node tests/local-member-server.mjs',url:'http://127.0.0.1:5187',reuseExistingServer:false}});
