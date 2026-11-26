// Conector ligero hacia Qdrant (192.168.20.52:6333) sin modelos pesados en RAM.
// Usa proyección vectorial determinista por trigramas/tokens (64 dimensiones, distancia Cosine)
// para indexar plantillas, temas, escenas 3D (licencias MIT/CC0) e historial de auditorías
// consumiendo < 2 MB de RAM en el servidor Proxmox de 16 GB.
import crypto from 'node:crypto';
import { RUTAS, listarIds, cargarPlantilla, cargarTema } from '../../generator/src/generate.mjs';

const QDRANT_URL = (process.env.QDRANT_URL || 'http://192.168.20.52:6333').replace(/\/$/, '');
const QDRANT_API_KEY = (process.env.QDRANT_API_KEY || '').trim();
const DIM = 256;
const COL_CATALOGO = 'forja_catalogo';
const COL_AUDITORIAS = 'forja_auditorias';
const TIMEOUT_MS = 3500;

// Catálogo semilla de plantillas y recursos open-source (100 % licencias permisivas MIT / CC0)
// listos para adaptar como "Caminos Dorados" en templates/<sector>.
export const PRESETS_REPOSITORIOS_ABIERTOS = [
  {
    id: 'preset-corporativo-b2b',
    tipo: 'blueprint-externo',
    nombre: 'Corporativo B2B / Firmas Contables y Legales',
    licencia: 'MIT',
    fuenteReferencia: 'AstroWind / Accessible Astro Starter (MIT)',
    sectores: 'auditoria revisoría fiscal contabilidad impuestos consultoria legal abogados finanzas b2b empresas',
    temaSugerido: 'ejecutivo',
    escena3dSugerida: 'burbujas (esferas cristalinas de baja intensidad 0.6)',
  },
  {
    id: 'preset-ferreteria-industrial',
    tipo: 'blueprint-externo',
    nombre: 'Catálogo Industrial / Ferreterías y Construcción',
    licencia: 'MIT + CC0 3D',
    fuenteReferencia: 'Astro Catalog Starter (MIT) + Kenney Low-Poly Tools (CC0)',
    sectores: 'ferreteria herramientas construccion repuestos tornilleria materiales electricos industrial',
    temaSugerido: 'brasa',
    escena3dSugerida: 'organica (geometría facetada metálica)',
  },
  {
    id: 'preset-salud-consultorio',
    tipo: 'blueprint-externo',
    nombre: 'Clínica / Consultorio Médico y Odontológico',
    licencia: 'MIT',
    fuenteReferencia: 'Accessible Astro Starter (MIT) WCAG AA',
    sectores: 'salud odontologia medico clinica laboratorio bienestar psicologia fisioterapia citas',
    temaSugerido: 'oceano',
    escena3dSugerida: 'burbujas (esferas suaves translúcidas)',
  },
  {
    id: 'preset-eco-bienestar',
    tipo: 'blueprint-externo',
    nombre: 'Spa, Belleza, Café de Especialidad y Sostenibilidad',
    licencia: 'MIT + CC0',
    fuenteReferencia: 'Astro Minimal Landing (MIT) + Poly Haven HDRI (CC0)',
    sectores: 'spa salon belleza peluqueria estetica cafe panaderia artesanal vegetariano organico',
    temaSugerido: 'bosque',
    escena3dSugerida: 'hojas (nudo toroidal orgánico con partículas)',
  },
];

