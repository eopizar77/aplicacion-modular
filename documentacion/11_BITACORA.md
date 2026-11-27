# 11 · Bitácora Técnica y de Gobernanza del Proyecto

Registro auditable con fecha y hora (`America/Bogota`, UTC-5) de todas las decisiones, archivos creados, validaciones ejecutadas y controles de seguridad aplicados.

---

## Sesión 1 — Lunes 23 de Noviembre de 2026 (`2026-11-23`)

### `[2026-11-23 10:38:03 -05:00]` · Definición del Concepto de Plataforma
- **Solicitud del usuario:** Evaluar si es posible construir un entorno modular para elegir template de login, dashboard, colores, imágenes, tecnologías de frontend/backend/BD y ensamblarlos en un paquete Docker, y conocer su nombre en la industria.
- **Resultado:** Se identificaron las categorías arquitectónicas (*App Generator / Scaffolding*, *Low-Code Platform*, *Model-Driven Development*, *White-label Design Tokens*, *Internal Developer Platform*) y referentes (*JHipster, Amplication, AppSeed, Backstage*), definiendo la arquitectura de 4 etapas (Catálogo → Manifiesto → Motor Generador → Empaquetado Docker).

### `[2026-11-23 10:45:04 -05:00]` · Extensión a Sitios Web Creativos 3D y Base CCB
- **Solicitud del usuario:** Incluir generación de páginas web dinámicas con movimiento 3D para mejorar a bajo costo sitios de negocios aprovechando una base de datos de la Cámara de Comercio de Bogotá (CCB).
- **Resultado:** Se diseñó la línea **Forja Sitios (WaaS)** con Astro + Three.js de carga diferida y se establecieron las advertencias de cumplimiento legal para Colombia (**Ley 1581 de 2012**, **Decreto 1377 de 2013** y **Ley 2300 de 2023**).

### `[2026-11-23 10:50:40 -05:00]` · Inicio de Construcción del MVP y Auditoría del Entorno
- **Solicitud del usuario:** Iniciar el proyecto completo en `D:\piza77\proyectos\APLICACION__MODULAR`, documentar todo detalladamente en `documentacion/` con cronograma basado en fecha y hora, y prepararlo para despliegue en servidor **Proxmox**.
- **Auditoría de herramientas en el host:**
  - `Node.js`: `v24.11.0`
  - `npm`: `11.6.1`
  - `Git`: `2.51.0.windows.1`
  - `Docker CLI`: `29.1.3, build f52814d`
