import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',timeout:240000,workers:1,use:{headless:true},webServer:process.env.TRUCO_TEST_URL?undefined:{command:'npm run dev',url:'http://127.0.0.1:3000',reuseExistingServer:true,timeout:120000}});
