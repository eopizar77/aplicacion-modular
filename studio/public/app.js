// Cliente web de Forja Studio.
// Sincroniza el formulario con el manifiesto site.json, valida y dispara el ensamblaje de Astro + Three.js.

const ETIQUETAS_COLOR = {
  primario: 'Primario',
  secundario: 'Secundario',
  acento: 'Acento / Brillo',
  fondo: 'Fondo general',
  superficie: 'Superficie / Tarjetas',
  texto: 'Texto principal',
  textoSuave: 'Texto secundario',
};

const estado = {
  catalogo: { plantillas: [], temas: [], sitios: [] },
  slugActual: null,
  manifiesto: null,
  assets: [],
  ultimaAuditoria: null,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function notificar(texto, tipo = '') {
  const pill = $('#estado-pill');
  pill.textContent = texto;
  pill.className = `pill ${tipo ? 'pill--' + tipo : ''}`;
  if (tipo === 'ok' || tipo === 'err') mostrarToast(texto, tipo);
}

function mostrarToast(mensaje, tipo = 'ok') {
  const stack = $('#toast-stack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.textContent = mensaje;
  stack.appendChild(el);
  setTimeout(() => el.remove(), tipo === 'err' ? 5500 : 3200);
}

async function api(ruta, opciones = {}) {
  const headers = {
    'X-Forja-CSRF': '1',
    ...(opciones.headers || {}),
  };
  if (opciones.body && typeof opciones.body === 'object' && !(opciones.body instanceof Blob)) {
    headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(opciones.body);
  }
  const res = await fetch(ruta, { ...opciones, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    $('#modal-login').showModal();
    throw new Error(data.error || 'Sesión requerida');
  }
  if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`);
  return data;
}

// ---------------------------------------------------------------- Inicialización
async function iniciar() {
  configurarEventosUI();
  const sesion = await fetch('/api/session').then((r) => r.json());
  if (sesion.requiereToken && !sesion.autenticado) {
    $('#modal-login').showModal();
    return;
  }
  await recargarCatalogo();
}

async function recargarCatalogo(slugPreferido) {
  notificar('Cargando catálogo...');
  estado.catalogo = await api('/api/catalog');

  const selSitio = $('#select-sitio');
  selSitio.innerHTML = '';
  for (const s of estado.catalogo.sitios) {
    const opt = document.createElement('option');
    opt.value = s.slug;
    opt.textContent = `${s.nombre} (${s.slug})`;
    selSitio.appendChild(opt);
  }

  // Selectores de plantillas y temas en modal nuevo
  const poblarSelect = (el, items) => {
    el.innerHTML = '';
    for (const it of items) {
      const o = document.createElement('option');
      o.value = it.id;
      o.textContent = `${it.nombre} (${it.id})`;
      el.appendChild(o);
    }
  };
  poblarSelect($('#f-plantilla'), estado.catalogo.plantillas);
  poblarSelect($('#nuevo-plantilla'), estado.catalogo.plantillas);
  poblarSelect($('#nuevo-tema'), estado.catalogo.temas);

  const objetivo = slugPreferido || estado.slugActual || estado.catalogo.sitios[0]?.slug;
  if (objetivo) {
    selSitio.value = objetivo;
    await seleccionarSitio(objetivo);
  }
  notificar('Listo', 'ok');
}

async function seleccionarSitio(slug) {
  notificar(`Cargando ${slug}...`);
  const data = await api(`/api/sites/${encodeURIComponent(slug)}`);
  estado.slugActual = data.slug;
  estado.manifiesto = data.manifiesto;
  estado.assets = data.assets || [];
  renderizarFormulario();
  actualizarIframe(data.previewUrl, data.compilado);
  notificar(`Editando: ${slug}`, 'ok');
}

function actualizarIframe(previewUrl, compilado = true) {
  $('#preview-url-texto').textContent = previewUrl;
  $('#preview-abrir').href = previewUrl;
  const iframe = $('#preview-iframe');
  if (compilado) {
    iframe.src = `${previewUrl}?t=${Date.now()}`;
  } else {
    iframe.srcdoc = `<body style="margin:0;font-family:Inter,system-ui,sans-serif;background:radial-gradient(circle at 50% 20%,#1a2234,#07090e 70%);color:#f3f6fc;display:grid;place-items:center;height:100vh;text-align:center;padding:2rem"><div style="max-width:360px;background:rgba(22,27,38,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:2rem"><div style="font-size:2rem;margin-bottom:0.6rem">⚡</div><h2 style="margin:0 0 0.5rem;font-size:1.15rem">Listo para ensamblar en 3D</h2><p style="margin:0;color:#8b96ab;font-size:0.88rem;line-height:1.5">Pulsa <strong style="color:#ff7b29">Guardar y Ensamblar 3D</strong> en la esquina superior derecha para compilar la vista previa interactiva.</p></div></body>`;
  }
}

// ---------------------------------------------------------------- Renderizado del Formulario
function renderizarFormulario() {
  const m = estado.manifiesto;
  if (!m) return;

  $('#f-plantilla').value = m.plantilla;
  $('#f-slug').value = m.slug;

  renderizarTarjetasTemas();
  renderizarPickersColores();
  renderizarSelectLogo();

  // Negocio
  const n = m.negocio || {};
  $('#f-nombre').value = n.nombre || '';
  $('#f-categoria').value = n.categoria || '';
  $('#f-eslogan').value = n.eslogan || '';
  $('#f-descripcion').value = n.descripcion || '';
  $('#f-ciudad').value = n.ciudad || '';
  $('#f-barrio').value = n.barrio || '';
  $('#f-direccion').value = n.direccion || '';
  $('#f-whatsapp').value = n.whatsapp || '';
  $('#f-telefono').value = n.telefono || '';
  $('#f-email').value = n.email || '';
  $('#f-rango').value = n.rangoPrecios || '';
  $('#f-nit').value = n.nit || '';
  $('#f-ig').value = n.redes?.instagram || '';
  $('#f-fb').value = n.redes?.facebook || '';
  $('#f-tt').value = n.redes?.tiktok || '';
  $('#f-mapa-q').value = n.mapa?.consulta || '';
  $('#f-mapa-mostrar').checked = n.mapa?.mostrarMapa !== false;

  renderizarHorarios(n.horarios || []);

  // Nosotros y Carta
  const sec = m.secciones || {};
  $('#f-nos-titulo').value = sec.nosotros?.titulo || '';
  $('#f-nos-texto').value = sec.nosotros?.texto || '';
  renderizarDatosNosotros(sec.nosotros?.datos || []);

  $('#f-menu-titulo').value = sec.menu?.titulo || 'Nuestra carta';
  $('#f-menu-sub').value = sec.menu?.subtitulo || '';
  renderizarCategoriasMenu(sec.menu?.categorias || []);

  // Testimonios, SEO y Legal
  renderizarTestimonios(sec.testimonios || []);
  $('#f-seo-titulo').value = m.seo?.titulo || '';
  $('#f-seo-desc').value = m.seo?.descripcion || '';
  $('#f-legal-resp').value = m.legal?.responsable || '';
  $('#f-legal-email').value = m.legal?.emailDatos || '';

  // Pestaña 5: Estudio Audiovisual IA (5 Niveles)
  renderizarAudiovisual(m.audiovisual || {});
}

function renderizarAudiovisual(av) {
  const n1 = av.nivel1Moodboard || {};
  const n2 = av.nivel2FichaMarca || {};
  const n3 = av.nivel3Tomas || [];
  const n4 = av.nivel4DireccionCine || {};
  const n5 = av.nivel5Animacion || {};

  $('#f-av-estilo').value = n1.estiloVisual || '';
  $('#f-av-ritmo').value = n1.ritmoEdicion || 'fast-pacing';

  $('#f-av-sujeto').value = n2.sujetoPrincipal || '';
  $('#f-av-frontal').value = n2.vistaFrontalPrompt || '';
  $('#f-av-lateral').value = n2.vistaLateralPrompt || '';
  $('#f-av-macro').value = n2.detallesTexturaPrompt || '';

  const contTomas = $('#lista-tomas-av');
  contTomas.innerHTML = '';
  const tomasBase = n3.length
    ? n3
    : [
        { seccionDestino: 'hero', angulo: 'frontal', descripcionPrompt: '' },
        { seccionDestino: 'nosotros', angulo: 'lateral', descripcionPrompt: '' },
        { seccionDestino: 'servicios', angulo: 'cenital', descripcionPrompt: '' },
        { seccionDestino: 'detalle', angulo: 'macro', descripcionPrompt: '' },
      ];
  for (const t of tomasBase) {
    const fila = document.createElement('div');
    fila.className = 'fila-item fila-toma-av';
    fila.dataset.seccion = t.seccionDestino;
    fila.dataset.angulo = t.angulo;
    fila.innerHTML = `
      <strong style="min-width:135px;font-size:0.78rem;text-transform:uppercase">${t.seccionDestino} (${t.angulo})</strong>
      <input type="text" class="av-toma-prompt" maxlength="400" placeholder="Prompt de la toma..." />
    `;
    fila.querySelector('input').value = t.descripcionPrompt || '';
    contTomas.appendChild(fila);
  }

  $('#f-av-idea').value = n4.ideaOperador || '';
  $('#f-av-camara').value = n4.promptTecnicoCamara || '';
  $('#f-av-luz').value = n4.iluminacionFisica || '';
  $('#f-av-mov').value = n4.movimientoLente || '';

  $('#f-av-formato').value = n5.formatoSalida || 'reel-9x16';
  $('#f-av-sfx').value = n5.sugerenciaAudioSfx || '';

  const estadoAv = n5.estado || 'sin_iniciar';
  const badge = $('#av-estado-badge');
  badge.textContent = estadoAv;
  badge.className = `pill ${estadoAv === 'aprobado_humano' || estadoAv === 'render_1080p_listo' ? 'pill--ok' : ''}`;
  $('#av-aprobacion-info').textContent = n5.fechaAprobacion
    ? `Aprobado por ${n5.aprobadoPor || 'admin'} el ${new Date(n5.fechaAprobacion).toLocaleString('es-CO')}`
    : 'Pendiente de aprobación humana (Paso 1 -> Paso 2).';
}

function renderizarTarjetasTemas() {
  const cont = $('#tarjetas-temas');
  cont.innerHTML = '';
  const temaActual = estado.manifiesto.tema;

  for (const t of estado.catalogo.temas) {
    const card = document.createElement('div');
    card.className = `tema-card ${t.id === temaActual ? 'tema-card--activo' : ''}`;
    const puntos = [t.colores.primario, t.colores.secundario, t.colores.acento, t.colores.fondo]
      .map((c) => `<span class="tema-card__punto" style="background:${c}"></span>`)
      .join('');
    card.innerHTML = `
      <div class="tema-card__puntos">${puntos}</div>
      <strong>${t.nombre}</strong>
      <small>Modo ${t.modo} · 3D: ${t.escena3d.forma}</small>
      <small>${t.descripcion}</small>
    `;
    card.addEventListener('click', () => {
      estado.manifiesto.tema = t.id;
      renderizarTarjetasTemas();
      renderizarPickersColores();
    });
    cont.appendChild(card);
  }
}

function renderizarPickersColores() {
  const cont = $('#grid-colores');
  cont.innerHTML = '';
  const temaBase = estado.catalogo.temas.find((t) => t.id === estado.manifiesto.tema) || estado.catalogo.temas[0];
  if (!temaBase) return;
  const overrides = estado.manifiesto.personalizacion?.colores || {};

  for (const [clave, etiqueta] of Object.entries(ETIQUETAS_COLOR)) {
    const valorActual = overrides[clave] || temaBase.colores[clave];
    const item = document.createElement('label');
    item.className = 'color-item';
    item.innerHTML = `
      <input type="color" data-color-key="${clave}" value="${valorActual}" />
      <div>
        <strong>${etiqueta}</strong>
        <code>${valorActual}</code>
      </div>
    `;
    const input = item.querySelector('input');
    const code = item.querySelector('code');
    input.addEventListener('input', () => {
      code.textContent = input.value.toUpperCase();
      if (!estado.manifiesto.personalizacion) estado.manifiesto.personalizacion = { colores: {} };
      if (!estado.manifiesto.personalizacion.colores) estado.manifiesto.personalizacion.colores = {};
      estado.manifiesto.personalizacion.colores[clave] = input.value.toUpperCase();
    });
    cont.appendChild(item);
  }
}

function renderizarSelectLogo() {
  const sel = $('#f-logo');
  sel.innerHTML = '<option value="">(Usar iniciales del negocio)</option>';
  for (const a of estado.assets) {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    sel.appendChild(opt);
  }
  sel.value = estado.manifiesto.negocio?.logo || '';
}

function renderizarHorarios(horarios) {
  const cont = $('#lista-horarios');
  cont.innerHTML = '';
  horarios.forEach((h) => agregarFilaHorario(h.dias, h.horas));
}

function agregarFilaHorario(dias = '', horas = '') {
  const fila = document.createElement('div');
  fila.className = 'fila-item fila-horario';
  fila.innerHTML = `
    <input type="text" class="h-dias" placeholder="Ej: Lunes a viernes" maxlength="40" />
    <input type="text" class="h-horas" placeholder="Ej: 12:00 – 22:00" maxlength="40" />
    <button type="button" class="btn btn--pequeno btn--peligro">✕</button>
  `;
  fila.querySelector('.h-dias').value = dias;
  fila.querySelector('.h-horas').value = horas;
  fila.querySelector('button').addEventListener('click', () => fila.remove());
  $('#lista-horarios').appendChild(fila);
}

function renderizarDatosNosotros(datos) {
  const cont = $('#lista-datos');
  cont.innerHTML = '';
  datos.forEach((d) => agregarFilaDato(d.valor, d.etiqueta));
}

function agregarFilaDato(valor = '', etiqueta = '') {
  if ($$('.fila-dato').length >= 4) return;
  const fila = document.createElement('div');
  fila.className = 'fila-item fila-dato';
  fila.innerHTML = `
    <input type="text" class="d-valor" placeholder="Ej: 12+" maxlength="12" style="max-width:110px" />
    <input type="text" class="d-etiqueta" placeholder="Ej: años asando en Chapinero" maxlength="40" />
    <button type="button" class="btn btn--pequeno btn--peligro">✕</button>
  `;
  fila.querySelector('.d-valor').value = valor;
  fila.querySelector('.d-etiqueta').value = etiqueta;
  fila.querySelector('button').addEventListener('click', () => fila.remove());
  $('#lista-datos').appendChild(fila);
}

function renderizarCategoriasMenu(categorias) {
  const cont = $('#lista-categorias');
  cont.innerHTML = '';
  categorias.forEach((c) => agregarCajaCategoria(c.nombre, c.items));
}

function agregarCajaCategoria(nombre = 'Nueva categoría', items = [{ nombre: 'Plato ejemplo', precio: 20000 }]) {
  const box = document.createElement('div');
  box.className = 'cat-box';
  box.innerHTML = `
    <div class="cat-box__header">
      <input type="text" class="cat-nombre" placeholder="Nombre de la categoría" maxlength="40" />
      <button type="button" class="btn btn--pequeno btn-add-plato">+ Plato</button>
      <button type="button" class="btn btn--pequeno btn--peligro btn-del-cat">Eliminar categoría</button>
    </div>
    <div class="cat-platos"></div>
  `;
  box.querySelector('.cat-nombre').value = nombre;
  const contPlatos = box.querySelector('.cat-platos');
  items.forEach((it) => agregarFilaPlato(contPlatos, it));
  box.querySelector('.btn-add-plato').addEventListener('click', () =>
    agregarFilaPlato(contPlatos, { nombre: '', precio: 0, descripcion: '' }),
  );
  box.querySelector('.btn-del-cat').addEventListener('click', () => box.remove());
  $('#lista-categorias').appendChild(box);
}

function agregarFilaPlato(contenedor, it = {}) {
  const row = document.createElement('div');
  row.className = 'plato-row';
  row.innerHTML = `
    <input type="text" class="p-nombre" placeholder="Nombre del plato *" maxlength="80" />
    <input type="number" class="p-precio" placeholder="Precio COP" min="0" step="500" />
    <label style="display:flex;align-items:center;gap:4px;font-size:0.76rem">
      <input type="checkbox" class="p-dest" /> ★ Destacado
    </label>
    <button type="button" class="btn btn--pequeno btn--peligro">✕</button>
    <input type="text" class="p-desc plato-row__desc" placeholder="Descripción o ingredientes (opcional)" maxlength="240" />
  `;
  row.querySelector('.p-nombre').value = it.nombre || '';
  row.querySelector('.p-precio').value = Number(it.precio ?? 0);
  row.querySelector('.p-dest').checked = Boolean(it.destacado);
  row.querySelector('.p-desc').value = it.descripcion || '';
  row.querySelector('button').addEventListener('click', () => row.remove());
  contenedor.appendChild(row);
}

function renderizarTestimonios(lista) {
  const cont = $('#lista-testimonios');
  cont.innerHTML = '';
  lista.forEach((t) => agregarFilaTestimonio(t.autor, t.texto, t.estrellas));
}

function agregarFilaTestimonio(autor = '', texto = '', estrellas = 5) {
  const fila = document.createElement('div');
  fila.className = 'fila-item fila-testimonio';
  fila.innerHTML = `
    <input type="text" class="t-autor" placeholder="Cliente" maxlength="60" style="max-width:140px" />
    <input type="text" class="t-texto" placeholder="Opinión del cliente" maxlength="400" />
    <select class="t-estrellas" style="max-width:85px">
      <option value="5">5 ★</option>
      <option value="4">4 ★</option>
      <option value="3">3 ★</option>
    </select>
    <button type="button" class="btn btn--pequeno btn--peligro">✕</button>
  `;
  fila.querySelector('.t-autor').value = autor;
  fila.querySelector('.t-texto').value = texto;
  fila.querySelector('.t-estrellas').value = String(estrellas || 5);
  fila.querySelector('button').addEventListener('click', () => fila.remove());
  $('#lista-testimonios').appendChild(fila);
}

// ---------------------------------------------------------------- Recolectar Formulario -> JSON válido
function recolectarManifiesto() {
  const m = structuredClone(estado.manifiesto);
  m.plantilla = $('#f-plantilla').value;

  const optStr = (sel) => {
    const v = $(sel).value.trim();
    return v ? v : undefined;
  };

  const redes = {};
  if (optStr('#f-ig')) redes.instagram = optStr('#f-ig');
  if (optStr('#f-fb')) redes.facebook = optStr('#f-fb');
  if (optStr('#f-tt')) redes.tiktok = optStr('#f-tt');

  const horarios = $$('.fila-horario')
    .map((f) => ({
      dias: f.querySelector('.h-dias').value.trim(),
      horas: f.querySelector('.h-horas').value.trim(),
    }))
    .filter((h) => h.dias && h.horas);

  m.negocio = {
    nombre: $('#f-nombre').value.trim(),
    ...(optStr('#f-eslogan') && { eslogan: optStr('#f-eslogan') }),
    descripcion: $('#f-descripcion').value.trim(),
    ...(optStr('#f-categoria') && { categoria: optStr('#f-categoria') }),
    ...(optStr('#f-nit') && { nit: optStr('#f-nit') }),
    ...(optStr('#f-logo') && { logo: optStr('#f-logo') }),
    ciudad: $('#f-ciudad').value.trim(),
    direccion: $('#f-direccion').value.trim(),
    ...(optStr('#f-barrio') && { barrio: optStr('#f-barrio') }),
    ...(optStr('#f-telefono') && { telefono: optStr('#f-telefono') }),
    ...(optStr('#f-whatsapp') && { whatsapp: optStr('#f-whatsapp') }),
    ...(optStr('#f-email') && { email: optStr('#f-email') }),
    ...(optStr('#f-rango') && { rangoPrecios: optStr('#f-rango') }),
    ...(Object.keys(redes).length && { redes }),
    ...(horarios.length && { horarios }),
    mapa: {
      consulta: optStr('#f-mapa-q') || `${$('#f-direccion').value.trim()}, ${$('#f-ciudad').value.trim()}`,
      mostrarMapa: $('#f-mapa-mostrar').checked,
    },
  };

  // Secciones
  const secciones = { ...(m.secciones || {}) };
  const nosTitulo = optStr('#f-nos-titulo');
  const nosTexto = optStr('#f-nos-texto');
  const datos = $$('.fila-dato')
    .map((f) => ({
      valor: f.querySelector('.d-valor').value.trim(),
      etiqueta: f.querySelector('.d-etiqueta').value.trim(),
    }))
    .filter((d) => d.valor && d.etiqueta);

  if (nosTitulo && nosTexto) {
    secciones.nosotros = {
      titulo: nosTitulo,
      texto: nosTexto,
      ...(datos.length && { datos }),
    };
  } else {
    delete secciones.nosotros;
  }

  const categorias = $$('.cat-box')
    .map((box) => {
      const nombre = box.querySelector('.cat-nombre').value.trim();
      const items = Array.from(box.querySelectorAll('.plato-row'))
        .map((r) => {
          const pNombre = r.querySelector('.p-nombre').value.trim();
          const pPrecio = Math.max(0, Math.round(Number(r.querySelector('.p-precio').value || 0)));
          const pDesc = r.querySelector('.p-desc').value.trim();
          const pDest = r.querySelector('.p-dest').checked;
          return {
            nombre: pNombre,
            ...(pDesc && { descripcion: pDesc }),
            precio: pPrecio,
            ...(pDest && { destacado: true }),
          };
        })
        .filter((it) => it.nombre);
      return { nombre, items };
    })
    .filter((c) => c.nombre && c.items.length > 0);

  if (categorias.length) {
    secciones.menu = {
      titulo: optStr('#f-menu-titulo') || 'Nuestra carta',
      ...(optStr('#f-menu-sub') && { subtitulo: optStr('#f-menu-sub') }),
      categorias,
    };
  }

  const testimonios = $$('.fila-testimonio')
    .map((f) => ({
      autor: f.querySelector('.t-autor').value.trim(),
      texto: f.querySelector('.t-texto').value.trim(),
      estrellas: Number(f.querySelector('.t-estrellas').value || 5),
    }))
    .filter((t) => t.autor && t.texto);

  if (testimonios.length) secciones.testimonios = testimonios;
  else delete secciones.testimonios;

  m.secciones = secciones;

  // SEO y Legal
  if (optStr('#f-seo-titulo') || optStr('#f-seo-desc')) {
    m.seo = {
      ...(optStr('#f-seo-titulo') && { titulo: optStr('#f-seo-titulo') }),
      ...(optStr('#f-seo-desc') && { descripcion: optStr('#f-seo-desc') }),
    };
  } else delete m.seo;

  if (optStr('#f-legal-resp') || optStr('#f-legal-email')) {
    m.legal = {
      ...(optStr('#f-legal-resp') && { responsable: optStr('#f-legal-resp') }),
      ...(optStr('#f-legal-email') && { emailDatos: optStr('#f-legal-email') }),
    };
  } else delete m.legal;

  // Recolectar Pestaña 5: Estudio Audiovisual IA (si tiene sujeto o idea configurados)
  const sujetoAv = optStr('#f-av-sujeto');
  const frontalAv = optStr('#f-av-frontal');
  const ideaAv = optStr('#f-av-idea');
  if (sujetoAv || frontalAv || ideaAv || m.audiovisual) {
    const tomasAv = $$('.fila-toma-av')
      .map((f) => ({
        seccionDestino: f.dataset.seccion,
        angulo: f.dataset.angulo,
        descripcionPrompt: f.querySelector('.av-toma-prompt').value.trim(),
      }))
      .filter((t) => t.descripcionPrompt);

    const avPrev = m.audiovisual || {};
    const avNuevo = {
      nivel1Moodboard: {
        referencias: avPrev.nivel1Moodboard?.referencias || [],
        ...(optStr('#f-av-estilo') && { estiloVisual: optStr('#f-av-estilo') }),
        ritmoEdicion: $('#f-av-ritmo').value || 'fast-pacing',
        ...(avPrev.nivel1Moodboard?.paletaExtraida && { paletaExtraida: avPrev.nivel1Moodboard.paletaExtraida }),
      },
      ...(sujetoAv &&
        frontalAv && {
          nivel2FichaMarca: {
            sujetoPrincipal: sujetoAv,
            vistaFrontalPrompt: frontalAv,
            ...(optStr('#f-av-lateral') && { vistaLateralPrompt: optStr('#f-av-lateral') }),
            ...(optStr('#f-av-macro') && { detallesTexturaPrompt: optStr('#f-av-macro') }),
          },
        }),
      ...(tomasAv.length && { nivel3Tomas: tomasAv }),
      ...(ideaAv && {
        nivel4DireccionCine: {
          ideaOperador: ideaAv,
          ...(optStr('#f-av-camara') && { promptTecnicoCamara: optStr('#f-av-camara') }),
          ...(optStr('#f-av-luz') && { iluminacionFisica: optStr('#f-av-luz') }),
          ...(optStr('#f-av-mov') && { movimientoLente: optStr('#f-av-mov') }),
        },
      }),
      nivel5Animacion: {
        ...(avPrev.nivel5Animacion || {}),
        formatoSalida: $('#f-av-formato').value || 'reel-9x16',
        estado: avPrev.nivel5Animacion?.estado || 'sin_iniciar',
        ...(optStr('#f-av-sfx') && { sugerenciaAudioSfx: optStr('#f-av-sfx') }),
      },
    };
    m.audiovisual = avNuevo;
  }

  return m;
}

// ---------------------------------------------------------------- Acciones y Eventos
function configurarEventosUI() {
  // Pestañas
  $$('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach((b) => b.classList.remove('tab--activa'));
      btn.classList.add('tab--activa');
      const target = btn.dataset.tab;
      $$('.tab-panel').forEach((p) => p.classList.toggle('oculto', p.dataset.panel !== target));
    });
  });

  // Cambio de sitio
  $('#select-sitio').addEventListener('change', (e) => seleccionarSitio(e.target.value));

  // Restaurar colores del tema
  $('#btn-reset-colores').addEventListener('click', () => {
    if (estado.manifiesto) {
      estado.manifiesto.personalizacion = { colores: {} };
      renderizarPickersColores();
      notificar('Colores restaurados al tema base');
    }
  });

  // Botones de agregar filas
  $('#btn-add-horario').addEventListener('click', () => agregarFilaHorario());
  $('#btn-add-dato').addEventListener('click', () => agregarFilaDato());
  $('#btn-add-categoria').addEventListener('click', () => agregarCajaCategoria());
  $('#btn-add-testimonio').addEventListener('click', () => agregarFilaTestimonio());

  // Botones del Puente Orquestador IA (Pestaña 5)
  $('#btn-ia-auditar').addEventListener('click', async () => {
    const btn = $('#btn-ia-auditar');
    btn.disabled = true;
    try {
      notificar('Consultando orquestador IA (Niveles 1-3)...');
      const r = await api(`/api/sites/${encodeURIComponent(estado.slugActual)}/ai/audit-copy`, {
        method: 'POST',
        body: { aplicarCopy: true },
      });
      estado.manifiesto = r.manifiesto;
      renderizarFormulario();
      notificar(`✔ Niveles 1-3 generados (${r.origen})`, 'ok');
    } catch (e) {
      notificar(e.message, 'err');
      alert(e.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('#btn-ia-cine').addEventListener('click', async () => {
    const btn = $('#btn-ia-cine');
    btn.disabled = true;
    try {
      notificar('Generando dirección cinematográfica (Nivel 4)...');
      const r = await api(`/api/sites/${encodeURIComponent(estado.slugActual)}/ai/cine-prompt`, {
        method: 'POST',
        body: {
          ideaOperador: $('#f-av-idea').value,
          formatoSalida: $('#f-av-formato').value,
        },
      });
      estado.manifiesto = r.manifiesto;
      renderizarAudiovisual(estado.manifiesto.audiovisual || {});
      notificar(`✔ Borrador Nivel 4-5 listo (${r.origen})`, 'ok');
    } catch (e) {
      notificar(e.message, 'err');
      alert(e.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('#btn-ia-aprobar').addEventListener('click', async () => {
    const btn = $('#btn-ia-aprobar');
    btn.disabled = true;
    try {
      notificar('Aprobando borrador (Human-in-the-Loop)...');
      const r = await api(`/api/sites/${encodeURIComponent(estado.slugActual)}/ai/approve-render`, {
        method: 'POST',
        body: { aprobadoPor: 'admin-studio' },
      });
      estado.manifiesto = r.manifiesto;
      renderizarAudiovisual(estado.manifiesto.audiovisual || {});
      notificar(`✔ Render 1080p autorizado (${r.estado})`, 'ok');
    } catch (e) {
      notificar(e.message, 'err');
      alert(e.message);
    } finally {
      btn.disabled = false;
    }
  });

  // Pestaña 6: Sincronización Qdrant y Auditoría Web 4 Pilares
  $('#btn-qdrant-sync').addEventListener('click', async () => {
    try {
      notificar('Sincronizando catálogo con Qdrant...');
      const r = await api('/api/qdrant/sync', { method: 'POST', body: {} });
      notificar(
        r.conectado
          ? `✔ Qdrant sincronizado (${r.puntosIndexados} piezas)`
          : `Índice local activo (${r.itemsLocales} piezas)`,
        'ok',
      );
    } catch (e) {
      notificar(e.message, 'err');
    }
  });

  $('#btn-ejecutar-auditoria').addEventListener('click', async () => {
    const url = $('#audit-url').value.trim();
    if (!url) {
      notificar('Ingresa una URL https:// para auditar', 'err');
      return;
    }
    const btn = $('#btn-ejecutar-auditoria');
    btn.disabled = true;
    $('#audit-resultado').innerHTML = '<div class="audit-card">Analizando DOM, cabeceras HTTP, WPO, DAFO y recomendaciones en Qdrant...</div>';
    try {
      notificar(`Auditando ${url}...`);
      const r = await api('/api/audit-url', {
        method: 'POST',
        body: { url, contextoCompetencia: $('#audit-contexto').value.trim() },
      });
      estado.ultimaAuditoria = r.reporte;
      renderizarReporteAuditoria(r.reporte);
      $('#btn-audit-crear-sitio').classList.remove('oculto');
      $('#btn-audit-copiar-md').classList.remove('oculto');
      notificar(`✔ Auditoría completada (${r.reporte.resumenEjecutivo.score}/100)`, 'ok');
    } catch (e) {
      $('#audit-resultado').innerHTML = `<div class="audit-card" style="border-color:var(--err)"><strong>Error:</strong> ${esc(e.message)}</div>`;
      notificar('Error en auditoría', 'err');
    } finally {
      btn.disabled = false;
    }
  });

  $('#btn-audit-copiar-md').addEventListener('click', async () => {
    if (!estado.ultimaAuditoria?.markdown) return;
    await navigator.clipboard.writeText(estado.ultimaAuditoria.markdown);
    notificar('✔ Informe Markdown copiado al portapapeles', 'ok');
  });

  $('#btn-audit-crear-sitio').addEventListener('click', async () => {
    const borrador = estado.ultimaAuditoria?.borradorForja?.manifiestoBase;
    if (!borrador) {
      notificar('Primero ejecuta el diagnóstico de una URL', 'err');
      return;
    }
    const btn = $('#btn-audit-crear-sitio');
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Ensamblando sitio 3D...';
    try {
      notificar(`Creando y ensamblando ${borrador.slug} (3-5s)...`);
      const r = await api('/api/audit-to-site', {
        method: 'POST',
        body: { manifiesto: borrador },
      });
      await recargarCatalogo(r.slug);
      $$('.tab')[0].click();
      notificar(`✔ Sitio ${r.slug} generado y ensamblado en ${r.segundos}s`, 'ok');
    } catch (e) {
      notificar(`Error: ${e.message}`, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });

  // Subir asset
  $('#btn-subir-asset').addEventListener('click', async () => {
    const file = $('#input-asset').files?.[0];
    if (!file || !estado.slugActual) {
      notificar('Selecciona un archivo primero', 'err');
      return;
    }
    try {
      notificar(`Subiendo ${file.name}...`);
      const nombreLimpio = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
      const r = await api(`/api/sites/${encodeURIComponent(estado.slugActual)}/assets`, {
        method: 'POST',
        headers: { 'X-Asset-Filename': encodeURIComponent(nombreLimpio) },
        body: file,
      });
      estado.assets = r.assets;
      estado.manifiesto.negocio.logo = r.asset;
      renderizarSelectLogo();
      $('#input-asset').value = '';
      notificar(`Imagen guardada: ${r.asset}`, 'ok');
    } catch (e) {
      notificar(e.message, 'err');
    }
  });

  // Guardar JSON
  $('#btn-guardar').addEventListener('click', async () => {
    try {
      notificar('Validando y guardando...');
      const nuevo = recolectarManifiesto();
      const r = await api(`/api/sites/${encodeURIComponent(estado.slugActual)}`, {
        method: 'PUT',
        body: nuevo,
      });
      estado.manifiesto = r.manifiesto;
      notificar('✔ Manifiesto validado y guardado', 'ok');
    } catch (e) {
      notificar(e.message, 'err');
      alert(`Error de validación:\n${e.message}`);
    }
  });

  // Guardar y ensamblar 3D
  $('#btn-ensamblar').addEventListener('click', async () => {
    const btn = $('#btn-ensamblar');
    btn.disabled = true;
    try {
      notificar('1/2 Validando manifiesto...');
      const nuevo = recolectarManifiesto();
      const guardado = await api(`/api/sites/${encodeURIComponent(estado.slugActual)}`, {
        method: 'PUT',
        body: nuevo,
      });
      estado.manifiesto = guardado.manifiesto;

      notificar('2/2 Ensamblando sitio 3D con Astro...');
      const b = await api(`/api/sites/${encodeURIComponent(estado.slugActual)}/build`, {
        method: 'POST',
      });
      actualizarIframe(b.previewUrl, true);
      notificar(`✔ Ensamblado en ${b.segundos}s`, 'ok');
    } catch (e) {
      notificar('Error al ensamblar', 'err');
      alert(e.message);
    } finally {
      btn.disabled = false;
    }
  });

  // Conmutador vista previa Escritorio / Celular
  $$('[data-viewport]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('[data-viewport]').forEach((b) => b.classList.remove('modo-activo'));
      btn.classList.add('modo-activo');
      $('#preview-contenedor').classList.toggle('preview__contenedor--mobile', btn.dataset.viewport === 'mobile');
    });
  });

  // Modal Nuevo Negocio
  $('#btn-nuevo-sitio').addEventListener('click', () => {
    $('#nuevo-nombre').value = '';
    $('#nuevo-slug').value = '';
    $('#modal-nuevo').showModal();
  });
  $('#btn-cancelar-nuevo').addEventListener('click', () => $('#modal-nuevo').close());
  $('#nuevo-nombre').addEventListener('input', (e) => {
    const slugSugerido = e.target.value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    $('#nuevo-slug').value = slugSugerido;
  });
  $('#form-nuevo').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const slug = $('#nuevo-slug').value.trim();
      const nombre = $('#nuevo-nombre').value.trim();
      const plantilla = $('#nuevo-plantilla').value;
      const tema = $('#nuevo-tema').value;
      notificar(`Creando ${slug}...`);
      await api('/api/sites', {
        method: 'POST',
        body: { slug, nombre, plantilla, tema },
      });
      $('#modal-nuevo').close();
      await recargarCatalogo(slug);
    } catch (err) {
      alert(err.message);
    }
  });

  // Modal Login
  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/session', {
        method: 'POST',
        body: { token: $('#login-token').value },
      });
      $('#modal-login').close();
      await recargarCatalogo();
    } catch (err) {
      alert(err.message);
    }
  });
}

function renderizarReporteAuditoria(rep) {
  const re = rep.resumenEjecutivo;
  const t = rep.tecnico;
  const est = rep.estrategia;
  const q = rep.qdrant;
  const colorEstado = re.score >= 80 ? 'pill--ok' : re.score < 55 ? 'pill--err' : '';

  const filasAccion = rep.planAccion
    .map(
      (a, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${esc(a.pilar)}</strong></td>
        <td>${esc(a.accion)}</td>
        <td><strong>${esc(a.impacto)}</strong></td>
        <td>${esc(a.esfuerzo)}</td>
        <td>${esc(a.resultadoEsperado)}</td>
      </tr>`,
    )
    .join('');

  const recsQdrant = (q.recomendaciones || [])
    .map((r) => `<li><strong>${esc(r.nombre)}</strong> — Tema: <code>${esc(r.temaSugerido)}</code> · Licencia: ${esc(r.licencia)} (afinidad ${esc(r.score)})</li>`)
    .join('');

  $('#audit-resultado').innerHTML = `
    <div class="audit-card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
        <div class="audit-score">
          <span>Puntuación: ${esc(re.score)} / 100</span>
          <span class="pill ${colorEstado}">${esc(re.estadoGeneral)}</span>
        </div>
        <small style="color:var(--muted)">Stack detectado: <strong>${esc(t.cms)}</strong> · TTFB: <strong>${esc(t.wpo.ttfbMs)} ms</strong></small>
      </div>
      <h3>1. Resumen Ejecutivo — Top 3 Hallazgos</h3>
      <ol style="margin:0.4rem 0 0.8rem;padding-left:1.2rem">
        ${re.top3Hallazgos.map((h) => `<li>${esc(h)}</li>`).join('')}
      </ol>
      <h3>Recomendación Vectorial (${esc(q.origen)})</h3>
      <ul style="margin:0;padding-left:1.2rem">${recsQdrant}</ul>
    </div>

    <div class="audit-card">
      <h3>2. Diagnóstico por los 4 Pilares</h3>
      <p><strong>Pilar 1 · SEO On-Page:</strong> Title (${esc(t.seo.longitudTitulo)} chars): <code>${esc(t.seo.titulo || 'Ausente')}</code> · Meta Desc (${esc(t.seo.longitudMetaDescription)} chars) · H1: ${esc(t.seo.conteoEncabezados.h1)} · H2: ${esc(t.seo.conteoEncabezados.h2)} · Schema.org: ${esc(t.seo.schemasDetectados.join(', ') || 'Ninguno')}</p>
      <p><strong>Brechas de Keywords:</strong> ${est.brechasKeywords.map((k) => `<code>${esc(k)}</code>`).join(' · ')}</p>
      <p><strong>Pilar 2 · WPO (Velocidad):</strong> HTML ${esc(t.wpo.pesoHtmlKb)} KB (${esc(t.wpo.compresion)}) · Scripts: ${esc(t.wpo.scriptsTotales)} (${esc(t.wpo.scriptsBloqueantesHead)} bloqueantes en head) · Imágenes: ${esc(t.wpo.imagenesTotales)} (${esc(t.wpo.imagenesSinAlt)} sin alt, ${esc(t.wpo.imagenesSinLazy)} sin lazy)</p>
      <p><strong>Pilar 3 · Competencia y Whitespace:</strong> ${esc(est.whitespaceMercado)}</p>
      <table class="audit-tabla">
        <tr><th>Fortalezas</th><th>Debilidades</th></tr>
        <tr>
          <td>${est.dafo.fortalezas.map((x) => `• ${esc(x)}`).join('<br>')}</td>
          <td>${est.dafo.debilidades.map((x) => `• ${esc(x)}`).join('<br>')}</td>
        </tr>
        <tr><th>Oportunidades</th><th>Amenazas</th></tr>
        <tr>
          <td>${est.dafo.oportunidades.map((x) => `• ${esc(x)}`).join('<br>')}</td>
          <td>${est.dafo.amenazas.map((x) => `• ${esc(x)}`).join('<br>')}</td>
        </tr>
      </table>
      <p style="margin-top:0.7rem"><strong>Pilar 4 · Tráfico y CRO:</strong> WhatsApp directo: <strong>${t.cro.tieneWhatsapp ? 'Sí' : 'No'}</strong> · Formularios: ${esc(t.cro.formularios)} · Analítica: ${esc(t.cro.analiticaDetectada.join(', ') || 'No detectada')}</p>
    </div>

    <div class="audit-card">
      <h3>3. Plan de Acción Priorizado (Impacto vs. Esfuerzo)</h3>
      <table class="audit-tabla">
        <thead>
          <tr><th>#</th><th>Pilar</th><th>Acción</th><th>Impacto</th><th>Esfuerzo</th><th>Resultado Esperado</th></tr>
        </thead>
        <tbody>${filasAccion}</tbody>
      </table>
    </div>
  `;
}

iniciar();
