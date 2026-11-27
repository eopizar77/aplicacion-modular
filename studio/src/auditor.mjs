// Motor de Auditoría Web Integral, Estrategia Digital y CRO (4 Pilares) — Forja Studio.
// Incluye:
//   1. Escudo Anti-SSRF por resolución DNS (bloquea IPs privadas/LAN/loopback en cada redirección).
//   2. Extracción técnica real On-Page SEO + WPO + Seguridad HTTP + Embudos CRO.
//   3. Métricas Core Web Vitals vía Google PageSpeed Insights API (cuando hay cuota/API key disponible).
//   4. Diagnóstico estructurado (Resumen Ejecutivo + 4 Pilares con DAFO + Plan Impacto vs. Esfuerzo)
//      conectado a deepseek_harness y Qdrant, más conversor directo a borrador site.json de Forja.
import dns from 'node:dns/promises';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { ErrorForja } from '../../generator/src/generate.mjs';
import { recomendarPiezasParaSitio, registrarAuditoriaEnQdrant } from './qdrant.mjs';

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB máx
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
const DEEPSEEK_URL = (process.env.DEEPSEEK_HARNESS_URL || 'http://192.168.20.52:3090').replace(/\/$/, '');
const DEEPSEEK_KEY = (process.env.DEEPSEEK_API_KEY || '').trim();
const PAGESPEED_KEY = (process.env.PAGESPEED_API_KEY || '').trim();

// ============================================================================
// 1. ESCUDO ANTI-SSRF (OWASP A10)
// ============================================================================
function esIpPrivadaOReservada(ip) {
  const limpia = ip.replace(/^::ffff:/i, '');
  if (net.isIPv4(limpia)) {
    const p = limpia.split('.').map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local / cloud metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true; // Homelab LAN 192.168.20.x protegida
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT / Tailscale
    if (p[0] >= 224) return true; // multicast / reservada
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === '::' || low === '::1') return true;
    if (low.startsWith('fc') || low.startsWith('fd')) return true; // ULA fc00::/7
    if (low.startsWith('fe8') || low.startsWith('fe9') || low.startsWith('fea') || low.startsWith('feb')) return true;
    return false;
  }
  return true;
}

export async function validarUrlPublica(rawUrl) {
  let u;
  try {
    u = new URL(String(rawUrl || '').trim());
  } catch {
    throw new ErrorForja('URL inválida. Incluye https:// o http:// (ej. https://ejemplo.com)');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new ErrorForja('Solo se permiten protocolos http:// o https://');
  }
  if (u.username || u.password) {
    throw new ErrorForja('No se permiten credenciales incrustadas en la URL');
  }
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.lan') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home')
  ) {
    throw new ErrorForja(`Dominio interno bloqueado por protección Anti-SSRF: ${host}`);
  }
  if (net.isIP(host)) {
    if (esIpPrivadaOReservada(host)) {
      throw new ErrorForja(`Dirección IP privada o reservada bloqueada por seguridad: ${host}`);
    }
    return u;
  }
  let registros;
  try {
    registros = await dns.lookup(host, { all: true });
  } catch {
    throw new ErrorForja(`No se pudo resolver el DNS del dominio: ${host}`);
  }
  if (!registros.length) throw new ErrorForja(`El dominio ${host} no devolvió direcciones IP`);
  for (const r of registros) {
    if (esIpPrivadaOReservada(r.address)) {
      throw new ErrorForja(`SSRF bloqueado: ${host} resuelve a una IP interna (${r.address})`);
    }
  }
  return u;
}

async function descargarHtmlSeguro(urlInicial) {
  let actual = await validarUrlPublica(urlInicial);
  const cadenaRedirects = [];
  const tInicio = performance.now();
  let ttfbMs = 0;

  for (let salto = 0; salto <= MAX_REDIRECTS; salto++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      const tReq = performance.now();
      res = await fetch(actual.href, {
        method: 'GET',
        redirect: 'manual',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'ForjaModularAuditor/0.1 (+https://forja.modular; SEO-WPO-CRO)',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-CO,es;q=0.9,en;q=0.7',
        },
      });
      ttfbMs = Math.round(performance.now() - tReq);
    } catch (e) {
      clearTimeout(timer);
      throw new ErrorForja(`No se pudo conectar con ${actual.hostname}: ${e.name === 'AbortError' ? 'tiempo de espera agotado (12s)' : e.message}`);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      clearTimeout(timer);
      if (salto === MAX_REDIRECTS) throw new ErrorForja('Demasiadas redirecciones (> 4)');
      const siguiente = new URL(res.headers.get('location'), actual.href);
      cadenaRedirects.push({ de: actual.href, a: siguiente.href, status: res.status });
      actual = await validarUrlPublica(siguiente.href);
      continue;
    }

    const chunks = [];
    let bytes = 0;
    try {
      for await (const chunk of res.body) {
        bytes += chunk.length;
        if (bytes > MAX_HTML_BYTES) break; // truncamos de forma segura a 2 MB
        chunks.push(chunk);
      }
    } finally {
      clearTimeout(timer);
    }

    const totalMs = Math.round(performance.now() - tInicio);
    const html = Buffer.concat(chunks).toString('utf-8');
    return {
      urlFinal: actual,
      status: res.status,
      cadenaRedirects,
      ttfbMs,
      totalMs,
      htmlBytes: bytes,
      headers: {
        contentType: res.headers.get('content-type') || '',
        contentEncoding: res.headers.get('content-encoding') || 'ninguna',
        cacheControl: res.headers.get('cache-control') || 'ausente',
        server: res.headers.get('server') || 'oculto',
        xPoweredBy: res.headers.get('x-powered-by') || '',
        hsts: Boolean(res.headers.get('strict-transport-security')),
        csp: Boolean(res.headers.get('content-security-policy')),
        xFrameOptions: Boolean(res.headers.get('x-frame-options')),
      },
      html,
    };
  }
  throw new ErrorForja('Flujo de descarga interrumpido');
}

