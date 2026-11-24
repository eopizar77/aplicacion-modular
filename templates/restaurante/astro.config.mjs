// Configuración de la plantilla. El generador Forja inyecta rutas por variables de entorno:
//   FORJA_SITE      JSON del sitio ya validado y resuelto (lo lee src/lib/site.ts)
//   FORJA_PUBLIC    carpeta public combinada (plantilla + assets del cliente)
//   FORJA_OUT       carpeta de salida (dist-sites/<slug>)
//   FORJA_SITE_URL  URL pública del sitio (canonical, Open Graph, sitemap)
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.FORJA_SITE_URL || 'http://localhost:4321',
  base: process.env.FORJA_BASE_PATH || '/',
  outDir: process.env.FORJA_OUT || './dist',
  publicDir: process.env.FORJA_PUBLIC || './public',
  trailingSlash: 'ignore',
  compressHTML: true,
  devToolbar: { enabled: false },
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  vite: {
    // 0 = nunca incrustar scripts en el HTML -> permite una CSP estricta (script-src 'self')
    build: { assetsInlineLimit: 0 },
  },
});
