---
name: familytree
description: 族谱 Web 应用的开发约定。用于在本仓库改 NestJS 人物/关系/会话、Vue3+Naive UI 族谱页、自写布局经 Vue Flow 渲染，或 Docker 单容器部署时，保持数据契约与画树规则一致。
---

# Familytree

本技能用于在 familytree 仓库内做开发：保持人物、亲子、婚姻三张事实表和会话的约定，前端一次取全树、在浏览器里排多棵根，以及单容器同时提供页面和 `/api`。

需求以 `docs/需求描述.md` 为准。实现与 `docs/技术设计*.md` 不一致时，以当前代码为准（已有 `sex`、画布用 Vue Flow）。不提供 `/api/health`，部署自检只看首页。

## Quick Reference

* 错误正文：`{ error, fields? }`，靠 HTTP 状态区分；没有 `{ code, message, data }` 信封。字段级见 [reference.md](references/reference.md)。
* 变更请求：`POST` / `PATCH` / `DELETE` 必须带 `X-Familytree: 1`，否则 403。登录、退出也要带。
* 会话：Cookie `familytree_session`，库里只存令牌散列；密码是 `crypto.scrypt`。有效期 14 天，不顺延。同一账号再次登录删掉旧会话。
* 年龄：只在 `server/src/people/age.ts` 的 `deriveAge` 里从原文推算。前端不解析 `birthText` / `deathText`。算不出则 `age` 为 `null`，页面不留「年龄不详」。
* 谁是根：没有父母，并且不会被画成配偶侧卡的人。多棵根按 id 从左到右、顶部对齐。配偶不因为没有父母再占一棵根。
* 种子：`persons` 为空才灌 `server/seed/family.json`。已有人物时不覆盖。账号不在种子里，空库用 `BOOTSTRAP_USERNAME` / `BOOTSTRAP_PASSWORD`。
* 部署：一个容器同时托管静态页和 `/api`。宿主机默认 `8084` → 容器 `8080`。改前端或后端都要重建镜像。

## 技术栈

- 后端：NestJS 12（Express）+ TypeORM + better-sqlite3。密码 `crypto.scrypt`。会话自管，不用 JWT。
- 前端：Vue 3.5 + Vite 7 + TypeScript + Vue Router 4 + Pinia + Naive UI。树的坐标在 `web/src/lib/layout.ts`，用 `@xyflow/vue` 渲染，节点不可拖、不可连。
- 部署：多阶段 Docker，一个 `familytree` 服务。SQLite 在卷 `/data/familytree.db`。

## 项目结构

```text
.
├── docs/                         # 需求与技术设计（代码冲突时以代码为准）
├── images/                       # 原始照片，只给人看，不进镜像、不在页面展示
├── server/
│   ├── src/
│   │   ├── main.ts               # 前缀 /api、校验管道、异常过滤器、listen
│   │   ├── app.module.ts         # 有 STATIC_DIR 才挂静态文件
│   │   ├── startup.service.ts    # 迁移 → 引导账号 → 空库种子
│   │   ├── config.ts             # 读 .env；SESSION_SECRET 不足 32 拒绝启动
│   │   ├── api-exception.filter.ts
│   │   ├── auth/                 # 账号、Cookie 会话、守卫、密码、令牌
│   │   ├── people/               # 人物、亲子、婚姻、年龄、整树读写
│   │   ├── database/             # DataSource、迁移、上海时间
│   │   └── seed/seed.service.ts
│   ├── seed/family.json
│   ├── test/                     # age.spec.ts（Jest）、app.spec.ts（node:test）
│   └── reset-password.ts
└── web/
    └── src/
        ├── api/client.ts         # fetch + Cookie + X-Familytree
        ├── api/types.ts
        ├── stores/session.ts
        ├── stores/tree.ts        # 全树、详情、折叠集合
        ├── lib/layout.ts         # 根、坐标、折线（纯函数）
        ├── lib/flow.ts           # 布局结果 → Vue Flow 节点/边
        ├── views/login-view.vue
        ├── views/tree-view.vue
        └── components/           # 画布、卡片、折叠钮、连线、详情、表单
```

