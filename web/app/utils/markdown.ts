/**
 * 轻量 Markdown 渲染器。
 *
 * 不引入第三方 Markdown 库，原因是本项目需要：
 *  1. 支持 MDC 自定义组件语法 `::name{props}`（行内与块级）
 *  2. 渲染前注入服务端下发的组件选项（mdcOptions）
 *  3. 严格转义，防止 XSS
 *
 * 输出为 HTML 字符串，由 v-html 渲染（内容已在渲染前完成转义）。
 */

import type { MdcOptions } from '~/types';

/** HTML 转义 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 从 markdown 中提取 MDC 组件块（渲染时替换为占位符） */
interface MdcBlock {
  raw: string;
  name: string;
  props: Record<string, string | number | boolean>;
  content: string | null;
  isBlock: boolean;
}

const MDC_BLOCK_RE = /^::([a-zA-Z][\w-]*)\s*(?:\{([^}]*)\})?\s*\n([\s\S]*?)\n::\s*$/gm;
const MDC_INLINE_RE = /::([a-zA-Z][\w-]*)\s*(?:\{([^}]*)\})?/g;

/** 解析属性串 */
export function parseAttrs(raw?: string): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!raw) return out;
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,}]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const key = m[1];
    const val = m[2] ?? m[3] ?? m[4] ?? '';
    if (val === 'true') out[key] = true;
    else if (val === 'false') out[key] = false;
    else if (/^-?\d+(\.\d+)?$/.test(val)) out[key] = Number(val);
    else out[key] = val;
  }
  return out;
}

/** 抽出 MDC 块并替换为占位符 */
export function extractMdcBlocks(markdown: string): { text: string; blocks: MdcBlock[] } {
  const blocks: MdcBlock[] = [];

  // 块级占位符必须独占一行，否则会与相邻段落粘连而无法被单独识别。
  // 这里在占位符前后补齐换行。
  let text = markdown.replace(
    MDC_BLOCK_RE,
    (_full, name: string, attrs: string, content: string) => {
      const idx = blocks.length;
      blocks.push({
        raw: '',
        name,
        props: parseAttrs(attrs),
        content: content.trim(),
        isBlock: true,
      });
      return `\nMDC_BLOCK_${idx}\n`;
    },
  );

  text = text.replace(MDC_INLINE_RE, (_full, name: string, attrs: string) => {
    const idx = blocks.length;
    blocks.push({
      raw: '',
      name,
      props: parseAttrs(attrs),
      content: null,
      isBlock: false,
    });
    return `MDC_INLINE_${idx}`;
  });

  return { text, blocks };
}

/** 将服务端下发的 mdcOptions 合并进组件 props */
export function mergeMdcOptions(
  blocks: MdcBlock[],
  options: MdcOptions[],
): MdcBlock[] {
  return blocks.map((b) => {
    const opt = options.find((o) => o.name === b.name);
    if (!opt) return b;
    return { ...b, props: { ...opt.props, ...b.props } };
  });
}

/* ------------------------------------------------------------------ *
 * 行内元素
 * ------------------------------------------------------------------ */

/**
 * 占位符 token。
 *
 * 使用零宽字符包裹，避免与用户输入冲突；
 * 占位符在「转义之后」被替换为组件 HTML，因此组件内容不参与转义流程。
 */
const PLACEHOLDER_RE = /MDC_(BLOCK|INLINE)_(\d+)/g;


/**
 * 当前渲染上下文的组件 HTML 表。
 *
 * 由 renderMarkdown 填充，renderInline 在行内渲染完成后统一消费。
 * 行内 MDC 组件（如 ::badge{text="新"}）嵌在段落中间，
 * 无法像块级组件那样独占一行，因此必须在行内渲染路径中替换。
 */
let componentHtml = new Map<number, string>();

/** 将行内文本中的占位符替换为组件 HTML */
function replacePlaceholders(html: string): string {
  return html.replace(/ MDC_(BLOCK|INLINE)_(\d+) /g, (full, _kind: string, idx: string) => {
    const n = Number(idx);
    return componentHtml.get(n) ?? full;
  });
}

function renderInline(src: string): string {
  let out = escapeHtml(src);

  // 行内代码
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 图片 ![alt](url "title")
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, alt: string, url: string, title?: string) => {
      const safe = sanitizeUrl(url);
      if (!safe) return escapeHtml(alt);
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(alt)}"${t} loading="lazy" />`;
    },
  );

  // 链接 [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_m, text: string, url: string, title?: string) => {
      const safe = sanitizeUrl(url);
      if (!safe) return text;
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(safe)}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  );

  // 粗体 / 斜体 / 删除线
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // 高亮 ==text==
  out = out.replace(/==([^=]+)==/g, '<mark>$1</mark>');

  // 标签 #tag
  out = out.replace(
    /(^|\s)#([\p{L}\p{N}_\-]{1,32})/gu,
    (_m, pre: string, tag: string) => `${pre}<span class="md-tag">#${tag}</span>`,
  );

  // 行内 MDC 组件占位符（在转义与行内语法处理完成后替换）
  return replacePlaceholders(out);
}

