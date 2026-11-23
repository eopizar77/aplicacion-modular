// Escena 3D procedural del hero (sin modelos externos -> carga mínima).
// Formas según el tema: "organica" (brasa), "burbujas" (océano), "hojas" (bosque).
import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  NormalBlending,
  OctahedronGeometry,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  TorusKnotGeometry,
  WebGLRenderer,
  type BufferGeometry as BG,
} from 'three';

type Forma = 'organica' | 'burbujas' | 'hojas';

interface Orbitante {
  mesh: Mesh;
  radio: number;
  velocidad: number;
  fase: number;
  altura: number;
  giro: number;
}

export function montarEscena(el: HTMLElement): () => void {
  const forma = (el.dataset.forma as Forma) || 'organica';
  const intensidad = Math.min(1.5, Math.max(0.2, Number(el.dataset.intensidad) || 1));
  const oscuro = el.dataset.modo !== 'claro';
  const col = JSON.parse(el.dataset.colores || '{}') as Record<string, string>;
  const cPrim = new Color(col.primario || '#e4572e');
  const cSec = new Color(col.secundario || '#f3a712');
  const cAcen = new Color(col.acento || '#ffd166');

  // ---------- renderer
  const canvas = document.createElement('canvas');
  canvas.className = 'hero__lienzo';
  el.appendChild(canvas);
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  const escena = new Scene();
  const camara = new PerspectiveCamera(42, 1, 0.1, 100);
  camara.position.set(0, 0, 10);

  // ---------- luces
  escena.add(new AmbientLight(0xffffff, oscuro ? 0.35 : 0.9));
  const luzPrincipal = new DirectionalLight(0xffffff, 2.2);
  luzPrincipal.position.set(4, 6, 6);
  escena.add(luzPrincipal);
  const luzColor = new PointLight(cSec, 40, 25);
  luzColor.position.set(-5, -2, 4);
  escena.add(luzColor);
  const luzAcento = new PointLight(cAcen, 25, 20);
  luzAcento.position.set(3, -4, 3);
  escena.add(luzAcento);

  const mundo = new Group();
  escena.add(mundo);

  // ---------- núcleo
  let geoNucleo: BG;
  if (forma === 'hojas') geoNucleo = new TorusKnotGeometry(1.25, 0.38, 180, 24);
  else if (forma === 'burbujas') geoNucleo = new SphereGeometry(1.7, 64, 48);
  else geoNucleo = new IcosahedronGeometry(1.8, 5);

  const matNucleo = new MeshStandardMaterial({
    color: cPrim,
    roughness: forma === 'burbujas' ? 0.12 : 0.38,
    metalness: forma === 'organica' ? 0.3 : 0.15,
    flatShading: forma === 'organica',
    emissive: cPrim,
    emissiveIntensity: oscuro ? 0.12 : 0.03,
    transparent: forma === 'burbujas',
    opacity: forma === 'burbujas' ? 0.9 : 1,
  });
  const nucleo = new Mesh(geoNucleo, matNucleo);
  mundo.add(nucleo);
  const posOriginal = (geoNucleo.getAttribute('position').array as Float32Array).slice();
  const deformar = forma !== 'hojas';

  // ---------- orbitantes
  const geoOrb: BG =
    forma === 'burbujas'
      ? new SphereGeometry(0.22, 20, 16)
      : forma === 'hojas'
        ? new SphereGeometry(0.28, 16, 12).scale(1, 0.18, 0.55)
        : new OctahedronGeometry(0.2, 0);
  const matsOrb = [cSec, cAcen, cPrim].map(
    (c) =>
      new MeshStandardMaterial({
        color: c,
        roughness: 0.3,
        metalness: 0.2,
        flatShading: forma === 'organica',
        transparent: forma === 'burbujas',
        opacity: forma === 'burbujas' ? 0.75 : 1,
      }),
  );
  const orbitantes: Orbitante[] = [];
  const nOrb = Math.round(16 * intensidad);
  for (let i = 0; i < nOrb; i++) {
    const mesh = new Mesh(geoOrb, matsOrb[i % matsOrb.length]);
    const escala = 0.6 + Math.random() * 1.1;
    mesh.scale.setScalar(escala);
    mundo.add(mesh);
    orbitantes.push({
      mesh,
      radio: 2.6 + Math.random() * 2.2,
      velocidad: (0.12 + Math.random() * 0.25) * (Math.random() > 0.5 ? 1 : -1),
      fase: Math.random() * Math.PI * 2,
      altura: (Math.random() - 0.5) * 3.2,
      giro: 0.4 + Math.random() * 1.2,
    });
  }

  // ---------- partículas (chispas / burbujas pequeñas / polen)
  const nPart = Math.round(260 * intensidad);
  const posPart = new Float32Array(nPart * 3);
  const velPart = new Float32Array(nPart);
  for (let i = 0; i < nPart; i++) {
    posPart[i * 3] = (Math.random() - 0.5) * 14;
    posPart[i * 3 + 1] = (Math.random() - 0.5) * 9;
    posPart[i * 3 + 2] = (Math.random() - 0.5) * 6;
    velPart[i] = 0.15 + Math.random() * 0.5;
  }
  const geoPart = new BufferGeometry();
  geoPart.setAttribute('position', new BufferAttribute(posPart, 3));
  const matPart = new PointsMaterial({
    color: cAcen,
    size: forma === 'burbujas' ? 0.07 : 0.05,
    transparent: true,
    opacity: oscuro ? 0.85 : 0.55,
    depthWrite: false,
    blending: oscuro ? AdditiveBlending : NormalBlending,
  });
  const particulas = new Points(geoPart, matPart);
  escena.add(particulas);

  // ---------- interacción
  const puntero = { x: 0, y: 0 };
  const suav = { x: 0, y: 0 };
  const alMover = (e: PointerEvent) => {
    puntero.x = (e.clientX / window.innerWidth) * 2 - 1;
    puntero.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', alMover, { passive: true });

  let progresoScroll = 0;
  const alScroll = () => {
    const alto = el.offsetHeight || window.innerHeight;
    progresoScroll = Math.min(1, Math.max(0, window.scrollY / alto));
  };
  window.addEventListener('scroll', alScroll, { passive: true });
  alScroll();

  // ---------- tamaño y composición responsive
  let desplazamientoX = 0;
  const ajustar = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    // En pantallas anchas la escena va a la derecha para no tapar el texto.
    desplazamientoX = w > 900 ? 2.6 : 0;
    const escala = w < 600 ? 0.72 : 1;
    mundo.scale.setScalar(escala);
  };
  const ro = new ResizeObserver(ajustar);
  ro.observe(el);
  ajustar();

  // ---------- bucle de animación (se pausa fuera de pantalla o con la pestaña oculta)
  let visible = true;
  let t = 0;
  let ultimo = performance.now();
  const posAttr = geoNucleo.getAttribute('position') as BufferAttribute;
  const arr = posAttr.array as Float32Array;

  const cuadro = (ahora: number) => {
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    t += dt;

    // Deformación orgánica del núcleo (ruido barato con senos)
    if (deformar) {
      const amp = forma === 'burbujas' ? 0.06 : 0.11;
      for (let i = 0; i < arr.length; i += 3) {
        const x = posOriginal[i], y = posOriginal[i + 1], z = posOriginal[i + 2];
        const n =
          Math.sin(x * 1.6 + t * 1.1) * Math.sin(y * 1.9 + t * 1.3) * Math.sin(z * 1.4 + t * 0.9);
        const f = 1 + amp * n;
        arr[i] = x * f;
        arr[i + 1] = y * f;
        arr[i + 2] = z * f;
      }
      posAttr.needsUpdate = true;
      geoNucleo.computeVertexNormals();
    }
    nucleo.rotation.y += dt * 0.25;
    nucleo.rotation.x += dt * 0.1;

    for (const o of orbitantes) {
      const a = o.fase + t * o.velocidad;
      o.mesh.position.set(Math.cos(a) * o.radio, o.altura + Math.sin(t * 0.8 + o.fase) * 0.35, Math.sin(a) * o.radio * 0.6);
      o.mesh.rotation.x += dt * o.giro;
      o.mesh.rotation.y += dt * o.giro * 0.7;
    }

    const p = geoPart.getAttribute('position') as BufferAttribute;
    const pa = p.array as Float32Array;
    for (let i = 0; i < nPart; i++) {
      pa[i * 3 + 1] += velPart[i] * dt * (forma === 'hojas' ? -0.6 : 1);
      pa[i * 3] += Math.sin(t + i) * dt * 0.08;
      if (pa[i * 3 + 1] > 4.5) pa[i * 3 + 1] = -4.5;
      if (pa[i * 3 + 1] < -4.5) pa[i * 3 + 1] = 4.5;
    }
    p.needsUpdate = true;

    // Parallax con el puntero + reacción al scroll
    suav.x += (puntero.x - suav.x) * 0.05;
    suav.y += (puntero.y - suav.y) * 0.05;
    mundo.rotation.y = suav.x * 0.35;
    mundo.rotation.x = suav.y * 0.2;
    mundo.position.x = desplazamientoX - suav.x * 0.3;
    mundo.position.y = progresoScroll * 2.5 - suav.y * 0.2;
    particulas.rotation.y = suav.x * 0.1;
    camara.position.z = 10 + progresoScroll * 3;

    renderer.render(escena, camara);
  };

  const actualizarBucle = () => {
    const activo = visible && document.visibilityState === 'visible';
    ultimo = performance.now();
    renderer.setAnimationLoop(activo ? cuadro : null);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    actualizarBucle();
  });
  io.observe(el);
  document.addEventListener('visibilitychange', actualizarBucle);
  actualizarBucle();

  // Aparición suave del lienzo (CSS hace la transición)
  requestAnimationFrame(() => el.classList.add('hero__escena--activa'));

  // ---------- limpieza (útil si en el futuro se usa navegación SPA)
  return () => {
    renderer.setAnimationLoop(null);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('pointermove', alMover);
    window.removeEventListener('scroll', alScroll);
    document.removeEventListener('visibilitychange', actualizarBucle);
    geoNucleo.dispose();
    geoOrb.dispose();
    geoPart.dispose();
    matNucleo.dispose();
    matsOrb.forEach((m) => m.dispose());
    matPart.dispose();
    renderer.dispose();
    canvas.remove();
  };
}
