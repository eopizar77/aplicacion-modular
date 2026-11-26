// Puente Orquestador de Forja Studio (Pilares 1 y 2).
// Conecta Forja Studio con deepseek_harness (192.168.20.52:3090) y n8n (192.168.20.52:5678).
// Si el stack de IA está apagado en Portainer para ahorrar RAM, utiliza un motor determinista
// de ingeniería audiovisual e informa con total transparencia (origen: "deepseek_harness" | "motor_local").
import { ErrorForja, cargarTema } from '../../generator/src/generate.mjs';
import { audiovisualSchema } from '../../generator/src/schema.mjs';

const DEEPSEEK_URL = (process.env.DEEPSEEK_HARNESS_URL || 'http://192.168.20.52:3090').replace(/\/$/, '');
const DEEPSEEK_KEY = (process.env.DEEPSEEK_API_KEY || '').trim();
const N8N_URL = (process.env.N8N_WEBHOOK_URL || '').replace(/\/$/, '');
const TIMEOUT_MS = 15_000;

/** Intenta consultar deepseek_harness; retorna null si el contenedor está apagado o no responde a tiempo. */
async function consultarDeepseek(systemPrompt, userPrompt) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (DEEPSEEK_KEY) headers.Authorization = `Bearer ${DEEPSEEK_KEY}`;

    const res = await fetch(`${DEEPSEEK_URL}/v1/chat/completions`, {
      method: 'POST',
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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

/**
 * PILAR 1 + NIVELES 1-3: Audita un manifiesto site.json, optimiza copy comercial/SEO
 * y construye los Niveles 1, 2 y 3 (4 ángulos coherentes) validados contra audiovisualSchema.
 */
export async function auditarYGenerarTomas(manifiesto) {
  const n = manifiesto.negocio;
  const tema = cargarTema(manifiesto.tema);
  const platoEstrella =
    manifiesto.secciones?.menu?.categorias?.[0]?.items?.find((i) => i.destacado)?.nombre ||
    manifiesto.secciones?.menu?.categorias?.[0]?.items?.[0]?.nombre ||
    n.categoria ||
    n.nombre;

  const sys =
    'Eres un Director Creativo y Especialista SEO para comercios de Bogotá. Responde ÚNICAMENTE un objeto JSON válido con las claves: esloganMejorado (<=120 chars), descripcionSeo (<=160 chars), estiloVisual (<=160 chars), sujetoPrincipal (<=140 chars), vistaFrontalPrompt (<=300 chars), vistaLateralPrompt (<=300 chars), detallesTexturaPrompt (<=300 chars), tomas (array de 4 objetos con seccionDestino: hero|nosotros|servicios|detalle, angulo: frontal|lateral|cenital|macro, descripcionPrompt <=400 chars).';
  const usr = JSON.stringify({
    nombre: n.nombre,
    categoria: n.categoria,
    ciudad: n.ciudad,
    barrio: n.barrio,
    descripcionActual: n.descripcion,
    platoEstrella,
    tema: tema.nombre,
    modo: tema.modo,
  });

  const ia = await consultarDeepseek(sys, usr);
  const origen = ia ? 'deepseek_harness' : 'motor_determinista_local';

  const paleta = [
    tema.colores.primario,
    tema.colores.secundario,
    tema.colores.acento,
    tema.colores.fondo,
  ];

  const actualAv = manifiesto.audiovisual || {};
  const nuevoAv = {
    nivel1Moodboard: {
      referencias: actualAv.nivel1Moodboard?.referencias || [],
      estiloVisual:
        ia?.estiloVisual ||
        actualAv.nivel1Moodboard?.estiloVisual ||
        `Estética ${tema.nombre} (${tema.modo}): alto contraste, texturas orgánicas reales e iluminación cálida de acento`,
      ritmoEdicion: actualAv.nivel1Moodboard?.ritmoEdicion || 'fast-pacing',
      paletaExtraida: paleta,
    },
    nivel2FichaMarca: {
      sujetoPrincipal:
        ia?.sujetoPrincipal ||
        `${platoEstrella} de ${n.nombre} (${n.barrio || n.ciudad})`,
      vistaFrontalPrompt:
        ia?.vistaFrontalPrompt ||
        `Plano principal a 45° de ${platoEstrella} recién preparado en ${n.nombre}, iluminación principal lateral, paleta ${paleta[0]} y ${paleta[1]}`,
      vistaLateralPrompt:
        ia?.vistaLateralPrompt ||
        `Vista de perfil rasante mostrando volumen, capas y vapor real de ${platoEstrella} sobre superficie ${tema.modo}`,
      detallesTexturaPrompt:
        ia?.detallesTexturaPrompt ||
        `Macro extremo con lente 100mm f/2.8 destacando texturas frescas, brillo natural y acabado artesanal de ${platoEstrella}`,
      ...(actualAv.nivel2FichaMarca?.fichaAsset && { fichaAsset: actualAv.nivel2FichaMarca.fichaAsset }),
    },
    nivel3Tomas: Array.isArray(ia?.tomas) && ia.tomas.length === 4
      ? ia.tomas
      : [
          {
            seccionDestino: 'hero',
            angulo: 'frontal',
            descripcionPrompt: `Hero principal 16:9: ${platoEstrella} en primer plano con atmósfera ${tema.nombre} y espacio negativo a la izquierda para titular`,
          },
          {
            seccionDestino: 'nosotros',
            angulo: 'lateral',
            descripcionPrompt: `Retrato documental lateral del equipo de ${n.nombre} en ${n.barrio || n.ciudad} preparando ${platoEstrella} con técnica tradicional`,
          },
          {
            seccionDestino: 'servicios',
            angulo: 'cenital',
            descripcionPrompt: `Plano cenital (flat-lay 90°) de mesa completa en ${n.nombre} mostrando variedad de la carta y bebidas`,
          },
          {
            seccionDestino: 'detalle',
            angulo: 'macro',
            descripcionPrompt: `Plano detalle macro de ingredientes frescos y textura de ${platoEstrella} con iluminación de recorte cálida`,
          },
        ],
    nivel4DireccionCine: actualAv.nivel4DireccionCine || {
      ideaOperador: `Comercial corto de ${platoEstrella} en ${n.nombre} para atraer clientes por WhatsApp`,
      promptTecnicoCamara: `Lente 50mm anamórfico f/1.8, 120fps slow-motion, dolly-in fluido hacia ${platoEstrella}`,
      iluminacionFisica: `Key light cálida 3200K a 45°, contraluz de separación en tono ${paleta[1]} y atmósfera sutil`,
      movimientoLente: 'Push-in progresivo con enfoque selectivo (rack focus) al centro del producto',
    },
    nivel5Animacion: actualAv.nivel5Animacion || {
      formatoSalida: 'reel-9x16',
      estado: 'sin_iniciar',
      sugerenciaAudioSfx: 'SFX: sonido ambiente real de preparación en primer plano + percusión moderna discreta',
    },
  };

  const validado = audiovisualSchema.safeParse(nuevoAv);
  if (!validado.success) {
    throw new ErrorForja('La propuesta audiovisual generada no superó el esquema de seguridad Zod');
  }

  return {
    origen,
    sugerenciasCopy: {
      eslogan: ia?.esloganMejorado || n.eslogan || `${platoEstrella} con sello auténtico en ${n.barrio || n.ciudad}`,
      descripcionSeo:
        ia?.descripcionSeo ||
        `${n.nombre} en ${n.barrio ? n.barrio + ', ' : ''}${n.ciudad}: disfruta ${platoEstrella}. Mira la carta con precios y reserva por WhatsApp.`.slice(
          0,
          160,
        ),
    },
    audiovisual: validado.data,
  };
}

/**
 * NIVEL 4 + Paso 1 del NIVEL 5: Traduce la idea simple del operador en dirección cinematográfica
 * técnica y marca el borrador de baja resolución como listo para revisión humana.
 */
export async function traducirDireccionCine(manifiesto, ideaOperador, formatoSalida = 'reel-9x16') {
  const idea = String(ideaOperador || '').trim();
  if (!idea || idea.length < 5) {
    throw new ErrorForja('Escribe una idea breve en el Nivel 4 (mínimo 5 caracteres)');
  }

  const n = manifiesto.negocio;
  const tema = cargarTema(manifiesto.tema);
  const sujeto =
    manifiesto.audiovisual?.nivel2FichaMarca?.sujetoPrincipal || `${n.nombre} (${n.categoria || n.ciudad})`;

  const sys =
    'Eres un Director de Fotografía Cinematográfica publicitaria. Convierte la idea del operador en un JSON estricto con: promptTecnicoCamara (<=600 chars), iluminacionFisica (<=300 chars), movimientoLente (<=200 chars), sugerenciaAudioSfx (<=240 chars).';
  const usr = JSON.stringify({
    negocio: n.nombre,
    sujetoFichaNivel2: sujeto,
    ideaOperador: idea,
    formatoSalida,
    coloresTema: tema.colores,
  });

  const ia = await consultarDeepseek(sys, usr);
  const origen = ia ? 'deepseek_harness' : 'motor_determinista_local';

  const direccion = {
    ideaOperador: idea.slice(0, 300),
    promptTecnicoCamara: (
      ia?.promptTecnicoCamara ||
      `Cámara Cinema 6K, lente prime 85mm T1.5, 120fps slow-motion en formato ${formatoSalida}. Sujeto: ${sujeto}. Acción: ${idea}. Profundidad de campo reducida con bokeh cremoso.`
    ).slice(0, 600),
    iluminacionFisica: (
      ia?.iluminacionFisica ||
      `Iluminación motivada de tres puntos: luz principal cálida lateral, contraluz intenso (${tema.colores.acento}) resaltando silueta y partículas en suspensión, sombras ricas (${tema.colores.fondo}).`
    ).slice(0, 300),
    movimientoLente: (
      ia?.movimientoLente ||
      'Dolly-in suave sincronizado con la acción principal + estabilización gimbal con ligero movimiento orgánico al cierre'
    ).slice(0, 200),
  };

  const animacion = {
    ...(manifiesto.audiovisual?.nivel5Animacion || {}),
    formatoSalida,
    // Regla del Nivel 5: todo cambio en dirección genera primero un borrador que exige aprobación humana
    estado: 'borrador_generado',
    sugerenciaAudioSfx: (
      ia?.sugerenciaAudioSfx ||
      'SFX foley hiperrealista en los primeros 1.5s (hook auditivo) + base rítmica moderna con corte limpio al llamado a la acción de WhatsApp'
    ).slice(0, 240),
  };

  return { origen, nivel4DireccionCine: direccion, nivel5Animacion: animacion };
}

/**
 * NIVEL 5 (Paso 2 — Human-in-the-Loop): Registra la aprobación humana del borrador
 * y solo entonces autoriza/dispara el render final 1080p (vía webhook n8n si está activo).
 */
export async function aprobarBorradorYDisparar1080p(manifiesto, aprobadoPor = 'admin') {
  const av = manifiesto.audiovisual;
  const estadoActual = av?.nivel5Animacion?.estado || 'sin_iniciar';

  if (estadoActual === 'sin_iniciar') {
    throw new ErrorForja(
      'Bloqueo de ahorro de créditos (Nivel 5): Primero debes generar el borrador en el Nivel 4 antes de aprobar el render 1080p.',
    );
  }

  const fechaAprobacion = new Date().toISOString();
  let webhookEnviado = false;

  if (N8N_URL) {
    try {
      const res = await fetch(`${N8N_URL}/webhook/forja-render-1080p`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: manifiesto.slug,
          negocio: manifiesto.negocio.nombre,
          nivel2FichaMarca: av?.nivel2FichaMarca,
          nivel4DireccionCine: av?.nivel4DireccionCine,
          formatoSalida: av?.nivel5Animacion?.formatoSalida || 'reel-9x16',
          aprobadoPor,
          fechaAprobacion,
        }),
      });
      webhookEnviado = res.ok;
    } catch {
      webhookEnviado = false;
    }
  }

  return {
    estado: webhookEnviado ? 'render_1080p_listo' : 'aprobado_humano',
    aprobadoPor: String(aprobadoPor).slice(0, 60),
    fechaAprobacion,
    webhookEnviado,
  };
}