/** 过滤危险协议 */
function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(javascript|vbscript|data:text\/html)/i.test(trimmed)) return null;
  return trimmed;
}

/* ------------------------------------------------------------------ *
 * 块级渲染
 * ------------------------------------------------------------------ */

export interface RenderOptions {
  /** 服务端下发的 MDC 组件选项 */
  mdcOptions?: MdcOptions[];
  /** 是否渲染 MDC 组件（false 时原样显示文本） */
  renderComponents?: boolean;
}

export function renderMarkdown(markdown: string, options: RenderOptions = {}): string {
  const { mdcOptions = [], renderComponents = true } = options;

  const { text, blocks } = extractMdcBlocks(markdown);
  const merged = mergeMdcOptions(blocks, mdcOptions);

  // 预渲染所有组件，供行内渲染路径按占位符索引取用
  componentHtml = new Map<number, string>();
  merged.forEach((b, idx) => {
    componentHtml.set(idx, renderComponent(b, renderComponents));
  });

  const lines = text.split('\n');
  const html: string[] = [];

  let i = 0;
  let inCode = false;
  let codeLang = '';
  let codeBuffer: string[] = [];

  const flushCode = () => {
    if (!inCode) return;
    const cls = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : '';
    html.push(`<pre><code${cls}>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
    inCode = false;
    codeBuffer = [];
    codeLang = '';
  };

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        flushCode();
      } else {
        inCode = true;
        codeLang = line.trim().slice(3).trim();
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      i++;
      continue;
    }

    // MDC 占位符
    const placeholder = line.trim().match(/^MDC_(BLOCK|INLINE)_(\d+)$/);
    if (placeholder) {
      const kind = placeholder[1];
      const idx = Number(placeholder[2]);
      const block = merged[idx];
      if (block) {
        html.push(renderComponent(block, renderComponents));
      }
      i++;
      continue;
    }

    // 标题
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2]);
      html.push(`<h${level}>${content}</h${level}>`);
      i++;
      continue;
    }

    // 分割线
    if (/^\s{0,3}([-*_])\s*(\1\s*){2,}$/.test(line)) {
      html.push('<hr />');
      i++;
      continue;
    }

    // 引用
    if (/^\s{0,3}>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
        i++;
      }
      html.push(`<blockquote>${renderMarkdown(quote.join('\n'), options)}</blockquote>`);
      continue;
    }

    // 无序列表
    if (/^\s{0,3}[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s{0,3}[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s{0,3}[-*+]\s+/, ''));
        i++;
      }
      html.push(
        `<ul>${items.map((t) => `<li>${renderInline(t)}</li>`).join('')}</ul>`,
      );
      continue;
    }

    // 有序列表
    if (/^\s{0,3}\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s{0,3}\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s{0,3}\d+\.\s+/, ''));
        i++;
      }
      html.push(
        `<ol>${items.map((t) => `<li>${renderInline(t)}</li>`).join('')}</ol>`,
      );
      continue;
    }

    // 任务列表
    if (/^\s{0,3}[-*+]\s+\[[ xX]\]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s{0,3}[-*+]\s+\[[ xX]\]\s+/.test(lines[i])) {
        const m = lines[i].match(/^\s{0,3}[-*+]\s+\[([ xX])\]\s+(.*)$/)!;
        const checked = m[1].toLowerCase() === 'x';
        items.push(
          `<li class="md-task"><span class="md-checkbox${checked ? ' checked' : ''}">${checked ? '✓' : ''}</span>${renderInline(m[2])}</li>`,
        );
        i++;
      }
      html.push(`<ul class="md-tasks">${items.join('')}</ul>`);
      continue;
    }

    // 表格
    if (line.includes('|') && lines[i + 1]?.match(/^\s*\|?[\s:|-]+\|[\s:|-]*$/)) {
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => {
        const l = c.startsWith(':');
        const r = c.endsWith(':');
        if (l && r) return 'center';
        if (r) return 'right';
        if (l) return 'left';
        return '';
      });
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        body.push(splitRow(lines[i]));
        i++;
      }
      const th = header
        .map((c, idx) => `<th${align[idx] ? ` style="text-align:${align[idx]}"` : ''}>${renderInline(c)}</th>`)
        .join('');
      const tb = body
        .map(
          (row) =>
            `<tr>${row
              .map((c, idx) => `<td${align[idx] ? ` style="text-align:${align[idx]}"` : ''}>${renderInline(c)}</td>`)
              .join('')}</tr>`,
        )
        .join('');
      html.push(`<table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`);
      continue;
    }

    // 空行
    if (!line.trim()) {
      i++;
      continue;
    }

    // 段落（连续非空行合并）
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s{0,3}>/.test(lines[i]) &&
      !/^\s{0,3}[-*+]\s+/.test(lines[i]) &&
      !/^\s{0,3}\d+\.\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith('```') &&
      !/^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) {
      html.push(`<p>${renderInline(para.join('\n')).replace(/\n/g, '<br />')}</p>`);
    } else {
      i++;
    }
  }

  flushCode();

  return html.join('\n');
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/* ------------------------------------------------------------------ *
 * MDC 组件渲染
 * ------------------------------------------------------------------ */

function renderComponent(block: MdcBlock, enabled: boolean): string {
  const { name, props, content } = block;

  if (!enabled) {
    return `<span class="mdc-inline">${escapeHtml(`::${name}`)}</span>`;
  }

  const cls = `mdc-${name}`;

  switch (name) {
    case 'alert': {
      const type = String(props.type ?? 'info');
      const title = String(props.title ?? '');
      const icon = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', danger: '⛔' }[type] ?? 'ℹ️';
      return `<div class="${cls} mdc-alert-${escapeHtml(type)}"><span class="mdc-alert-icon">${icon}</span><div class="mdc-alert-body">${title ? `<strong class="mdc-alert-title">${escapeHtml(title)}</strong>` : ''}${content ? renderMarkdown(content, { renderComponents: false }) : ''}</div></div>`;
    }
    case 'callout': {
      const type = String(props.type ?? 'info');
      const icon = String(props.icon ?? '💡');
      const title = String(props.title ?? '');
      return `<div class="${cls} mdc-callout-${escapeHtml(type)}"><span class="mdc-callout-icon">${escapeHtml(icon)}</span><div>${title ? `<div class="mdc-callout-title">${escapeHtml(title)}</div>` : ''}${content ? renderMarkdown(content, { renderComponents: false }) : ''}</div></div>`;
    }
    case 'badge': {
      const type = String(props.type ?? 'default');
      const text = String(props.text ?? '徽章');
      return `<span class="${cls} mdc-badge-${escapeHtml(type)}">${escapeHtml(text)}</span>`;
    }
    case 'card': {
      const title = String(props.title ?? '');
      const subtitle = String(props.subtitle ?? '');
      const variant = String(props.variant ?? 'default');
      return `<div class="${cls} mdc-card-${escapeHtml(variant)}">${title ? `<div class="mdc-card-title">${escapeHtml(title)}</div>` : ''}${subtitle ? `<div class="mdc-card-subtitle">${escapeHtml(subtitle)}</div>` : ''}${content ? `<div class="mdc-card-body">${renderMarkdown(content, { renderComponents: false })}</div>` : ''}</div>`;
    }
    case 'quote-card': {
      const author = String(props.author ?? '');
      const source = String(props.source ?? '');
      return `<blockquote class="${cls}">${content ? renderMarkdown(content, { renderComponents: false }) : ''}${author || source ? `<footer>${escapeHtml(author)}${source ? ` — ${escapeHtml(source)}` : ''}</footer>` : ''}</blockquote>`;
    }
    case 'todo': {
      const checked = props.checked === true || props.checked === 'true';
      const text = String(props.text ?? '待办');
      return `<div class="${cls}"><span class="md-checkbox${checked ? ' checked' : ''}">${checked ? '✓' : ''}</span><span>${escapeHtml(text)}</span></div>`;
    }
    case 'collapse': {
      const title = String(props.title ?? '展开');
      const open = props.open === true || props.open === 'true';
      return `<details class="${cls}" ${open ? 'open' : ''}><summary>${escapeHtml(title)}</summary><div class="mdc-collapse-body">${content ? renderMarkdown(content, { renderComponents: false }) : ''}</div></details>`;
    }
    case 'divider': {
      const color = String(props.color ?? 'gray');
      const text = String(props.text ?? '');
      return `<div class="${cls}" style="border-color:${escapeHtml(color)}">${text ? `<span>${escapeHtml(text)}</span>` : ''}</div>`;
    }
    case 'media': {
      const caption = String(props.caption ?? '');
      const layout = String(props.layout ?? 'default');
      return `<div class="${cls} mdc-media-${escapeHtml(layout)}">${content ? renderMarkdown(content, { renderComponents: false }) : ''}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</div>`;
    }
    case 'timeline-item': {
      const time = String(props.time ?? '');
      const type = String(props.type ?? 'default');
      const title = String(props.title ?? '');
      return `<div class="${cls} mdc-timeline-${escapeHtml(type)}"><div class="mdc-timeline-dot"></div><div class="mdc-timeline-body">${time ? `<span class="mdc-timeline-time">${escapeHtml(time)}</span>` : ''}${title ? `<strong>${escapeHtml(title)}</strong>` : ''}${content ? renderMarkdown(content, { renderComponents: false }) : ''}</div></div>`;
    }
    case 'poll': {
      const question = String(props.question ?? '');
      const options = String(props.options ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      return `<div class="${cls}"><div class="mdc-poll-question">${escapeHtml(question)}</div><ul class="mdc-poll-options">${options.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul></div>`;
    }
    default: {
      return `<span class="${cls}">${content ? renderMarkdown(content, { renderComponents: false }) : escapeHtml(name)}</span>`;
    }
  }
}
