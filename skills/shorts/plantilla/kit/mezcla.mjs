// Kit · mezcla de sonido (voz + música + efectos) para el render final.
//
// HyperFrames renderiza el vídeo con la voz; esta mezcla se hace aparte, en Node, para controlar al milisegundo
// el ducking de la música bajo la voz, los efectos anclados a la imagen y el nivel final. Después se sustituye la
// pista de audio del render (ffmpeg -c:v copy). Solo mezcla archivos que ya existen: no genera voz ni sonido.
//
//   import { mezclar } from '<kit>/mezcla.mjs';
//   const informe = mezclar({ dur, voz: [{ archivo, en }], musica: {...}, habla: [[a, b]], palabras: [t...], eventos: [...], salida });
//
// Reglas:
//  - La voz manda: mientras se habla, la música queda 16-20 dB por debajo de la voz; sube solo en los huecos.
//  - Ningún efecto tapa una palabra: van por debajo de la voz y, si caen encima del arranque de una palabra,
//    se adelantan 100 ms (o se atrasan, si adelantarlos los pone sobre otra).
//  - Nivel final: −14 LUFS integrados, pico real por debajo de −1 dBTP (se hace con ffmpeg después: normalizar()).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

export const SR = 48000;
const db = (x) => Math.pow(10, x / 20);

export function leer(archivo) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', archivo, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 2e9 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}
export function escribirWav(archivo, datos) {
  const n = datos.length, h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + n * 4, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(n * 4, 40);
  fs.writeFileSync(archivo, Buffer.concat([h, Buffer.from(datos.buffer, datos.byteOffset, n * 4)]));
}
/** Sonoridad integrada (LUFS), pico real (dBTP) y rango (LU) de un archivo, con el ebur128 de ffmpeg. */
export function sonoridad(archivo, desde, hasta) {
  const args = ['-nostats'];
  if (desde != null) args.push('-ss', String(desde));
  if (hasta != null) args.push('-to', String(hasta));
  args.push('-i', archivo, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-');
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1e9 }).stderr;
  const res = r.slice(r.lastIndexOf('Summary:'));
  const num = (re) => Number((res.match(re) || [])[1]);
  return { I: num(/I:\s+(-?[\d.]+) LUFS/), LRA: num(/LRA:\s+(-?[\d.]+) LU/), TP: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}

/** RMS (dB) por bloques de 50 ms de una señal estéreo. */
function envolvente(x, paso = SR / 20) {
  const n = Math.floor(x.length / 2 / paso), e = new Float32Array(n);
  for (let k = 0; k < n; k++) { let s = 0; for (let i = k * paso; i < (k + 1) * paso; i++) { const m = (x[2 * i] + x[2 * i + 1]) / 2; s += m * m; } e[k] = Math.sqrt(s / paso); }
  return e;
}
/** Periodo del compás (s): autocorrelación de los arranques de energía, tempo entre 80 y 170 BPM, × 4 tiempos. */
export function compas(x) {
  const e = envolvente(x, SR / 100);                      // bloques de 10 ms
  const on = new Float32Array(e.length);
  for (let i = 1; i < e.length; i++) on[i] = Math.max(0, e[i] - e[i - 1]);
  let mejor = 0, lag = 0;
  for (let L = Math.round(6000 / 170); L <= Math.round(6000 / 80); L++) {
    let s = 0; for (let i = 0; i + L < on.length; i++) s += on[i] * on[i + L];
    if (s > mejor) { mejor = s; lag = L; }
  }
  return { tiempo: lag / 100, bpm: 6000 / lag, compas: (lag / 100) * 4 };
}

/**
 * Pista de música del largo: si la canción es más corta que el vídeo, se repite un trozo saltando atrás un número entero
 * de compases, con un fundido cruzado de igual potencia donde las dos zonas se parecen más; así su final real coincide
 * con el final del vídeo. Si es más larga, se corta y se funde.
 */