// ============================================================================
// 2. EXTRACCIÓN TÉCNICA REAL (SEO ON-PAGE + WPO + CRO)
// ============================================================================
function limpiarTextoHtml(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extraerAtributoMeta(html, clave, valorClave) {
  const re = new RegExp(`<meta[^>]+${clave}=["']${valorClave}["'][^>]*>`, 'gi');
  const coincidencias = html.match(re) || [];
  return coincidencias
    .map((tag) => {
      const m = tag.match(/content=["']([^"']*)["']/i);
      return m ? limpiarTextoHtml(m[1]) : '';
    })
    .filter(Boolean);
}

export function analizarDomYCabeceras(descarga) {
  const { html, urlFinal, headers, ttfbMs, totalMs, htmlBytes, cadenaRedirects, status } = descarga;

  // --- SEO On-Page ---
  const titulos = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => limpiarTextoHtml(m[1]));
  const metaDesc = extraerAtributoMeta(html, 'name', 'description');
  const metaRobots = extraerAtributoMeta(html, 'name', 'robots')[0] || '';
  const viewport = extraerAtributoMeta(html, 'name', 'viewport')[0] || '';
  const ogTitle = extraerAtributoMeta(html, 'property', 'og:title')[0] || '';
  const ogImage = extraerAtributoMeta(html, 'property', 'og:image')[0] || '';
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : '';
  const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  const htmlLang = langMatch ? langMatch[1].trim() : '';

  // Jerarquía H1-H6
  const encabezados = [];
  for (const m of html.matchAll(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const nivel = Number(m[1][1]);
    const texto = limpiarTextoHtml(m[2]);
    if (texto) encabezados.push({ nivel, texto: texto.slice(0, 140) });
  }
  const conteoH = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  let saltosJerarquia = 0;
  let nivelPrevio = 0;
  for (const h of encabezados) {
    conteoH[`h${h.nivel}`]++;
    if (nivelPrevio > 0 && h.nivel > nivelPrevio + 1) saltosJerarquia++;
    nivelPrevio = h.nivel;
  }

  // Datos estructurados Schema.org
  const schemasDetectados = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(m[1]);
      const items = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
      for (const it of items) {
        if (it?.['@type']) schemasDetectados.push(String(it['@type']));
      }
    } catch {
      schemasDetectados.push('JSON-LD con error de sintaxis');
    }
  }

  // --- WPO y Recursos ---
  const headHtml = (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
  const scriptsTotales = (html.match(/<script\b[^>]*>/gi) || []).length;
  const scriptsBloqueantesHead = [...headHtml.matchAll(/<script\b([^>]*)>/gi)].filter((m) => {
    const attrs = m[1];
    return /\bsrc=/i.test(attrs) && !/\b(defer|async)\b/i.test(attrs) && !/type=["']module["']/i.test(attrs);
  }).length;
  const hojasCss = (html.match(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi) || []).length;

  const imgs = [...html.matchAll(/<img\b([^>]*)>/gi)].map((m) => m[1]);
  let imgsSinAlt = 0;
  let imgsSinLazy = 0;
  let imgsFormatoModerno = 0;
  let imgsSinDimensiones = 0;
  imgs.forEach((attrs, idx) => {
    const altMatch = attrs.match(/\balt=["']([^"']*)["']/i);
    if (!altMatch || !altMatch[1].trim()) imgsSinAlt++;
    if (idx > 1 && !/\bloading=["']lazy["']/i.test(attrs)) imgsSinLazy++;
    if (/\.(webp|avif|svg)(\?|["'\s>])/i.test(attrs)) imgsFormatoModerno++;
    if (!/\bwidth=/i.test(attrs) || !/\bheight=/i.test(attrs)) imgsSinDimensiones++;
  });

  // Dominios externos y analítica/CMS
  const dominiosExternos = new Set();
  for (const m of html.matchAll(/\b(?:src|href)=["'](https?:\/\/[^"'\s>]+)["']/gi)) {
    try {
      const h = new URL(m[1]).hostname.toLowerCase();
      if (h !== urlFinal.hostname.toLowerCase()) dominiosExternos.add(h);
    } catch {
      // ignorar URL malformada en el DOM
    }
  }

  const cms =
    /wp-content|wp-includes/i.test(html)
      ? 'WordPress'
      : /wix\.com|wixstatic/i.test(html)
        ? 'Wix'
        : /shopify/i.test(html)
          ? 'Shopify'
          : /elementor/i.test(html)
            ? 'WordPress + Elementor'
            : /_astro\//i.test(html)
              ? 'Astro'
              : /_next\//i.test(html)
                ? 'Next.js'
                : 'Personalizado / No identificado';

  const constructoresPesados = [];
  if (/elementor/i.test(html)) constructoresPesados.push('Elementor');
  if (/divi/i.test(html)) constructoresPesados.push('Divi');
  if (/revslider|slider-revolution/i.test(html)) constructoresPesados.push('Slider Revolution');
  if (/wpbakery|js_composer/i.test(html)) constructoresPesados.push('WPBakery');
  if (/jquery/i.test(html)) constructoresPesados.push('jQuery');

  const analiticaDetectada = [];
  if (/googletagmanager\.com|gtag\(/i.test(html)) analiticaDetectada.push('Google Tag Manager / GA4');
  if (/connect\.facebook\.net|fbq\(/i.test(html)) analiticaDetectada.push('Meta Pixel');
  if (/hotjar|clarity\.ms/i.test(html)) analiticaDetectada.push('Mapas de calor (Hotjar/Clarity)');
  if (/matomo|piwik/i.test(html)) analiticaDetectada.push('Matomo');

  // --- CRO, Contacto y Conversión ---
  const enlaces = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    href: m[1].trim(),
    texto: limpiarTextoHtml(m[2]).slice(0, 80),
  }));
  const tieneWhatsapp = enlaces.some((e) => /wa\.me|whatsapp\.com/i.test(e.href));
  const enlaceWhatsapp = enlaces.find((e) => /wa\.me|whatsapp\.com/i.test(e.href))?.href || '';
  const enlacesTel = enlaces.filter((e) => e.href.startsWith('tel:')).map((e) => e.href.replace(/^tel:/, ''));
  const enlacesMail = enlaces.filter((e) => e.href.startsWith('mailto:')).map((e) => e.href.replace(/^mailto:/, '').split('?')[0]);
  const formularios = (html.match(/<form\b/gi) || []).length;
  const enlacesInsegurosHttp = enlaces.filter((e) => e.href.startsWith('http://')).length;
  const enlacesVaciosHash = enlaces.filter((e) => e.href === '#' || e.href === '').length;

  const ctasDetectados = [
    ...new Set(
      enlaces
        .filter((e) => /cotiz|contact|agend|reserv|whatsapp|llam|asesor|solicita|consulta|presupuesto/i.test(`${e.texto} ${e.href}`))
        .map((e) => e.texto || e.href)
        .filter(Boolean),
    ),
  ].slice(0, 8);

  return {
    urlAuditada: urlFinal.href,
    dominio: urlFinal.hostname,
    statusHttp: status,
    esHttps: urlFinal.protocol === 'https:',
    redirecciones: cadenaRedirects,
    cms: constructoresPesados.length ? `${cms} (${constructoresPesados.join(', ')})` : cms,
    seo: {
      titulo: titulos[0] || '',
      cantidadTagTitle: titulos.length,
      longitudTitulo: (titulos[0] || '').length,
      metaDescription: metaDesc[0] || '',
      cantidadMetaDescription: metaDesc.length,
      longitudMetaDescription: (metaDesc[0] || '').length,
      canonical,
      metaRobots,
      htmlLang,
      viewportConfigurado: Boolean(viewport),
      openGraphCompleto: Boolean(ogTitle && ogImage),
      schemasDetectados,
      conteoEncabezados: conteoH,
      saltosJerarquia,
      h1Textos: encabezados.filter((h) => h.nivel === 1).map((h) => h.texto).slice(0, 5),
      h2Textos: encabezados.filter((h) => h.nivel === 2).map((h) => h.texto).slice(0, 10),
      h3h4Textos: encabezados.filter((h) => h.nivel === 3 || h.nivel === 4).map((h) => h.texto).slice(0, 10),
      enlacesInsegurosHttp,
      enlacesVaciosHash,
    },
    wpo: {
      ttfbMs,
      descargaHtmlMs: totalMs,
      pesoHtmlKb: Number((htmlBytes / 1024).toFixed(1)),
      compresion: headers.contentEncoding,
      cacheControl: headers.cacheControl,
      scriptsTotales,
      scriptsBloqueantesHead,
      hojasCss,
      imagenesTotales: imgs.length,
      imagenesSinAlt: imgsSinAlt,
      imagenesSinLazy: imgsSinLazy,
      imagenesSinDimensiones: imgsSinDimensiones,
      imagenesFormatoModerno: imgsFormatoModerno,
      dominiosTercerosCount: dominiosExternos.size,
      dominiosTercerosMuestra: [...dominiosExternos].slice(0, 10),
      constructoresPesados,
    },
    seguridad: {
      https: urlFinal.protocol === 'https:',
      hsts: headers.hsts,
      csp: headers.csp,
      xFrameOptions: headers.xFrameOptions,
      serverExpuesto: headers.server,
      xPoweredBy: headers.xPoweredBy,
    },
    cro: {
      tieneWhatsapp,
      enlaceWhatsapp,
      telefonos: [...new Set(enlacesTel)].slice(0, 4),
      correos: [...new Set(enlacesMail)].slice(0, 4),
      formularios,
      ctasDetectados,
      analiticaDetectada,
    },
  };
}

// ============================================================================
// 3. CORE WEB VITALS VÍA GOOGLE PAGESPEED INSIGHTS (CERO RAM EN PROXMOX)
// ============================================================================
async function consultarPageSpeed(url, strategy) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 11_000);
  try {
    const qs = new URLSearchParams({ url, strategy, category: 'performance' });
    if (PAGESPEED_KEY) qs.set('key', PAGESPEED_KEY);
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`, {
      signal: ctrl.signal,
    });
    if (!res.ok) return { disponible: false, motivo: `HTTP ${res.status} (cuota pública sin PAGESPEED_API_KEY)` };
    const data = await res.json();
    const audits = data?.lighthouseResult?.audits || {};
    const score = Math.round((data?.lighthouseResult?.categories?.performance?.score ?? 0) * 100);
    return {
      disponible: true,
      score,
      fcp: audits['first-contentful-paint']?.displayValue || 'N/D',
      lcp: audits['largest-contentful-paint']?.displayValue || 'N/D',
      tbt: audits['total-blocking-time']?.displayValue || 'N/D',
      cls: audits['cumulative-layout-shift']?.displayValue || 'N/D',
      speedIndex: audits['speed-index']?.displayValue || 'N/D',
    };
  } catch {
    return { disponible: false, motivo: 'Tiempo de espera agotado o sin acceso a API pública de PageSpeed' };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// 4. PUNTUACIÓN Y DIAGNÓSTICO ESTRATÉGICO (4 PILARES + DAFO + PLAN DE ACCIÓN)
// ============================================================================
function calcularScoreYHallazgos(t, cwvMovil) {
  let score = 100;
  const hallazgos = [];
  const acciones = [];

  // SEO
  if (!t.seo.titulo) {
    score -= 14;
    hallazgos.push('Ausencia crítica de etiqueta `<title>` en la página principal.');
    acciones.push({
      prioridad: 1,
      pilar: 'SEO',
      accion: 'Definir etiqueta `<title>` única (50–60 caracteres) con servicio principal + ciudad (Bogotá/Colombia).',
      impacto: 'Alto',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Mejora inmediata de CTR orgánico e indexación temática en Google.',
    });
  } else if (t.seo.longitudTitulo < 25 || t.seo.longitudTitulo > 65 || t.seo.cantidadTagTitle > 1) {
    score -= 6;
    acciones.push({
      prioridad: 2,
      pilar: 'SEO',
      accion: `Ajustar \`<title>\` actual (${t.seo.longitudTitulo} caracteres, ${t.seo.cantidadTagTitle} etiqueta(s)) al rango óptimo de 50–60 caracteres con palabra clave transaccional.`,
      impacto: 'Alto',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Evita truncamiento en SERP móvil y aumenta clics calificados.',
    });
  }

  if (!t.seo.metaDescription) {
    score -= 12;
    hallazgos.push('Falta etiqueta `<meta name="description">`: Google genera fragmentos automáticos poco persuasivos.');
    acciones.push({
      prioridad: 1,
      pilar: 'SEO / CRO',
      accion: 'Redactar meta descripción persuasiva (140–155 caracteres) con propuesta de valor y llamado a la acción.',
      impacto: 'Alto',
      esfuerzo: 'Bajo',
      resultadoEsperado: '+15 % a +25 % en tasa de clics (CTR) desde resultados de búsqueda.',
    });
  }

  if (t.seo.conteoEncabezados.h1 === 0) {
    score -= 12;
    hallazgos.push('No existe encabezado `<h1>`: el buscador no identifica el tema principal de la página.');
    acciones.push({
      prioridad: 1,
      pilar: 'SEO',
      accion: 'Incluir un único `<h1>` visible en el Hero con la oferta central y ubicación geográfica.',
      impacto: 'Alto',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Claridad semántica para Googlebot y reducción de rebote en los primeros 3 segundos.',
    });
  } else if (t.seo.conteoEncabezados.h1 > 1) {
    score -= 7;
    hallazgos.push(`Multiplicidad de encabezados \`<h1>\` (${t.seo.conteoEncabezados.h1} detectados), diluyendo la jerarquía semántica.`);
    acciones.push({
      prioridad: 2,
      pilar: 'SEO',
      accion: `Consolidar los ${t.seo.conteoEncabezados.h1} encabezados \`<h1>\` en uno solo y convertir los secundarios en \`<h2>\`.`,
      impacto: 'Medio',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Estructura H1–H6 limpia y accesible.',
    });
  }

  if (!t.seo.schemasDetectados.length) {
    score -= 6;
    acciones.push({
      prioridad: 2,
      pilar: 'SEO',
      accion: 'Inyectar datos estructurados `Schema.org` (`ProfessionalService` / `LocalBusiness` / `FAQPage`) en JSON-LD.',
      impacto: 'Medio',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Elegibilidad para resultados enriquecidos (Rich Snippets) y mejor lectura por buscadores IA.',
    });
  }

  if (!t.seo.canonical) {
    score -= 4;
    acciones.push({
      prioridad: 3,
      pilar: 'SEO',
      accion: 'Declarar etiqueta `<link rel="canonical">` autorreferenciada.',
      impacto: 'Medio',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Previene contenido duplicado por parámetros UTM o variantes HTTP/WWW.',
    });
  }

  // WPO
  if (t.wpo.ttfbMs > 800) {
    score -= 10;
    hallazgos.push(`Tiempo de respuesta del servidor (TTFB) elevado: ${t.wpo.ttfbMs} ms (recomendado < 400 ms).`);
    acciones.push({
      prioridad: 1,
      pilar: 'WPO',
      accion: `Migrar de renderizado dinámico (${t.cms}) a arquitectura estática precompilada (Astro SSG en Forja Modular) o caché de borde CDN.`,
      impacto: 'Alto',
      esfuerzo: 'Medio',
      resultadoEsperado: `Bajar el TTFB de ${t.wpo.ttfbMs} ms a < 50 ms y eliminar sobrecarga de base de datos.`,
    });
  }

  if (t.wpo.scriptsBloqueantesHead > 2 || t.wpo.scriptsTotales > 15) {
    score -= 9;
    hallazgos.push(
      `Sobrecarga de JavaScript: ${t.wpo.scriptsTotales} scripts totales (${t.wpo.scriptsBloqueantesHead} bloqueando el renderizado en \`<head>\`).`,
    );
    acciones.push({
      prioridad: 1,
      pilar: 'WPO',
      accion: 'Eliminar plugins/constructores pesados y diferir scripts no críticos (`defer` / islas Astro con `assetsInlineLimit: 0`).',
      impacto: 'Alto',
      esfuerzo: 'Medio',
      resultadoEsperado: 'Mejora directa en FCP, LCP e interactividad móvil en redes 4G.',
    });
  }

  if (t.wpo.imagenesTotales > 0 && (t.wpo.imagenesSinLazy > 2 || t.wpo.imagenesFormatoModerno === 0)) {
    score -= 7;
    acciones.push({
      prioridad: 2,
      pilar: 'WPO',
      accion: `Convertir imágenes a WebP/AVIF, añadir \`width/height\` explícitos (${t.wpo.imagenesSinDimensiones} sin dimensiones) y \`loading="lazy"\` (${t.wpo.imagenesSinLazy} sin diferir).`,
      impacto: 'Alto',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Ahorro del 40 %–70 % en peso de página móvil y eliminación de saltos visuales (CLS).',
    });
  }

  if (t.wpo.imagenesSinAlt > 0) {
    score -= 4;
    acciones.push({
      prioridad: 3,
      pilar: 'SEO / Accesibilidad',
      accion: `Agregar atributos \`alt\` descriptivos a las ${t.wpo.imagenesSinAlt} imágenes que hoy carecen de texto alternativo.`,
      impacto: 'Medio',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Cumplimiento WCAG AA y posicionamiento en Google Imágenes.',
    });
  }

  if (t.wpo.compresion === 'ninguna') {
    score -= 6;
    acciones.push({
      prioridad: 2,
      pilar: 'WPO',
      accion: 'Activar compresión Gzip/Brotli en el servidor HTTP.',
      impacto: 'Alto',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Reducción del ~70 % en transferencia de HTML, CSS y JS.',
    });
  }

  if (cwvMovil?.disponible && cwvMovil.score < 60) {
    score -= 8;
    hallazgos.push(`Rendimiento móvil crítico en PageSpeed (${cwvMovil.score}/100, LCP: ${cwvMovil.lcp}).`);
  }

  // CRO & Seguridad
  if (!t.cro.tieneWhatsapp) {
    score -= 8;
    hallazgos.push('Fricción de conversión: no se detectó botón directo a WhatsApp para atención inmediata en móvil.');
    acciones.push({
      prioridad: 1,
      pilar: 'CRO',
      accion: 'Implementar CTA flotante y contextual de WhatsApp con mensaje prellenado según el servicio consultado.',
      impacto: 'Alto',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Incremento inmediato de leads directos en Colombia (canal preferido B2B y B2C).',
    });
  }

  if (!t.seguridad.csp || !t.seguridad.hsts) {
    score -= 5;
    acciones.push({
      prioridad: 3,
      pilar: 'Seguridad / Confianza',
      accion: 'Configurar cabeceras HTTP `Content-Security-Policy`, `Strict-Transport-Security (HSTS)` y `X-Frame-Options`.',
      impacto: 'Medio',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Blindaje contra XSS/Clickjacking y mayor confianza corporativa.',
    });
  }

  if (!t.cro.analiticaDetectada.length) {
    acciones.push({
      prioridad: 2,
      pilar: 'CRO / Medición',
      accion: 'Implementar analítica sin cookies respetuosa de Ley 1581 (ej. Matomo self-hosted en Proxmox o Plausible) y verificar Google Search Console.',
      impacto: 'Medio',
      esfuerzo: 'Bajo',
      resultadoEsperado: 'Visibilidad real de embudos de abandono y palabras clave de conversión sin banners invasivos.',
    });
  }

  score = Math.max(12, Math.min(98, score));
  const estadoGeneral = score >= 80 ? 'Óptimo' : score >= 55 ? 'Regular' : 'Crítico';

  if (hallazgos.length < 3) {
    if (t.wpo.pesoHtmlKb > 80) {
      hallazgos.push(`HTML inicial pesado (${t.wpo.pesoHtmlKb} KB) con ${t.wpo.hojasCss} hojas de estilo externas.`);
    }
    if (!t.seo.openGraphCompleto) {
      hallazgos.push('Metadatos Open Graph incompletos: al compartir el enlace por WhatsApp o LinkedIn pierde impacto visual.');
    }
    if (!t.seguridad.csp) {
      hallazgos.push('Ausencia de política `Content-Security-Policy` (CSP) y endurecimiento de cabeceras HTTP.');
    }
  }

  return {
    score,
    estadoGeneral,
    top3Hallazgos: hallazgos.slice(0, 3),
    planAccion: acciones.sort((a, b) => a.prioridad - b.prioridad),
  };
}

async function enriquecerCompetenciaConIA(tecnico, contextoExtra) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (DEEPSEEK_KEY) headers.Authorization = `Bearer ${DEEPSEEK_KEY}`;
    const res = await fetch(`${DEEPSEEK_URL}/v1/chat/completions`, {
      method: 'POST',
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Eres un Consultor Senior en Estrategia Digital y CRO en Colombia. Devuelve SOLO un JSON con: propuestaValorActual (string), brechasKeywords (array de 4 strings), rivalesCategorias ({directos, indirectos, legacy, disruptores}), dafo ({fortalezas: string[], debilidades: string[], oportunidades: string[], amenazas: string[]}), whitespaceMercado (string), embudoFricciones (array de 3 strings).',
          },
          {
            role: 'user',
            content: JSON.stringify({
              dominio: tecnico.dominio,
              titulo: tecnico.seo.titulo,
              metaDescription: tecnico.seo.metaDescription,
              h1: tecnico.seo.h1Textos,
              h2: tecnico.seo.h2Textos,
              ctas: tecnico.cro.ctasDetectados,
              contextoUsuario: contextoExtra || '',
            }),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content;
    return txt ? JSON.parse(txt) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function construirEstrategiaDeterminista(t, ia) {
  const textoCompleto = `${t.seo.titulo} ${t.seo.metaDescription} ${t.seo.h1Textos.join(' ')} ${t.seo.h2Textos.join(' ')}`.toLowerCase();
  const esAuditoriaContable = /audit|revisor|contab|niif|tribut|impuest|financ|aseguramiento/.test(textoCompleto);

  const porDefecto = esAuditoriaContable
    ? {
        sectorInferido: 'Auditoría, Revisoría Fiscal y Consultoría Contable/Tributaria (B2B Colombia)',
        propuestaValorActual:
          'Firma colombiana enfocada en servicios de revisoría fiscal, auditoría financiera/interna, consultoría NIIF y asesoría tributaria empresarial.',
        brechasKeywords: [
          'revisoría fiscal en Bogotá precios / cotización empresas',
          'auditoría externa NIIF para PYMES y S.A.S. en Colombia',
          'consultoría tributaria DIAN y planeación fiscal corporativa',
          'auditoría de control interno y cumplimiento normativo Bogotá',
        ],
        rivalesCategorias: {
          directos: 'Firmas medianas nacionales de revisoría fiscal y outsourcing contable en Bogotá/Medellín.',
          indirectos: 'Contadores independientes y software contable en la nube con asesoría incluida (Siigo, Alegra, World Office).',
          legacy: 'Big Four (Deloitte, PwC, EY, KPMG) y redes internacionales (BDO, Grant Thornton, Baker Tilly) con tarifas altas.',
          disruptores: 'Boutiques digitales B2B con cotizadores interactivos, diagnósticos tributarios express y atención inmediata por WhatsApp.',
        },
        dafo: {
          fortalezas: [
            `Dominio corporativo propio .com.co (${t.dominio}) con presencia institucional establecida.`,
            `Oferta especializada en servicios de alta recurrencia legal obligatoria en Colombia (Revisoría Fiscal, Auditoría, Tributaria).`,
          ],
          debilidades: [
            `Arquitectura tecnológica basada en ${t.cms} con ${t.wpo.scriptsTotales} scripts y TTFB de ${t.wpo.ttfbMs} ms que penaliza la experiencia móvil.`,
            t.seo.metaDescription
              ? 'Jerarquía de aterrizaje generalista sin páginas de conversión dedicadas por servicio/industria.'
              : 'Ausencia o debilidad en metadatos On-Page clave para captar búsquedas de alta intención comercial.',
          ],
          oportunidades: [
            'Capturar empresas S.A.S. y medianas que buscan rigor técnico cercano sin pagar tarifas de Big Four.',
            'Incorporar calculadora/diagnóstico rápido de obligatoriedad de Revisoría Fiscal (topes de activos/ingresos en UVT/SMMLV) como imán de leads (CRO).',
          ],
          amenazas: [
            'Competidores B2B que ya posicionan artículos de calendario tributario DIAN y captan el tráfico orgánico informativo y transaccional.',
            'Pérdida de prospectos ejecutivos que consultan desde el celular y abandonan si la carga supera los 3 segundos.',
          ],
        },
        whitespaceMercado:
          'Posicionarse como la firma de auditoría ágil y moderna en Colombia: web ultrarrápida (< 1s en Astro), diagnóstico interactivo de topes de Revisoría Fiscal en 30 segundos y agendamiento directo con socio auditor vía WhatsApp/Calendario.',
        embudoFricciones: [
          'El visitante ejecutivo llega a una portada institucional extensa sin un diferenciador cuantificable en el primer pantallazo (años de experiencia, sectores auditados, tiempos de respuesta).',
          'Los formularios tradicionales de contacto B2B generan alta fricción frente a un botón de diagnóstico rápido o contacto directo preclasificado.',
          'Falta prueba social estructurada verificable (casos de éxito por industria, certificaciones, logos o indicadores de cumplimiento).',
        ],
      }
    : {
        sectorInferido: 'Servicios / Comercio Empresarial en Colombia',
        propuestaValorActual: t.seo.metaDescription || t.seo.titulo || `Presencia digital de ${t.dominio}.`,
        brechasKeywords: [
          `${t.seo.h1Textos[0] || t.dominio} en Bogotá`,
          `cotización y precios de ${t.seo.h2Textos[0] || 'servicios principales'}`,
          `mejor empresa de ${t.seo.h2Textos[1] || 'soluciones'} en Colombia`,
          `atención inmediata y asesoría especializada`,
        ],
        rivalesCategorias: {
          directos: 'Empresas locales del mismo nicho con posicionamiento en Google Maps y búsqueda orgánica.',
          indirectos: 'Directorios comerciales, marketplaces y perfiles activos en Instagram/LinkedIn.',
          legacy: 'Líderes tradicionales del sector con alta autoridad de dominio histórica.',
          disruptores: 'Competidores digitales con sitios rápidos mobile-first y atención automatizada en WhatsApp.',
        },
        dafo: {
          fortalezas: [`Dominio propio activo (${t.dominio}) sobre HTTPS (${t.esHttps ? 'Sí' : 'No'}).`],
          debilidades: [`Stack actual (${t.cms}) con ${t.wpo.scriptsTotales} scripts y margen claro de mejora en WPO/SEO On-Page.`],
          oportunidades: ['Migrar a experiencia instantánea en Forja Modular con embudo directo a WhatsApp y Schema.org completo.'],
          amenazas: ['Incremento del costo por clic (CPC) y pérdida de visibilidad orgánica frente a sitios técnicamente optimizados.'],
        },
        whitespaceMercado:
          'Diferenciación mediante velocidad extrema en móviles, claridad de precios/alcance y contacto sin fricción en menos de 2 clics.',
        embudoFricciones: [
          'Propuesta de valor poco específica en el primer pantallazo móvil (Above the Fold).',
          'Ausencia de llamados a la acción contextuales al final de cada bloque de servicio.',
          'Falta de elementos de prueba social cuantificables cerca del punto de contacto.',
        ],
      };

  return {
    origenEstrategia: ia ? 'deepseek_harness' : 'motor_consultor_forja',
    ...porDefecto,
    ...(ia || {}),
  };
}

/** Construye un manifiesto válido de Forja Modular pre-poblado con los datos reales extraídos de la URL auditada. */
function construirBorradorForja(t, recomendacionQdrant) {
  const slugLimpio = t.dominio
    .replace(/^www\./i, '')
    .split('.')[0]
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const slugBase = slugLimpio.length >= 2 ? slugLimpio : 'sitio-auditado';

  const parteTitulo = t.seo.titulo
    .replace(/^inicio\s*[-|–—:]\s*/i, '')
    .split(/[|\-–—]/)[0]
    .trim();
  const nombreLimpio = (parteTitulo || t.dominio).trim().slice(0, 80);

  const temaCandidato = recomendacionQdrant?.recomendaciones?.[0]?.temaSugerido || 'ejecutivo';
  const temasValidos = new Set(['brasa', 'oceano', 'bosque', 'ejecutivo']);
  const temaElegido = temasValidos.has(temaCandidato) ? temaCandidato : 'ejecutivo';

  const waDigitos = (t.cro.enlaceWhatsapp.match(/(\d{10,15})/) || [])[1] || undefined;
  const telDecodificado = decodeURIComponent(t.cro.telefonos[0] || '').trim();
  const telValido = /^\+?[0-9 ()-]{7,20}$/.test(telDecodificado) ? telDecodificado : undefined;
  const mailDecodificado = decodeURIComponent(t.cro.correos[0] || '').trim();
  const mailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailDecodificado) && mailDecodificado.length <= 120
    ? mailDecodificado
    : undefined;
  const candidatosServicios = [...t.seo.h2Textos, ...(t.seo.h3h4Textos || [])].filter(
    (s) => s.length > 3 && !/^sede\b|^inicio\b|^contacto\b/i.test(s),
  );
  const serviciosExtraidos = (
    candidatosServicios.length
      ? candidatosServicios
      : ['Servicio Principal', 'Consultoría Especializada', 'Acompañamiento Integral']
  )
    .slice(0, 6)
    .map((s) => ({
      nombre: s.slice(0, 80),
      descripcion: `Servicio profesional optimizado con atención directa y respaldo especializado.`,
      precio: 0,
      destacado: false,
    }));
  if (serviciosExtraidos[0]) serviciosExtraidos[0].destacado = true;

  return {
    slugSugerido: `${slugBase}-v2`,
    temaSugerido: temaElegido,
    plantillaSugerida: 'restaurante',
    manifiestoBase: {
      slug: `${slugBase}-v2`,
      plantilla: 'restaurante',
      tema: temaElegido,
      negocio: {
        nombre: nombreLimpio,
        eslogan: (t.seo.h1Textos[0] || 'Excelencia, confianza y resultados medibles').slice(0, 120),
        descripcion: (
          t.seo.metaDescription ||
          `${nombreLimpio}: soluciones especializadas en Bogotá y Colombia con atención ágil y estándares de calidad.`
        ).slice(0, 400),
        categoria: 'Firma Especializada · Colombia',
        ciudad: 'Bogotá D.C.',
        direccion: 'Atención corporativa en Bogotá y toda Colombia',
        ...(telValido && { telefono: telValido }),
        ...(waDigitos && { whatsapp: waDigitos }),
        ...(mailValido && { email: mailValido }),
        mapa: {
          consulta: `${nombreLimpio}, Bogotá, Colombia`,
          mostrarMapa: true,
        },
      },
      secciones: {
        nosotros: {
          titulo: `Por qué elegir a ${nombreLimpio}`,
          texto:
            'Versión modernizada en Forja Modular con carga instantánea, jerarquía SEO limpia y experiencia móvil sin fricción.',
          datos: [
            { valor: '< 1s', etiqueta: 'carga optimizada' },
            { valor: '100%', etiqueta: 'cumplimiento técnico' },
          ],
        },
        menu: {
          titulo: 'Portafolio de Servicios',
          subtitulo: 'Conoce nuestras líneas de atención y solicita una propuesta personalizada.',
          categorias: [
            {
              nombre: 'Líneas Principales',
              items: serviciosExtraidos,
            },
          ],
        },
      },
      seo: {
        titulo: `${nombreLimpio} | Especialistas en Bogotá y Colombia`.slice(0, 70),
        descripcion: (
          t.seo.metaDescription ||
          `Conoce los servicios de ${nombreLimpio} en Colombia. Solicita diagnóstico o cotización inmediata.`
        ).slice(0, 160),
      },
      legal: {
        responsable: nombreLimpio,
        ...(mailValido && { emailDatos: mailValido }),
      },
    },
  };
}

/** Genera el documento Markdown completo siguiendo estrictamente el formato de los 4 Pilares. */
export function formatearAuditoriaMarkdown(reporte) {
  const { resumenEjecutivo: re, tecnico: t, pageSpeed: ps, estrategia: est, qdrant, planAccion, datosExternosRequeridos } =
    reporte;

  const filasCwv = (etiqueta, d) =>
    d?.disponible
      ? `| **${etiqueta}** | ${d.score}/100 | ${d.fcp} | ${d.lcp} | ${d.tbt} | ${d.cls} |`
      : `| **${etiqueta}** | *Pendiente API Key* | — | — | — | *(Nota: ${d?.motivo || 'N/D'})* |`;

  const filasPlan = planAccion
    .map(
      (a, i) =>
        `| ${i + 1} | **${a.pilar}** | ${a.accion} | **${a.impacto}** | ${a.esfuerzo} | ${a.resultadoEsperado} |`,
    )
    .join('\n');

  return `# Auditoría Web Integral, Estrategia Digital y CRO (4 Pilares)

- **Sitio auditado:** ${t.urlAuditada}
- **Fecha de análisis:** ${reporte.fecha}
- **Stack / CMS detectado:** ${t.cms}

---

## 1. Resumen Ejecutivo

- **Estado General del Sitio:** **${re.estadoGeneral.toUpperCase()}** (**${re.score} / 100**)
- **Los 3 Hallazgos Más Importantes:**
  1. ${re.top3Hallazgos[0] || 'Oportunidad de optimización técnica On-Page y velocidad móvil.'}
  2. ${re.top3Hallazgos[1] || 'Fricción en el embudo de conversión móvil.'}
  3. ${re.top3Hallazgos[2] || 'Ausencia de datos estructurados y cabeceras de endurecimiento HTTP.'}
- **Recomendación del Catálogo Vectorial (${qdrant.origen}):** Tema sugerido **\`${qdrant.recomendaciones[0]?.temaSugerido || 'ejecutivo'}\`** (${qdrant.recomendaciones[0]?.nombre || 'Corporativo'}).

---

## 2. Diagnóstico Detallado por Pilar

### Pilar 1: Optimización para Motores de Búsqueda (SEO)

- **Auditoría On-Page (Datos medidos en vivo):**
  - **\`<title>\` (${t.seo.longitudTitulo} caracteres, ${t.seo.cantidadTagTitle} etiqueta):** \`${t.seo.titulo || '(AUSENTE)'}\`
  - **Meta Description (${t.seo.longitudMetaDescription} caracteres, ${t.seo.cantidadMetaDescription} etiqueta):** \`${t.seo.metaDescription || '(AUSENTE)'}\`
  - **Canonical:** \`${t.seo.canonical || '(No declarada)'}\` · **Idioma \`<html lang>\`:** \`${t.seo.htmlLang || '(No declarado)'}\`
  - **Jerarquía de Encabezados:** H1: **${t.seo.conteoEncabezados.h1}** | H2: **${t.seo.conteoEncabezados.h2}** | H3: **${t.seo.conteoEncabezados.h3}** | Saltos de nivel detectados: **${t.seo.saltosJerarquia}**
  - **Textos \`<h1>\` actuales:** ${t.seo.h1Textos.length ? t.seo.h1Textos.map((x) => `*"${x}"*`).join(', ') : '*(Ninguno)*'}
  - **Datos estructurados \`Schema.org\`:** ${t.seo.schemasDetectados.length ? t.seo.schemasDetectados.join(', ') : '*(Ninguno detectado)*'}
  - **Enlaces internos vacíos (\`#\`):** ${t.seo.enlacesVaciosHash} · **Enlaces HTTP inseguros:** ${t.seo.enlacesInsegurosHttp}
- **Posicionamiento y Brechas de Palabras Clave (*Keyword Gaps*):**
  ${est.brechasKeywords.map((k) => `- \`${k}\``).join('\n  ')}
- **Perfil de Enlaces (Backlinks):**
  - *Requerimiento de datos:* ${datosExternosRequeridos.backlinks}

### Pilar 2: Velocidad y Rendimiento Técnico (WPO)

- **Telemetría HTTP directa (Servidor origen):**
  - **TTFB (Time to First Byte):** \`${t.wpo.ttfbMs} ms\` · **Descarga HTML total:** \`${t.wpo.descargaHtmlMs} ms\`
  - **Peso documento HTML:** \`${t.wpo.pesoHtmlKb} KB\` · **Compresión:** \`${t.wpo.compresion}\` · **Cache-Control:** \`${t.wpo.cacheControl}\`
- **Métricas Core Web Vitals (Móvil vs. Escritorio):**

| Dispositivo | Score | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|
${filasCwv('Móvil', ps.movil)}
${filasCwv('Escritorio', ps.escritorio)}

- **Diagnóstico de Cuellos de Botella:**
  - **Scripts totales:** ${t.wpo.scriptsTotales} (**${t.wpo.scriptsBloqueantesHead}** bloqueantes en \`<head>\`) · **Hojas CSS:** ${t.wpo.hojasCss}.
  - **Imágenes:** ${t.wpo.imagenesTotales} totales · **${t.wpo.imagenesSinAlt}** sin \`alt\` · **${t.wpo.imagenesSinLazy}** sin \`loading="lazy"\` · **${t.wpo.imagenesFormatoModerno}** en formato moderno (WebP/AVIF/SVG).
  - **Dominios externos cargados:** ${t.wpo.dominiosTercerosCount} (${t.wpo.dominiosTercerosMuestra.join(', ') || 'ninguno'}).

### Pilar 3: Análisis de la Competencia y Posicionamiento

- **Propuesta de Valor Percibida:** ${est.propuestaValorActual}
- **Categorización de Rivales:**
  - **Directos:** ${est.rivalesCategorias.directos}
  - **Indirectos:** ${est.rivalesCategorias.indirectos}
  - **Consolidados (*Legacy*):** ${est.rivalesCategorias.legacy}
  - **Disruptores:** ${est.rivalesCategorias.disruptores}
- **Matriz DAFO (SWOT):**

| Fortalezas (Internas) | Debilidades (Internas) |
|---|---|
| ${est.dafo.fortalezas.join('<br>• ')} | ${est.dafo.debilidades.join('<br>• ')} |
| **Oportunidades (Externas)** | **Amenazas (Externas)** |
| ${est.dafo.oportunidades.join('<br>• ')} | ${est.dafo.amenazas.join('<br>• ')} |

- **Espacio Vacío de Mercado (*Whitespace*):** ${est.whitespaceMercado}

### Pilar 4: Análisis de Tráfico y Comportamiento (CRO)

- **Instrumentación y Analítica Detectada en Código:** ${t.cro.analiticaDetectada.length ? t.cro.analiticaDetectada.join(', ') : '*(Ninguna herramienta de analítica detectada en el HTML público)*'}.
- **Canales de Conversión Activos:**
  - **WhatsApp directo:** ${t.cro.tieneWhatsapp ? `Sí (${t.cro.enlaceWhatsapp})` : '**No detectado**'}
  - **Teléfonos clicables (\`tel:\`):** ${t.cro.telefonos.join(', ') || 'Ninguno'}
  - **Correos clicables (\`mailto:\`):** ${t.cro.correos.join(', ') || 'Ninguno'}
  - **Formularios \`<form>\`:** ${t.cro.formularios} · **CTAs detectados:** ${t.cro.ctasDetectados.join(' · ') || 'Ninguno claro'}
- **Puntos de Fricción en el Embudo:**
  ${est.embudoFricciones.map((f) => `- ${f}`).join('\n  ')}
- **Nota sobre fuentes de tráfico reales:** ${datosExternosRequeridos.trafico}

---

## 3. Plan de Acción Priorizado (Impacto vs. Esfuerzo)

| # | Pilar | Acción Concreta | Impacto | Esfuerzo | Resultado Esperado |
|---|---|---|---|---|---|
${filasPlan}
`;
}

