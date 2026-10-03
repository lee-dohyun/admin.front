FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache g++ make py3-pip libc6-compat git
WORKDIR /app
COPY package*.json ./
RUN npm install

# dev 는 production 보다 앞에 둔다 - CI 가 target 을 빠뜨려도 마지막 스테이지(production)가 빌드된다.
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
CMD ["npm", "run", "dev"]

FROM deps AS builder
COPY . .
RUN npm run build

FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# 런타임은 node 만 쓴다. 베이스 이미지에 딸린 npm·yarn·corepack 은 지운다 - 이미지 스캔 경고의
# 대부분이 npm 자신의 node_modules 였고, 침해 시 공격자가 쓸 도구이기도 하다(gateway#247).
# apk upgrade: 베이스 이미지 태그가 갱신되기 전에 나온 OS 패키지 수정본(openssl 등)을 받는다.
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    rm -rf /usr/local/lib/node_modules /opt/yarn-v* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg && \
    apk upgrade --no-cache

# next.config 의 output: "standalone" 산출물만 싣는다 - 빌드 도구와 devDependencies 는 들어가지 않는다.
# .next 는 런타임 사용자 소유여야 한다(캐시 쓰기).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
