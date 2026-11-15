import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let playwright;
try {playwright=require(process.env.JLPT_PLAYWRIGHT_PATH||'playwright');}
catch {throw new Error('浏览器验收需要 Playwright：先运行 npm install --no-save playwright，再运行浏览器测试脚本。');}
export const chromium=playwright.chromium;
