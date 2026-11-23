# 05 · Generador CLI y Especificación del Manifiesto

El corazón de **Forja Modular** es su motor declarativo ([generator/src/generate.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/generate.mjs)) y su validador de esquemas ([generator/src/schema.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/src/schema.mjs)). Ningún dato del cliente se concatena jamás como código fuente; todo pasa por un contrato JSON validado con lista blanca (`zod.strict()`).

---

## 1. Referencia del CLI `forja`

Ejecutable desde [generator/bin/forja.mjs](file:///d:/piza77/proyectos/APLICACION__MODULAR/generator/bin/forja.mjs) mediante `npm run forja -- <comando>`:

| Comando | Argumentos | Qué hace internamente |
|---|---|---|
| `list` | *(ninguno)* | Recorre `catalog/templates`, `catalog/themes` y `sites/`, valida sus metadatos e imprime la tabla de piezas disponibles. |
| `validate` | `<slug>` o `--all` | Valida `sites/<slug>/site.json`, el tema asignado, la plantilla y verifica que cada imagen referenciada exista y no salga de su directorio. Devuelve código de salida `1` si hay cualquier fallo. |
| `build` | `<slug>` o `--all` | Ejecuta `prepararTrabajo()` (crea `.forja/<slug>/site.resolved.json` y copia assets validando tamaño `<= 5 MB` y ausencia de XSS en SVG) e invoca `astro build` con `spawn(..., { shell: false })`. |
| `dev` | `<slug>` | Prepara `.forja/<slug>/` y lanza `astro dev --host 127.0.0.1`. |
| `new` | `<slug> [--plantilla id] [--tema id] [--nombre "..."]` | Crea `sites/<slug>/` a partir del ejemplo de la plantilla con el slug, tema y nombre ya configurados. |

---

## 2. Estructura de `sites/<slug>/site.json`

Todo manifiesto de cliente sigue esta estructura exacta:

### 2.1 Campos de Raíz

| Campo | Tipo | Obligatorio | Regla de Validación | Descripción |
|---|---|---|---|---|
| `slug` | `string` | Sí | `/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/` | Identificador único; debe coincidir exactamente con el nombre de la carpeta en `sites/<slug>` y será el subdominio del sitio. |
| `plantilla` | `string` | Sí | ID existente en `catalog/templates/` | Plantilla a utilizar (ej. `"restaurante"`). |
| `tema` | `string` | Sí | ID existente en `catalog/themes/` | Tema base de diseño (ej. `"brasa"`, `"oceano"`, `"bosque"`). |
| `personalizacion` | `object` | No | `{ colores?: Partial<Colores> }` | Permite sobreescribir uno o más colores hexadecimales (`#RGB` o `#RRGGBB`) del tema elegido sin crear un tema nuevo. |
| `negocio` | `object` | Sí | Ver sección 2.2 | Datos principales de la empresa. |
| `secciones` | `object` | No | Ver sección 2.3 | Contenido de las secciones de la página (`nosotros`, `menu`, `galeria`, `testimonios`). |
| `seo` | `object` | No | `{ titulo?: <=70, descripcion?: <=160, imagen?: asset }` | Metadatos para motores de búsqueda y Open Graph (WhatsApp/redes). |
| `legal` | `object` | No | `{ responsable?: <=120, emailDatos?: email }` | Razón social y correo oficial para ejercer derechos de Habeas Data (Ley 1581) en `/privacidad/`. |

### 2.2 Objeto `negocio`

| Campo | Tipo | Obligatorio | Regla de Validación | Ejemplo |
|---|---|---|---|---|
| `nombre` | `string` | Sí | `1..80` caracteres | `"La Brasa de Chapinero"` |
| `eslogan` | `string` | No | `<= 120` caracteres | `"Carnes a la leña, sabor de toda la vida"` |
| `descripcion` | `string` | Sí | `1..400` caracteres | Resumen del negocio para SEO y ficha JSON-LD. |
| `categoria` | `string` | No | `<= 60` caracteres | `"Asadero · Parrilla"` |
| `nit` | `string` | No | `/^[0-9.\-]{5,20}$/` | `"901.234.567-8"` |
| `logo` | `string` | No | `assets/<archivo>.(png\|jpg\|webp\|avif\|svg\|gif)` | `"assets/logo.svg"` |
| `ciudad` | `string` | Sí | `1..60` caracteres | `"Bogotá D.C."` |
| `direccion` | `string` | Sí | `1..140` caracteres | `"Calle 60 # 9-23"` |
| `barrio` | `string` | No | `<= 60` caracteres | `"Chapinero"` |
| `telefono` | `string` | No | `/^\+?[0-9 ()-]{7,20}$/` | `"+57 601 000 0000"` |
| `whatsapp` | `string` | No | `/^[0-9]{10,15}$/` (solo dígitos con indicativo país) | `"573001234567"` |
| `email` | `string` | No | Email válido `<= 120` caracteres | `"contacto@midominio.co"` |
| `rangoPrecios` | `enum` | No | `"$" \| "$$" \| "$$$" \| "$$$$"` | `"$$"` |
| `redes` | `object` | No | URLs estrictamente `https://` (`instagram`, `facebook`, `tiktok`) | `{"instagram": "https://www.instagram.com/mitienda"}` |
| `horarios` | `array` | No | Máx. 10 filas `{ dias: <=40, horas: <=40 }` | `[{"dias": "Lunes a viernes", "horas": "12:00 – 22:00"}]` |
| `mapa` | `object` | No | `{ consulta: <=200, mostrarMapa?: boolean }` | `{"consulta": "Calle 60 # 9-23, Bogotá", "mostrarMapa": true}` |

### 2.3 Objeto `secciones`

- **`nosotros`**:
  - `titulo` (`1..80`), `texto` (`1..1200`, soporta saltos de línea `\n`), `datos` (hasta 4 tarjetas `{ valor: <=12, etiqueta: <=40 }`).
- **`menu`**:
  - `titulo` (`1..80`), `subtitulo` (`<=200`), `categorias` (de 1 a 12 categorías, cada una con `nombre` y `items` de 1 a 40 platos: `{ nombre: <=80, descripcion?: <=240, precio: int >= 0, destacado?: boolean, etiquetas?: string[] }`).
- **`galeria`**:
  - Hasta 12 fotos `{ src: "assets/...", alt: "Descripción accesible de la imagen" }`.
- **`testimonios`**:
  - Hasta 8 reseñas `{ autor: <=60, texto: <=400, estrellas: 1..5 }`.

---

## 3. Esquema de Temas (`catalog/themes/<id>.json`)

Cada tema define los *Design Tokens* y el comportamiento de la escena 3D:

```json
{
  "id": "brasa",
  "nombre": "Brasa",
  "descripcion": "Oscuro y cálido. Ideal para asaderos, parrillas, hamburgueserías y bares.",
  "modo": "oscuro",
  "colores": {
    "primario": "#E4572E",
    "secundario": "#F3A712",
    "acento": "#FFD166",
    "fondo": "#120E0B",
    "superficie": "#1E1814",
    "texto": "#F7EFE6",
    "textoSuave": "#C9B8A6"
  },
  "tipografia": {
    "titulos": "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
    "cuerpo": "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  },
  "radio": "18px",
  "escena3d": {
    "forma": "organica",
    "intensidad": 1
  }
}
```

> [!IMPORTANT]
> Los campos `tipografia.titulos` y `tipografia.cuerpo` se validan con la expresión regular `/^[\p{L}0-9 ,'"\-]+$/u`. Caracteres como `;`, `{`, `}` o `:` son rechazados inmediatamente para impedir inyección CSS al generar las variables `:root`.
