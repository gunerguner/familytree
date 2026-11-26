# Familytree 详细参考

SKILL.md 的扩展材料。改接口、年龄、画树、会话或部署时按需阅读。

## 关键文件索引

| 用途 | 路径 |
|------|------|
| 进程入口 | `server/src/main.ts` |
| 启动顺序 | `server/src/startup.service.ts`（迁移 → 引导账号 → 种子） |
| 环境变量 | `server/src/config.ts`、`docker/.env.example` |
| 错误正文 | `server/src/api-exception.filter.ts` |
| 会话守卫 | `server/src/auth/session.guard.ts` |
| 登录限流与 Cookie | `server/src/auth/auth.service.ts` |
| 密码 / 令牌 | `server/src/auth/password.ts`、`server/src/auth/token.ts` |
| 人物读写 | `server/src/people/people.service.ts`、`people.controller.ts`、`person.dto.ts` |
| 年龄 | `server/src/people/age.ts` |
| 表与迁移 | `server/src/database/data-source.ts`、`init.migration.ts`、`sex.migration.ts`、`sex-brother-in-law.migration.ts` |
| 上海时间 | `server/src/database/time.ts` |
| 种子 | `server/src/seed/seed.service.ts`、`server/seed/family.json` |
| 重置密码 | `server/src/reset-password.ts` |
| 前端请求 | `web/src/api/client.ts`、`web/src/api/types.ts` |
| 树状态 | `web/src/stores/tree.ts`、`web/src/stores/session.ts` |
| 布局 / Vue Flow | `web/src/lib/layout.ts`、`web/src/lib/flow.ts` |
| 页面 | `web/src/views/login-view.vue`、`web/src/views/tree-view.vue` |
| 主题 | `web/src/theme.ts`、`web/src/styles/main.css` |
| Docker | `docker/Dockerfile`、`docker/docker-compose.yml`、`docker/entrypoint.sh` |

---

## API 契约（字段级）

成功时直接返回业务 JSON，没有外层信封。失败：

```json
{ "error": "给页面看的一句中文", "fields": { "name": "姓名不能为空" } }
```

没有字段错误时不带 `fields`。校验管道认不出的正文统一成 `{ "error": "提交的内容无法识别" }`（400）。未捕获异常是 500 `{ "error": "服务暂时不可用" }`。

| 状态 | 何时 |
|------|------|
| 400 | JSON 不合法，或角色、性别不在枚举里 |
| 401 | 未登录，或登录失败「账号或密码不正确」 |
| 403 | 变更请求缺少 `X-Familytree: 1`，「缺少请求头」 |
| 404 | 「找不到这个人」 |
| 409 | 亲子成环，「这样会把祖先收成自己的后代」 |
| 422 | 姓名为空、引用的人不存在、指向自己、父母或婚姻重复 |
| 429 | 登录过于频繁，「稍后再试」 |

### POST `/api/session`

公开，仍要 `X-Familytree: 1`。

```json
{ "username": "zhang", "password": "……" }
```

成功 204，`Set-Cookie`。失败不区分用户名还是密码。

Cookie 名 `familytree_session`。值是 `base64url(32 字节随机数) + "." + hex(hmac)`。HMAC 密钥是 `SESSION_SECRET`。库里的 `token_hash` 只覆盖随机数那段。`HttpOnly`、`SameSite=Lax`、`Path=/`。`COOKIE_SECURE=true` 时加 `Secure`。有效期与会话行同为 14 天，从登录时算起，中途不顺延。

同一 IP 10 分钟内失败 8 次之后 429。成功登录清掉该 IP 的计数。只当直接连接来自回环或 `TRUSTED_PROXY` 时，才用 `X-Forwarded-For` 最左侧一段。

同一账号再次登录会先删掉该账号的全部会话。

### GET `/api/session`

有效则 `{ "username": "zhang" }`，否则 401 `{ "error": "请先登录" }`。

