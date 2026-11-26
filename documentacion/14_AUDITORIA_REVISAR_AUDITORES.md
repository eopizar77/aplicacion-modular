# Auditoría Web Integral, Estrategia Digital y CRO (4 Pilares)

- **Sitio auditado:** https://revisarauditores.com.co/
- **Fecha de análisis:** 2026-11-26T23:07:47.539Z
- **Stack / CMS detectado:** WordPress (Divi, jQuery)

---

## 1. Resumen Ejecutivo

- **Estado General del Sitio:** **CRÍTICO** (**43 / 100**)
- **Los 3 Hallazgos Más Importantes:**
  1. Falta etiqueta `<meta name="description">`: Google genera fragmentos automáticos poco persuasivos.
  2. No existe encabezado `<h1>`: el buscador no identifica el tema principal de la página.
  3. Sobrecarga de JavaScript: 20 scripts totales (0 bloqueando el renderizado en `<head>`).
- **Recomendación del Catálogo Vectorial (memoria_local):** Tema sugerido **`ejecutivo`** (Corporativo B2B / Firmas Contables y Legales).

---

## 2. Diagnóstico Detallado por Pilar

### Pilar 1: Optimización para Motores de Búsqueda (SEO)

- **Auditoría On-Page (Datos medidos en vivo):**
  - **`<title>` (31 caracteres, 1 etiqueta):** `Inicio - Revisar Auditores LTDA`
  - **Meta Description (0 caracteres, 0 etiqueta):** `(AUSENTE)`
  - **Canonical:** `https://revisarauditores.com.co/` · **Idioma `<html lang>`:** `es`
  - **Jerarquía de Encabezados:** H1: **0** | H2: **1** | H3: **0** | Saltos de nivel detectados: **1**
  - **Textos `<h1>` actuales:** *(Ninguno)*
  - **Datos estructurados `Schema.org`:** WebPage, BreadcrumbList, WebSite, Organization
  - **Enlaces internos vacíos (`#`):** 0 · **Enlaces HTTP inseguros:** 2
- **Posicionamiento y Brechas de Palabras Clave (*Keyword Gaps*):**
  - `revisoría fiscal en Bogotá precios / cotización empresas`
  - `auditoría externa NIIF para PYMES y S.A.S. en Colombia`
  - `consultoría tributaria DIAN y planeación fiscal corporativa`
  - `auditoría de control interno y cumplimiento normativo Bogotá`
- **Perfil de Enlaces (Backlinks):**
  - *Requerimiento de datos:* La inspección HTTP pública no expone el grafo completo de backlinks; conecta Google Search Console (informe de Enlaces) o Ahrefs Webmaster Tools gratuito para auditar autoridad de dominios de referencia y anchor texts.

### Pilar 2: Velocidad y Rendimiento Técnico (WPO)

- **Telemetría HTTP directa (Servidor origen):**
  - **TTFB (Time to First Byte):** `277 ms` · **Descarga HTML total:** `342 ms`
  - **Peso documento HTML:** `83.9 KB` · **Compresión:** `gzip` · **Cache-Control:** `max-age=0, no-cache, no-store, must-revalidate`
- **Métricas Core Web Vitals (Móvil vs. Escritorio):**

| Dispositivo | Score | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|
| **Móvil** | *Pendiente API Key* | — | — | — | *(Nota: HTTP 429 (cuota pública sin PAGESPEED_API_KEY))* |
| **Escritorio** | *Pendiente API Key* | — | — | — | *(Nota: HTTP 429 (cuota pública sin PAGESPEED_API_KEY))* |

- **Diagnóstico de Cuellos de Botella:**
  - **Scripts totales:** 20 (**0** bloqueantes en `<head>`) · **Hojas CSS:** 12.
  - **Imágenes:** 15 totales · **14** sin `alt` · **13** sin `loading="lazy"` · **0** en formato moderno (WebP/AVIF/SVG).
  - **Dominios externos cargados:** 16 (mlnaqryzajcw.i.optimole.com, fonts.googleapis.com, www.supersolidaria.gov.co, www.supersociedades.gov.co, www.superfinanciera.gov.co, www.dian.gov.co, www.shd.gov.co, www.ibague.gov.co, www.medellin.gov.co, www.villavicencio.gov.co).

### Pilar 3: Análisis de la Competencia y Posicionamiento

- **Propuesta de Valor Percibida:** Firma colombiana enfocada en servicios de revisoría fiscal, auditoría financiera/interna, consultoría NIIF y asesoría tributaria empresarial.
- **Categorización de Rivales:**
  - **Directos:** Firmas medianas nacionales de revisoría fiscal y outsourcing contable en Bogotá/Medellín.
  - **Indirectos:** Contadores independientes y software contable en la nube con asesoría incluida (Siigo, Alegra, World Office).
  - **Consolidados (*Legacy*):** Big Four (Deloitte, PwC, EY, KPMG) y redes internacionales (BDO, Grant Thornton, Baker Tilly) con tarifas altas.
  - **Disruptores:** Boutiques digitales B2B con cotizadores interactivos, diagnósticos tributarios express y atención inmediata por WhatsApp.
- **Matriz DAFO (SWOT):**

