/**
 * 前端交互验证（后台管理版）
 *
 * 覆盖：登录门禁、概览、记录管理、标签、日历、足迹、视图、
 *       封存库、书签、检索、编辑器、主题切换、详情页。
 */
import { chromium } from 'playwright';

const api = 'http://localhost:4000/api';
const OUT = 'C:/Users/a1319/WorkBuddy/2026-11-05-23-01-55/docs';
const WEB = 'http://localhost:3000';

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
};

const b = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const consoleErrors = [];
p.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
p.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push('console: ' + m.text().slice(0, 160));
});

console.log('\n▶ 前端交互验证（后台管理版）\n');

// ---------- 1. 登录门禁 ----------
await p.goto(WEB + '/', { waitUntil: 'networkidle', timeout: 45000 });
await p.waitForTimeout(800);
check('未登录访问被重定向到登录页', p.url().includes('/login'), p.url());
check('登录页展示门禁卡片', await p.locator('.gate-card').isVisible().catch(() => false));
check('登录页无后台侧栏', (await p.locator('.rail').count()) === 0);

// ---------- 2. 通过表单登录 ----------
await p.locator('#acct').fill('demo');
await p.locator('#pwd').fill('demo123');
await p.locator('.gate-submit').click();
await p.waitForTimeout(1800);
check('登录后进入后台', !p.url().includes('/login'), p.url());
check('登录后显示侧栏', (await p.locator('.rail').count()) === 1);

