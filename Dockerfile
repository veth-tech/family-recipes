# ---- build stage: install everything, build web + server ----
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime stage: production deps + built assets only ----
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/build ./build
COPY --from=build /app/server/db/migrations ./server/db/migrations

EXPOSE 3000
VOLUME /data

CMD ["node", "build/server/index.mjs"]
