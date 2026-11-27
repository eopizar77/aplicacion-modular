#!/usr/bin/env node
// Servidor de Forja Studio (Fase 3).
// Reutiliza al 100 % el motor y esquemas de generator/src (Cero Duplicación, Cero dependencias externas adicionales).
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  RUTAS,
  ErrorForja,
  listarIds,
  listarSitios,
  cargarTema,
  cargarPlantilla,
  cargarSitio,
  crearSitio,
  guardarSitio,
  listarAssetsSitio,
  guardarAssetSitio,
  construirSitio,
  escribirIndice,
} from '../../generator/src/generate.mjs';
import {
  auditarYGenerarTomas,
  traducirDireccionCine,
  aprobarBorradorYDisparar1080p,
} from './orchestrator.mjs';
import { auditarSitioWeb } from './auditor.mjs';
import { sincronizarCatalogoQdrant } from './qdrant.mjs';

const DIR_STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_PUBLIC = path.join(DIR_STUDIO, 'public');
const PORT = Number(process.env.STUDIO_PORT || 4322);
const HOST = process.env.STUDIO_HOST || '127.0.0.1';
const STUDIO_TOKEN = (process.env.STUDIO_TOKEN || '').trim();
const MAX_JSON_BYTES = 256 * 1024; // 256 KB para site.json
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB para imágenes

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8',
};

// Semáforo simple para evitar builds concurrentes sobre .forja/ y dist-sites/
let buildEnCurso = false;

function dentroDe(base, destino) {
  const rel = path.relative(base, destino);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function aplicarCabecerasSeguridad(res, esPreview = false) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  );
  // La vista previa (/sites/<slug>/) se embebe dentro del iframe del propio Studio (same-origin).
  res.setHeader('X-Frame-Options', esPreview ? 'SAMEORIGIN' : 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    esPreview
      ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-src https://www.google.com https://maps.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
}

function responderJson(res, codigo, obj) {
  aplicarCabecerasSeguridad(res, false);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(obj));
}

