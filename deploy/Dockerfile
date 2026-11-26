# 构建上下文是仓库根。
# 官方镜像名为 docker.io/library/node:22-bookworm 与其 slim 版。
# 这里用 DaoCloud 的公开镜像前缀。DaoCloud 不可用时，改回官方名，
# 或在本机 /etc/docker/daemon.json 配置账号专属的阿里云 registry-mirrors。
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm
ARG NODE_IMAGE_SLIM=docker.m.daocloud.io/library/node:22-bookworm-slim

FROM ${NODE_IMAGE} AS build
WORKDIR /src
COPY .npmrc ./
COPY server/package.json server/package-lock.json ./server/
COPY web/package.json web/package-lock.json ./web/
RUN npm ci --prefix server && npm ci --prefix web
COPY server ./server
COPY web ./web
RUN npm run build --prefix web && npm run build --prefix server
RUN npm ci --prefix server --omit=dev

FROM ${NODE_IMAGE_SLIM}
# bookworm 镜像的软件源在 debian.sources。换成阿里云后再装 util-linux（setpriv）。
# 备选主机名：mirrors.tuna.tsinghua.edu.cn
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i \
        -e 's|http://deb.debian.org/debian-security|https://mirrors.aliyun.com/debian-security|g' \
        -e 's|http://deb.debian.org/debian|https://mirrors.aliyun.com/debian|g' \
        -e 's|https://deb.debian.org/debian-security|https://mirrors.aliyun.com/debian-security|g' \
        -e 's|https://deb.debian.org/debian|https://mirrors.aliyun.com/debian|g' \
        /etc/apt/sources.list.d/debian.sources; \
    fi \
 && apt-get update \
 && apt-get install -y --no-install-recommends util-linux \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --uid 10001 --create-home app
WORKDIR /app
COPY --from=build /src/server/node_modules ./node_modules
COPY --from=build /src/server/dist ./dist
COPY --from=build /src/server/seed ./seed
COPY --from=build /src/web/dist ./static
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENV STATIC_DIR=/app/static \
    DATABASE_PATH=/data/familytree.db \
    NODE_ENV=production \
    PORT=8080 \
    TZ=Asia/Shanghai
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]
