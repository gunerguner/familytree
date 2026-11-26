# AGENTS 约定（familytree 仓库）

本文件面向在本仓库工作的 AI 编码助手，与 `.agents/skills/familytree/`、`.agents/skills/code-style/` 一起生效。
架构与接口见 [`.agents/skills/familytree/SKILL.md`](./skills/familytree/SKILL.md)，字段级契约见 [reference.md](./skills/familytree/references/reference.md)。

## 完成标准

- 改动 `server/src/**` 或 `server/test/**` 后，必须在 `server/` 执行 `npm test`，失败则修到全绿再收工。
- 改动 `web/src/**` 或 `web/test/**` 后，必须在 `web/` 执行 `npm test`。动了页面、路由、表单或画布时，再执行 `npm run build`（含 `vue-tsc`）。
- 前后端都改动、或动了 API 契约（字段、错误正文、角色枚举、性别）时，两边测试都要跑。
- 纯文档、注释、`.agents/` 改动可跳过。
- 新增功能必须随代码补测试；修 bug 先补能复现的回归用例。

## 改动范围 → 命令

| 改动 | 命令 |
|------|------|
| `server/src/**`、`server/test/**` | `cd server && npm test` |
| `web/src/**`、`web/test/**` | `cd web && npm test` |
| 页面 / 路由 / 表单 / 画布 | 再加 `cd web && npm run build` |
| 前后端都动 / API 契约 | 两边都跑 |
| 提交前 | 两边都跑 |

## 测试位置（硬性约束）

- 后端测试只允许放 `server/test/`。`age.spec.ts` 走 Jest；`app.spec.ts` 由 `tsconfig.spec.json` 编译后用 `node --test`。禁止把 `*.spec.ts` 写进 `server/src/`。
- 前端测试只允许放 `web/test/`。禁止把 `*.test.ts` 或 `__tests__/` 写进 `web/src/`。
