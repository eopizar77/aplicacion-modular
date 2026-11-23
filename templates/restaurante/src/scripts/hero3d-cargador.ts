// Cargador del hero 3D: decide SI y CUÁNDO cargar Three.js.
// Three.js (~150 KB gzip) solo se descarga si el dispositivo lo puede aprovechar.

function soportaWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function debeUsar3D(): boolean {
  const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  const ahorroDatos = nav.connection?.saveData === true;
  const redLenta = /(^|-)2g$/.test(nav.connection?.effectiveType ?? '');
  const pocaMemoria = typeof nav.deviceMemory === 'number' && nav.deviceMemory < 2;
  return !reducirMovimiento && !ahorroDatos && !redLenta && !pocaMemoria && soportaWebGL();
}

const contenedor = document.querySelector<HTMLElement>('[data-hero3d]');

if (contenedor && debeUsar3D()) {
  const iniciar = () =>
    import('./hero3d-escena')
      .then((m) => m.montarEscena(contenedor))
      .catch((err) => console.warn('[forja] Escena 3D desactivada:', err));

  // Esperar a que el navegador esté libre: el contenido (LCP) siempre primero.
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(iniciar, { timeout: 2500 });
  } else {
    setTimeout(iniciar, 800);
  }
}
