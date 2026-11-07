# MXMosPanel

个人自用的说说后台界面。无标题、无文件夹，打开即写；登录后才能进入。

| 项 | 说明 |
|---|---|
| 框架 | Nuxt 4 · Vue 3 · TypeScript（strict） |
| 样式 | 原生 SCSS（设计令牌 + 全局样式），不使用 Tailwind |
| 渲染 | 自研 Markdown + MDC 组件渲染器，零第三方 Markdown 依赖 |
| 共享代码 | [`MXMosShared`](https://github.com/MineXine/MXMosShared)（submodule） |
| 后端 | [`MXMosApi`](https://github.com/MineXine/MXMosApi) |

## 快速开始

```bash
git clone --recursive https://github.com/MineXine/MXMosPanel.git
cd MXMosPanel/web
npm install
```

配置 `web/.env`（参考 `web/.env.example`）：

```ini
NUXT_PUBLIC_API_BASE=http://localhost:4000/api
```

启动：

```bash
npm run dev        # 开发模式
npm run build      # 生产构建
npm run preview    # 预览构建产物
npm run typecheck  # vue-tsc 全量检查
```

先启动 [`MXMosApi`](https://github.com/MineXine/MXMosApi) 再打开 http://localhost:3000 ，注册账号后登录进入。

## 目录结构

```
MXMosPanel/
├── web/
│   ├── app/
│   │   ├── components/       # PostCard / PostEditor / MarkdownContent
│   │   ├── composables/      # useApi / useAuth / useTheme
│   │   ├── layouts/          # default（后台外壳） / bare（登录页）
│   │   ├── middleware/       # auth.global.ts —— 登录门禁
│   │   ├── pages/            # 13 个页面
│   │   ├── utils/            # markdown.ts（渲染器）/ icons.ts
│   │   └── assets/styles/    # _tokens.scss（设计令牌）+ main.scss
│   └── scripts/              # 前端测试脚本
├── docs/                     # API 契约与页面截图
└── shared/                   # MXMosShared submodule
```

## 设计体系

界面按「私人手账 / 案头工作台」的方向设计，令牌命名取自实体世界而非通用灰阶。

| 族 | 含义 | 变量 |
|---|---|---|
| 纸 | 表面层级 | `--paper` 画布 · `--paper-raised` 抬起的纸面 · `--paper-inset` 凹陷的输入框 · `--paper-tint` 着色纸面 |
| 墨 | 文字四级 | `--ink` 主墨 · `--ink-soft` 次要 · `--ink-faint` 元信息 · `--ink-ghost` 禁用 |
| 描图纸 | 分隔与描边 | `--vellum` · `--vellum-soft` · `--vellum-strong` · `--vellum-focus` |
| 印泥 | 唯一强调色 | `--seal` · `--seal-hover` · `--seal-soft` · `--seal-ink` |

**规则**

- 每屏一个焦点：概览页只有「累计记录」是大字，其余降到次级
- 深度策略唯一：卡片用微阴影表达抬升，描图纸色只做分隔线
- 输入框比周围更暗（凹陷，等待接收内容）
- 侧栏与画布同底色，仅一道描图纸分隔——不同底色会把空间割裂
- 强调色只有一色相的三个浓淡档，不引入彩虹色
- 动效只动 `transform` / `opacity`，缓动统一 `cubic-bezier(0.23, 1, 0.32, 1)`，尊重 `prefers-reduced-motion`
- 数字用 `tabular-nums`，标题 `text-wrap: balance`，正文 `text-wrap: pretty`
- 图标按钮均有 `aria-label`；图标只用几何符号，不用彩色 emoji
- 词汇统一：**封存**（不用归档）、**书签**（不用收藏）、**记录**（不用说说）

## 页面

| 页面 | 用途 |
|---|---|
| `/` 概览 | 累计记录数、最近记录、常用标签、快捷入口 |
| `/posts` 记录管理 | 全部记录的浏览与筛选（可见性 / 排序 / 标签 / 关键词） |
| `/new` 写一条 | 编辑器，支持 Markdown 与 MDC 组件、草稿自动保存 |
| `/archive` 封存库 | 已封存的记录，可批量恢复 |
| `/favorites` 书签 | 加过书签的记录 |
| `/search` 检索 | 全文搜索（中文 bigram + 英文前缀分词） |
| `/tags` 标签体系 | 标签清单 + 该标签下的记录 |
| `/calendar` 日历 | 按月查看，有记录的日期带墨点标记 |
| `/map` 足迹 | 带位置记录的分布图与位置档案 |
| `/views` 视图 | 筛选条件组合，可自建 |
| `/settings` 账号设置 | 资料、数据条、当前设备 |

## 登录门禁

除 `/login` 与分享落地页外，所有路由都要求已登录（`app/middleware/auth.global.ts`）。服务端渲染阶段凭 Cookie 判定，未登录直接跳转登录页，登录后回到原本要去的页面。

## Markdown 与 MDC

支持标题、粗斜体、删除线、高亮、引用、列表、任务列表、表格、代码块、链接、图片，并自动提取 `#标签`。

MDC 自定义组件支持块级与行内两种写法：

```markdown
::alert{type="warning" title="注意"}
这里是组件内容
::

行内形式：前面 ::badge{text="新"} 后面
```

可用组件：`alert` `callout` `badge` `card` `quote-card` `todo` `collapse` `divider` `media` `timeline-item` `poll`

**选项注入**：`MDC_DEFAULTS` 定义组件默认选项，正文显式声明的 props 优先，未声明的项由配置表补齐。前后端共用同一份解析器，保证「编辑器预览 = 发布后渲染」。

## 测试

```bash
npm run test:render        # 24 项渲染器单元测试（Markdown / MDC / XSS 转义）
npm run test:ui            # 36 项浏览器交互验证（Playwright 驱动 Edge，需前后端已启动）
npm run typecheck          # vue-tsc 全量检查
npm run typecheck:scripts  # scripts/ TypeScript 全量检查
```

## 设计规范来源

界面以 [UI Skills MCP](https://www.ui-skills.com/mcp) 为规范依据，实际采用 `interface-design`、`better-writing`、`better-typography`、`baseline-ui` 四份技能。

## 文档

- [`docs/API.md`](docs/API.md) —— REST API 契约
- [`docs/`](docs/) —— 各页面截图
