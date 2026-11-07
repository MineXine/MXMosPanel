# REST API 契约

基础路径：`/api`
鉴权：`Authorization: Bearer <token>`（token 由 `/auth/register` 或 `/auth/login` 返回）

统一响应包装：

```jsonc
// 成功
{ "ok": true, "data": { /* ... */ } }

// 失败
{ "ok": false, "error": { "code": "BAD_REQUEST", "message": "错误描述", "details": {} } }
```

错误码：`BAD_REQUEST` `UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND` `CONFLICT` `VALIDATION_ERROR` `INTERNAL_ERROR`

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
| `status` | `published\|archived` | `published` | 归档状态 |
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

归档/恢复。归档后不出现在默认时间线，`status=archived` 可查。

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

## 健康检查

### GET /health

```jsonc
{ "ok": true, "data": { "status": "healthy", "time": "2026-11-05T..." } }
```
