# Imagen de producción de la API NestJS.
# Contexto de build: raíz del monorepo.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV npm_config_update_notifier=false

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace @nexo/api --include-workspace-root

COPY apps/api apps/api
RUN npm run build --workspace @nexo/api

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace @nexo/api --include-workspace-root \
    && npm cache clean --force

COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/sql apps/api/sql
# Carpeta para evidencias. En producción conviene montar un volumen persistente aquí.
RUN mkdir -p apps/api/uploads/evidencias

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
