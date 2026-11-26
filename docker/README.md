# familytree Docker 部署

所有 Compose 与镜像定义集中在 **`docker/`** 目录。在仓库根目录执行 Compose 时，请使用 `-f docker/docker-compose.yml` 与 `--env-file docker/.env`（或先 `cd docker` 再 `--env-file .env`）。

## 运行时架构

本编排只有一个服务 **`familytree`**：同一个 Nest 进程托管静态页面和 `/api`，没有单独的前端 Nginx。

| 组件 | 说明 |
|------|------|
| 应用 | 镜像由 `docker/Dockerfile` 构建。容器内监听 **8080**，页面和接口在同一进程 |
| SQLite | 宿主机目录 `SQLITE_HOST_DIR`（默认 `docker/sqlitefile/`）挂载到容器 `/data`。库文件是 `/data/familytree.db` |

**构建上下文（`build.context`）为仓库根目录**（`docker-compose.yml` 中为 `..`）。仓库根 **`.dockerignore`** 在构建时生效。

## 目录说明

| 文件 | 作用 |
|------|------|
| `docker-compose.yml` | 编排 `familytree` |
| `Dockerfile` | 构建前端与后端，运行镜像只保留生产依赖 |
| `entrypoint.sh` | 创建 `/data` 并交给 `app` 用户后启动 Node |
| `.env.example` | 环境变量模板，复制为 `docker/.env` 后按需修改 |
| `sqlitefile/` | SQLite 持久化目录（挂载至容器 `/data`） |

## 端口与映射

| 服务 | 容器内端口 | 默认宿主机映射 |
|------|------------|----------------|
| familytree | 8080 | **8084** |

## 与其他项目同机部署

各项目各自独立 Compose 栈，通过 **`COMPOSE_PROJECT_NAME`** 与 **宿主机端口** 隔离，**不共享 Docker 网络**。

| 项目 | COMPOSE_PROJECT_NAME | 宿主机端口 |
|------|----------------------|------------|
| stockManager | `stockmanager` | 8080 |
| carSales | `carsales` | 8081 |
| Astock | `astock` | 8082 |
| AdAstra | `adastra` | 8083 |
| **familytree** | **`familytree`** | **8084** |

同机部署时 **勿删** `COMPOSE_PROJECT_NAME=familytree`，否则项目名会落成目录名 `docker`，和其他栈冲突。

对外 HTTPS 由 **tencentDocker** 边缘 Nginx 按子域名分流（familytree 默认 `host.docker.internal:8084` → `familytree.zhangzhicheng.info`）。

## 前置条件

- 已安装 [Docker](https://docs.docker.com/get-docker/) 与 [Docker Compose V2](https://docs.docker.com/compose/)

## 配置

1. 复制环境变量文件：

   ```bash
   cp docker/.env.example docker/.env
   ```

2. 编辑 `docker/.env`，至少修改：

   - **`COMPOSE_PROJECT_NAME`**：默认 `familytree`（同机部署时勿删）
   - **`SESSION_SECRET`**：给 Cookie 做 HMAC 的长随机串
   - **`BOOTSTRAP_USERNAME`** / **`BOOTSTRAP_PASSWORD`**：库里还没有账号时创建第一个账号
   - **`COOKIE_SECURE`**：从 HTTPS 域名访问时设为 `true`

3. SQLite 数据文件默认位于 `docker/sqlitefile/familytree.db`。首次启动会建库并灌入种子。**已有数据的库文件可直接拷贝到该目录覆盖**。

## 启动与停止

在**仓库根目录**执行：

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env build
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d
```

或在 `docker/` 目录下：

```bash
cd docker
docker compose --env-file .env build
docker compose --env-file .env up -d
```

停止并删除容器（保留 `sqlitefile/` 里的库文件）：

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env down
```

## 更新代码后重新部署

```bash
git pull
docker compose -f docker/docker-compose.yml --env-file docker/.env build
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d
```

## 自检

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8084/
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8084/api/session
```

未登录时 `/api/session` 返回 401，说明接口已经起来。

## 常见问题

| 症状 | 处理 |
|------|------|
| 页面或接口没有更新 | 重新 `build` 后再 `up -d`。页面打在同一个镜像里 |
| 登录后刷新掉登录态 | 从 `https://familytree.zhangzhicheng.info` 进入，并确认 `COOKIE_SECURE=true` |
| 登录限流把所有人算成同一个 IP | 把日志里的对端地址追加到 `TRUSTED_PROXY`，然后 `up -d` |
| SQLite 需重置 | 停止栈后替换或删除 `docker/sqlitefile/familytree.db`，再 `up -d` |

## 接入 tencentDocker 边缘网关

1. 确保本栈映射至 **8084**（默认已配置）。
2. 在 `tencentDocker/docker/` 配置 `FAMILYTREE_FRONTEND_UPSTREAM=host.docker.internal:8084`。
3. 放置 `familytree.zhangzhicheng.info` TLS 证书至 `tencentDocker/docker/ssl/familytree.zhangzhicheng.info/`。
4. DNS 添加 A 记录后重启 edge-nginx。
5. 浏览器访问 `https://familytree.zhangzhicheng.info`。

详见 `tencentDocker/docs/deploy-guide.md`。