- **Archivos base creados (`10:51`):**
  - [package.json](file:///d:/piza77/proyectos/APLICACION__MODULAR/package.json) (monorepo npm workspaces).
  - [.gitignore](file:///d:/piza77/proyectos/APLICACION__MODULAR/.gitignore) y [.dockerignore](file:///d:/piza77/proyectos/APLICACION__MODULAR/.dockerignore) (con bloqueo explícito de `*.csv`, `*.xlsx` y `data/privado/`).
  - [.env.example](file:///d:/piza77/proyectos/APLICACION__MODULAR/.env.example).

### `[2026-11-23 10:52:07 -05:00]` · Creación del Catálogo de Piezas
- **Temas (*Design Tokens*):**
  - [catalog/themes/brasa.json](file:///d:/piza77/proyectos/APLICACION__MODULAR/catalog/themes/brasa.json) (modo oscuro, escena 3D `organica`).
  - [catalog/themes/oceano.json](file:///d:/piza77/proyectos/APLICACION__MODULAR/catalog/themes/oceano.json) (modo claro, escena 3D `burbujas`).
  - [catalog/themes/bosque.json](file:///d:/piza77/proyectos/APLICACION__MODULAR/catalog/themes/bosque.json) (modo oscuro, escena 3D `hojas`).
- **Ficha de plantilla:**
  - [catalog/templates/restaurante.json](file:///d:/piza77/proyectos/APLICACION__MODULAR/catalog/templates/restaurante.json).

### `[2026-11-23 10:53:40 -05:00]` · Construcción del Motor Generador y Esquemas Estrictos
- **Instalación de dependencias:** `zod@^4.6.7` en `generator`; `astro@^7.4.13` y `three@^0.187.0` en `templates/restaurante` (`0 vulnerabilities` en `npm audit`).
- **Módulos del generador creados (`10:54 - 10:55`):**
  - [generator/src/schema.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/schema.mjs): Esquemas Zod con `.strict()`, lista blanca de fuentes CSS, colores hexadecimales, URLs `https:` y rutas relativas de assets.
  - [generator/src/generate.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/generate.mjs): Resolución de temas, protección anti-path traversal (`dentroDe`), rechazo de symlinks, escaneo anti-XSS de archivos `.svg` y ejecución de Astro sin shell (`spawn`).
  - [generator/bin/forja.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/bin/forja.mjs): Interfaz de línea de comandos (`list`, `validate`, `build`, `dev`, `new`).

### `[2026-11-23 10:55:38 -05:00]` · Desarrollo de la Plantilla Restaurante 3D
- **Configuración y capa de datos:**
  - [templates/restaurante/astro.config.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/astro.config.mjs) (`assetsInlineLimit: 0` para permitir CSP sin `'unsafe-inline'` en `script-src`).
  - [templates/restaurante/src/lib/site.ts](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/lib/site.ts) (formateador COP, generador de enlaces WhatsApp/Maps/Waze).
- **Layout, componentes y páginas (`10:55 - 10:57`):**
  - [Layout.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/layouts/Layout.astro), [Header.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/components/Header.astro), [Hero.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/components/Hero.astro), [Nosotros.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/components/Nosotros.astro), [Menu.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/components/Menu.astro), [Galeria.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/components/Galeria.astro), [Testimonios.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/components/Testimonios.astro), [Visita.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/components/Visita.astro), [Footer.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/components/Footer.astro).
  - Páginas: [index.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/pages/index.astro), [privacidad.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/pages/privacidad.astro) (Ley 1581 de 2012) y [404.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/pages/404.astro).
- **Scripts 3D y estilos (`10:57 - 10:59`):**
  - [hero3d-cargador.ts](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/scripts/hero3d-cargador.ts), [hero3d-escena.ts](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/scripts/hero3d-escena.ts), [tilt.ts](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/scripts/tilt.ts) y [global.css](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/styles/global.css).

### `[2026-11-23 10:59:28 -05:00]` · Sitios de Referencia y Verificación de Compilación
- **Sitios creados:**
  - [sites/demo-restaurante/site.json](file:///d:/piza77/proyectos/APLICACION__MODULAR/sites/demo-restaurante/site.json) + [logo.svg](file:///d:/piza77/proyectos/APLICACION__MODULAR/sites/demo-restaurante/assets/logo.svg) (*La Brasa de Chapinero*, tema `brasa`).
  - [sites/demo-cevicheria/site.json](file:///d:/piza77/proyectos/APLICACION__MODULAR/sites/demo-cevicheria/site.json) (*Mar de Usaquén*, tema `oceano` con color primario personalizado `#0B6E99`).
- **Ajuste técnico (`11:00`):** Resolución dinámica del binario de Astro 7 (`./bin/astro.mjs`) leyendo el campo `bin` de `node_modules/astro/package.json` en `binAstro()`.
- **Resultado del build real (`11:00:52`):**
  - `demo-cevicheria` compilado en `4.1s`.
  - `demo-restaurante` compilado en `3.0s`.
  - Verificación de salida en `dist-sites/demo-restaurante/`: HTML comprimido (`14.4 KB`), CSS (`14.1 KB`), cargador 3D (`2.4 KB`), script tilt (`0.7 KB`) y chunk diferido de Three.js (`541 KB`), con cero scripts ejecutables inline.

### `[2026-11-23 11:02:04 -05:00]` · Empaquetado Docker y Configuración Nginx Multi-Sitio
- **Archivos de infraestructura creados:**
  - [deploy/nginx/seguridad.conf](file:///d:/piza77/proyectos/APLICACION__MODULAR/deploy/nginx/seguridad.conf) (CSP estricta, cabeceras de endurecimiento).
  - [deploy/nginx/default.conf](file:///d:/piza77/proyectos/APLICACION__MODULAR/deploy/nginx/default.conf) (enrutamiento dinámico por subdominio `$slug`, `/healthz`, rate-limiting `20r/s`).
  - [Dockerfile](file:///d:/piza77/proyectos/APLICACION__MODULAR/Dockerfile) (build multi-etapa `node:24-alpine` → `nginxinc/nginx-unprivileged:1.29-alpine`).
  - [docker-compose.yml](file:///d:/piza77/proyectos/APLICACION__MODULAR/docker-compose.yml) (`read_only: true`, `cap_drop: ALL`, `no-new-privileges: true` y perfil opcional `tunnel`).

### `[2026-11-23 11:06:15 -05:00]` · Gobernanza Arquitectónica y Documentación Completa
- **Adopción de reglas de control técnico:** Prevención de las "4 D" (Cero Duplicación, Cero Desviación, Cero Diluvio, Cero Disfraz), Seguridad/Privacidad por Diseño y protocolo estructurado de respuesta.
- **Entrega incremental de los 12 documentos del proyecto en `documentacion/` (`11:03 - 11:12`):**
  - [00_INDICE.md](file:///d:/piza77/proyectos/APLICACION__MODULAR/documentacion/00_INDICE.md) al [11_BITACORA.md](file:///d:/piza77/proyectos/APLICACION__MODULAR/documentacion/11_BITACORA.md) completados y verificados.

### `[2026-11-23 18:28:17 -05:00]` · Adaptación para Portainer + Nginx Proxy Manager (`homelab.lan`)
- **Contexto recibido del usuario:** Capturas de la lista de Stacks en Portainer y de los Proxy Hosts en Nginx Proxy Manager (`192.168.20.52`, dominio `*.homelab.lan` en modo `HTTP Only`).
- **Ajustes realizados:**
  - [generator/src/generate.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/generate.mjs): Soporte de `ESQUEMA_URL` (`http` automático para dominios `.lan` / `.local`, `https` para dominios públicos) sin agregar puerto en la URL cuando se publica detrás de Nginx Proxy Manager.
  - [deploy/nginx/default.conf](file:///d:/piza77/proyectos/APLICACION__MODULAR/deploy/nginx/default.conf): Inclusión de `~^forja\.` en el `server_name` del servidor por defecto para que `http://forja.homelab.lan` muestre el portal índice de sitios generados.
  - [Dockerfile](file:///d:/piza77/proyectos/APLICACION__MODULAR/Dockerfile), [docker-compose.yml](file:///d:/piza77/proyectos/APLICACION__MODULAR/docker-compose.yml) y [.env.example](file:///d:/piza77/proyectos/APLICACION__MODULAR/.env.example): Configuración por defecto en puerto libre `19085`, `DOMINIO_BASE=homelab.lan`, `FORJA_BUILD_CONTEXT` para Portainer y volúmenes `tmpfs` (`/tmp`, `/var/cache/nginx`, `/var/run`) requeridos por `nginx-unprivileged` con `read_only: true`.
  - [documentacion/07_DESPLIEGUE_PROXMOX.md](file:///d:/piza77/proyectos/APLICACION__MODULAR/documentacion/07_DESPLIEGUE_PROXMOX.md): Guía específica paso a paso para Portainer, Nginx Proxy Manager (`192.168.20.52:19085`) y AdGuard Home (`*.homelab.lan`).

### `[2026-11-23 19:18:19 - 19:42:16 -05:00]` · Puesta en Producción Exitosa en Proxmox / Portainer y Cierre del Día 1
- **Verificación en servidor (`192.168.20.52:19085`):** Stack `forja-modular` desplegado en Portainer desde el repositorio GitHub `eopizar77/aplicacion-modular`.
- **Mejora de enrutamiento (`19:31 - 19:36`):**
  - Se habilitó enrutamiento directo por ruta `/<slug>/` (`FORJA_BASE_PATH=/<slug>` en Astro y servidor principal en [deploy/nginx/default.conf](file:///d:/piza77/proyectos/APLICACION__MODULAR/deploy/nginx/default.conf)) para que todos los sitios (`/` índice, `/demo-restaurante/`, `/demo-cevicheria/`) abran sin requerir la creación manual de nuevos subdominios DNS en AdGuard Home.
  - Se eliminó la directiva `image:` junto a `build:` en [docker-compose.yml](file:///d:/piza77/proyectos/APLICACION__MODULAR/docker-compose.yml) para evitar que Portainer intente hacer `docker pull` contra Docker Hub al actualizar el stack.
  - Se añadió [.gitattributes](file:///d:/piza77/proyectos/APLICACION__MODULAR/.gitattributes) (`* text=auto eol=lf`) garantizando finales de línea Unix en todo el repositorio.
- **Estado al cierre del Día 1:** **Fase 0, Fase 1 y Fase 1.1 (Despliegue en Proxmox/Portainer) 100 % operativas y verificadas por el usuario.**

---

## Sesión 2 — Jueves 26 de Noviembre de 2026 (`2026-11-26`)

### `[2026-11-26 16:36:11 - 16:51:00 -05:00]` · Construcción de Fase 3: Forja Studio (Constructor Visual Web)
- **Solicitud del usuario:** Avanzar con la **Fase 3 (Forja Studio)** manteniendo las reglas de gobernanza ("Prevención de las 4 D" y Ciberseguridad por Diseño), previo a revisar nuevas instrucciones estratégicas.
- **Entrega 3.1 — Extensión del Generador y Backend API (`16:38 - 16:39`):**
  - [generator/src/generate.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/generate.mjs): Nuevas funciones `validarAssetBuffer`, `guardarSitio` (escritura atómica con `.tmp` + validación Zod estricta), `listarAssetsSitio` y `guardarAssetSitio`.
  - [studio/package.json](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/package.json) y [studio/src/server.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/src/server.mjs): Servidor HTTP nativo (`node:http`) sin dependencias adicionales, autenticación `STUDIO_TOKEN` con `crypto.timingSafeEqual`, protección CSRF (`X-Forja-CSRF: 1`), bloqueo de concurrencia en builds y endpoints `/api/catalog`, `/api/sites`, `/api/sites/:slug`, `/api/sites/:slug/build`, `/api/sites/:slug/assets`.
- **Entrega 3.2 — Interfaz Web Visual (`16:40 - 16:42`):**
  - [studio/public/index.html](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/public/index.html), [studio/public/styles.css](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/public/styles.css) y [studio/public/app.js](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/public/app.js): Editor guiado en 4 pestañas (1. Tema, Colores y Logo; 2. Negocio y Contacto; 3. Historia y Carta 3D; 4. Opiniones, SEO y Ley 1581), modal de creación de nuevos sitios y panel de vista previa en vivo (`iframe`) con modos Escritorio y Celular.
- **Pruebas automatizadas ejecutadas (`16:48`):**
  - `GET /api/catalog` → `200 OK` (3 temas, 2 sitios).
  - `GET /api/sites/demo-restaurante` → `200 OK`.
  - Prueba anti-CSRF (`PUT` sin `X-Forja-CSRF: 1`) → bloqueado con `403 Forbidden`.
  - Prueba de guardado atómico (`PUT` con cabecera CSRF y manifiesto válido) → `200 OK`.
- **Entrega 3.3 — Integración Docker/Portainer y Documentación (`16:49 - 16:51`):**
  - [Dockerfile](file:///d:/piza77/proyectos/APLICACION__MODULAR/Dockerfile) y [docker-compose.yml](file:///d:/piza77/proyectos/APLICACION__MODULAR/docker-compose.yml): Nuevo stage y servicio `forja-studio` (puerto `19086`, usuario no-root `node`) compartiendo el volumen `forja_dist` con `forja-web` (`19085`).
  - Documentación completa en [documentacion/12_FORJA_STUDIO.md](file:///d:/piza77/proyectos/APLICACION__MODULAR/documentacion/12_FORJA_STUDIO.md).

### `[2026-11-26 17:25:05 - 17:32:00 -05:00]` · Implementación de los 4 Pilares de Integración Homelab IA + Flujo Audiovisual (5 Niveles)
- **Análisis de arquitectura y hardware (`17:25`):** Evaluación del prompt estratégico del usuario para el servidor Proxmox (Intel Core i7, 16 GB RAM, HDD 1TB + HDD 2TB) e identificación de salvaguardas contra OOM, cuellos de botella de I/O en discos mecánicos (`tmpfs` para `.forja/`) y validación Zod obligatoria sobre salidas de LLMs.
- **Entregable 1 — Orquestación Docker 16 GB RAM y Discos 1TB/2TB (`17:28`):**
  - [docker-compose.override.example.yml](file:///d:/piza77/proyectos/APLICACION__MODULAR/docker-compose.override.example.yml): Límites estrictos de memoria (`web: 128M`, `studio: 640M`, `db: 192M`), staging `/app/.forja` en `tmpfs` (RAM), separación de volúmenes `HDD_1TB_PATH` / `HDD_2TB_PATH` y PostgreSQL 17 Alpine afinado para bajo consumo.
- **Entregable 2 — Esquema Maestro Audiovisual (5 Niveles) y Forja Apps (`17:27`):**
  - [generator/src/schema.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/schema.mjs): Inclusión de `audiovisualSchema` (Niveles 1 a 5 con máquina de estados `Human-in-the-Loop`) y `appSchema` (configuración declarativa de **Forja Apps** con templates de Login, Dashboard, módulos ERP y entidades CRUD).
- **Entregable 3 — Puente Orquestador Real (`17:29`):**
  - [studio/src/orchestrator.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/src/orchestrator.mjs) y rutas `/api/sites/:slug/ai/audit-copy`, `/api/sites/:slug/ai/cine-prompt` y `/api/sites/:slug/ai/approve-render` en [studio/src/server.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/src/server.mjs).
- **Entregable 4 — Pestaña 5 "🎬 Estudio IA (5 Niveles)" en Forja Studio y Documentación (`17:30 - 17:32`):**
  - [studio/public/index.html](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/public/index.html) y [studio/public/app.js](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/public/app.js): Controles interactivos para los 5 niveles y botón de aprobación humana antes del render 1080p.
  - Documentación detallada en [documentacion/13_ORQUESTACION_HOMELAB_IA.md](file:///d:/piza77/proyectos/APLICACION__MODULAR/documentacion/13_ORQUESTACION_HOMELAB_IA.md).

### `[2026-11-26 17:59:43 - 18:10:00 -05:00]` · Motor Auditor Web & CRO (4 Pilares), Conector Qdrant y Prueba Real (`revisarauditores.com.co`)
- **Solicitud del usuario:** Construir el módulo de Auditoría Web Integral en 4 Pilares (SEO, WPO, Competencia/DAFO, Tráfico/CRO), conectar el catálogo vectorial a Qdrant (`192.168.20.52:6333`) y ejecutar una prueba real sobre `https://revisarauditores.com.co/`.
- **Módulos y activos creados:**
  - [catalog/themes/ejecutivo.json](file:///d:/piza77/proyectos/APLICACION__MODULAR/catalog/themes/ejecutivo.json): Tema corporativo claro para firmas contables, legales y B2B.
  - [studio/src/qdrant.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/src/qdrant.mjs): Indexador vectorial ligero (256 dimensiones Cosine, `< 2 MB` RAM) de plantillas, temas y blueprints MIT/CC0 hacia Qdrant (`:6333`).
  - [studio/src/auditor.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/src/auditor.mjs): Escudo Anti-SSRF DNS (verificado bloqueando `http://192.168.20.52:8083`), extractor técnico real On-Page/WPO/CRO, integración con Google PageSpeed API y generador del informe de 4 Pilares + conversor a `site.json`.
  - **Pestaña 6 (`🔍 Auditor URL & CRO`)** integrada en [studio/public/index.html](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/public/index.html) y [studio/public/app.js](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/public/app.js) con escape HTML anti-XSS estricto.
- **Resultado de la prueba real sobre `https://revisarauditores.com.co/`:**
  - Puntaje actual detectado: **43/100 (Estado: Crítico)** — WordPress + Divi + jQuery (`83.9 KB` HTML, `0` etiquetas `<h1>`, `0` `<meta name="description">`, `14/15` imágenes sin `alt`, `20` scripts, sin WhatsApp directo).
  - Sitio modernizado generado y compilado en [sites/revisarauditores-v2/site.json](file:///d:/piza77/proyectos/APLICACION__MODULAR/sites/revisarauditores-v2/site.json) e informe completo guardado en [documentacion/14_AUDITORIA_REVISAR_AUDITORES.md](file:///d:/piza77/proyectos/APLICACION__MODULAR/documentacion/14_AUDITORIA_REVISAR_AUDITORES.md).

### `[2026-11-26 18:59:03 - 19:19:30 -05:00]` · Corrección de Permisos Docker (`UID 1000`) y Rediseño Moderno "Forja Studio 2.0"
- **Infraestructura Docker:** Se corrigió `--chown=1000:1000` sobre el volumen compartido (`forja_publicados`), se añadió sincronización automática de semillas `/app/.seed` en el arranque de `forja-studio` y captura completa de `stderr` en `ejecutar()` de [generator/src/generate.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/generate.mjs).
- **Rediseño UI Forja Studio 2.0:** Se renovaron [studio/public/index.html](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/public/index.html), [studio/public/styles.css](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/public/styles.css) y [studio/public/app.js](file:///d:/piza77/proyectos/APLICACION__MODULAR/studio/public/app.js) con arquitectura de 3 columnas (*Dark Glassmorphism* + riel lateral con iconos SVG + tarjetas *Bento* + simulador de navegador/smartphone con *Dynamic Island* y notificaciones *Toast*), manteniendo cero dependencias externas y CSP estricta.






