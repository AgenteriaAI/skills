#!/usr/bin/env node
// Mezcla final: voz + música (opcional) + efectos (opcionales) anclados a palabras. La música baja sola bajo la voz
// (ducking) y el resultado sale a −14 LUFS con pico real ≤ −1,5 dBTP, lo que pide YouTube.
//
//   node herramientas/sonido.mjs            → renders/mezcla/final.wav
//
// Música: el primer .mp3 de musica/ (pon ahí una pista con licencia para usarla, por ejemplo de la Biblioteca de audio
// de YouTube; apunta título y autor para la descripción). Sin música, solo voz y efectos.
// Efectos: guion/efectos.json → [{ "fila": 1, "palabra": "cero", "tipo": "golpe", "db": -9, "nota": "cae el 0" }, …]
// con sonidos/<tipo>.mp3 (herramientas/efectos.mjs genera un juego). Los que no tengan archivo se saltan.
import fs from 'node:fs';
import path from 'node:path';
import { leer, escribirWav, sonoridad, musicaTrozo, intervalosHabla, mezclar, normalizar } from '../kit/mezcla.mjs';

const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(DIR, 'renders/mezcla');
fs.mkdirSync(OUT, { recursive: true });
const w = {};
new Function('window', fs.readFileSync(path.join(DIR, 'tiempos/tramos.js'), 'utf8'))(w);
new Function('window', fs.readFileSync(path.join(DIR, 'tiempos/short.js'), 'utf8'))(w);
const T = w.TIEMPOS.short, TR = w.TRAMOS[0], DUR = T.duracion;
if (!TR.audio) { console.error('No hay voz real todavía (herramientas/voz.mjs y luego herramientas/tiempos.mjs).'); process.exit(1); }
const norm = (s) => s.toLowerCase().replace(/[.,:;¿?¡!«»"()…]/g, '');
const P = (fila, palabra, n = 1) => {
  let k = 0;
  for (const p of T.palabras) if (p.fila === fila && norm(p.w) === norm(palabra) && ++k === n) return p.ini;
  throw new Error(`no encuentro «${palabra}» en la fila ${fila}`);
};
const SON = path.join(DIR, 'sonidos');
const fEf = path.join(DIR, 'guion/efectos.json');
const E = (fs.existsSync(fEf) ? JSON.parse(fs.readFileSync(fEf, 'utf8')) : [])
  .map((e) => ({ t: e.t ?? P(e.fila, e.palabra, e.n) + (e.desfase || 0), tipo: e.tipo, db: e.db ?? -12, nota: e.nota }))
  .filter((e) => fs.existsSync(path.join(SON, e.tipo + '.mp3')));
const mus = fs.existsSync(path.join(DIR, 'musica')) ? fs.readdirSync(path.join(DIR, 'musica')).filter((f) => f.endsWith('.mp3')).sort()[0] : null;
const VOZ = path.join(DIR, 'voz', TR.audio.archivo);
const Ivoz = sonoridad(VOZ).I;
let pista = new Float32Array(Math.ceil(DUR * 48000) * 2), desde = null, musicaDb = -60;
if (mus) {
  const r = musicaTrozo(leer(path.join(DIR, 'musica', mus)), DUR); pista = r.pista; desde = r.desde;
  escribirWav(path.join(OUT, 'musica-cruda.wav'), pista);
  musicaDb = Ivoz - sonoridad(path.join(OUT, 'musica-cruda.wav')).I - 10;
}
const r = mezclar({
  dur: DUR, voz: [{ archivo: VOZ, en: TR.audio.ini }], musica: pista, musicaDb, niveles: [{ t: 0, db: 2 }, { t: 1, db: 0 }], duck: -12,
  habla: intervalosHabla(T.palabras), arranques: T.palabras.map((p) => p.ini), eventos: E, sonidos: SON,
  fundidoEntrada: 0.01, fundidoSalida: 0.8, salida: path.join(OUT, 'mezcla.wav'),
});
normalizar(path.join(OUT, 'mezcla.wav'), path.join(OUT, 'final.wav'));
const fin = sonoridad(path.join(OUT, 'final.wav'));
console.log(JSON.stringify({ musica: mus, musicaDesde: desde, efectos: r.colocados.length, vozMenosMusica: mus ? +r.medidas.vozMenosMusica.toFixed(1) : null, final: fin }, null, 1));
