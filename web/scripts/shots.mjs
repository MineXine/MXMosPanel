/**
 * 生成后台管理界面最终截图。
 */
import { chromium } from 'playwright';

const OUT = 'C:/Users/a1319/WorkBuddy/2026-11-05-23-01-55/docs';
const api = 'http://localhost:4000/api';

// 复用已登录会话：从本地存储文件读取凭据不存在，故用接口登录
const creds = JSON.parse(process.env.SHOU_OWN || '{}');
const loginRes = await fetch(`${api}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(creds),
});
const token = (await loginRes.json()).data?.token;
if (!token) throw new Error('登录失败：无法获取 token');

const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();

// 登录页
await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 45000 });
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/v3-login.png` });
console.log('shot login');

await ctx.addCookies([{ name: 'shuoshuo.token', value: token, domain: 'localhost', path: '/' }]);

const pages = [
  ['/', 'v3-dashboard'],
  ['/posts', 'v3-records'],
  ['/tags', 'v3-tags'],
  ['/calendar', 'v3-calendar'],
  ['/map', 'v3-map'],
  ['/views', 'v3-views'],
  ['/new', 'v3-editor'],
  ['/settings', 'v3-settings'],
];

for (const [path, name] of pages) {
  await p.goto('http://localhost:3000' + path, { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

// 深色
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(() =>
  localStorage.setItem('shuoshuo.theme', JSON.stringify({ scheme: 'dark', accent: 'cinnabar' })),
);
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/v3-dark.png` });
console.log('shot dark');

await b.close();
