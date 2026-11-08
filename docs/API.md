# REST API 契约

基础路径：`/api`

**两种鉴权方式**（可混用）：

| 方式 | 头 | 用途 |
|---|---|---|
| JWT 会话 | `Authorization: Bearer <token>` | 后台界面登录态，短期有效 |
| API Token | `X-API-Token: mx_...`<br>或 `Authorization: ApiToken mx_...` | 第三方长期访问（小程序 / CLI / 脚本） |

API Token 由 `/tokens` 创建，明文只返回一次；停用、过期、吊销后立即失效。

统一响应包装：

```jsonc
// 成功
{ "ok": true, "data": { /* ... */ } }

// 失败
{ "ok": false, "error": { "code": "BAD_REQUEST", "message": "错误描述", "details": {} } }
```

错误码：`BAD_REQUEST` `UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND` `CONFLICT` `VALIDATION_ERROR` `INTERNAL_ERROR`

**状态码约定**：请求体 schema 校验失败返回 `422 VALIDATION_ERROR`；业务规则违反（如配额超限）返回 `400 BAD_REQUEST`。

---

## 认证

### POST /auth/register

```jsonc
// 请求
{ "username": "alice", "password": "secret123", "displayName": "Alice" }
// 响应 201
{ "ok": true, "data": { "token": "eyJ...", "user": { /* User */ } } }
```

`username` 3–24 位字母数字与 `_ . -`；`password` ≥ 6 位。用户名重复返回 409。

### POST /auth/login

```jsonc
{ "username": "alice", "password": "secret123" }
```

### GET /auth/me · PATCH /auth/me

`PATCH` 支持 `displayName`、`bio`、`avatarColor`（`#rrggbb`）。

### PATCH /auth/password

```jsonc
{ "oldPassword": "old123", "newPassword": "new123" }
```

旧密码不匹配返回 401。成功后旧密码立即失效。

### GET /auth/users

返回所有用户（用于切换体验账号），无需鉴权。

---

## 说说

### GET /posts

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `page` | int | 1 | 页码 |
| `pageSize` | int | 20 | 每页条数（≤100） |
| `visibility` | `public\|private\|all` | `all` | `all` = 公开 + 自己的私密 |
| `status` | `published\|archived\|hidden` | `published` | 记录状态 |
| `keyword` | string | — | 全文检索词 |
| `tags` | string | — | 逗号分隔，需全部命中 |
| `from` / `to` | ISO date | — | 时间范围 |
| `hasLocation` | bool | — | 仅带位置的 |
| `sort` | `latest\|oldest\|popular\|liked` | `latest` | 排序 |
| `authorId` | string | — | 限定作者 |
| `liked` / `favorited` | bool | — | 仅当前用户点赞/收藏的 |
| `minLat` `minLng` `maxLat` `maxLng` | number | — | 地理范围过滤 |

```jsonc
// 响应
{ "ok": true, "data": {
  "items": [ /* Post[] */ ],
  "total": 42, "page": 1, "pageSize": 20, "hasMore": true
}}
```

### POST /posts

```jsonc
{
  "content": "正文，支持 Markdown 与 ::mdc 组件",
  "visibility": "public",              // 可选，默认 public
  "tags": ["旅行"],                     // 可选；不传则从正文自动提取 #标签
  "location": { "lat": 30.2469, "lng": 120.1461, "label": "杭州西湖" },
  "attachments": [{ "id": "...", "url": "/uploads/x.png", "filename": "x.png",
                    "mime": "image/png", "size": 1024, "kind": "image" }]
}
```

服务端自动完成：
- 提取纯文本 `plainText`（用于检索与摘要）
- 从正文抽取 `#标签`（最多 12 个）
- 解析 MDC 组件 → `mdcOptions`（正文显式 props 优先，缺失项由 `shared/mdc.ts` 的 `MDC_DEFAULTS` 补齐）
- 生成检索 token `searchTokens`
- 记录发布设备 `device`（浏览器/系统/设备类型，来自 UA）

### POST /posts/by-token

**开放发布** —— 用 API Token 发布说说，无需登录会话。请求体与 `POST /posts` 完全一致。

```bash
curl -X POST https://example.com/api/posts/by-token \
  -H "X-API-Token: mx_ab12cd34ef56..." \
  -H "content-type: application/json" \
  -d '{"content":"从脚本发布的一条说说 #自动化"}'
```

- 作者为令牌归属的用户
- 令牌需启用、未过期、未被吊销，否则返回 401
- 发布成功后会触发「新建说说」通知（见 `/notice`）

### MDC 组件语法

正文支持 MDC（Markdown Components）语法，支持块级与行内两种形式：

```markdown
::alert{type="warning" title="注意"}
这里是组件内容
::

行内形式：前面 ::badge{text="新"} 后面
```

**可用组件**：`alert` `callout` `badge` `card` `quote-card` `todo` `collapse` `divider` `media` `timeline-item` `poll`