// ---------- 3. 概览 ----------
await p.goto(WEB + '/', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
check('概览显示聚焦数字', (await p.locator('.hero-figure').count()) === 1);
check('概览显示最近记录', (await p.locator('.recent-item').count()) >= 1);
check('概览显示常用标签', (await p.locator('.tagrow').count()) >= 1);
check('概览显示快捷入口', (await p.locator('.quick-item').count()) >= 3);
check('侧栏按分组导航', (await p.locator('.nav-group').count()) >= 3);

// ---------- 4. 记录管理 ----------
await p.goto(WEB + '/posts', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
const cardCount = await p.locator('.leaf').count();
check('记录管理列出记录', cardCount >= 1, `cards=${cardCount}`);
check('记录卡显示可见性印记', (await p.locator('.leaf-stamps .stamp').count()) >= 1);
check('记录管理有视图快捷条', (await p.locator('.viewchip').count()) >= 5);

// ---------- 5. 标签体系 ----------
await p.goto(WEB + '/tags', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
check('标签页显示清单', (await p.locator('.tagrow').count()) >= 1);
await p.locator('.tagrow').first().click();
await p.waitForTimeout(1200);
check('点击标签加载该标签记录', (await p.locator('.leaf').count()) >= 1);
check('标签详情区显示计数', (await p.locator('.detail-count').count()) === 1);

// ---------- 6. 日历 ----------
await p.goto(WEB + '/calendar', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
const cells = await p.locator('.day-cell').count();
check('日历渲染完整网格', cells >= 28, `cells=${cells}`);
const marked = await p.locator('.day-cell .day-dot').count();
check('日历用墨点标记有记录的日期', marked >= 1, `marked=${marked}`);
check('日历有图例说明', (await p.locator('.cal-legend').count()) === 1);
await p.locator('.day-cell:has(.day-dot)').first().click();
await p.waitForTimeout(1200);
check('点击日期显示当日记录', (await p.locator('.day-panel .leaf').count()) >= 1);

// ---------- 7. 足迹 ----------
await p.goto(WEB + '/map', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
check('地图渲染位置标记', (await p.locator('.marker').count()) >= 1);
check('地图有位置档案面板', (await p.locator('.point-panel').count()) === 1);
check('位置档案列出位置', (await p.locator('.point-item').count()) >= 1);
await p.locator('.point-item').first().click();
await p.waitForTimeout(600);
check('点击位置显示详情', await p.locator('.point-detail').isVisible());

// ---------- 8. 视图 ----------
await p.goto(WEB + '/views', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
check('视图页列出视图', (await p.locator('.view-card').count()) >= 5);
await p.locator('.btn-seal:has-text("新建视图")').click();
await p.waitForTimeout(500);
check('新建视图表单可展开', await p.locator('.create-form').isVisible());

// ---------- 9. 封存库 / 书签 ----------
await p.goto(WEB + '/archive', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
check('封存库正常渲染', (await p.locator('h1').innerText()).includes('封存'));

await p.goto(WEB + '/favorites', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
check('书签页正常渲染', (await p.locator('h1').innerText()).includes('书签'));

// ---------- 10. 检索 ----------
await p.goto(WEB + '/search', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await p.locator('.search-page .search-input').fill('西湖');
await p.locator('.search-form button[type="submit"]').click();
await p.waitForTimeout(1500);
check('检索返回结果', (await p.locator('.leaf').count()) >= 1);
check('检索结果提示正确', (await p.locator('.result-head').innerText()).includes('西湖'));

// ---------- 11. 编辑器 ----------
await p.goto(WEB + '/new', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);
check('编辑器渲染', (await p.locator('.editor-input').count()) === 1);
await p.locator('.editor-input').fill('测试正文 #测试');
await p.waitForTimeout(400);
await p.locator('.tool-btn[title="插入组件"]').click();
await p.waitForTimeout(400);
check('组件选择器列出组件', (await p.locator('.mdc-item').count()) >= 10);
await p.locator('.mdc-item').first().click();
await p.waitForTimeout(500);
const editorVal = await p.locator('.editor-input').inputValue();
check('组件已插入编辑器', editorVal.includes('::alert'), editorVal.slice(0, 48).replace(/\n/g, ' '));

await p.locator('.tool-btn[title="预览效果"]').click();
await p.waitForTimeout(700);
check('预览渲染组件', (await p.locator('.preview-area .mdc-alert').count()) >= 1);
await p.locator('.tool-btn[title="继续编辑"]').click();
await p.waitForTimeout(300);

// 可见性
await p.locator('.vis-btn:has-text("仅自己可见")').click();
await p.waitForTimeout(400);
check('可见性可切为仅自己可见', (await p.locator('.vis-btn.active').innerText()).includes('仅自己可见'));

// 草稿自动保存
await p.waitForTimeout(2000);
const draftHint = await p.locator('.saved-hint').innerText().catch(() => '');
check('草稿自动保存提示', draftHint.includes('草稿'), draftHint);

// ---------- 12. 主题 ----------
await p.locator('.bar-tools button[title="外观"]').click();
await p.waitForTimeout(400);
check('外观面板可打开', await p.locator('.pop-theme').isVisible());
await p.locator('.theme-pick:has-text("夜墨")').click();
await p.waitForTimeout(500);
const scheme = await p.evaluate(() => document.documentElement.getAttribute('data-scheme'));
check('切换深色主题', scheme === 'dark', `scheme=${scheme}`);
await p.screenshot({ path: `${OUT}/v3-dark.png` });
await p.locator('.theme-pick:has-text("宣纸")').click();
await p.waitForTimeout(400);
check('切回浅色主题', (await p.evaluate(() => document.documentElement.getAttribute('data-scheme'))) === 'light');

// ---------- 13. 详情页 ----------
await p.goto(WEB + '/posts', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await p.locator('.leaf').first().locator('.leaf-menu button').click();
await p.waitForTimeout(300);
await p.locator('.menu-item:has-text("查看详情")').click();
await p.waitForTimeout(1500);
check('详情页显示记录信息', (await p.locator('.meta-card').count()) >= 1);
check('详情页显示设备信息', (await p.locator('.meta-card').innerText()).includes('发布设备'));
await p.screenshot({ path: `${OUT}/v3-detail.png` });

// ---------- 14. 无 console 错误 ----------
check('无 JS 运行时错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length === 0 ? '✅' : '❌'} ${results.length - failed.length}/${results.length} 项通过\n`);
await b.close();
process.exit(failed.length === 0 ? 0 : 1);
