# 06 · Plantillas, Diseño (*Design Tokens*) y Motor 3D

Este documento explica cómo funciona la capa visual de **Forja Modular**, cómo se inyectan los *design tokens* sin duplicar hojas de estilo y cómo opera el motor 3D con degradación elegante.

---

## 1. Arquitectura de *Design Tokens* (White-Label Theming)

En lugar de mantener un CSS por cada cliente o tema (**Cero Duplicación**), la plantilla `templates/restaurante` usa un único archivo de estilos ([global.css](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/styles/global.css)) gobernado por variables CSS nativas inyectadas en tiempo de compilación desde [Layout.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/layouts/Layout.astro):

```css
:root {
  --c-primario: #E4572E;
  --c-secundario: #F3A712;
  --c-acento: #FFD166;
  --c-fondo: #120E0B;
  --c-superficie: #1E1814;
  --c-texto: #F7EFE6;
  --c-texto-suave: #C9B8A6;
  --f-titulos: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  --f-cuerpo: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --radio: 18px;
  color-scheme: dark;
}
```

### Derivación cromática con `color-mix()`
Todos los brillos, bordes, velos traslúcidos y sombras se calculan automáticamente en CSS moderno usando `color-mix(in srgb, var(--c-primario) 20%, transparent)`. Así, cambiar un solo color hexadecimal en `site.json` recalcula toda la paleta de sombras, chips y gradientes sin tocar el CSS.

---

## 2. Motor 3D en Dos Fases (Rendimiento y Ahorro de Datos)

Para evitar que la librería `three` (~150 KB comprimida) bloquee el renderizado inicial (*Largest Contentful Paint* - LCP) en celulares con datos móviles, el motor 3D está dividido en dos módulos independientes:

### Fase 1: Guardián ligero ([hero3d-cargador.ts](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/scripts/hero3d-cargador.ts) — 2.4 KB)
Antes de descargar un solo byte de Three.js, el cargador evalúa cinco condiciones del dispositivo:
1. `prefers-reduced-motion: reduce` **no** está activo.
2. `navigator.connection?.saveData` **no** es `true` (modo ahorro de datos desactivado).
3. La red efectiva **no** es `2g` ni `slow-2g`.
4. `navigator.deviceMemory` es `>= 2 GB` (si el navegador reporta el dato).
5. El navegador soporta contexto `webgl2` o `webgl`.

Si cualquiera falla, el sitio **no descarga Three.js** y muestra el respaldo `.hero__respaldo` (gradientes radiales animados por GPU en CSS puro). Si todas pasan, espera a `requestIdleCallback` para importar dinámicamente la escena.

### Fase 2: Escena procedural ([hero3d-escena.ts](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/scripts/hero3d-escena.ts))
Lee los atributos `data-forma`, `data-intensidad`, `data-colores` y `data-modo` del contenedor HTML y construye una escena 3D 100 % procedural (sin descargas externas de archivos `.glb`):

| Tema | `escena3d.forma` | Geometría Central | Satélites Orbitantes | Efecto en Bucle |
|---|---|---|---|---|
| **Brasa** | `organica` | `IcosahedronGeometry(1.8, 5)` con sombreado plano (`flatShading`) | Octaedros incandescentes + chispas ascendentes (`AdditiveBlending`) | Deformación orgánica senoidal de vértices |
| **Océano** | `burbujas` | `SphereGeometry(1.7, 64, 48)` translúcida (`roughness: 0.12`) | Esferas cristalinas + microburbujas flotantes | Ondulación suave acuática |
| **Bosque** | `hojas` | `TorusKnotGeometry(1.25, 0.38, 180, 24)` | Elipsoides aplanados (hojas) + polen descendente | Rotación orgánica + parallax con puntero y scroll |

### Control de Consumo de Batería y GPU
- `powerPreference: 'low-power'` y `devicePixelRatio` limitado a `1.75`.
- **`IntersectionObserver` + `visibilitychange`**: cuando el usuario hace scroll hacia la carta o cambia de pestaña, `renderer.setAnimationLoop(null)` detiene por completo el uso de GPU/CPU.

---

## 3. Microinteracciones 3D y Scroll sin Librerías Pesadas

- **Tarjetas con inclinación 3D ([tilt.ts](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/scripts/tilt.ts) — 0.7 KB):** Calcula la posición relativa del puntero sobre cada plato o testimonio (`.tilt`) con `requestAnimationFrame` y actualiza `--rx`, `--ry`, `--gx`, `--gy`, proyectando rotación en perspectiva (`perspective(900px)`) y un brillo radial que sigue al cursor. Se desactiva automáticamente en pantallas táctiles (`(hover: hover) and (pointer: fine)`).
- **Animaciones al hacer scroll (CSS Scroll-Driven Animations):** Las clases `.aparecer` y `.cabecera` usan `animation-timeline: view()` y `animation-timeline: scroll()` con `@supports`, logrando transiciones fluidas a 60 fps en el hilo del compositor sin cargar librerías JS de scroll.

---

## 4. Cómo Crear una Nueva Plantilla Sectorial (Fase 4)

1. Crear carpeta `templates/<nuevo-sector>/` con `package.json`, `astro.config.mjs` (leyendo `FORJA_SITE`, `FORJA_PUBLIC`, `FORJA_OUT`, `FORJA_SITE_URL`) y `src/lib/site.ts`.
2. Registrar su ficha en `catalog/templates/<nuevo-sector>.json` cumpliendo `plantillaSchema` de [schema.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/schema.mjs).
3. Crear un sitio de referencia en `sites/demo-<nuevo-sector>/site.json`.
4. Ejecutar `npm run validate && npm run build:sites`.