**选项注入规则**：

| 来源 | 优先级 | 示例 |
|---|---|---|
| 正文显式声明 | 高 | `::alert{type="warning"}` → `type=warning` |
| 配置表默认值 | 低（补齐缺失项） | `MDC_DEFAULTS.alert.closable=true` → `closable=true` |

合并结果写入 `post.mdcOptions`，例如：

```jsonc
{ "name": "alert", "props": { "type": "warning", "title": "注意", "closable": true } }
```

### GET /posts/:id

私密说说非作者访问返回 **403**。

### PATCH /posts/:id

仅作者可改。正文变更时自动重算 `plainText`、`mdcOptions`、`tags`、`searchTokens`。

### DELETE /posts/:id

仅作者可删。

### POST /posts/:id/archive · /posts/:id/unarchive

封存 / 恢复。封存后不出现在默认时间线，`status=archived` 可查。

### PATCH /posts/:id/status

**状态流转** —— 在三种状态间直接切换：

| 状态 | 含义 |
|---|---|
| `published` | 正常发布（默认） |
| `archived` | 封存，从默认列表移出 |
| `hidden` | 隐藏，仅作者可见（等同自用草稿箱） |

```jsonc
{ "status": "hidden" }
```

`hidden` 不进默认列表，但 `GET /posts?status=hidden` 可检索。进入 `archived` 自动写 `archivedAt`，离开时清空。

### POST /posts/:id/like · /posts/:id/favorite

幂等切换（再次调用取消）。

```jsonc
{ "ok": true, "data": { "liked": true, "count": 12 } }
```

### GET /posts/:id/likes

返回点赞该说说的用户列表。

---

## 分享

### POST /posts/:id/share

```jsonc
// 可选请求体
{ "expiresInDays": 7 }   // 不传或 <=0 表示永久有效
// 响应 201
{ "ok": true, "data": { "share": {
  "id": "...", "postId": "...", "token": "abc123...",
  "creatorId": "...", "expiresAt": "2026-11-13T...", "createdAt": "..."
}}}
```

前端拼装落地页：`{origin}/share/{token}`

### GET /share/:token

**无需鉴权。** 返回分享的说说；token 无效或过期返回 404。

### GET /posts/:id/shares · GET /share

前者按说说查分享记录，后者查当前用户的全部分享。

### DELETE /posts/:id/shares/:shareId

撤销分享（仅创建者）。

---

## 标签 / 日历 / 地图

### GET /posts/tags/list

```jsonc
{ "tags": [{ "name": "旅行", "count": 12, "lastUsedAt": "2026-11-05T..." }] }
```

标签名统一小写存储（`#开放API` → `开放api`）。

### POST /posts/tags/rename

**标签改名 / 合并** —— 把作者所有说说里的 `from` 替换成 `to`；`to` 已存在时自动去重，不产生重复标签。

```jsonc
{ "from": "前端", "to": "开发" }
```

```jsonc
{ "renamed": 5, "tags": [ /* 改名后的标签列表 */ ] }
```

### DELETE /posts/tags/:name

**删除标签** —— 从作者所有说说中摘除该标签，说说本身不受影响。

```jsonc
{ "removed": 3, "tags": [ /* 剩余标签 */ ] }
```

### GET /posts/calendar/buckets?year=2026&month=11

```jsonc
{ "cells": [{ "date": "2026-11-05", "count": 3 }] }
```

### GET /posts/map/points

支持 `visibility`、`tags` 与 `minLat/minLng/maxLat/maxLng`。

```jsonc
{ "points": [{ "id": "...", "lat": 30.2469, "lng": 120.1461,
               "label": "杭州西湖", "title": "...", "excerpt": "...",
               "tags": ["旅行"], "createdAt": "..." }] }
```

---

## API 令牌

第三方（小程序 / CLI / 自动化脚本）长期访问开放接口的凭据。
与 JWT 会话解耦：JWT 短时绑定登录态，Token 可长期使用、可单独吊销。

### GET /tokens

```jsonc
{ "tokens": [{ "id": "...", "name": "我的脚本",
               "token": "mx_ab12cd34••••••••",   // 掩码，仅用于识别
               "prefix": "mx_ab12cd34",
               "enabled": true, "scopes": ["posts:write"],
               "lastUsedAt": null, "expiresAt": null, "createdAt": "..." }],
  "total": 1 }
```

列表一律返回掩码，**不含完整明文**。

### POST /tokens

```jsonc
{ "name": "我的脚本", "scopes": ["posts:write"], "expiresAt": null }
```

```jsonc
{ "ok": true, "data": { "id": "...", "name": "我的脚本",
  "token": "mx_ab12cd34ef56...",        // ★ 完整明文，仅此一次返回
  "prefix": "mx_ab12cd34",
  "warning": "请立即保存，此明文不会再次显示" } }
```