export function musicaLarga(x, dur, xf = 2.0) {
  const L = x.length / 2 / SR;
  const { compas: bar, bpm } = compas(x);
  if (L >= dur) return { pista: x.subarray(0, Math.ceil(dur * SR) * 2), bpm, salto: null };
  const D = Math.ceil((dur - L + 0.3) / bar) * bar;      // cuánto hay que saltar atrás
  const e = envolvente(x);                                // 50 ms
  let mejor = -Infinity, T1 = 0;
  for (let t = 90; t < L - 30; t += bar / 4) {            // dónde empalmar: la zona [t, t+8 s] frente a [t-D, t-D+8 s]
    const a = Math.round(t * 20), b = Math.round((t - D) * 20); if (b < 0) continue;
    let s = 0, na = 0, nb = 0;
    for (let k = 0; k < 160; k++) { s += e[a + k] * e[b + k]; na += e[a + k] ** 2; nb += e[b + k] ** 2; }
    const c = s / Math.sqrt(na * nb + 1e-12);
    if (c > mejor) { mejor = c; T1 = t; }
  }
  // salida: hasta T1 suena la canción tal cual; desde T1 suena la canción desde T1 - D (muestra i - iD), con un fundido
  // cruzado de igual potencia de `xf` segundos centrado en T1.
  const total = Math.ceil(dur * SR), out = new Float32Array(total * 2);
  const i1 = Math.round(T1 * SR), iD = Math.round(D * SR), nx = Math.round(xf * SR), nL = x.length / 2;
  for (let i = 0; i < total; i++) {
    const u = (i - (i1 - nx / 2)) / nx;
    const ga = u <= 0 ? 1 : u >= 1 ? 0 : Math.cos(u * Math.PI / 2), gb = u <= 0 ? 0 : u >= 1 ? 1 : Math.sin(u * Math.PI / 2);
    let v0 = 0, v1 = 0;
    if (ga > 0 && i < nL) { v0 += x[2 * i] * ga; v1 += x[2 * i + 1] * ga; }
    const q = i - iD;
    if (gb > 0 && q >= 0 && q < nL) { v0 += x[2 * q] * gb; v1 += x[2 * q + 1] * gb; }
    out[2 * i] = v0; out[2 * i + 1] = v1;
  }
  return { pista: out, bpm, salto: { en: T1, atras: D, aDe: T1 - D, fundido: xf, parecido: mejor } };
}

/** Trozo de música para el Short: la ventana de `dur` segundos con más energía (y que empiece fuerte), arrancando en un tiempo. */
export function musicaTrozo(x, dur) {
  const e = envolvente(x), n = Math.round(dur * 20);
  const { tiempo } = compas(x);
  let mejor = -Infinity, ini = 0;
  for (let t = 4; t + dur < x.length / 2 / SR - 2; t += tiempo) {
    const a = Math.round(t * 20);
    let s = 0, s1 = 0; for (let k = 0; k < n; k++) s += e[a + k]; for (let k = 0; k < 20; k++) s1 += e[a + k];
    const v = s / n + 0.5 * s1 / 20;
    if (v > mejor) { mejor = v; ini = t; }
  }
  const i0 = Math.round(ini * SR), total = Math.ceil(dur * SR);
  return { pista: x.slice(i0 * 2, (i0 + total) * 2), desde: ini };
}

/** Une intervalos de habla: palabras [{ini, fin}] globales → [[a, b]] con margen y huecos cortos rellenos. */
export function intervalosHabla(palabras, { antes = 0.06, despues = 0.14, hueco = 0.35 } = {}) {
  const v = palabras.map((p) => [p.ini - antes, p.fin + despues]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of v) { const u = out[out.length - 1]; if (u && a - u[1] < hueco) u[1] = Math.max(u[1], b); else out.push([a, b]); }
  return out;
}

/**
 * La mezcla. Devuelve un informe con las medidas (diferencia voz-música en el habla, efectos colocados y movidos).
 * cfg: { dur, voz: [{ archivo, en }], musica: Float32Array (ya cortada a dur), musicaDb, niveles: [{ t, db }],
 *        duck, habla: [[a, b]], arranques: [t...] (inicio de cada palabra), eventos: [{ t, tipo, db }], sonidos (carpeta),
 *        fundidoSalida, salida, tallos (carpeta para guardar voz.wav y musica.wav, opcional) }
 */
