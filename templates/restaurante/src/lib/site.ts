// Acceso a los datos del sitio. Se ejecuta SOLO en build (servidor), nunca en el navegador.
import fs from 'node:fs';

const ruta = process.env.FORJA_SITE;
if (!ruta) {
  throw new Error(
    '[forja] Falta FORJA_SITE. Ejecuta la plantilla a través del generador: npm run forja -- dev <slug>',
  );
}

export type Item = {
  nombre: string;
  descripcion?: string;
  precio: number;
  destacado?: boolean;
  etiquetas?: string[];
};

// El JSON ya fue validado por el esquema estricto del generador (generator/src/schema.mjs).
export const site: any = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
export const negocio = site.negocio;
export const tema = site.tema;
export const secciones = site.secciones ?? {};

const fmtCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
export const precio = (v: number) => fmtCOP.format(v);

const basePrefix = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

/** URL pública relativa a la base del sitio ("/" -> "/demo-restaurante/"). */
export const baseUrl = (p = '/') => `${basePrefix}/${p.replace(/^\/+/, '')}`;

/** URL pública de un asset del cliente ("assets/logo.png" -> "/demo-restaurante/assets/logo.png"). */
export const assetUrl = (p: string) => baseUrl(p);

export function whatsappUrl(mensaje?: string) {
  if (!negocio.whatsapp) return null;
  const texto = mensaje ?? `Hola ${negocio.nombre}, vi su página web y quisiera hacer una reserva.`;
  return `https://wa.me/${negocio.whatsapp}?text=${encodeURIComponent(texto)}`;
}

export function mapaUrls() {
  const q = negocio.mapa?.consulta ?? `${negocio.direccion}, ${negocio.ciudad}`;
  const e = encodeURIComponent(q);
  return {
    embed: `https://www.google.com/maps?q=${e}&output=embed`,
    google: `https://www.google.com/maps/search/?api=1&query=${e}`,
    waze: `https://waze.com/ul?q=${e}&navigate=yes`,
  };
}

export const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-ZÁÉÍÓÚÑ]/.test(p))
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
