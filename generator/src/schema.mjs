// Esquemas de validación de Forja Modular.
// Todo dato que entra al generador se valida aquí ANTES de llegar a una plantilla.
// Principio: lista blanca estricta (strict) -> campos desconocidos = error.
import { z } from 'zod';

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
// Solo letras, números, espacios, comas, comillas y guiones: evita inyección CSS.
const FONT_RE = /^[\p{L}0-9 ,'"\-]+$/u;
// Rutas relativas a la carpeta assets del sitio; sin "..", sin rutas absolutas.
const ASSET_RE = /^assets\/[a-zA-Z0-9._\/-]+\.(png|jpe?g|webp|avif|svg|gif)$/;

const texto = (max) => z.string().trim().min(1).max(max);
const textoOpc = (max) => z.string().trim().max(max).optional();
const urlHttps = z
  .string()
  .trim()
  .max(300)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Debe ser una URL https:// válida');
const asset = z
  .string()
  .regex(ASSET_RE, 'Ruta de imagen inválida (usa assets/<archivo>.png|jpg|webp|avif|svg|gif)')
  .refine((v) => !v.includes('..'), 'No se permite ".." en rutas');
const hex = z.string().regex(HEX_RE, 'Color hexadecimal inválido (#RGB o #RRGGBB)');

export const coloresSchema = z
  .object({
    primario: hex,
    secundario: hex,
    acento: hex,
    fondo: hex,
    superficie: hex,
    texto: hex,
    textoSuave: hex,
  })
  .strict();

export const temaSchema = z
  .object({
    id: z.string().regex(SLUG_RE),
    nombre: texto(40),
    descripcion: texto(200),
    modo: z.enum(['claro', 'oscuro']),
    colores: coloresSchema,
    tipografia: z
      .object({
        titulos: z.string().max(160).regex(FONT_RE, 'Fuente con caracteres no permitidos'),
        cuerpo: z.string().max(160).regex(FONT_RE, 'Fuente con caracteres no permitidos'),
      })
      .strict(),
    radio: z.string().regex(/^\d{1,2}px$/, 'Radio inválido, ej: 16px'),
    escena3d: z
      .object({
        forma: z.enum(['organica', 'burbujas', 'hojas']),
        intensidad: z.number().min(0.2).max(1.5),
      })
      .strict(),
  })
  .strict();

export const plantillaSchema = z
  .object({
    id: z.string().regex(SLUG_RE),
    nombre: texto(60),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    sector: z.string().regex(SLUG_RE),
    descripcion: texto(500),
    directorio: z.string().regex(/^templates\/[a-z0-9-]+$/),
    secciones: z.array(z.string().regex(SLUG_RE)).min(1),
    temasRecomendados: z.array(z.string().regex(SLUG_RE)),
    ejemplo: z.string().optional(),
  })
  .strict();

const itemMenu = z
  .object({
    nombre: texto(80),
    descripcion: textoOpc(240),
    precio: z.number().int().min(0).max(100_000_000),
    destacado: z.boolean().optional(),
    etiquetas: z.array(texto(24)).max(5).optional(),
  })
  .strict();

export const sitioSchema = z
  .object({
    $schema: z.string().optional(),
    slug: z.string().regex(SLUG_RE, 'slug: solo minúsculas, números y guiones (2-50 caracteres)'),
    plantilla: z.string().regex(SLUG_RE),
    tema: z.string().regex(SLUG_RE),
    personalizacion: z
      .object({
        colores: coloresSchema.partial().optional(),
      })
      .strict()
      .optional(),
    negocio: z
      .object({
        nombre: texto(80),
        eslogan: textoOpc(120),
        descripcion: texto(400),
        categoria: textoOpc(60),
        nit: z
          .string()
          .regex(/^[0-9.\-]{5,20}$/, 'NIT inválido')
          .optional(),
        logo: asset.optional(),
        ciudad: texto(60),
        direccion: texto(140),
        barrio: textoOpc(60),
        telefono: z
          .string()
          .regex(/^\+?[0-9 ()-]{7,20}$/, 'Teléfono inválido')
          .optional(),
        whatsapp: z
          .string()
          .regex(/^[0-9]{10,15}$/, 'WhatsApp: solo dígitos con indicativo, ej: 573001234567')
          .optional(),
        email: z.string().email().max(120).optional(),
        rangoPrecios: z.enum(['$', '$$', '$$$', '$$$$']).optional(),
        redes: z
          .object({
            instagram: urlHttps.optional(),
            facebook: urlHttps.optional(),
            tiktok: urlHttps.optional(),
          })
          .strict()
          .optional(),
        horarios: z
          .array(z.object({ dias: texto(40), horas: texto(40) }).strict())
          .max(10)
          .optional(),
        mapa: z
          .object({
            consulta: texto(200),
            mostrarMapa: z.boolean().default(true),
          })
          .strict()
          .optional(),
      })
      .strict(),
    secciones: z
      .object({
        nosotros: z
          .object({
            titulo: texto(80),
            texto: texto(1200),
            datos: z
              .array(z.object({ valor: texto(12), etiqueta: texto(40) }).strict())
              .max(4)
              .optional(),
          })
          .strict()
          .optional(),
        menu: z
          .object({
            titulo: texto(80),
            subtitulo: textoOpc(200),
            categorias: z
              .array(
                z
                  .object({
                    nombre: texto(40),
                    items: z.array(itemMenu).min(1).max(40),
                  })
                  .strict(),
              )
              .min(1)
              .max(12),
          })
          .strict()
          .optional(),
        galeria: z
          .array(z.object({ src: asset, alt: texto(140) }).strict())
          .max(12)
          .optional(),
        testimonios: z
          .array(
            z
              .object({
                autor: texto(60),
                texto: texto(400),
                estrellas: z.number().int().min(1).max(5).default(5),
              })
              .strict(),
          )
          .max(8)
          .optional(),
      })
      .strict()
      .default({}),
    seo: z
      .object({
        titulo: textoOpc(70),
        descripcion: textoOpc(160),
        imagen: asset.optional(),
      })
      .strict()
      .optional(),
    legal: z
      .object({
        responsable: textoOpc(120),
        emailDatos: z.string().email().max(120).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Convierte errores de zod en líneas legibles para humanos. */
export function formatearErrores(error) {
  return error.issues.map((i) => `  - ${i.path.join('.') || '(raíz)'}: ${i.message}`).join('\n');
}