### DELETE `/api/session`

公开。删掉当前会话行并清 Cookie。没有会话也返回 204。

### GET `/api/tree`

一次返回全部人物和关系，不分页，也不标哪一棵是主根。

```jsonc
{
  "persons": [ /* Person */ ],
  "parents": [
    { "childId": 2, "parentId": 1, "role": "father", "sortOrder": 0 }
  ],
  "marriages": [
    { "id": 10, "aId": 1, "bId": 3, "label": "妻子", "sortOrder": 0 }
  ]
}
```

`Person`：

```jsonc
{
  "id": 1,
  "name": "张尔寿",
  "sex": "male",
  "kinship": "曾祖父",
  "formerName": null,
  "nickname": null,
  "birthText": "十一月初八",
  "deathText": "四月十二",
  "narrative": null,
  "birthYear": null,
  "deceased": true,
  "age": null
}
```

`sex` 只有 `male` | `female`。`birthYear`、`deceased`、`age` 不入库，读出时由 `deriveAge` 填上。三个键始终出现，空值写 `null`（`deceased` 是布尔）。

### GET `/api/persons/:id`

在 `Person` 上再加：

```jsonc
{
  "parents": [{ "id": 1, "name": "张尔寿", "role": "father", "sortOrder": 0 }],
  "marriages": [{ "personId": 4, "name": "范氏", "label": "妻子", "sortOrder": 0 }],
  "children": [{ "id": 5, "name": "张伯森", "role": "father", "sortOrder": 0 }]
}
```

`parents[].role` 是对方在链接上的角色。`children[].role` 是当前这个人在该链接上的角色。父母、子女按 `sortOrder`、再按 id 排序。配偶按婚姻的 `sort_order`、再按婚姻 id。

### POST `/api/persons`、PATCH `/api/persons/:id`

正文是整体替换：字段、他作为子女的亲子链接、他参与的婚姻。返回详情。POST 为 201，PATCH 为 200。

```jsonc
{
  "name": "张坚如",
  "sex": "male",
  "kinship": "父",
  "formerName": "张坚",
  "nickname": null,
  "birthText": "1900.2.18",
  "deathText": "1963.4.7",
  "narrative": "经历原文\n\n备注原文",
  "parents": [{ "personId": 2, "role": "father", "sortOrder": 0 }],
  "marriages": [
    { "personId": 8, "label": "妻子", "sortOrder": 0 },
    { "personId": 9, "label": "继母", "sortOrder": 1 }
  ]
}
```

校验：

- `name` trim 后不能空（422，`fields.name`）。
- `sex` 必须是 `male` 或 `female`。
- 父母、配偶的 `personId` 必须已存在，且不能是本人。
- 父母列表、婚姻列表里同一个 `personId` 只能出现一次。两端对调的婚姻视为同一段。
- 替换之后沿父母向上不能回到自己，否则 409。事务回滚，库内链接与提交前一致。
- 他作为别人父母的 `parent_links` 不动。父母可以是空数组：若他也不会被画成侧卡，就会成为新的根。

空字符串在写入前改成 `NULL`。同一子女的每条亲子链接使用同一个 `sort_order`（见 SKILL 的优先级）。

### DELETE `/api/persons/:id`

204。一个事务里删掉 `child_id` 或 `parent_id` 等于他的亲子、`a_id` 或 `b_id` 等于他的婚姻，再删人物。不删子女。

---

## 年龄

唯一实现：`deriveAge(birthText, deathText, today)`。`today` 是 `Asia/Shanghai` 的日历日。

| 字段 | 含义 |
|------|------|
| `birthYear` | 原文里第一个独立四位年，范围 1800–2099；否则 `null` |
| `deceased` | 卒于去掉空白后还有字 |
| `age` | 下面的规则得到的整数岁；否则 `null`。0 要返回 |

