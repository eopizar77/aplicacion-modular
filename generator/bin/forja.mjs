#!/usr/bin/env node
// CLI de Forja Modular.
//   forja list                         -> catálogo de plantillas, temas y sitios
//   forja validate <slug>|--all        -> valida manifiestos sin construir
//   forja build <slug>|--all           -> ensambla sitios en dist-sites/<slug>
//   forja dev <slug>                   -> servidor de desarrollo con recarga
//   forja new <slug> [--plantilla x] [--tema y] [--nombre "Mi negocio"]
import {
  RUTAS,
  ErrorForja,
  listarIds,
  listarSitios,
  cargarTema,
  cargarPlantilla,
  cargarSitio,
  construirSitio,
  desarrollarSitio,
  escribirIndice,
  crearSitio,
} from '../src/generate.mjs';

const [, , comando, ...resto] = process.argv;

function opciones(args) {
  const o = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const sig = args[i + 1];
      if (sig && !sig.startsWith('--')) {
        o[k] = sig;
        i++;
      } else o[k] = true;
    } else o._.push(a);
  }
  return o;
}

const c = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  err: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
};

function objetivos(o) {
  if (o.all) return listarSitios();
  if (!o._[0]) throw new ErrorForja('Indica un slug o usa --all');
  return [o._[0]];
}

async function main() {
  const o = opciones(resto);
  switch (comando) {
    case 'list': {
      console.log(c.b('\nPlantillas'));
      for (const id of listarIds(RUTAS.plantillas)) {
        const p = cargarPlantilla(id);
        console.log(`  ${c.ok(p.id.padEnd(16))} ${p.nombre} ${c.dim(`v${p.version} · ${p.sector}`)}`);
      }
      console.log(c.b('\nTemas'));
      for (const id of listarIds(RUTAS.temas)) {
        const t = cargarTema(id);
        console.log(`  ${c.ok(t.id.padEnd(16))} ${t.nombre} ${c.dim(`(${t.modo}, 3D: ${t.escena3d.forma})`)}`);
      }
      console.log(c.b('\nSitios'));
      for (const s of listarSitios()) console.log(`  ${c.ok(s)}`);
      console.log();
      break;
    }
    case 'validate': {
      let fallos = 0;
      for (const slug of objetivos(o)) {
        try {
          const { manifiesto } = cargarSitio(slug);
          cargarPlantilla(manifiesto.plantilla);
          cargarTema(manifiesto.tema);
          console.log(`${c.ok('✔')} ${slug}`);
        } catch (e) {
          fallos++;
          console.log(`${c.err('✘')} ${slug}\n${e.message}`);
        }
      }
      process.exitCode = fallos ? 1 : 0;
      break;
    }
    case 'build': {
      const resultados = [];
      let fallos = 0;
      for (const slug of objetivos(o)) {
        process.stdout.write(`${c.dim('⚒')}  Ensamblando ${c.b(slug)}...\n`);
        try {
          const r = await construirSitio(slug);
          resultados.push(r);
          console.log(`${c.ok('✔')} ${slug} ${c.dim(`(${r.segundos}s, ${r.nAssets} assets)`)} → ${r.url}`);
        } catch (e) {
          fallos++;
          console.log(`${c.err('✘')} ${slug}\n${e.message}`);
        }
      }
      if (resultados.length && process.env.MOSTRAR_INDICE !== 'false') await escribirIndice(resultados);
      console.log(`\n${resultados.length} sitio(s) listos en dist-sites/${fallos ? c.err(`, ${fallos} con error`) : ''}`);
      process.exitCode = fallos ? 1 : 0;
      break;
    }
    case 'dev': {
      if (!o._[0]) throw new ErrorForja('Uso: forja dev <slug>');
      await desarrollarSitio(o._[0]);
      break;
    }
    case 'new': {
      if (!o._[0]) throw new ErrorForja('Uso: forja new <slug> [--plantilla restaurante] [--tema brasa] [--nombre "..."]');
      const dir = await crearSitio(o._[0], { plantilla: o.plantilla, tema: o.tema, nombre: o.nombre });
      console.log(`${c.ok('✔')} Sitio creado en ${dir}\n  Edita site.json y ejecuta: npm run forja -- build ${o._[0]}`);
      break;
    }
    default:
      console.log(`Forja Modular CLI

Uso:
  npm run forja -- list
  npm run forja -- validate <slug> | --all
  npm run forja -- build <slug> | --all
  npm run forja -- dev <slug>
  npm run forja -- new <slug> [--plantilla restaurante] [--tema brasa] [--nombre "Mi negocio"]`);
  }
}

main().catch((e) => {
  console.error(c.err(e instanceof ErrorForja ? e.message : e.stack || String(e)));
  process.exit(1);
});
