# 04 · Guía de Instalación y Operación Local

## 1. Requisitos del Sistema

| Herramienta | Versión Mínima | Versión Verificada en este Entorno | Propósito |
|---|---|---|---|
| **Node.js** | `>= 20.10.0` | `v24.11.0` | Ejecución del CLI `forja` y compilación de Astro |
| **npm** | `>= 10.0.0` | `11.6.1` | Gestión de workspaces (`generator`, `templates/*`) |
| **Git** | `>= 2.40` | `2.51.0.windows.1` | Control de versiones |
| **Docker** | `>= 24.0` + Compose v2 | `29.1.3` | Construcción y ejecución del servidor multi-sitio Nginx |

---

## 2. Instalación Paso a Paso

1. **Ubicarse en la raíz del proyecto:**
   ```powershell
   cd D:\piza77\proyectos\APLICACION__MODULAR
   ```

2. **Instalar dependencias del monorepo:**
   ```powershell
   npm install
   ```
   *Nota:* Como el proyecto usa `workspaces` en [package.json](file:///d:/piza77/proyectos/APLICACION__MODULAR/package.json), este único comando instala `zod` para `generator` y `astro` + `three` para `templates/restaurante`.

3. **Configurar variables de entorno (opcional en local):**
   ```powershell
   Copy-Item .env.example .env
   ```
   Variables disponibles en [.env.example](file:///d:/piza77/proyectos/APLICACION__MODULAR/.env.example):
   - `WEB_PORT=8080`: Puerto local donde escuchará Nginx en Docker.
   - `DOMINIO_BASE=localhost`: Dominio raíz para subdominios (`<slug>.localhost`).
   - `MOSTRAR_INDICE=true`: Genera la página índice interna en `dist-sites/_indice/index.html` (`false` recomendado al exponer a Internet).
   - `CLOUDFLARE_TUNNEL_TOKEN=`: Solo necesario si se activa el perfil `--profile tunnel`.

---

## 3. Comandos de Trabajo Diario

### 3.1 Explorar el catálogo disponible
```powershell
npm run list
```
Muestra en consola las plantillas (`restaurante`), los temas (`bosque`, `brasa`, `oceano`) y los sitios registrados en `sites/`.

### 3.2 Validar todos los manifiestos y assets
```powershell
npm run validate
```
Verifica que todos los `sites/<slug>/site.json` cumplan el esquema estricto de [schema.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/schema.mjs) y que cada imagen referenciada exista dentro de `sites/<slug>/assets/`.

### 3.3 Modo desarrollo con recarga en vivo (Hot Reload)
```powershell
npm run dev:restaurante
# o para cualquier otro sitio:
npm run forja -- dev demo-cevicheria
```
Prepara `.forja/<slug>/` y levanta el servidor de desarrollo de Astro ligado exclusivamente a `127.0.0.1:4321` (no expone el puerto en la red local).

### 3.4 Construir todos los sitios para producción
```powershell
npm run build:sites
```
Genera las carpetas estáticas listas para servir en `dist-sites/<slug>/`.

### 3.5 Crear un sitio para un cliente nuevo
```powershell
npm run forja -- new asadero-el-portal --plantilla restaurante --tema brasa --nombre "Asadero El Portal"
```
Esto clona la estructura base en `sites/asadero-el-portal/site.json`. Luego editas sus datos y ejecutas:
```powershell
npm run forja -- build asadero-el-portal
```

---

## 4. Ejecución con Docker en Local

1. **Asegurarse de que Docker Desktop esté corriendo.**
2. **Construir y levantar el contenedor endurecido:**
   ```powershell
   npm run docker:up
   ```
3. **Probar los sitios en el navegador:**
   - Índice interno de sitios: `http://localhost:8080/`
   - Endpoint de salud: `http://localhost:8080/healthz`
   - Sitio 1 (Tema Brasa): `http://demo-restaurante.localhost:8080/`
   - Sitio 2 (Tema Océano): `http://demo-cevicheria.localhost:8080/`
4. **Detener el contenedor:**
   ```powershell
   npm run docker:down
   ```

---

## 5. Solución de Problemas Comunes

| Síntoma | Causa | Solución |
|---|---|---|
| `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified` | El motor de Docker Desktop no está iniciado en Windows. | Inicia **Docker Desktop**, espera a que el icono de la barra de tareas esté estable y vuelve a ejecutar `npm run docker:up`. |
| `Manifiesto de "<slug>" inválido: Unrecognized key(s) in object` | Se agregó un campo en `site.json` que no existe en el esquema. | Revisa el nombre del campo en [05_GENERADOR_Y_MANIFIESTO.md](05_GENERADOR_Y_MANIFIESTO.md); todos los objetos usan `.strict()` por seguridad. |
| `Asset rechazado ... SVG con contenido activo` | Un archivo `.svg` contiene etiquetas `<script>`, `onload=`, `<foreignObject>` o `javascript:`. | Limpia el SVG con SVGO o expórtalo como curvas puras desde Illustrator/Figma/Inkscape. |
| En Windows un navegador antiguo no resuelve `*.localhost` | Algunos entornos corporativos con proxy interceptan `*.localhost`. | Agrega `127.0.0.1 demo-restaurante.localhost demo-cevicheria.localhost` en `C:\Windows\System32\drivers\etc\hosts`. |
