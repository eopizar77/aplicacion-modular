// Núcleo del generador Forja: carga catálogo, valida, resuelve tema y ensambla.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  sitioSchema,
  temaSchema,
  plantillaSchema,
  formatearErrores,
  SLUG_RE,
} from './schema.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RUTAS = {
  temas: path.join(ROOT, 'catalog', 'themes'),
  plantillas: path.join(ROOT, 'catalog', 'templates'),
  sitios: path.join(ROOT, 'sites'),
  trabajo: process.env.FORJA_WORK_DIR ? path.resolve(process.env.FORJA_WORK_DIR) : path.join(ROOT, '.forja'),
  salida: path.join(ROOT, 'dist-sites'),
};

const EXT_PERMITIDAS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.gif', '.glb']);
const MAX_ASSET_BYTES = 5 * 1024 * 1024; // 5 MB por archivo

export class ErrorForja extends Error {}

function leerJson(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  } catch (e) {
    throw new ErrorForja(`No se pudo leer JSON: ${path.relative(ROOT, ruta)}\n  ${e.message}`);
  }
}

function asegurarSlug(slug, tipo = 'slug') {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    throw new ErrorForja(`${tipo} inválido: "${slug}" (solo minúsculas, números y guiones)`);
  }
  return slug;
}

/** Garantiza que `destino` quede dentro de `base` (defensa contra path traversal). */
function dentroDe(base, destino) {
  const rel = path.relative(base, destino);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// ---------------------------------------------------------------- catálogo
export function listarIds(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => (d.isFile() && d.name.endsWith('.json')) || d.isDirectory())
    .map((d) => d.name.replace(/\.json$/, ''))
    .filter((id) => SLUG_RE.test(id))
    .sort();
}

export function cargarTema(id) {
  asegurarSlug(id, 'tema');
  const ruta = path.join(RUTAS.temas, `${id}.json`);
  if (!fs.existsSync(ruta)) throw new ErrorForja(`Tema "${id}" no existe en catalog/themes`);
  const r = temaSchema.safeParse(leerJson(ruta));
  if (!r.success) throw new ErrorForja(`Tema "${id}" inválido:\n${formatearErrores(r.error)}`);
  return r.data;
}

export function cargarPlantilla(id) {
  asegurarSlug(id, 'plantilla');
  const ruta = path.join(RUTAS.plantillas, `${id}.json`);
  if (!fs.existsSync(ruta)) throw new ErrorForja(`Plantilla "${id}" no existe en catalog/templates`);
  const r = plantillaSchema.safeParse(leerJson(ruta));
  if (!r.success) throw new ErrorForja(`Plantilla "${id}" inválida:\n${formatearErrores(r.error)}`);
  const dir = path.join(ROOT, r.data.directorio);
  if (!fs.existsSync(dir)) throw new ErrorForja(`Directorio de plantilla no encontrado: ${r.data.directorio}`);
  return { ...r.data, dirAbs: dir };
}

export function listarSitios() {
  if (!fs.existsSync(RUTAS.sitios)) return [];
  return fs
    .readdirSync(RUTAS.sitios, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(RUTAS.sitios, d.name, 'site.json')))
    .map((d) => d.name)
    .filter((n) => SLUG_RE.test(n))
    .sort();
}

// ---------------------------------------------------------------- validación
export function cargarSitio(slug) {
  asegurarSlug(slug);
  const dir = path.join(RUTAS.sitios, slug);
  const ruta = path.join(dir, 'site.json');
  if (!fs.existsSync(ruta)) throw new ErrorForja(`No existe sites/${slug}/site.json`);
  const r = sitioSchema.safeParse(leerJson(ruta));
  if (!r.success) throw new ErrorForja(`Manifiesto de "${slug}" inválido:\n${formatearErrores(r.error)}`);
  if (r.data.slug !== slug) {
    throw new ErrorForja(`El slug del manifiesto ("${r.data.slug}") no coincide con la carpeta ("${slug}")`);
  }
  // Verificar que las imágenes referenciadas existan
  const refs = recolectarAssets(r.data);
  for (const ref of refs) {
    const abs = path.join(dir, ref);
    if (!dentroDe(dir, abs)) throw new ErrorForja(`Ruta fuera del sitio: ${ref}`);
    if (!fs.existsSync(abs)) throw new ErrorForja(`Imagen referenciada no existe: sites/${slug}/${ref}`);
  }
  return { manifiesto: r.data, dir };
}

