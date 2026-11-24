#!/usr/bin/env node
// Tiempos de la voz: los reales si ya hay voz (voz/short.tiempos.json); si no, sintéticos para montar el borrador gratis.
//
//   node herramientas/tiempos.mjs
//
// Lee guion/voz.json y escribe, por tramo, tiempos/<tramo>.js con la misma forma
// que tendrán los tiempos reales de ElevenLabs pasados a palabras:
//   { tramo, duracion, palabras: [{ w, ini, fin, fila }], filas: { n: { ini, fin } } }
// Después ajusta data-start y data-duration de cada tramo en index.html (en orden, sin huecos).
//
// Ritmo sintético: 3,4 palabras por segundo (lo que dice una voz enérgica acelerada un 10 %).
// Cuando llega la voz real, este mismo script escribe los tiempos reales y la animación no se toca:
// todo se ancla a palabras, nunca a segundos escritos a mano.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PPS = 2.6;            // palabras por segundo
const PAUSA_FILA = 0.3;     // silencio entre filas
const ENTRADA_DEF = 0.55;   // margen antes de la primera palabra (la cortinilla tapa el corte)
const COLA = 0.8;           // margen tras la última palabra
const AJUSTES = { short: { pps: 3.4, entrada: 0.1, pausa: 0.25, cola: 1.2 } };   // la voz del canal (Ginyin, +10 %) va a unas 3,4 palabras por segundo

