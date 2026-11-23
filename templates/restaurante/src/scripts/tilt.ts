// Efecto "tilt" 3D en tarjetas: rotación sutil siguiendo el puntero.
// Solo en dispositivos con puntero fino (mouse) y sin preferencia de movimiento reducido.
const habilitar =
  window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (habilitar) {
  const MAX = 8; // grados
  document.querySelectorAll<HTMLElement>('.tilt').forEach((tarjeta) => {
    let raf = 0;
    tarjeta.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = tarjeta.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        tarjeta.style.setProperty('--rx', `${(0.5 - py) * MAX}deg`);
        tarjeta.style.setProperty('--ry', `${(px - 0.5) * MAX}deg`);
        tarjeta.style.setProperty('--gx', `${px * 100}%`);
        tarjeta.style.setProperty('--gy', `${py * 100}%`);
        tarjeta.classList.add('tilt--activa');
      });
    });
    tarjeta.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      tarjeta.classList.remove('tilt--activa');
      tarjeta.style.setProperty('--rx', '0deg');
      tarjeta.style.setProperty('--ry', '0deg');
    });
  });
}