怎样才认月日：整段原文不含农历特征（`正月`、`腊月`、`冬月`、`闰月`、`初`、`廿`、`卅`，以及地支加「时」）时，才解析 `YYYY年M月D日` 或 `YYYY.M.D` / `YYYY-M-D` / `YYYY/M/D`。月日不合法则只留年份。含农历特征时，即使旁边有公历年，也不拿农历月日做生日折算。不做历法换算。一段里有两个四位年时取第一个。

岁数：

- 出生读不出年份，或已卒但卒于读不出年份：`age` 为 `null`。`deceased` 仍看原文有没有字。
- 两边参与计算的月日都齐全：`结束年 − 出生年`，结束月日早于出生月日再减 1。已卒的结束日来自卒于；在世的结束日是今天。
- 其余能读出所需年份的情况：只做年份差。
- 结果小于 0 时 `age` 为 `null`。

代表值（今天 2026-11-25）在 `server/test/age.spec.ts`：`1900.2.18`–`1963.4.7` 为 63 岁；`1945 年` 在世为 81；`正月十九` 没有年龄。

---

## 谁是根、怎么排

`rootIds` / `layout`（`web/src/lib/layout.ts`）：

- 有父母的人不是根。
- 没有父母时看婚姻：配偶有父母，或夫妻都没有父母但对方后代更多（相同则 id 更小的当根），则自己是侧卡。
- 其余没有父母的人是根。根按 id 升序从左到右，顶部对齐，间隔 80px。
- 配偶没有自己的主卡片时，画在主卡右侧，按婚姻 `sortOrder` 再按 id。已经会在别处当主卡的配偶不再画侧卡。
- 子女按该父母名下的 `sortOrder`、再按 `childId`，并按「另一个父母」分组，组的顺序跟随配偶。没有另一个父母的子女在最后一组。
- 折叠只藏这个人的后代。其他根不动。折叠钮是独立节点，id 为 `fold:<personId>`。

卡片尺寸在布局里是常数：宽 112、高 48。代距 56，卡片间距 12，配偶组间距 28，外圈 48。连线分 `blood` 与 `marriage`。

`toFlow` 把坐标交给 Vue Flow。节点 `draggable`、`connectable`、`selectable` 都是 false。缩放 0.4–1.8。Vue Flow 对单向 `nodes` 绑定只在数组长度变化时重读，所以 `tree-canvas.vue` 在布局变化后调用 `setNodes` / `setEdges`。

路由：`/` 族谱，`/login` 登录。打开某人用 `/?person=<id>`，新建用 `/?create=1`（两者同时存在时以新建为准）。id 不是正整数则忽略。

详情在桌面是右侧卡片，宽度小于 768px 时改为底部抽屉。空字段留标签、右边空白，不写「未知」。`age === null` 时不出现年龄行。卡片第二行只在有 `birthYear`、「已卒」或数字年龄时出现。

保存成功后用返回的详情更新面板，再 `loadTree()`。删除成功后关掉面板并重新取树。

---

## 迁移与种子

`createDataSource` 的 `migrations` 顺序：`InitMigration` → `SexMigration` → `SexBrotherInLawMigration`。启动时 `runMigrations()`。新结构只追加新类并登记到这个数组，不改已经发布的 `up`。

连接打开后执行 `foreign_keys=ON`、`journal_mode=WAL`、`busy_timeout=5000`。时间列是上海时区的 RFC3339 文本。

`sex` 不在最初的 `Init` 里。`SexMigration` 加列（默认 `male`）并用称谓、姓名、亲子角色回填；`SexBrotherInLawMigration` 把姐夫、妹夫、丈夫改回 `male`。新人物必须显式提交 `sex`。

种子文件的人物用 `key` 互相引用，`key` 不入库。`persons` 行数大于 0 则整段跳过。失败则进程退出。账号不在 JSON 里。