## 分层约定

| 层 | 职责 | 约定 |
|----|------|------|
| `people.controller` | HTTP 薄层 | 不写校验细节；`ParseIntPipe` 管 id |
| `people.service` | 人物与关系的事务 | 空字符串写入前改成 `null`；亲子成环抛 409；整体替换「此人作为子女的链接」和「此人参与的婚姻」 |
| `age.ts` | 从生卒原文推算年份与岁数 | 唯一实现。不入库 |
| `auth` | 登录、会话、限流 | 守卫先查变更请求头，再查会话。`@Public()` 只跳过登录，不跳过 `X-Familytree` |
| `database/` | 连接与迁移 | 启动时 `runMigrations()`。新列追加新的 `MigrationInterface`，不改已经发出的 `Init` |
| `web/src/lib/layout.ts` | 排版 | 不发请求。输入是树的三份数组加折叠集合 |
| `web/src/api/client.ts` | HTTP | 成功直接返回 JSON；204 返回空。401（登录接口自身除外）清会话并去登录页 |

## 领域规则

- 人物必填 `name`（trim 后非空）和 `sex`（`male` / `female`）。称谓、原名、小名、出生原文、卒于原文、记述可空。
- 称谓是资料原文，不能代替亲子关系。
- 亲子角色只有：`father`、`stepfather`、`mother`、`stepmother`、`adoptive_mother`、`adoptive_father`。同一对人物一条链接。
- 同一子女的全部亲子链接写入同一个 `sort_order`，优先取生父那条，其次继父、养父、母亲、继母、养母。
- 婚姻两端无序：生成列 `lo`/`hi` 保证同一对人不重复。`label` 是身份原文，两边详情显示同一句。`sort_order` 小的侧卡在左。
- 删除人物：同一事务去掉他的亲子和婚姻，再删本人。子女保留。子女若不再有父母，下次画图成为新的根。根也可以删。
- 折叠只在浏览器，键 `familytree.collapsed`。不按分支另请求。

## 修改导航

| 目标 | 改动位置 |
|------|----------|
| 新 API | `people.controller` 或 `session.controller` → service → `web/src/api/types.ts` + `client` 调用方 |
| 人物字段 | `person.entity` → 新迁移 → `person.dto` → `people.service` 的 `fields`/`view` → `web/src/api/types.ts` → 表单与详情 |
| 亲子角色 | `PARENT_ROLES` → 迁移 CHECK → DTO `@IsIn` → `ROLE_LABELS` → 表单选项 |
| 年龄规则 | 只改 `server/src/people/age.ts`，并补 `server/test/age.spec.ts`。前端只消费 `age` / `birthYear` / `deceased` |
| 谁是根、卡片坐标、连线 | `web/src/lib/layout.ts`，用 `web/test/layout.test.ts` 锁行为。不要改成可拖拽的组织架构图 |
| Vue Flow 节点/边 | `web/src/lib/flow.ts`、`family-unit.vue`、`family-edge.vue`、`fold-node.vue` |
| 登录 / Cookie / 限流 | `server/src/auth/`。前端 `stores/session.ts` |
| 种子 | `server/seed/family.json`。只补照片里能辨认的人，不编造「……」和读不清的字 |
| 表结构 | `server/src/database/` 追加迁移，并登记进 `data-source.ts` 的 `migrations` |
| 部署 | `docker/`。页面打进同一镜像，改前端也要重建 |

## 快速决策树

- **症状：变更接口 403「缺少请求头」**
  - 先看：是否 `POST`/`PATCH`/`DELETE` 且带了 `X-Familytree: 1`（`web/src/api/client.ts` 已统一加）