function compararSeguro(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function leerCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  for (const par of raw.split(';')) {
    const idx = par.indexOf('=');
    if (idx > 0) {
      const k = par.slice(0, idx).trim();
      const v = par.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

/** Verifica STUDIO_TOKEN si fue configurado en el entorno. */
function estaAutenticado(req) {
  if (!STUDIO_TOKEN) return true;
  const headerToken = req.headers['x-forja-token'];
  if (typeof headerToken === 'string' && compararSeguro(headerToken, STUDIO_TOKEN)) return true;
  const cookies = leerCookies(req);
  if (cookies.forja_token && compararSeguro(cookies.forja_token, STUDIO_TOKEN)) return true;
  return false;
}

/** Exige cabecera anti-CSRF en todas las peticiones mutadoras (POST, PUT, DELETE). */
function verificarCsrf(req) {
  return req.headers['x-forja-csrf'] === '1';
}

function leerCuerpoBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new ErrorForja(`El cuerpo supera el límite permitido (${Math.round(maxBytes / 1024)} KB)`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function leerCuerpoJson(req) {
  const buf = await leerCuerpoBuffer(req, MAX_JSON_BYTES);
  try {
    return JSON.parse(buf.toString('utf-8') || '{}');
  } catch {
    throw new ErrorForja('JSON mal formado en la solicitud');
  }
}

async function servirArchivoEstatico(res, baseDir, relPath, esPreview = false) {
  let limpio = decodeURIComponent(relPath.split('?')[0]).replace(/^\/+/, '');
  if (!limpio || limpio.endsWith('/')) limpio += 'index.html';
  const abs = path.resolve(baseDir, limpio);
  if (!dentroDe(baseDir, abs)) {
    responderJson(res, 403, { error: 'Acceso denegado' });
    return;
  }
  let objetivo = abs;
  if (!fs.existsSync(objetivo) || fs.statSync(objetivo).isDirectory()) {
    const conIndex = path.join(abs, 'index.html');
    if ( dentroDe(baseDir, conIndex) && fs.existsSync(conIndex)) objetivo = conIndex;
    else {
      responderJson(res, 404, { error: 'Recurso no encontrado' });
      return;
    }
  }
  const ext = path.extname(objetivo).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  aplicarCabecerasSeguridad(res, esPreview);
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(objetivo).pipe(res);
}

async function reconstruirIndiceGlobal() {
  const sitios = listarSitios();
  const resultados = [];
  for (const slug of sitios) {
    const dirCompilado = path.join(RUTAS.salida, slug, 'index.html');
    if (fs.existsSync(dirCompilado)) {
      const { manifiesto } = cargarSitio(slug);
      resultados.push({
        slug,
        url: `/${slug}/`,
        resuelto: {
          negocio: manifiesto.negocio,
          plantillaInfo: { id: manifiesto.plantilla },
          tema: { id: manifiesto.tema },
        },
      });
    }
  }
  if (resultados.length && process.env.MOSTRAR_INDICE !== 'false') {
    await escribirIndice(resultados);
  }
}

async function manejarApi(req, res, url) {
  const metodo = req.method || 'GET';
  const ruta = url.pathname;

  // Endpoint de estado de sesión / login con STUDIO_TOKEN
  if (ruta === '/api/session' && metodo === 'GET') {
    return responderJson(res, 200, {
      requiereToken: Boolean(STUDIO_TOKEN),
      autenticado: estaAutenticado(req),
    });
  }

  if (ruta === '/api/session' && metodo === 'POST') {
    if (!verificarCsrf(req)) return responderJson(res, 403, { error: 'Falta cabecera CSRF' });
    const body = await leerCuerpoJson(req);
    if (!STUDIO_TOKEN || compararSeguro(body.token || '', STUDIO_TOKEN)) {
      res.setHeader(
        'Set-Cookie',
        `forja_token=${encodeURIComponent(STUDIO_TOKEN)}; HttpOnly; Path=/; SameSite=Strict`,
      );
      return responderJson(res, 200, { autenticado: true });
    }
    return responderJson(res, 401, { error: 'Clave de acceso incorrecta' });
  }

  // A partir de aquí todo endpoint requiere estar autenticado
  if (!estaAutenticado(req)) {
    return responderJson(res, 401, { error: 'No autenticado. Ingresa la clave de Forja Studio.' });
  }
  if (metodo !== 'GET' && !verificarCsrf(req)) {
    return responderJson(res, 403, { error: 'Solicitud bloqueada por protección CSRF' });
  }

  // GET /api/catalog -> plantillas, temas y lista resumida de sitios
  if (ruta === '/api/catalog' && metodo === 'GET') {
    const plantillas = listarIds(RUTAS.plantillas).map((id) => cargarPlantilla(id));
    const temas = listarIds(RUTAS.temas).map((id) => cargarTema(id));
    const sitios = listarSitios().map((slug) => {
      const { manifiesto } = cargarSitio(slug);
      const compilado = fs.existsSync(path.join(RUTAS.salida, slug, 'index.html'));
      return {
        slug,
        nombre: manifiesto.negocio.nombre,
        plantilla: manifiesto.plantilla,
        tema: manifiesto.tema,
        ciudad: manifiesto.negocio.ciudad,
        compilado,
        previewUrl: `/${slug}/`,
      };
    });
    return responderJson(res, 200, { plantillas, temas, sitios });
  }

  // POST /api/sites -> crear sitio nuevo desde plantilla
  if (ruta === '/api/sites' && metodo === 'POST') {
    const body = await leerCuerpoJson(req);
    const slug = String(body.slug || '').trim().toLowerCase();
    await crearSitio(slug, {
      plantilla: body.plantilla || 'restaurante',
      tema: body.tema || 'brasa',
      nombre: body.nombre,
    });
    const { manifiesto } = cargarSitio(slug);
    return responderJson(res, 201, {
      slug,
      manifiesto,
      assets: listarAssetsSitio(slug),
    });
  }

  // POST /api/build-all -> compilar todos los sitios
  if (ruta === '/api/build-all' && metodo === 'POST') {
    if (buildEnCurso) return responderJson(res, 409, { error: 'Ya hay un ensamblaje en curso, espera unos segundos.' });
    buildEnCurso = true;
    try {
      const resultados = [];
      for (const slug of listarSitios()) {
        const r = await construirSitio(slug);
        resultados.push({ slug: r.slug, segundos: r.segundos, previewUrl: `/${r.slug}/` });
      }
      await reconstruirIndiceGlobal();
      return responderJson(res, 200, { ok: true, resultados });
    } finally {
      buildEnCurso = false;
    }
  }

  // Rutas por sitio: /api/sites/:slug[/accion]
  const m = ruta.match(/^\/api\/sites\/([a-z0-9-]+)(?:\/([a-z]+))?$/);
  if (m) {
    const [, slug, accion] = m;

    if (!accion && metodo === 'GET') {
      const { manifiesto } = cargarSitio(slug);
      const compilado = fs.existsSync(path.join(RUTAS.salida, slug, 'index.html'));
      return responderJson(res, 200, {
        slug,
        manifiesto,
        assets: listarAssetsSitio(slug),
        compilado,
        previewUrl: `/${slug}/`,
      });
    }

    if (!accion && metodo === 'PUT') {
      const datos = await leerCuerpoJson(req);
      const guardado = await guardarSitio(slug, datos);
      return responderJson(res, 200, {
        ok: true,
        manifiesto: guardado,
        assets: listarAssetsSitio(slug),
      });
    }

    if (accion === 'build' && metodo === 'POST') {
      if (buildEnCurso) return responderJson(res, 409, { error: 'Ya hay un ensamblaje en curso, espera unos segundos.' });
      buildEnCurso = true;
      try {
        const r = await construirSitio(slug);
        await reconstruirIndiceGlobal();
        return responderJson(res, 200, {
          ok: true,
          slug: r.slug,
          segundos: r.segundos,
          nAssets: r.nAssets,
          previewUrl: `/${r.slug}/`,
        });
      } finally {
        buildEnCurso = false;
      }
    }

    if (accion === 'assets' && metodo === 'POST') {
      const nombre = decodeURIComponent(String(req.headers['x-asset-filename'] || '').trim());
      const buf = await leerCuerpoBuffer(req, MAX_UPLOAD_BYTES);
      const rutaRel = await guardarAssetSitio(slug, nombre, buf);
      return responderJson(res, 201, {
        ok: true,
        asset: rutaRel,
        assets: listarAssetsSitio(slug),
      });
    }
  }

  // Rutas del Puente Orquestador IA (Pilares 1 y 2): /api/sites/:slug/ai/:operacion
  const mAi = ruta.match(/^\/api\/sites\/([a-z0-9-]+)\/ai\/([a-z0-9-]+)$/);
  if (mAi && metodo === 'POST') {
    const [, slug, operacion] = mAi;
    const { manifiesto } = cargarSitio(slug);
    const body = await leerCuerpoJson(req);

    if (operacion === 'audit-copy') {
      const r = await auditarYGenerarTomas(manifiesto);
      manifiesto.audiovisual = r.audiovisual;
      if (body.aplicarCopy) {
        manifiesto.negocio.eslogan = r.sugerenciasCopy.eslogan;
        manifiesto.seo = { ...(manifiesto.seo || {}), descripcion: r.sugerenciasCopy.descripcionSeo };
      }
      const guardado = await guardarSitio(slug, manifiesto);
      return responderJson(res, 200, {
        ok: true,
        origen: r.origen,
        sugerenciasCopy: r.sugerenciasCopy,
        manifiesto: guardado,
      });
    }

    if (operacion === 'cine-prompt') {
      const r = await traducirDireccionCine(manifiesto, body.ideaOperador, body.formatoSalida);
      manifiesto.audiovisual = {
        ...(manifiesto.audiovisual || {}),
        nivel4DireccionCine: r.nivel4DireccionCine,
        nivel5Animacion: r.nivel5Animacion,
      };
      const guardado = await guardarSitio(slug, manifiesto);
      return responderJson(res, 200, {
        ok: true,
        origen: r.origen,
        manifiesto: guardado,
      });
    }

    if (operacion === 'approve-render') {
      const r = await aprobarBorradorYDisparar1080p(manifiesto, body.aprobadoPor || 'operador-studio');
      manifiesto.audiovisual = {
        ...(manifiesto.audiovisual || {}),
        nivel5Animacion: {
          ...(manifiesto.audiovisual?.nivel5Animacion || {}),
          estado: r.estado,
          aprobadoPor: r.aprobadoPor,
          fechaAprobacion: r.fechaAprobacion,
        },
      };
      const guardado = await guardarSitio(slug, manifiesto);
      return responderJson(res, 200, {
        ok: true,
        ...r,
        manifiesto: guardado,
      });
    }
  }

  // POST /api/qdrant/sync -> indexa plantillas, temas y blueprints MIT/CC0 en Qdrant (:6333)
  if (ruta === '/api/qdrant/sync' && metodo === 'POST') {
    const r = await sincronizarCatalogoQdrant();
    return responderJson(res, 200, { ok: true, ...r });
  }

  // POST /api/audit-url -> ejecuta la auditoría de 4 Pilares sobre cualquier URL externa
  if (ruta === '/api/audit-url' && metodo === 'POST') {
    const body = await leerCuerpoJson(req);
    const reporte = await auditarSitioWeb(body.url, {
      contextoCompetencia: body.contextoCompetencia,
    });
    return responderJson(res, 200, { ok: true, reporte });
  }

  // POST /api/audit-to-site -> crea o actualiza el sitio desde una auditoría y lo ensambla en 3D automáticamente
  if (ruta === '/api/audit-to-site' && metodo === 'POST') {
    if (buildEnCurso) {
      return responderJson(res, 409, { error: 'Ya hay un ensamblaje en curso, espera unos segundos.' });
    }
    const body = await leerCuerpoJson(req);
    const manifiestoPropuesto = body.manifiesto;
    if (!manifiestoPropuesto?.slug) throw new ErrorForja('Falta manifiesto base para crear el sitio');
    const slug = String(manifiestoPropuesto.slug).trim().toLowerCase();
    const dirSitio = path.join(RUTAS.sitios, slug);
    const yaExistia = fs.existsSync(dirSitio);

    if (!yaExistia) {
      await crearSitio(slug, {
        plantilla: manifiestoPropuesto.plantilla || 'restaurante',
        tema: manifiestoPropuesto.tema || 'ejecutivo',
        nombre: manifiestoPropuesto.negocio?.nombre,
      });
    }

    let guardado;
    try {
      guardado = await guardarSitio(slug, { ...manifiestoPropuesto, slug });
    } catch (err) {
      // Rollback: si era un sitio nuevo y falló la validación, no dejamos carpeta huérfana
      if (!yaExistia) await fsp.rm(dirSitio, { recursive: true, force: true });
      throw err;
    }

    buildEnCurso = true;
    try {
      const compilacion = await construirSitio(slug);
      await reconstruirIndiceGlobal();
      return responderJson(res, yaExistia ? 200 : 201, {
        ok: true,
        slug,
        actualizado: yaExistia,
        segundos: compilacion.segundos,
        previewUrl: `/${slug}/`,
        manifiesto: guardado,
      });
    } finally {
      buildEnCurso = false;
    }
  }

  return responderJson(res, 404, { error: `Ruta API no encontrada: ${metodo} ${ruta}` });
}

export function crearServidorStudio() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (url.pathname === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('ok\n');
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        await manejarApi(req, res, url);
        return;
      }

      // Si la ruta corresponde a un sitio compilado en dist-sites/<slug>/..., lo sirve para el iframe de vista previa
      // porque Astro compila con FORJA_BASE_PATH=/<slug>.
      const primerSegmento = url.pathname.split('/').filter(Boolean)[0];
      if (primerSegmento && fs.existsSync(path.join(RUTAS.salida, primerSegmento))) {
        await servirArchivoEstatico(res, RUTAS.salida, url.pathname, true);
        return;
      }

      // Resto de rutas: interfaz web de Forja Studio (studio/public/)
      await servirArchivoEstatico(res, DIR_PUBLIC, url.pathname, false);
    } catch (e) {
      console.error('[forja-studio] Error en solicitud:', req.method, req.url, e?.code || '', e?.message || e);
      const codigo = e instanceof ErrorForja ? 400 : 500;
      const detalleSistema = e?.code ? ` (${e.code})` : '';
      responderJson(res, codigo, {
        error: e instanceof ErrorForja ? e.message : `Error interno del servidor${detalleSistema}`,
      });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Si corremos en Docker con volúmenes ya creados, sincroniza sitios nuevos de /app/.seed que falten
  const dirSeed = path.resolve(DIR_STUDIO, '..', '.seed');
  if (fs.existsSync(dirSeed)) {
    const poblarFaltantes = (origenBase, destinoBase) => {
      if (!fs.existsSync(origenBase)) return;
      fs.mkdirSync(destinoBase, { recursive: true });
      for (const d of fs.readdirSync(origenBase, { withFileTypes: true })) {
        const dest = path.join(destinoBase, d.name);
        if (!fs.existsSync(dest)) {
          fs.cpSync(path.join(origenBase, d.name), dest, { recursive: true });
        }
      }
    };
    try {
      poblarFaltantes(path.join(dirSeed, 'sites'), RUTAS.sitios);
      poblarFaltantes(path.join(dirSeed, 'dist-sites'), RUTAS.salida);
    } catch (err) {
      console.warn('[forja-studio] Aviso al sincronizar semillas:', err.message);
    }
  }

  const srv = crearServidorStudio();
  srv.listen(PORT, HOST, () => {
    console.log(`\n⚒️  Forja Studio activo en http://${HOST}:${PORT}`);
    console.log(`   Autenticación STUDIO_TOKEN: ${STUDIO_TOKEN ? 'ACTIVA' : 'desactivada (modo local)'}\n`);
  });
}
