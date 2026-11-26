# syntax=docker/dockerfile:1
# ============================================================================
# Forja Modular — imagen de producción multi-sitio
#   Etapa 1 (build): instala dependencias y ensambla TODOS los sitios de /sites
#   Etapa 2 (runtime): Nginx sin privilegios (usuario no-root, puerto 8080)
# ============================================================================

FROM node:24-alpine AS build
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY . .
RUN npm ci --no-audit --no-fund

ARG DOMINIO_BASE=homelab.lan
ARG ESQUEMA_URL=http
ARG WEB_PORT=19085
ARG MOSTRAR_INDICE=true
ENV DOMINIO_BASE=${DOMINIO_BASE} \
    ESQUEMA_URL=${ESQUEMA_URL} \
    WEB_PORT=${WEB_PORT} \
    MOSTRAR_INDICE=${MOSTRAR_INDICE}

RUN node generator/bin/forja.mjs validate --all \
 && node generator/bin/forja.mjs build --all

# ----------------------------------------------------------------------------
# Target: studio (Panel visual Forja Studio — Fase 3, ejecuta como usuario no-root "node")
FROM build AS studio
ENV STUDIO_HOST=0.0.0.0 \
    STUDIO_PORT=4322
RUN chown -R node:node /app
USER node
EXPOSE 4322
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4322/healthz || exit 1
CMD ["node", "studio/src/server.mjs"]

# ----------------------------------------------------------------------------
# Target por defecto: runtime (Servidor Nginx multi-sitio sin privilegios)
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
LABEL org.opencontainers.image.title="forja-sitios" \
      org.opencontainers.image.description="Sitios web generados por Forja Modular" \
      org.opencontainers.image.version="0.1.0"

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/seguridad.conf /etc/nginx/snippets/seguridad.conf
COPY --from=build /app/dist-sites /usr/share/nginx/html/sites

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