- **症状：401「请先登录」或刷新掉登录**
  - 先看：Cookie `familytree_session`；HTTPS 域名要把 `COOKIE_SECURE=true`
  - 再看：会话是否过期（14 天，不续期）；`SESSION_SECRET` 变更会使旧 Cookie 的 HMAC 失效
- **症状：保存后树的位置不对**
  - 先看：`parent_links` 是否写在子女身上（改的是「此人的父母」，不是「此人作为别人父母」的链接）
  - 再看：`rootIds`：没父母的配偶会被画成侧卡，不会单独成根
- **症状：409「这样会把祖先收成自己的后代」**
  - 亲子沿父母向上成环。婚姻不参与成环判断。事务会回滚
- **症状：年龄没显示**
  - 原文读不出 1800–2099 的四位公历年，或已卒但卒于读不出年份。农历月日不换算。不要在前端再算一遍
- **症状：改了页面线上没变**
  - 重新 `docker compose build` 再 `up -d`。静态文件在镜像的 `/app/static`
- **症状：进程拒绝启动**
  - `SESSION_SECRET` 少于 32 字符；生产缺 `DATABASE_PATH`；空库缺引导用户名或密码（用户名 1–32）

## API 一览

基础路径 `/api`。除标注公开的接口外都要有效会话。

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| POST | `/api/session` | 204 / 401 / 429 | 公开。登录。10 分钟同 IP 失败 8 次后 429 |
| GET | `/api/session` | 200 / 401 | `{ username }` |
| DELETE | `/api/session` | 204 | 公开。退出。没有会话也是 204 |
| GET | `/api/tree` | 200 | 全部人物、亲子、婚姻 |
| GET | `/api/persons/:id` | 200 / 404 | 详情含父母、配偶、子女 |
| POST | `/api/persons` | 201 | 整体写入字段和关系 |
| PATCH | `/api/persons/:id` | 200 | 整体替换字段和此人的关系 |
| DELETE | `/api/persons/:id` | 204 | 删关系和本人，保留子女 |

字段、错误码和年龄规则见 [reference.md](references/reference.md)。

## 数据库表

| 表 | 主键 | 说明 |
|----|------|------|
| `persons` | `id` | 姓名、性别、称谓、原名、小名、生卒原文、记述 |
| `parent_links` | `id`，唯一 `(child_id, parent_id)` | 父母—子女—角色 |
| `marriages` | `id`，唯一 `(lo, hi)` | 一段婚姻。`lo`/`hi` 为两端 id 的较小/较大值 |
| `accounts` | `id`，`username` 唯一 | `password_hash` |
| `sessions` | `id`，`token_hash` 唯一 | 过期时间；账号删除时级联 |

## 开发常见操作

```bash
# 后端（默认 :3000）。需要 SESSION_SECRET（≥32）和空库时的引导账号
cd server && npm run start:dev

# 前端。Vite 把 /api 代理到 PORT（默认 3000）
cd web && npm run dev

# 测试
cd server && npm test
cd web && npm test
cd web && npm run build
```

本地页面由 Vite 提供，不要设 `STATIC_DIR`。生产镜像才把 `web/dist` 放到 `/app/static`。

## 提交前自检清单

- 新增或修改了人物字段：实体、迁移、DTO、`view`、前端 `types`、详情和表单是否一起改
- 改了亲子或婚姻语义：`replaceRelations` 的事务、成环检查、`layout.ts` 的根与侧卡是否仍一致
- 改了年龄：只动 `age.ts`，前端没有第二套解析
- 改了错误正文：`ApiExceptionFilter` 仍是 `{ error, fields? }`，页面读的是这两个字段
- 改了种子：`persons` 非空的库不会重灌；不要为了「画全」编造人名
- 改了前端或接口：按 [AGENTS.md](../../AGENTS.md) 跑过对应测试

## 深度参考

| 场景 | 文档 |
|------|------|
| 接口字段、年龄、会话、布局、迁移、部署 | [reference.md](references/reference.md) |
| 代码怎么写 | [code-style](../code-style/SKILL.md) |