function normalizarTexto(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convierte texto en un vector unitario determinista de 64 dimensiones (Feature Hashing). */
export function textoAVector(texto) {
  const vec = new Float64Array(DIM);
  const limpio = normalizarTexto(texto);
  if (!limpio) {
    vec[0] = 1;
    return Array.from(vec);
  }
  const tokens = limpio.split(' ');
  const rasgos = [...tokens];
  for (const tok of tokens) {
    if (tok.length >= 4) {
      for (let i = 0; i <= tok.length - 3; i++) rasgos.push(tok.slice(i, i + 3));
    }
  }
  for (const r of rasgos) {
    const h = crypto.createHash('md5').update(r).digest();
    const idx = h[0] % DIM;
    const signo = h[1] % 2 === 0 ? 1 : -1;
    const peso = r.length > 3 ? 1.5 : 0.8;
    vec[idx] += signo * peso;
  }
  let norma = 0;
  for (let i = 0; i < DIM; i++) norma += vec[i] * vec[i];
  norma = Math.sqrt(norma) || 1;
  return Array.from(vec, (v) => Number((v / norma).toFixed(6)));
}

function similitudCoseno(a, b) {
  let dot = 0;
  for (let i = 0; i < DIM; i++) dot += a[i] * b[i];
  return dot;
}

function uuidDeterminista(idTexto) {
  const hex = crypto.createHash('md5').update(String(idTexto)).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function qdrantFetch(ruta, metodo = 'GET', body = undefined) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (QDRANT_API_KEY) headers['api-key'] = QDRANT_API_KEY;
    const res = await fetch(`${QDRANT_URL}${ruta}`, {
      method: metodo,
      headers,
      signal: ctrl.signal,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function asegurarColeccion(nombre) {
  const existe = await qdrantFetch(`/collections/${nombre}`, 'GET');
  if (existe) return true;
  const creada = await qdrantFetch(`/collections/${nombre}`, 'PUT', {
    vectors: { size: DIM, distance: 'Cosine' },
  });
  return Boolean(creada);
}

function construirItemsCatalogo() {
  const items = [];
  for (const id of listarIds(RUTAS.plantillas)) {
    const p = cargarPlantilla(id);
    items.push({
      id: `plantilla:${p.id}`,
      tipo: 'plantilla-instalada',
      nombre: p.nombre,
      licencia: 'MIT (Propia Forja)',
      temaSugerido: p.temasRecomendados[0] || 'brasa',
      texto: `${p.nombre} ${p.sector} ${p.descripcion} restaurante comida gastronomia menu carta whatsapp`,
      payload: p,
    });
  }
  for (const id of listarIds(RUTAS.temas)) {
    const t = cargarTema(id);
    items.push({
      id: `tema:${t.id}`,
      tipo: 'tema-instalado',
      nombre: `Tema ${t.nombre}`,
      licencia: 'MIT (Propia Forja)',
      temaSugerido: t.id,
      texto: `${t.nombre} ${t.modo} ${t.descripcion} ${t.escena3d.forma}`,
      payload: { id: t.id, modo: t.modo, escena3d: t.escena3d },
    });
  }
  for (const pr of PRESETS_REPOSITORIOS_ABIERTOS) {
    items.push({
      id: `preset:${pr.id}`,
      tipo: pr.tipo,
      nombre: pr.nombre,
      licencia: pr.licencia,
      temaSugerido: pr.temaSugerido,
      texto: `${pr.nombre} ${pr.sectores} ${pr.escena3dSugerida}`,
      payload: pr,
    });
  }
  return items;
}

/** Sincroniza plantillas, temas y blueprints MIT/CC0 con Qdrant (:6333). */
export async function sincronizarCatalogoQdrant() {
  const items = construirItemsCatalogo();
  const okCol = await asegurarColeccion(COL_CATALOGO);
  if (!okCol) {
    return {
      conectado: false,
      qdrantUrl: QDRANT_URL,
      itemsLocales: items.length,
      mensaje: 'Qdrant no accesible desde este host; operando con índice vectorial en memoria local.',
    };
  }
  const points = items.map((it) => ({
    id: uuidDeterminista(it.id),
    vector: textoAVector(it.texto),
    payload: {
      clave: it.id,
      tipo: it.tipo,
      nombre: it.nombre,
      licencia: it.licencia,
      temaSugerido: it.temaSugerido,
      detalle: it.payload,
    },
  }));
  const up = await qdrantFetch(`/collections/${COL_CATALOGO}/points?wait=true`, 'PUT', { points });
  return {
    conectado: Boolean(up),
    qdrantUrl: QDRANT_URL,
    puntosIndexados: points.length,
    coleccion: COL_CATALOGO,
  };
}

/** Busca en Qdrant (o respaldo en memoria) las piezas más afines al negocio auditado. */
export async function recomendarPiezasParaSitio(textoConsulta) {
  const vector = textoAVector(textoConsulta);
  const resQdrant = await qdrantFetch(`/collections/${COL_CATALOGO}/points/search`, 'POST', {
    vector,
    limit: 3,
    with_payload: true,
  });

  if (resQdrant?.result?.length) {
    return {
      origen: 'qdrant',
      recomendaciones: resQdrant.result.map((r) => ({
        score: Number(r.score.toFixed(3)),
        ...r.payload,
      })),
    };
  }

  // Respaldo exacto en memoria si Qdrant está en otra red o apagado
  const items = construirItemsCatalogo();
  const ordenados = items
    .map((it) => ({
      score: Number(similitudCoseno(vector, textoAVector(it.texto)).toFixed(3)),
      clave: it.id,
      tipo: it.tipo,
      nombre: it.nombre,
      licencia: it.licencia,
      temaSugerido: it.temaSugerido,
      detalle: it.payload,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    origen: 'memoria_local',
    recomendaciones: ordenados,
  };
}

/** Guarda el resumen vectorial de una auditoría web en Qdrant (colección forja_auditorias). */
export async function registrarAuditoriaEnQdrant(resumenAuditoria) {
  const okCol = await asegurarColeccion(COL_AUDITORIAS);
  if (!okCol) return false;
  const point = {
    id: uuidDeterminista(`${resumenAuditoria.url}:${resumenAuditoria.fecha}`),
    vector: textoAVector(`${resumenAuditoria.titulo} ${resumenAuditoria.descripcion} ${resumenAuditoria.url}`),
    payload: resumenAuditoria,
  };
  const r = await qdrantFetch(`/collections/${COL_AUDITORIAS}/points?wait=true`, 'PUT', { points: [point] });
  return Boolean(r);
}