function recolectarAssets(m) {
  const out = [];
  if (m.negocio.logo) out.push(m.negocio.logo);
  if (m.seo?.imagen) out.push(m.seo.imagen);
  for (const g of m.secciones?.galeria ?? []) out.push(g.src);
  return out;
}

/** Une el tema del catálogo con las personalizaciones del cliente. */
export function resolverSitio(slug) {
  const { manifiesto, dir } = cargarSitio(slug);
  const plantilla = cargarPlantilla(manifiesto.plantilla);
  const temaBase = cargarTema(manifiesto.tema);
  const tema = {
    ...temaBase,
    colores: { ...temaBase.colores, ...(manifiesto.personalizacion?.colores ?? {}) },
  };
  const { $schema, personalizacion, ...resto } = manifiesto;
  const resuelto = {
    ...resto,
    tema,
    plantillaInfo: { id: plantilla.id, version: plantilla.version },
    generado: { fecha: new Date().toISOString(), generador: 'forja@0.1.0' },
  };
  return { resuelto, plantilla, dirSitio: dir };
}

// ---------------------------------------------------------------- assets
export async function validarAssetBuffer(nombre, buffer) {
  if (typeof nombre !== 'string' || !/^[a-zA-Z0-9._-]+\.(png|jpe?g|webp|avif|svg|gif)$/.test(nombre)) {
    return 'nombre o extensión de archivo no permitidos (usa png, jpg, webp, avif, svg o gif)';
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return 'archivo vacío';
  if (buffer.length > MAX_ASSET_BYTES) {
    return `supera 5 MB (${(buffer.length / 1048576).toFixed(1)} MB)`;
  }
  const ext = path.extname(nombre).toLowerCase();
  if (ext === '.svg') {
    const txt = buffer.toString('utf-8');
    if (/<script|\son[a-z]+\s*=|javascript:|<foreignObject|<iframe/i.test(txt)) {
      return 'SVG con contenido activo (script/eventos) — rechazado por seguridad';
    }
  }
  return null;
}

async function validarAsset(abs) {
  const ext = path.extname(abs).toLowerCase();
  if (!EXT_PERMITIDAS.has(ext)) return `extensión no permitida (${ext})`;
  const st = await fsp.stat(abs);
  if (st.size > MAX_ASSET_BYTES) return `supera 5 MB (${(st.size / 1048576).toFixed(1)} MB)`;
  if (ext === '.svg') {
    const txt = await fsp.readFile(abs, 'utf-8');
    if (/<script|\son[a-z]+\s*=|javascript:|<foreignObject|<iframe/i.test(txt)) {
      return 'SVG con contenido activo (script/eventos) — rechazado por seguridad';
    }
  }
  return null;
}

async function copiarDir(origen, destino, { validar = false } = {}) {
  if (!fs.existsSync(origen)) return 0;
  await fsp.mkdir(destino, { recursive: true });
  let n = 0;
  for (const ent of await fsp.readdir(origen, { withFileTypes: true })) {
    if (ent.isSymbolicLink()) continue; // nunca seguir enlaces simbólicos
    const o = path.join(origen, ent.name);
    const d = path.join(destino, ent.name);
    if (ent.isDirectory()) n += await copiarDir(o, d, { validar });
    else if (ent.isFile()) {
      if (validar) {
        const err = await validarAsset(o);
        if (err) throw new ErrorForja(`Asset rechazado ${path.relative(ROOT, o)}: ${err}`);
      }
      await fsp.copyFile(o, d);
      n++;
    }
  }
  return n;
}

/** Prepara .forja/<slug>/ con el JSON resuelto y la carpeta public combinada. */
export async function prepararTrabajo(slug) {
  const { resuelto, plantilla, dirSitio } = resolverSitio(slug);
  const trabajo = path.join(RUTAS.trabajo, slug);
  await fsp.rm(trabajo, { recursive: true, force: true });
  const publico = path.join(trabajo, 'public');
  await copiarDir(path.join(plantilla.dirAbs, 'public'), publico);
  const nAssets = await copiarDir(path.join(dirSitio, 'assets'), path.join(publico, 'assets'), {
    validar: true,
  });
  const rutaJson = path.join(trabajo, 'site.resolved.json');
  await fsp.writeFile(rutaJson, JSON.stringify(resuelto, null, 2), 'utf-8');
  return { resuelto, plantilla, trabajo, publico, rutaJson, nAssets };
}

// ---------------------------------------------------------------- astro
function binAstro(dirPlantilla) {
  // Busca el paquete astro (local a la plantilla o elevado al root por workspaces)
  // y lee su ejecutable desde package.json -> "bin" (cambia entre versiones mayores).
  for (const base of [dirPlantilla, ROOT]) {
    const dirPkg = path.join(base, 'node_modules', 'astro');
    const pkgJson = path.join(dirPkg, 'package.json');
    if (!fs.existsSync(pkgJson)) continue;
    const { bin } = leerJson(pkgJson);
    const rel = typeof bin === 'string' ? bin : bin?.astro;
    if (rel && fs.existsSync(path.join(dirPkg, rel))) return path.join(dirPkg, rel);
  }
  throw new ErrorForja('Astro no está instalado. Ejecuta: npm install');
}

function ejecutar(args, opciones) {
  return new Promise((resolve, reject) => {
    // Sin shell: los argumentos nunca se interpretan como comandos.
    // Capturamos stderr/stdout para mostrar la causa exacta si Astro falla en un contenedor.
    const p = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opciones });
    let logSalida = '';
    p.stdout.on('data', (d) => {
      logSalida += d.toString();
    });
    p.stderr.on('data', (d) => {
      const txt = d.toString();
      logSalida += txt;
      process.stderr.write(txt);
    });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else {
        const detalle = logSalida.trim().split('\n').slice(-8).join('\n');
        reject(new ErrorForja(`Astro terminó con código ${code}${detalle ? `:\n${detalle}` : ''}`));
      }
    });
  });
}

