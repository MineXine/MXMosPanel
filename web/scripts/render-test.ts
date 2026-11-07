/**
 * 渲染器单元测试：直接验证 Markdown + MDC 解析结果。
 * 覆盖块级/行内组件、选项合并、中文检索相关纯函数。
 */
import assert from 'node:assert';
import { renderMarkdown, extractMdcBlocks } from '../app/utils/markdown.js';
import { parseMdcOptions, MDC_DEFAULTS } from '../../shared/mdc.js';

let pass = 0;
const results: string[] = [];

function check(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    results.push(`✓ ${name}`);
    console.log(`✓ ${name}`);
  } catch (e) {
    results.push(`✗ ${name} — ${(e as Error).message}`);
    console.log(`✗ ${name} — ${(e as Error).message}`);
  }
}

console.log('\n▶ 渲染器单元测试\n');

// ---------- MDC 块提取 ----------
check('块级 MDC 组件被正确提取', () => {
  const md = '::alert{type="warning" title="注意"}\n记得带伞\n::';
  const { blocks, text } = extractMdcBlocks(md);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].name, 'alert');
  assert.equal(blocks[0].content, '记得带伞');
  assert.equal(blocks[0].props.type, 'warning');
  assert.ok(text.includes('MDC_BLOCK_0'));
});

check('行内 MDC 组件被正确提取', () => {
  const { blocks } = extractMdcBlocks('前面 ::badge{text="新"} 后面');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].name, 'badge');
  assert.equal(blocks[0].props.text, '新');
});

check('多个 MDC 组件分别提取', () => {
  const { blocks } = extractMdcBlocks(
    '::alert{type="info"}\nA\n::\n\n::todo{checked=true text="做完了"}\n',
  );
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].name, 'alert');
  assert.equal(blocks[1].name, 'todo');
  assert.equal(blocks[1].props.checked, true);
});

// ---------- shared 解析器 ----------
check('shared 解析器识别块级组件选项', () => {
  const opts = parseMdcOptions('::alert{type="warning" title="注意"}\n内容\n::');
  assert.equal(opts.length, 1);
  assert.equal(opts[0].name, 'alert');
  assert.equal(opts[0].props.type, 'warning');
  assert.equal(opts[0].props.title, '注意');
});

check('shared 解析器补齐配置默认值', () => {
  const opts = parseMdcOptions('::alert{type="warning"}\n内容\n::');
  assert.equal(opts[0].props.closable, true, '未声明项应使用默认值');
  assert.equal(opts[0].props.type, 'warning', '显式声明项应覆盖默认值');
});

check('shared 解析器识别行内组件', () => {
  const opts = parseMdcOptions('正文 ::badge{text="新"} 更多');
  assert.equal(opts.length, 1);
  assert.equal(opts[0].name, 'badge');
  assert.equal(opts[0].props.text, '新');
});

check('非白名单组件被忽略', () => {
  const opts = parseMdcOptions('::unknown-thing{a="1"}');
  assert.equal(opts.length, 0);
});

// ---------- 渲染输出 ----------
check('块级 alert 渲染为 mdc-alert 元素', () => {
  const md = '::alert{type="warning" title="注意"}\n记得带伞\n::';
  const opts = parseMdcOptions(md, MDC_DEFAULTS);
  const html = renderMarkdown(md, { mdcOptions: opts });
  assert.ok(html.includes('mdc-alert'), `缺少 mdc-alert: ${html}`);
  assert.ok(html.includes('mdc-alert-warning'));
  assert.ok(html.includes('记得带伞'));
});

check('渲染时应用配置默认值', () => {
  const md = '::alert{type="info"}\n内容\n::';
  const opts = parseMdcOptions(md, MDC_DEFAULTS);
  const html = renderMarkdown(md, { mdcOptions: opts });
  assert.ok(html.includes('mdc-alert-info'));
  assert.ok(html.includes('提示'), '默认 title 应被注入');
});

check('块级组件前有其他内容时仍能正确渲染', () => {
  // 回归用例：占位符必须独占一行，否则会与前一段落粘连
  const md = '测试内容 #测试标签\n::alert{type="info" title="提示"}\n这里填写内容\n::';
  const opts = parseMdcOptions(md, MDC_DEFAULTS);
  const html = renderMarkdown(md, { mdcOptions: opts });
  assert.ok(html.includes('mdc-alert'), `块级组件未渲染: ${html}`);
  assert.ok(html.includes('这里填写内容'));
  assert.ok(html.includes('md-tag'), '前一段落的标签应正常渲染');
  assert.ok(!html.includes('MDC_BLOCK_'), '不应残留未替换的占位符');
});

check('行内 badge 渲染为 mdc-badge 元素', () => {
  const md = '前面 ::badge{text="新"} 后面';
  const opts = parseMdcOptions(md, MDC_DEFAULTS);
  const html = renderMarkdown(md, { mdcOptions: opts });
  assert.ok(html.includes('mdc-badge'), `缺少 mdc-badge: ${html}`);
  assert.ok(html.includes('新'));
});

check('todo 组件渲染复选框', () => {
  const md = '::todo{checked=true text="已完成"}';
  const opts = parseMdcOptions(md, MDC_DEFAULTS);
  const html = renderMarkdown(md, { mdcOptions: opts });
  assert.ok(html.includes('mdc-todo'));
  assert.ok(html.includes('已完成'));
});

check('未传 mdcOptions 时组件降级为原文', () => {
  const html = renderMarkdown('::alert{type="info"}\n内容\n::', { renderComponents: false });
  assert.ok(html.includes('mdc-inline'));
});

// ---------- Markdown 基础能力 ----------
check('标题渲染', () => {
  assert.ok(renderMarkdown('# 一级标题').includes('<h1>一级标题</h1>'));
});

check('粗体与斜体渲染', () => {
  const html = renderMarkdown('**粗** 和 *斜*');
  assert.ok(html.includes('<strong>粗</strong>'));
  assert.ok(html.includes('<em>斜</em>'));
});

check('代码块被转义', () => {
  const html = renderMarkdown('```\n<script>alert(1)</script>\n```');
  assert.ok(html.includes('&lt;script&gt;'), '代码内容必须转义');
  assert.ok(!html.includes('<script>'), '不得输出可执行脚本');
});

check('HTML 注入被转义（防 XSS）', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<img src=x'), '原始 HTML 必须转义');
  assert.ok(html.includes('&lt;img'));
});

check('危险链接协议被拦截', () => {
  const html = renderMarkdown('[点我](javascript:alert(1))');
  assert.ok(!html.includes('javascript:'), `危险协议未被拦截: ${html}`);
});

check('标签被渲染为 md-tag', () => {
  assert.ok(renderMarkdown('这是 #旅行 记录').includes('md-tag'));
});

check('列表渲染', () => {
  const html = renderMarkdown('- 项目一\n- 项目二');
  assert.ok(html.includes('<ul>'));
  assert.ok(html.includes('项目一'));
});

check('引用渲染', () => {
  assert.ok(renderMarkdown('> 引用内容').includes('<blockquote>'));
});

check('表格渲染', () => {
  const html = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
  assert.ok(html.includes('<table>'));
  assert.ok(html.includes('<th>A</th>'));
});

check('分割线渲染', () => {
  assert.ok(renderMarkdown('---').includes('<hr />'));
});

check('高亮渲染', () => {
  assert.ok(renderMarkdown('==重点==').includes('<mark>重点</mark>'));
});

console.log(`\n${pass === results.length ? '✅' : '❌'} ${pass}/${results.length} 项通过\n`);
process.exit(pass === results.length ? 0 : 1);