export function mezclar(cfg) {
  const total = Math.ceil(cfg.dur * SR), N = total * 2;
  const voz = new Float32Array(N), mus = new Float32Array(N), sfx = new Float32Array(N);
  for (const v of cfg.voz) {
    const x = leer(v.archivo), i0 = Math.round(v.en * SR) * 2;
    for (let i = 0; i < x.length && i0 + i < N; i++) voz[i0 + i] += x[i];
  }
  // ---- envolvente de la música (dB): nivel base + curva por tramos + ducking bajo la voz, suavizada ----
  const paso = SR / 100, nb = Math.ceil(total / paso), g = new Float32Array(nb);
  const niv = cfg.niveles.slice().sort((a, b) => a.t - b.t);
  const nivel = (t) => {
    if (t <= niv[0].t) return niv[0].db;
    for (let k = 1; k < niv.length; k++) if (t <= niv[k].t) { const a = niv[k - 1], b = niv[k]; return a.db + (b.db - a.db) * (t - a.t) / Math.max(1e-6, b.t - a.t); }
    return niv[niv.length - 1].db;
  };
  let h = 0;
  const objetivo = new Float32Array(nb);
  for (let k = 0; k < nb; k++) {
    const t = k / 100;
    while (h < cfg.habla.length && cfg.habla[h][1] < t) h++;
    const habla = h < cfg.habla.length && t >= cfg.habla[h][0] && t <= cfg.habla[h][1];
    objetivo[k] = cfg.musicaDb + nivel(t) + (habla ? cfg.duck : 0);
  }
  // ataque 60 ms al bajar, suelta 300 ms al subir (anticipando un poco el ataque para que la voz entre limpia)
  const adelanto = 6;
  const obj2 = new Float32Array(nb);
  for (let k = 0; k < nb; k++) { let m = objetivo[k]; for (let j = 1; j <= adelanto && k + j < nb; j++) m = Math.min(m, objetivo[k + j]); obj2[k] = m; }
  let cur = obj2[0];
  for (let k = 0; k < nb; k++) { const o = obj2[k]; cur += (o - cur) * (o < cur ? 1 - Math.exp(-1 / 6) : 1 - Math.exp(-1 / 30)); g[k] = cur; }
  const fs0 = (cfg.fundidoEntrada || 0), fsal = cfg.fundidoSalida || 0;
  for (let i = 0; i < total; i++) {
    const kf = i / paso, k = Math.min(nb - 2, Math.floor(kf)), u = kf - k;
    let lin = db(g[k] * (1 - u) + g[k + 1] * u);
    const t = i / SR;
    if (fs0 > 0 && t < fs0) lin *= t / fs0;
    if (fsal > 0 && t > cfg.dur - fsal) lin *= Math.max(0, (cfg.dur - t) / fsal);
    mus[2 * i] = (cfg.musica[2 * i] || 0) * lin; mus[2 * i + 1] = (cfg.musica[2 * i + 1] || 0) * lin;
  }
  // ---- efectos ----
  const cache = {}, colocados = [];
  const arr = cfg.arranques.slice().sort((a, b) => a - b);
  const cerca = (t) => arr.some((a) => Math.abs(a - t) < 0.05);
  for (const ev of cfg.eventos.slice().sort((a, b) => a.t - b.t)) {
    let t = ev.t, movido = 0;
    if (cerca(t)) { if (!cerca(t - 0.1)) { t -= 0.1; movido = -100; } else if (!cerca(t + 0.1)) { t += 0.1; movido = 100; } }
    t = Math.max(0, t);
    const x = cache[ev.tipo] || (cache[ev.tipo] = leer(path.join(cfg.sonidos, ev.tipo + '.mp3')));
    const i0 = Math.round(t * SR) * 2, gl = db(ev.db);
    for (let i = 0; i < x.length && i0 + i < N; i++) sfx[i0 + i] += x[i] * gl;
    colocados.push({ t: Math.round(t * 1000) / 1000, tipo: ev.tipo, db: ev.db, movido, nota: ev.nota || '' });
  }
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = voz[i] + mus[i] + sfx[i];
  escribirWav(cfg.salida, out);
  // ---- medidas: voz frente a música dentro del habla (RMS en dB), y la música en los huecos ----
  const rms = (x, ivs) => { let s = 0, n = 0; for (const [a, b] of ivs) for (let i = Math.max(0, Math.round(a * SR)); i < Math.min(total, Math.round(b * SR)); i++) { const m = (x[2 * i] + x[2 * i + 1]) / 2; s += m * m; n++; } return 10 * Math.log10(s / Math.max(1, n) + 1e-20); };
  const huecos = []; let ant = 0; for (const [a, b] of cfg.habla) { if (a - ant > 0.4) huecos.push([ant + 0.1, a - 0.1]); ant = b; }
  if (cfg.dur - ant > 0.4) huecos.push([ant + 0.1, cfg.dur - 0.1]);
  const medidas = { vozEnHabla: rms(voz, cfg.habla), musicaEnHabla: rms(mus, cfg.habla), musicaEnHuecos: rms(mus, huecos), efectosEnTotal: rms(sfx, [[0, cfg.dur]]) };
  medidas.vozMenosMusica = medidas.vozEnHabla - medidas.musicaEnHabla;
  if (cfg.tallos) { fs.mkdirSync(cfg.tallos, { recursive: true }); escribirWav(path.join(cfg.tallos, 'voz.wav'), voz); escribirWav(path.join(cfg.tallos, 'musica.wav'), mus); escribirWav(path.join(cfg.tallos, 'efectos.wav'), sfx); }
  return { medidas, colocados };
}

/** Normaliza a −14 LUFS con pico real ≤ −1,5 dBTP (loudnorm en dos pasadas, lineal si se puede) y codifica en AAC. */
export function normalizar(entrada, salida, { I = -14, TP = -1.5, LRA = 11 } = {}) {
  const p1 = spawnSync('ffmpeg', ['-nostats', '-i', entrada, '-af', `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1e8 }).stderr;
  const j = JSON.parse(p1.slice(p1.lastIndexOf('{'), p1.lastIndexOf('}') + 1));
  const af = `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=48000`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', entrada, '-af', af, '-c:a', 'pcm_f32le', salida], { encoding: 'utf8' });
  if (r.status) throw new Error(r.stderr);
  return j;
}
