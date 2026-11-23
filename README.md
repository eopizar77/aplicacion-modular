# ⚒️ Forja Modular

> Generador de sitios web y (próximamente) aplicaciones **ensamblables por piezas**: eliges la plantilla, el tema de diseño, los colores, las imágenes y los datos, y Forja lo ensambla en un paquete listo para producción con Docker.

**Versión:** 0.1.0 (MVP) · **Inicio del proyecto:** lunes 23 de noviembre de 2026, 10:50 a. m. (hora de Bogotá)

## Qué hace hoy (v0.1.0)

- **Generador CLI** (`forja`): valida manifiestos JSON, mezcla temas y personalizaciones, y ensambla sitios estáticos.
- **Plantilla "Restaurante 3D"** (Astro + Three.js): hero 3D animado, carta con tarjetas 3D, testimonios, horarios, mapa, WhatsApp y política de datos (Ley 1581).
- **3 temas** (design tokens): `brasa`, `oceano` y `bosque`.
- **Servidor multi-sitio**: Nginx sin privilegios que sirve cada negocio en `<slug>.<tu-dominio>`.
- **Docker + Docker Compose**, listo para desplegar en **Proxmox** (VM o LXC) y publicar con **Cloudflare Tunnel**.

## Inicio rápido

```bash
npm install                      # instala dependencias
npm run forja -- list            # ver plantillas, temas y sitios
npm run validate                 # validar todos los manifiestos
npm run build:sites              # ensamblar todos los sitios en dist-sites/
npm run dev:restaurante          # desarrollo con recarga en http://127.0.0.1:4321
docker compose up -d --build     # producción local: http://demo-restaurante.localhost:8080
```

## Crear el sitio de un negocio nuevo

```bash
npm run forja -- new panaderia-la-espiga --tema bosque --nombre "Panadería La Espiga"
# edita sites/panaderia-la-espiga/site.json y agrega imágenes en sites/panaderia-la-espiga/assets/
npm run forja -- build panaderia-la-espiga
```

## Estructura

```
catalog/        Catálogo de piezas: temas (design tokens) y fichas de plantillas
generator/      CLI y motor de ensamblaje (validación estricta con zod)
templates/      Plantillas (proyectos Astro alimentados por datos)
sites/          Un folder por negocio: site.json + assets/
deploy/nginx/   Configuración Nginx multi-sitio + cabeceras de seguridad
documentacion/  Documentación completa del proyecto (empieza por 00_INDICE.md)
```

## Documentación

Toda la documentación está en [`documentacion/`](documentacion/00_INDICE.md).