明文只存哈希（sha256），之后无法取回；`prefix` 保留明文前 11 位供列表识别。单用户最多 20 个令牌。

### PATCH /tokens/:id

可改 `name`、`enabled`、`scopes`、`expiresAt`。停用后立即拒绝所有请求。

### DELETE /tokens/:id

吊销令牌，立即失效。

---

## 通知

**第三方推送通知** —— 新建说说时推送到 11 种渠道，形态与 kkapi-open 的 `noticeType` 对齐。

支持渠道：`telegram` `wecom`（企业微信） `dingtalk`（钉钉） `bark`（iOS） `pushplus` `pushdeer` `serverchan`（Server酱） `igot` `qmsg` `gocqhttp` `webhook`（通用 Webhook）

### GET /notice/types

静态元数据，无需鉴权：

```jsonc
{ "types": ["telegram", "wecom", "dingtalk", "bark", "pushplus",
            "pushdeer", "serverchan", "igot", "qmsg", "gocqhttp", "webhook"] }
```

### GET /notice

```jsonc
{ "notices": [{ "id": "...", "type": "telegram", "token": "****c34f",
                "title": "我的说说", "enabled": true, "onPostCreate": true,
                "lastSentAt": null, "createdAt": "..." }], "total": 1 }
```

`token` 一律脱敏返回（只露末 4 位）。

### POST /notice

```jsonc
{ "type": "telegram", "token": "123456:ABC-DEF/987654321",
  "title": "我的说说", "enabled": true, "onPostCreate": true }
```

`token` 形态按渠道而定：

| 渠道 | token 形态 |
|---|---|
| `telegram` | `<botToken>/<chatId>` |
| `wecom` / `dingtalk` | Webhook 地址或 access token |
| `bark` | 设备 key |
| `pushplus` / `pushdeer` / `qmsg` | 对应平台 token |
| `serverchan` | SendKey |
| `gocqhttp` | go-cqhttp 的 HTTP 地址 |
| `webhook` | 任意接收 URL（POST JSON） |

### PATCH /notice/:id · DELETE /notice/:id

### POST /notice/:id/test

立即推一条测试消息，返回渠道的真实响应状态，便于配置后校验：

```jsonc
{ "sent": false, "status": null, "error": "HTTP 404" }
```

失败不抛异常（推送是尽力而为）。

### POST /notice/test-all

批量测试所有已启用渠道。

---

## 视图

### GET /views

首次访问自动初始化 5 个内置视图：全部说说 / 私密 / 公开 / 带位置 / 归档。

### POST /views

```jsonc
{ "name": "旅行足迹", "icon": "📍", "description": "带位置的旅行说说",
  "filters": { "visibility": "all", "status": "published",
               "hasLocation": true, "sort": "latest" } }
```

### PATCH /views/:id · DELETE /views/:id

仅所有者可操作。

### GET /views/:id/posts?page=1&pageSize=20

按视图条件取说说，返回 `{ view, items, total, page, pageSize, hasMore }`。

---

## 草稿

### PUT /drafts

```jsonc
{ "key": "new-post", "content": "未完成的内容", "tags": [], "attachments": [] }
```

按 `ownerId + key` 幂等 upsert。

### GET /drafts · GET /drafts/:key · DELETE /drafts/:key

---

## 媒体

### POST /media

`multipart/form-data`，字段名 `file`。支持 image/*、video/*、audio/*、application/pdf。

```jsonc
{ "media": { "id": "...", "url": "/uploads/xxx.png", "filename": "a.png",
             "mime": "image/png", "size": 10240, "kind": "image",
             "createdAt": "..." } }
```

### GET /media · DELETE /media/:id

---

## 统计与设备

### GET /stats

```jsonc
{ "stats": {
  "total": 42, "published": 38, "archived": 4, "privateCount": 6,
  "withLocation": 12, "totalLikes": 88, "totalFavorites": 21,
  "totalShares": 5, "tagCount": 30, "mediaCount": 14 } }
```

### GET /stats/device

```jsonc
{ "device": { "browser": "Chrome", "browserVersion": "120.0.0.0",
              "os": "Windows", "osVersion": "10",
              "deviceType": "desktop", "deviceVendor": "", "ua": "..." } }
```

---

## 健康检查与版本

### GET /health

```jsonc
{ "ok": true, "data": { "status": "healthy", "time": "2026-11-05T..." } }
```

### GET /version

**能力自描述** —— 供开放 API 消费方做兼容判断，无需鉴权：

```jsonc
{ "ok": true, "data": {
    "name": "MXMosApi",
    "version": "1.1.0",
    "apiVersion": "v1",
    "capabilities": {
      "jwt": true, "apiToken": true,
      "posts": true, "postStatus": true, "tagManagement": true,
      "views": true, "calendar": true, "map": true, "search": true,
      "openPublish": true, "notice": true, "media": true, "share": true
    } } }
```
