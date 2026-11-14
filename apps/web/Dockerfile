# Imagen de producción del frontend Next.js.
# Contexto de build: raíz del monorepo.
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV npm_config_update_notifier=false

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace @nexo/web --include-workspace-root

COPY apps/web apps/web
# La URL de la API se inyecta en tiempo de ejecución con NEXO_API_URL.
# Este ARG queda como respaldo si se quiere fijar durante el build.
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace @nexo/web

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace @nexo/web --include-workspace-root \
    && npm cache clean --force

COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/apps/web/public apps/web/public
COPY --from=build /app/apps/web/next.config.mjs apps/web/next.config.mjs
COPY --from=build /app/apps/web/tsconfig.json apps/web/tsconfig.json
COPY --from=build /app/apps/web/next-env.d.ts apps/web/next-env.d.ts

EXPOSE 3000
CMD ["sh", "-c", "cd /app/apps/web && /app/node_modules/.bin/next start -p ${PORT:-3000} -H 0.0.0.0"]