/** Ejecuta la auditoría integral de extremo a extremo sobre una URL pública. */
export async function auditarSitioWeb(rawUrl, opciones = {}) {
  const descarga = await descargarHtmlSeguro(rawUrl);
  const tecnico = analizarDomYCabeceras(descarga);

  const [cwvMovil, cwvEscritorio, iaEstrategia, qdrant] = await Promise.all([
    opciones.omitirPageSpeed ? Promise.resolve({ disponible: false, motivo: 'Omitido' }) : consultarPageSpeed(tecnico.urlAuditada, 'mobile'),
    opciones.omitirPageSpeed ? Promise.resolve({ disponible: false, motivo: 'Omitido' }) : consultarPageSpeed(tecnico.urlAuditada, 'desktop'),
    enriquecerCompetenciaConIA(tecnico, opciones.contextoCompetencia),
    recomendarPiezasParaSitio(
      `${tecnico.seo.titulo} ${tecnico.seo.metaDescription} ${tecnico.seo.h1Textos.join(' ')} ${tecnico.seo.h2Textos.join(' ')} ${(tecnico.seo.h3h4Textos || []).join(' ')} ${opciones.contextoCompetencia || ''}`,
    ),
  ]);

  const evaluacion = calcularScoreYHallazgos(tecnico, cwvMovil);
  const estrategia = construirEstrategiaDeterminista(tecnico, iaEstrategia);
  const borradorForja = construirBorradorForja(tecnico, qdrant);
  const fecha = new Date().toISOString();

  const datosExternosRequeridos = {
    backlinks:
      'La inspección HTTP pública no expone el grafo completo de backlinks; conecta Google Search Console (informe de Enlaces) o Ahrefs Webmaster Tools gratuito para auditar autoridad de dominios de referencia y anchor texts.',
    trafico:
      'Para medir tasa de rebote exacta por canal (Orgánico, Directo, Referido, IA) sin usar cookies invasivas, se recomienda conectar Google Search Console + Matomo self-hosted en Proxmox.',
    cwv: !cwvMovil.disponible
      ? 'Agrega PAGESPEED_API_KEY (gratuita en Google Cloud Console) en tu .env para obtener LCP/CLS de laboratorio en cada consulta sin límites de cuota.'
      : null,
  };

  const reporte = {
    fecha,
    resumenEjecutivo: {
      score: evaluacion.score,
      estadoGeneral: evaluacion.estadoGeneral,
      top3Hallazgos: evaluacion.top3Hallazgos,
    },
    tecnico,
    pageSpeed: {
      movil: cwvMovil,
      escritorio: cwvEscritorio,
    },
    estrategia,
    qdrant,
    planAccion: evaluacion.planAccion,
    datosExternosRequeridos,
    borradorForja,
  };

  reporte.markdown = formatearAuditoriaMarkdown(reporte);

  await registrarAuditoriaEnQdrant({
    url: tecnico.urlAuditada,
    dominio: tecnico.dominio,
    fecha,
    score: evaluacion.score,
    estadoGeneral: evaluacion.estadoGeneral,
    titulo: tecnico.seo.titulo,
    descripcion: tecnico.seo.metaDescription,
  });

  return reporte;
}