export function urlSitio(slug) {
  const dominio = (process.env.DOMINIO_BASE || 'localhost').trim();
  if (!/^[a-z0-9.-]+$/i.test(dominio)) throw new ErrorForja(`DOMINIO_BASE inválido: ${dominio}`);
  const esLocal = dominio === 'localhost';
  const esLan = esLocal || dominio.endsWith('.lan') || dominio.endsWith('.local');
  const esquema = (process.env.ESQUEMA_URL || (esLan ? 'http' : 'https')).trim();
  if (esquema !== 'http' && esquema !== 'https') throw new ErrorForja(`ESQUEMA_URL inválido: ${esquema}`);
  const puerto = esLocal ? `:${process.env.WEB_PORT || 8080}` : '';
  return `${esquema}://${dominio}${puerto}/${slug}`;
}

export async function construirSitio(slug) {
  const t0 = Date.now();
  const prep = await prepararTrabajo(slug);
  const salida = path.join(RUTAS.salida, slug);
  if (!dentroDe(RUTAS.salida, salida)) throw new ErrorForja('Ruta de salida inválida');
  await fsp.rm(salida, { recursive: true, force: true });
  await ejecutar([binAstro(prep.plantilla.dirAbs), 'build'], {
    cwd: prep.plantilla.dirAbs,
    env: {
      ...process.env,
      FORJA_SITE: prep.rutaJson,
      FORJA_PUBLIC: prep.publico,
      FORJA_OUT: salida,
      FORJA_BASE_PATH: `/${slug}`,
      FORJA_SITE_URL: urlSitio(slug),
      ASTRO_TELEMETRY_DISABLED: '1',
    },
  });
  return { slug, salida, segundos: ((Date.now() - t0) / 1000).toFixed(1), url: `/${slug}/`, ...prep };
}

export async function desarrollarSitio(slug) {
  const prep = await prepararTrabajo(slug);
  await ejecutar([binAstro(prep.plantilla.dirAbs), 'dev', '--host', '127.0.0.1'], {
    cwd: prep.plantilla.dirAbs,
    env: {
      ...process.env,
      FORJA_SITE: prep.rutaJson,
      FORJA_PUBLIC: prep.publico,
      ASTRO_TELEMETRY_DISABLED: '1',
    },
  });
}

// ---------------------------------------------------------------- índice
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Página índice (solo para entornos internos): lista los sitios generados. */
export async function escribirIndice(resultados) {
  const filas = resultados
    .map(
      (r) =>
        `<li><a href="/${esc(r.slug)}/">${esc(r.resuelto.negocio.nombre)}</a> <small>${esc(r.slug)} · ${esc(
          r.resuelto.plantillaInfo.id,
        )} · tema ${esc(r.resuelto.tema.id)}</small></li>`,
    )
    .join('\n      ');
  const html = `<!doctype html>
<html lang="es-CO">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Forja Modular · Sitios generados</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0d1117;color:#e6edf3;max-width:760px;margin:3rem auto;padding:0 1.25rem}
    h1{font-size:1.6rem}a{color:#58a6ff;font-weight:600}li{margin:.7rem 0}small{color:#8b949e;display:block}
    code{background:#161b22;padding:.15rem .4rem;border-radius:6px}
  </style>
</head>
<body>
  <h1>⚒️ Forja Modular — sitios generados</h1>
  <p>Generado: ${esc(new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }))}</p>
  <ul>
      ${filas}
  </ul>
  <p><small>Página interna. Desactívala en producción con <code>MOSTRAR_INDICE=false</code>.</small></p>
</body>
</html>`;
  await fsp.mkdir(path.join(RUTAS.salida, '_indice'), { recursive: true });
  await fsp.writeFile(path.join(RUTAS.salida, '_indice', 'index.html'), html, 'utf-8');
}