`reset-password.ts` 读 `RESET_USERNAME`、`RESET_PASSWORD`。账号不存在则非 0 退出；存在则更新散列并删掉该账号的全部会话。

---

## 配置

| 变量 | 说明 |
|------|------|
| `DATABASE_PATH` | 生产必填，`/data/familytree.db`。开发默认 `server/data/dev.sqlite`（生产缺了就退出） |
| `SESSION_SECRET` | 至少 32 字符，否则拒绝启动 |
| `BOOTSTRAP_USERNAME` / `BOOTSTRAP_PASSWORD` | 仅 `accounts` 为空时创建第一个账号。用户名 1–32。缺了就退出 |
| `COOKIE_SECURE` | 默认 false。HTTPS 反代后设 `true` |
| `TRUSTED_PROXY` | 逗号分隔。默认只信任回环 |
| `STATIC_DIR` | 生产 `/app/static`。开发不设 |
| `PORT` | 开发 3000，容器 8080 |
| `NODE_ENV` | 生产 `production` |
| `TZ` | 镜像设为 `Asia/Shanghai` |

---

## 部署

`docker/docker-compose.yml` 只有服务 `familytree`。构建上下文是仓库根。容器只读根文件系统，可写的是 `/data` 卷和 `/tmp`。入口以 root 把 `/data` 交给 uid `10001` 后降权跑 Node。

| 项 | 值 |
|----|----|
| 宿主机端口 | 8084 → 容器 8080 |
| `COMPOSE_PROJECT_NAME` | `familytree`（同机其他栈不要改成目录名 `docker`） |
| 库文件 | `${SQLITE_HOST_DIR:-./sqlitefile}` → `/data` |
| 对外域名 | `familytree.zhangzhicheng.info`，由 tencentDocker 边缘 Nginx 反代 |

改页面或接口后都要重建镜像再 `up -d`。未登录时 `GET /api/session` 应是 401。

npm、better-sqlite3 预编译包、Node 头文件、Docker 基础镜像和 Debian 源的国内地址写在仓库根 `.npmrc` 和 `docker/Dockerfile`。不要改回已停用的 `registry.npm.taobao.org`。字体只用系统里已有的，不请求外部字体。

---

## 测试

| 端 | 位置 | 命令 |
|----|------|------|
| 后端年龄 | `server/test/age.spec.ts`（Jest） | `cd server && npm test` |
| 后端 HTTP | `server/test/app.spec.ts`（编译后 `node --test`） | 同上。临时 SQLite，不碰开发库 |
| 前端布局与 flow | `web/test/*.test.ts`（Vitest） | `cd web && npm test` |

`app.spec.ts` 在 import 应用之前设置 `DATABASE_PATH`、`SESSION_SECRET`、引导账号。HTTP 用例要带 `X-Familytree: 1`。契约断言看状态码和 `{ error, fields? }`，不要断言 Astock 那种 `{ code, message, data }`。

新增接口补一条成功和一条失败。改 `rootIds` 或折叠时补 `web/test/layout.test.ts`。修 bug 先写能复现的用例。

## 变更影响面

| 你改了什么 | 还要联动检查 |
|-----------|----------------|
| `person.entity` / DTO | 迁移、`view`、`web/src/api/types.ts`、详情和表单 |
| `PARENT_ROLES` | 迁移 CHECK、`ROLE_LABELS`、表单选项、种子 |
| `deriveAge` | `server/test/age.spec.ts`。前端不要再解析原文 |
| `replaceRelations` | 成环 409 是否回滚；侧卡与根是否仍由「有没有父母」决定 |
| `layout.ts` | `web/test/layout.test.ts`；`flow.ts` 的节点 id（人物 id、`fold:<id>`） |
| Cookie / `SESSION_SECRET` | 已登录浏览器会全部失效 |
| `family.json` | 只影响空库。已有库不会重灌 |
| `docker/Dockerfile` | 前后端都在同一镜像里，都要重建 |
