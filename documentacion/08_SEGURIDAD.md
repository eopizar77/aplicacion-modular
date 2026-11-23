# 08 · Arquitectura de Ciberseguridad y Defensa en Profundidad

Como proyecto diseñado bajo el principio de **Ciberseguridad por Diseño**, **Forja Modular** implementa controles preventivos en cada capa: entrada de datos, motor de compilación, HTML/JS generado, servidor HTTP (Nginx) y contenedor (Docker/Proxmox).

---

## 1. Modelo de Amenazas (STRIDE) y Mitigaciones Implementadas

| Amenaza | Vector de Ataque | Control Implementado | Archivo / Ubicación |
|---|---|---|---|
| **SSTI / Inyección de Código en Generador** | Un atacante intenta inyectar código JS/Astro dentro de un campo de `site.json`. | El generador **no** usa plantillas de reemplazo de texto sobre código fuente. Astro consume `site.resolved.json` como datos tipados y escapa automáticamente toda interpolación HTML `{variable}`. | [generate.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/generate.mjs), [Layout.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/layouts/Layout.astro) |
| **Inyección de Comandos OS (Command Injection)** | Un `slug` o variable maliciosa intenta ejecutar comandos en shell durante el build (`; rm -rf /`). | `SLUG_RE` restringe slugs a `/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/` y Astro se invoca mediante `spawn(process.execPath, args)` **sin shell** (`shell: false`). | [schema.mjs#L5](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/schema.mjs#L5), [generate.mjs#L204-L212](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/generate.mjs#L204-L212) |
| **Path Traversal y Enlaces Simbólicos** | Un manifiesto referencia `../../etc/passwd` o incluye un symlink en `assets/`. | `ASSET_RE` prohíbe `..`, `dentroDe(base, destino)` verifica contención de rutas con `path.relative`, y `copiarDir` ignora explícitamente enlaces simbólicos (`if (ent.isSymbolicLink()) continue`). | [schema.mjs#L10-L29](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/schema.mjs#L10-L29), [generate.mjs#L36-L39](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/generate.mjs#L36-L39), [generate.mjs#L156](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/generate.mjs#L156) |
| **Stored XSS vía Imágenes SVG** | Un logo `.svg` subido por un cliente incluye `<script>`, `onload="..."`, `javascript:` o `<foreignObject>`. | `validarAsset()` inspecciona el contenido de todo archivo `.svg`, rechaza payloads activos y limita el tamaño de cualquier asset a **5 MB**. | [generate.mjs#L139-L150](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/generate.mjs#L139-L150) |
| **Inyección CSS vía *Design Tokens*** | Un tema o personalización inyecta `red; } body { background: url(...)` en colores o fuentes. | Colores validados con `/^#(?:[0-9a-fA-F]{3}\|[0-9a-fA-F]{6})$/` y fuentes con `/^[\p{L}0-9 ,'"\-]+$/u`. | [schema.mjs#L6-L8](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/schema.mjs#L6-L8) |
| **XSS en Bloque JSON-LD (`</script>`)** | Un campo de texto contiene `</script><script>alert(1)</script>` dentro del bloque Schema.org. | `JSON.stringify(jsonLd).replace(/</g, '\\u003c')` neutraliza cualquier cierre de etiqueta en el bloque `application/ld+json`. | [Layout.astro#L48](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/layouts/Layout.astro#L48) |
| **XSS por Protocolos Peligrosos en Enlaces** | Un enlace de redes sociales usa `javascript:alert(1)` o `data:...`. | `urlHttps` parsea con `new URL(v)` y exige `u.protocol === 'https:'`. | [schema.mjs#L14-L24](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/schema.mjs#L14-L24) |
| **Mass Assignment / Contaminación de Esquema** | Inyección de propiedades no documentadas en JSON. | Todos los objetos Zod usan `.strict()`: cualquier propiedad desconocida aborta la validación. | [schema.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/schema.mjs) |

---

## 2. Política de Seguridad de Contenido (CSP) sin `'unsafe-inline'` en Scripts

En [astro.config.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/astro.config.mjs) configuramos `vite.build.assetsInlineLimit: 0`. Esto obliga a Astro a emitir todos los scripts como archivos externos `/_astro/*.js`, permitiendo en [deploy/nginx/seguridad.conf](file:///d:/piza77/proyectos/APLICACION__MODULAR/deploy/nginx/seguridad.conf) una directiva `script-src 'self'` estricta:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-src https://www.google.com https://maps.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
```

### Cabeceras Adicionales Activas
- `X-Content-Type-Options: nosniff` (impide *MIME-sniffing*).
- `X-Frame-Options: DENY` + `frame-ancestors 'none'` (impide *Clickjacking*).
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` (bloquea APIs sensibles del navegador).
- `Cross-Origin-Opener-Policy: same-origin`.
- `server_tokens off` (oculta la versión exacta de Nginx).
- `limit_req_zone $binary_remote_addr zone=porip:10m rate=20r/s` con `burst=40 nodelay` (mitigación de fuerza bruta/scraping).

---

## 3. Endurecimiento del Contenedor Docker

En [Dockerfile](file:///d:/piza77/proyectos/APLICACION__MODULAR/Dockerfile) y [docker-compose.yml](file:///d:/piza77/proyectos/APLICACION__MODULAR/docker-compose.yml):

1. **Imagen multi-etapa sin código fuente ni Node.js en producción:** La etapa final (`nginxinc/nginx-unprivileged:1.29-alpine`) solo contiene los archivos estáticos compilados (`dist-sites`), sin `node`, sin `npm` y sin el código del generador.
2. **Ejecución sin root (`UID 101`):** El proceso Nginx corre como usuario sin privilegios en el puerto `8080`.
3. **Sistema de archivos de solo lectura (`read_only: true`):** Ningún proceso dentro del contenedor puede modificar archivos servidos ni escribir puertas traseras; solo `/tmp` existe en memoria (`tmpfs`).
4. **Eliminación total de capacidades del kernel (`cap_drop: [ALL]`):** El contenedor no tiene capacidades POSIX (`NET_RAW`, `SYS_ADMIN`, `CHOWN`, etc.).
5. **Bloqueo de escalada de privilegios (`no-new-privileges: true`)** y límites de recursos (`cpus: "1.0"`, `memory: 256M`) para evitar agotamiento del host Proxmox (DoS).

---

## 4. Auditoría de Dependencias y Licencias

Verificación ejecutada sobre el árbol de paquetes (`npm audit`):
- **Vulnerabilidades detectadas:** `0 vulnerabilities`.
- **Licencias de dependencias directas:**
  - `astro`: **MIT**
  - `three`: **MIT**
  - `zod`: **MIT**