| Fortalezas (Internas) | Debilidades (Internas) |
|---|---|
| Dominio corporativo propio .com.co (revisarauditores.com.co) con presencia institucional establecida.<br>• Oferta especializada en servicios de alta recurrencia legal obligatoria en Colombia (Revisoría Fiscal, Auditoría, Tributaria). | Arquitectura tecnológica basada en WordPress (Divi, jQuery) con 20 scripts y TTFB de 277 ms que penaliza la experiencia móvil.<br>• Ausencia o debilidad en metadatos On-Page clave para captar búsquedas de alta intención comercial. |
| **Oportunidades (Externas)** | **Amenazas (Externas)** |
| Capturar empresas S.A.S. y medianas que buscan rigor técnico cercano sin pagar tarifas de Big Four.<br>• Incorporar calculadora/diagnóstico rápido de obligatoriedad de Revisoría Fiscal (topes de activos/ingresos en UVT/SMMLV) como imán de leads (CRO). | Competidores B2B que ya posicionan artículos de calendario tributario DIAN y captan el tráfico orgánico informativo y transaccional.<br>• Pérdida de prospectos ejecutivos que consultan desde el celular y abandonan si la carga supera los 3 segundos. |

- **Espacio Vacío de Mercado (*Whitespace*):** Posicionarse como la firma de auditoría ágil y moderna en Colombia: web ultrarrápida (< 1s en Astro), diagnóstico interactivo de topes de Revisoría Fiscal en 30 segundos y agendamiento directo con socio auditor vía WhatsApp/Calendario.

### Pilar 4: Análisis de Tráfico y Comportamiento (CRO)

- **Instrumentación y Analítica Detectada en Código:** *(Ninguna herramienta de analítica detectada en el HTML público)*.
- **Canales de Conversión Activos:**
  - **WhatsApp directo:** **No detectado**
  - **Teléfonos clicables (`tel:`):** Ninguno
  - **Correos clicables (`mailto:`):** Ninguno
  - **Formularios `<form>`:** 1 · **CTAs detectados:** Contáctenos · CONTÁCTENOS
- **Puntos de Fricción en el Embudo:**
  - El visitante ejecutivo llega a una portada institucional extensa sin un diferenciador cuantificable en el primer pantallazo (años de experiencia, sectores auditados, tiempos de respuesta).
  - Los formularios tradicionales de contacto B2B generan alta fricción frente a un botón de diagnóstico rápido o contacto directo preclasificado.
  - Falta prueba social estructurada verificable (casos de éxito por industria, certificaciones, logos o indicadores de cumplimiento).
- **Nota sobre fuentes de tráfico reales:** Para medir tasa de rebote exacta por canal (Orgánico, Directo, Referido, IA) sin usar cookies invasivas, se recomienda conectar Google Search Console + Matomo self-hosted en Proxmox.

---

## 3. Plan de Acción Priorizado (Impacto vs. Esfuerzo)

| # | Pilar | Acción Concreta | Impacto | Esfuerzo | Resultado Esperado |
|---|---|---|---|---|---|
| 1 | **SEO / CRO** | Redactar meta descripción persuasiva (140–155 caracteres) con propuesta de valor y llamado a la acción. | **Alto** | Bajo | +15 % a +25 % en tasa de clics (CTR) desde resultados de búsqueda. |
| 2 | **SEO** | Incluir un único `<h1>` visible en el Hero con la oferta central y ubicación geográfica. | **Alto** | Bajo | Claridad semántica para Googlebot y reducción de rebote en los primeros 3 segundos. |
| 3 | **WPO** | Eliminar plugins/constructores pesados y diferir scripts no críticos (`defer` / islas Astro con `assetsInlineLimit: 0`). | **Alto** | Medio | Mejora directa en FCP, LCP e interactividad móvil en redes 4G. |
| 4 | **CRO** | Implementar CTA flotante y contextual de WhatsApp con mensaje prellenado según el servicio consultado. | **Alto** | Bajo | Incremento inmediato de leads directos en Colombia (canal preferido B2B y B2C). |
| 5 | **WPO** | Convertir imágenes a WebP/AVIF, añadir `width/height` explícitos (15 sin dimensiones) y `loading="lazy"` (13 sin diferir). | **Alto** | Bajo | Ahorro del 40 %–70 % en peso de página móvil y eliminación de saltos visuales (CLS). |
| 6 | **CRO / Medición** | Implementar analítica sin cookies respetuosa de Ley 1581 (ej. Matomo self-hosted en Proxmox o Plausible) y verificar Google Search Console. | **Medio** | Bajo | Visibilidad real de embudos de abandono y palabras clave de conversión sin banners invasivos. |
| 7 | **SEO / Accesibilidad** | Agregar atributos `alt` descriptivos a las 14 imágenes que hoy carecen de texto alternativo. | **Medio** | Bajo | Cumplimiento WCAG AA y posicionamiento en Google Imágenes. |
| 8 | **Seguridad / Confianza** | Configurar cabeceras HTTP `Content-Security-Policy`, `Strict-Transport-Security (HSTS)` y `X-Frame-Options`. | **Medio** | Bajo | Blindaje contra XSS/Clickjacking y mayor confianza corporativa. |
