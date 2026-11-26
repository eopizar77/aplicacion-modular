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

// ============================================================================
// PILAR 2: Flujo Audiovisual de Agencia en 5 Niveles (con Human-in-the-Loop)
// ============================================================================
const anguloTomaSchema = z
  .object({
    seccionDestino: z.enum(['hero', 'nosotros', 'servicios', 'detalle']),
    angulo: z.enum(['frontal', 'lateral', 'cenital', 'macro']),
    descripcionPrompt: texto(400),
    assetGenerado: asset.optional(),
  })
  .strict();

export const audiovisualSchema = z
  .object({
    // Nivel 1: Moodboard e ingesta de referencias visuales
    nivel1Moodboard: z
      .object({
        referencias: z.array(urlHttps).max(6).default([]),
        estiloVisual: textoOpc(160),
        ritmoEdicion: z.enum(['fast-pacing', 'cinematic-slow', 'dynamic-commercial']).default('fast-pacing'),
        paletaExtraida: z.array(hex).max(5).optional(),
      })
      .strict()
      .optional(),
    // Nivel 2: Ficha técnica visual única de producto/marca (consistencia)
    nivel2FichaMarca: z
      .object({
        sujetoPrincipal: texto(140),
        vistaFrontalPrompt: texto(300),
        vistaLateralPrompt: textoOpc(300),
        detallesTexturaPrompt: textoOpc(300),
        fichaAsset: asset.optional(),
      })
      .strict()
      .optional(),
    // Nivel 3: Construcción de 4 ángulos coherentes para secciones de site.json
    nivel3Tomas: z.array(anguloTomaSchema).max(4).optional(),
    // Nivel 4: Dirección cinematográfica traducida por deepseek_harness
    nivel4DireccionCine: z
      .object({
        ideaOperador: texto(300),
        promptTecnicoCamara: textoOpc(600),
        iluminacionFisica: textoOpc(300),
        movimientoLente: textoOpc(200),
      })
      .strict()
      .optional(),
    // Nivel 5: Animación en 2 pasos (Borrador -> Aprobación Humana -> Render 1080p)
    nivel5Animacion: z
      .object({
        formatoSalida: z.enum(['reel-9x16', 'hero-16x9', 'post-1x1']).default('reel-9x16'),
        estado: z
          .enum(['sin_iniciar', 'borrador_generado', 'aprobado_humano', 'render_1080p_listo'])
          .default('sin_iniciar'),
        borradorUrl: urlHttps.optional(),
        aprobadoPor: textoOpc(60),
        fechaAprobacion: z.string().datetime().optional(),
        renderFinal1080pUrl: urlHttps.optional(),
        sugerenciaAudioSfx: textoOpc(240),
      })
      .strict()
      .optional(),
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
    audiovisual: audiovisualSchema.optional(),
  })
  .strict();

// ============================================================================
// PILAR 3: Esquema Maestro de "Forja Apps" (Aplicaciones Empresariales CRUD/ERP)
// ============================================================================
const campoEntidadSchema = z
  .object({
    nombre: z.string().regex(/^[a-z][a-zA-Z0-9]{1,40}$/, 'Usa camelCase para nombres de campo'),
    tipo: z.enum(['string', 'text', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'enum', 'uuid']),
    requerido: z.boolean().default(true),
    unico: z.boolean().default(false),
    valoresEnum: z.array(texto(40)).max(20).optional(),
  })
  .strict();

const entidadSchema = z
  .object({
    nombre: z.string().regex(/^[A-Z][a-zA-Z0-9]{1,40}$/, 'Usa PascalCase para nombres de entidad'),
    tabla: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, 'Usa snake_case para la tabla'),
    campos: z.array(campoEntidadSchema).min(1).max(40),
  })
  .strict();

export const appSchema = z
  .object({
    slug: z.string().regex(SLUG_RE),
    nombre: texto(80),
    tema: z.string().regex(SLUG_RE),
    stack: z
      .object({
        frontend: z.enum(['react', 'vue', 'angular', 'astro-islands']).default('react'),
        backend: z.enum(['node-fastify', 'node-express', 'python-fastapi']).default('node-fastify'),
        baseDatos: z.enum(['postgresql', 'mysql']).default('postgresql'),
      })
      .strict(),
    uiTemplates: z
      .object({
        login: z.enum(['corporativo-split', 'minimal-glass', 'brutalista-3d']).default('corporativo-split'),
        dashboard: z.enum(['sidebar-ejecutivo', 'topbar-compacto', 'modular-cards']).default('sidebar-ejecutivo'),
      })
      .strict(),
    seguridad: z
      .object({
        auth: z.enum(['jwt-refresh-argon2id', 'session-cookie-strict']).default('jwt-refresh-argon2id'),
        roles: z.array(z.string().regex(SLUG_RE)).min(1).max(10).default(['admin', 'operador', 'auditor']),
        rateLimitLoginPorMinuto: z.number().int().min(3).max(30).default(5),
      })
      .strict(),
    modulosErp: z
      .array(z.enum(['login-rbac', 'tesoreria', 'recepcion-ocr', 'presupuestos', 'rrhh', 'inventarios']))
      .min(1),
    entidades: z.array(entidadSchema).max(30).default([]),
  })
  .strict();

/** Convierte errores de zod en líneas legibles para humanos. */
export function formatearErrores(error) {
  return error.issues.map((i) => `  - ${i.path.join('.') || '(raíz)'}: ${i.message}`).join('\n');
}