const r3 = (x) => Math.round(x * 1000) / 1000;
// Voz real (ElevenLabs, tiempos por carácter) donde ya existe: voz/<archivo>.tiempos.json (la escribe herramientas/voz.mjs). El texto tiene que ser exactamente el de las filas; si no, se avisa y se usan tiempos sintéticos.
const VOZ = path.join(DIR, 'voz');
const REALES = { short: { archivo: 'short', entrada: 0.1, cola: 1.2 } };
function palabrasReales(tramo, cfg) {
  const f = path.join(VOZ, cfg.archivo + '.tiempos.json');
  if (!fs.existsSync(f)) return null;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  // Se compara sin signos: la voz lleva «¡…!» y marcas de interpretación ([excited], [fast]…) que no se dicen.
  const limpio = (x) => x.toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[¡!¿?.,:;«»"()…]/g, '').replace(/\s+/g, ' ').trim();
  const esperado = tramo.filas.map((x) => x.voz).join(' ');
  if (limpio(d.texto) !== limpio(esperado)) { console.warn(`⚠ ${tramo.id}: el texto de la voz no coincide con el guion; uso tiempos sintéticos`); return null; }
  // Palabras habladas con sus tiempos, sin las marcas entre corchetes. «YT» toma el tramo de «Uai Ti».
  const hab = d.chars.join(''), hw = [];
  for (let i = 0; i < hab.length;) {
    if (hab[i] === ' ') { i++; continue; }
    if (hab[i] === '[') { while (i < hab.length && hab[i] !== ']') i++; i++; continue; }
    let j = i; while (j < hab.length && hab[j] !== ' ' && hab[j] !== '[') j++;
    hw.push({ w: hab.slice(i, j), ini: d.starts[i], fin: d.ends[j - 1] }); i = j;
  }
  const n = (x) => limpio(x);
  const palabras = [], filas = {};
  let h = 0;
  for (const fila of tramo.filas) {
    fila.voz.split(/\s+/).filter(Boolean).forEach((w, k) => {
      let ini, fin;
      if (n(w) === 'yt' && hw[h] && n(hw[h].w) === 'uai') { ini = hw[h].ini; fin = hw[h + 1].fin; h += 2; }
      else { if (!hw[h] || n(hw[h].w) !== n(w)) console.warn(`⚠ ${tramo.id}: «${w}» ↔ «${hw[h] && hw[h].w}»`); ini = hw[h].ini; fin = hw[h].fin; h++; }
      palabras.push({ w, ini: r3(ini + cfg.entrada), fin: r3(fin + cfg.entrada), fila: fila.n });
      if (k === 0) filas[fila.n] = { ini: r3(ini + cfg.entrada) };
      filas[fila.n].fin = r3(fin + cfg.entrada);
    });
  }
  if (h !== hw.length) console.warn(`⚠ ${tramo.id}: sobran ${hw.length - h} palabras habladas`);
  const audio = path.join(VOZ, cfg.archivo + '.mp3');
  return { palabras, filas, fin: d.ends[d.ends.length - 1] + cfg.entrada, audio: { archivo: cfg.archivo + '.mp3', ini: cfg.entrada, dur: r3(d.ends[d.ends.length - 1]) } };
}
const guion = JSON.parse(fs.readFileSync(path.join(DIR, 'guion/voz.json'), 'utf8'));
const tramos = [{ id: 'short', filas: guion.filas }];

let inicio = 0;
const resumen = [];
for (const tramo of tramos) {
  const aj = AJUSTES[tramo.id] || {};
  const pps = aj.pps ?? PPS, pausa = aj.pausa ?? PAUSA_FILA;
  let t = aj.entrada ?? ENTRADA_DEF;
  const palabras = [];
  const filas = {};
  const real = REALES[tramo.id] ? palabrasReales(tramo, REALES[tramo.id]) : null;
  if (!real) tramo.filas.forEach((f, i) => {
    if (i > 0) t += pausa;
    const ini = t;
    for (const w of f.voz.split(/\s+/).filter(Boolean)) {
      palabras.push({ w, ini: r3(t), fin: r3(t + 1 / pps), fila: f.n });
      t += 1 / pps;
    }
    filas[f.n] = { ini: r3(ini), fin: r3(t) };
  });
  if (real) { palabras.push(...real.palabras); Object.assign(filas, real.filas); t = real.fin; }
  const duracion = r3(t + ((real && REALES[tramo.id].cola) ?? aj.cola ?? COLA));
  const datos = { tramo: tramo.id, origen: real ? 'voz-real' : `sintetico-${pps}pps`, inicio: r3(inicio), duracion, palabras, filas, audio: real ? real.audio : null };
  const js = `// Generado por herramientas/tiempos-sinteticos.mjs. No editar a mano.\n(window.TIEMPOS = window.TIEMPOS || {})[${JSON.stringify(tramo.id)}] = ${JSON.stringify(datos, null, 1)};\n`;
  fs.mkdirSync(path.join(DIR, 'tiempos'), { recursive: true });
  fs.writeFileSync(path.join(DIR, 'tiempos', `${tramo.id}.js`), js);
  resumen.push({ id: tramo.id, inicio: r3(inicio), duracion, palabras: palabras.length, origen: datos.origen, audio: datos.audio });
  inicio += duracion;
}

// index.html: data-start / data-duration de cada tramo y duración total.
const idx = path.join(DIR, 'index.html');
if (fs.existsSync(idx)) {
  let html = fs.readFileSync(idx, 'utf8');
  for (const r of resumen) {
    const re = new RegExp(`(<div id="${r.id}"[^>]*?data-start=")[^"]*("[^>]*?data-duration=")[^"]*(")`);
    html = html.replace(re, `$1${r.inicio}$2${r.duracion}$3`);
  }
  html = html.replace(/(<div id="root"[^>]*?data-duration=")[^"]*(")/, `$1${r3(inicio)}$2`);
  for (const r of resumen) {
    const re = new RegExp(`<audio id="voz-${r.id}"[^>]*></audio>\\n?`, 'g');
    html = html.replace(re, '');
    if (r.audio) html = html.replace('<!-- voz -->', `<!-- voz -->\n  <audio id="voz-${r.id}" src="voz/${r.audio.archivo}" data-start="${r3(r.inicio + r.audio.ini)}" data-duration="${r.audio.dur}" data-track-index="5" data-volume="1"></audio>`);
  }
  fs.writeFileSync(idx, html);
}
fs.writeFileSync(path.join(DIR, 'tiempos', 'tramos.js'),
  `// Generado por herramientas/tiempos-sinteticos.mjs. No editar a mano.\nwindow.TRAMOS = ${JSON.stringify(resumen)};\n`);
console.table(resumen);
console.log('Total', r3(inicio), 's');
