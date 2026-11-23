# 01 · Visión y alcance

## 1. Visión

**Forja Modular** es una plataforma para **ensamblar software por piezas**, como cuando se arma un computador: eliges los componentes (plantilla, tema visual, colores, imágenes, módulos y datos) y la plataforma los integra en un paquete desplegable (Docker).

Tiene dos líneas de producto:

| Línea | Qué genera | Estado |
|---|---|---|
| **Forja Sitios** | Páginas web dinámicas, creativas y con 3D para negocios (restaurantes, ferreterías, salones de belleza, etc.) | ✅ MVP (v0.1.0) |
| **Forja Apps** | Aplicaciones de gestión (login, dashboard, módulos CRUD, CRM/ERP) con el stack que elijas | 🗓️ Fase 5 |

## 2. Problema que resuelve

- Muchos negocios de Bogotá no tienen sitio web, o tienen uno viejo, lento o que no se ve bien en el celular.
- Hacer un sitio a la medida es caro y lento. Las plantillas genéricas se ven todas iguales.
- Para el desarrollador, repetir el mismo trabajo para cada cliente no escala.

**Solución:** plantillas sectoriales de alta calidad, alimentadas por datos (JSON) y temas intercambiables. Hacer un sitio nuevo cuesta minutos, no semanas, y el costo de hosting por cliente es casi cero.

## 3. ¿Cómo se llama este tipo de proyecto?

| Término | Significado en Forja |
|---|---|
| **App/Site Generator (scaffolding)** | El motor `forja` que ensambla proyectos desde plantillas |
| **Design tokens / theming white-label** | Los temas de `catalog/themes` (colores, tipografía, radios, escena 3D) |
| **Model-Driven Development** | El manifiesto `site.json` describe el sitio; el código se deriva de él |
| **Website-as-a-Service (WaaS)** | El modelo de negocio: setup + mensualidad |
| **Internal Developer Platform / Golden paths** | Las plantillas son "caminos dorados" probados y seguros |

Referentes similares: JHipster, Amplication, AppSeed, Backstage Software Templates, Refine y Budibase.

## 4. Alcance por fases

| Fase | Nombre | Entregables principales |
|---|---|---|
| 0 | Fundación | Estructura del repo, arquitectura, documentación base |
| 1 | MVP Sitios | Generador CLI, plantilla restaurante 3D, 3 temas, Docker, Nginx multi-sitio |
| 1.1 | Despliegue Proxmox | VM con Docker, dominio, Cloudflare Tunnel, respaldos |
| 2 | Datos y API | API REST (Node/Express o Fastify) + PostgreSQL, importador CCB con segmentación, auditoría |
| 3 | Forja Studio | Interfaz web tipo asistente: elegir plantilla, tema y colores, ver la vista previa en vivo y publicar |
| 4 | Catálogo sectorial | Plantillas: ferretería, belleza/spa, salud/consultorio, servicios profesionales, tienda simple |
| 5 | Forja Apps | Generador de aplicaciones: login, dashboard, módulos CRUD desde la definición de entidades, elección de stack |
| 6 | Piloto comercial | 5 a 10 negocios reales, métricas, ajustes legales y de precios |

Las fechas y horas están en [03_CRONOGRAMA.md](03_CRONOGRAMA.md).

## 5. Fuera de alcance (por ahora)

- Comercio electrónico con pasarela de pagos (se evaluará en la Fase 4 con Wompi, ePayco o Mercado Pago).
- Editor visual de arrastrar y soltar dentro de la página.
- Hosting de correo electrónico.

## 6. Principios del proyecto

1. **Rendimiento primero**: el 3D es un acento, nunca un obstáculo. Un celular de gama media con datos móviles debe cargar el sitio rápido.
2. **Seguro por defecto**: validación estricta, CSP sin scripts en línea, contenedores sin privilegios.
3. **Privacidad por diseño**: los sitios no usan cookies ni rastreadores; los datos personales se tratan según la Ley 1581.
4. **Todo es dato**: los sitios se describen en JSON; nada de editar código para cada cliente.
5. **Documentado**: cada decisión y actividad queda registrada en `documentacion/`.

## 7. Glosario

| Término | Definición |
|---|---|
| **Slug** | Identificador corto del sitio (`demo-restaurante`). También es su subdominio. |
| **Manifiesto** | `sites/<slug>/site.json`: describe un negocio y su sitio |
| **Plantilla** | Proyecto Astro reutilizable en `templates/<id>` |
| **Tema** | Conjunto de design tokens en `catalog/themes/<id>.json` |
| **Ensamblar** | Validar + resolver el tema + construir con Astro + copiar assets → `dist-sites/<slug>` |
| **CCB** | Cámara de Comercio de Bogotá |
| **SIC** | Superintendencia de Industria y Comercio (autoridad de protección de datos) |