// ---------------------------------------------------------------- nuevo sitio
export async function crearSitio(slug, { plantilla = 'restaurante', tema, nombre } = {}) {
  asegurarSlug(slug);
  const p = cargarPlantilla(plantilla);
  const t = cargarTema(tema || p.temasRecomendados[0]);
  const destino = path.join(RUTAS.sitios, slug);
  if (fs.existsSync(destino)) throw new ErrorForja(`Ya existe sites/${slug}`);
  if (!p.ejemplo) throw new ErrorForja(`La plantilla "${p.id}" no tiene sitio de ejemplo`);
  const ejemplo = path.join(ROOT, p.ejemplo);
  await copiarDir(ejemplo, destino);
  const rutaJson = path.join(destino, 'site.json');
  const m = leerJson(rutaJson);
  m.slug = slug;
  m.plantilla = p.id;
  m.tema = t.id;
  if (nombre) m.negocio.nombre = String(nombre).slice(0, 80);
  await fsp.writeFile(rutaJson, JSON.stringify(m, null, 2) + '\n', 'utf-8');
  return destino;
}

/** Valida y guarda de forma atómica el manifiesto site.json de un sitio existente. */
export async function guardarSitio(slug, datos) {
  asegurarSlug(slug);
  const dir = path.join(RUTAS.sitios, slug);
  if (!dentroDe(RUTAS.sitios, dir) || !fs.existsSync(dir)) {
    throw new ErrorForja(`El sitio "${slug}" no existe`);
  }
  const r = sitioSchema.safeParse(datos);
  if (!r.success) throw new ErrorForja(`Manifiesto inválido:\n${formatearErrores(r.error)}`);
  if (r.data.slug !== slug) {
    throw new ErrorForja(`El slug del manifiesto ("${r.data.slug}") no puede diferir de "${slug}"`);
  }
  cargarPlantilla(r.data.plantilla);
  cargarTema(r.data.tema);
  for (const ref of recolectarAssets(r.data)) {
    const abs = path.join(dir, ref);
    if (!dentroDe(dir, abs)) throw new ErrorForja(`Ruta fuera del sitio: ${ref}`);
    if (!fs.existsSync(abs)) throw new ErrorForja(`Imagen referenciada no existe: sites/${slug}/${ref}`);
  }
  const rutaTmp = path.join(dir, 'site.json.tmp');
  const rutaFinal = path.join(dir, 'site.json');
  await fsp.writeFile(rutaTmp, JSON.stringify(r.data, null, 2) + '\n', 'utf-8');
  await fsp.rename(rutaTmp, rutaFinal);
  return r.data;
}

/** Lista los archivos disponibles en sites/<slug>/assets/. */
export function listarAssetsSitio(slug) {
  asegurarSlug(slug);
  const dirAssets = path.join(RUTAS.sitios, slug, 'assets');
  if (!fs.existsSync(dirAssets)) return [];
  return fs
    .readdirSync(dirAssets, { withFileTypes: true })
    .filter((d) => d.isFile() && EXT_PERMITIDAS.has(path.extname(d.name).toLowerCase()))
    .map((d) => `assets/${d.name}`)
    .sort();
}

/** Valida y guarda un asset en sites/<slug>/assets/<nombre>. */
export async function guardarAssetSitio(slug, nombre, buffer) {
  asegurarSlug(slug);
  const err = await validarAssetBuffer(nombre, buffer);
  if (err) throw new ErrorForja(`Asset rechazado: ${err}`);
  const dirAssets = path.join(RUTAS.sitios, slug, 'assets');
  await fsp.mkdir(dirAssets, { recursive: true });
  const destino = path.join(dirAssets, nombre);
  if (!dentroDe(dirAssets, destino)) throw new ErrorForja('Nombre de archivo inválido');
  await fsp.writeFile(destino, buffer);
  return `assets/${nombre}`;
}

