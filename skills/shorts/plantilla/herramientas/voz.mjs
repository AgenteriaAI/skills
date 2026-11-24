#!/usr/bin/env node
// Genera la voz del Short con ElevenLabs y los tiempos de cada carácter (para anclar la animación y los subtítulos).
//
//   ELEVENLABS_API_KEY=… node herramientas/voz.mjs
//
// Lee guion/voz.json ({ filas: [{ n, voz, hablado? }] }). «voz» es lo que sale en los subtítulos; «hablado», si está,
// es lo que se manda a la voz (con exclamaciones y marcas como [excited], que no se dicen ni se subtitulan).
// Escribe voz/short.raw.mp3 (tal cual), voz/short.mp3 (acelerado VOICE_SPEED) y voz/short.tiempos.json.
// Cuesta dinero: unos 0,10 $ por Short de 30 s. No rehace la voz si ya existe (bórrala para regenerarla).
//
// Variables: ELEVENLABS_API_KEY (obligatoria), ELEVENLABS_VOICE_ID (por defecto, una voz joven y enérgica en español),
// ELEVENLABS_MODEL (eleven_v3), ELEVENLABS_STABILITY (0 = la más expresiva), VOICE_SPEED (1.1).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Falta ELEVENLABS_API_KEY (https://elevenlabs.io → Developers → API keys).'); process.exit(1); }
const VOZ = process.env.ELEVENLABS_VOICE_ID || 'nMPrFLO7QElx9wTR0JGo';
const MODELO = process.env.ELEVENLABS_MODEL || 'eleven_v3';
const ESTAB = process.env.ELEVENLABS_STABILITY ?? '0';
const K = Number(process.env.VOICE_SPEED || 1.1);

const { filas } = JSON.parse(fs.readFileSync(path.join(DIR, 'guion/voz.json'), 'utf8'));
const texto = filas.map((f) => f.voz).join(' ');
const hablado = filas.map((f) => f.hablado || f.voz).join(' ');
const out = path.join(DIR, 'voz');
fs.mkdirSync(out, { recursive: true });
const mp3 = path.join(out, 'short.mp3'), raw = path.join(out, 'short.raw.mp3');
if (fs.existsSync(mp3)) { console.log('La voz ya existe (voz/short.mp3). Bórrala para generarla otra vez.'); process.exit(0); }

const body = { text: hablado, model_id: MODELO };
if (ESTAB !== '') body.voice_settings = { stability: Number(ESTAB) };
const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(VOZ)}/with-timestamps?output_format=mp3_44100_128`, {
  method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(body),
});
if (!res.ok) { console.error('ElevenLabs respondió', res.status, await res.text()); process.exit(1); }
const j = await res.json();
fs.writeFileSync(raw, Buffer.from(j.audio_base64, 'base64'));
if (K !== 1) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-filter:a', `atempo=${K}`, mp3]); else fs.copyFileSync(raw, mp3);
const a = j.alignment;
const esc = (xs) => xs.map((x) => +(x / K).toFixed(3));
fs.writeFileSync(path.join(out, 'short.tiempos.json'), JSON.stringify({ voz: VOZ, velocidad: K, texto, hablado, chars: a.characters, starts: esc(a.character_start_times_seconds), ends: esc(a.character_end_times_seconds) }));
const dur = a.character_end_times_seconds.at(-1) / K;
console.log(`Voz lista: ${hablado.length} caracteres, ${dur.toFixed(1)} s.`);
// Las marcas entre corchetes no deben leerse en voz alta: si una dura más de 0,6 s, la ha dicho.
const s = a.characters.join('');
for (const m of s.matchAll(/\[[^\]]*\]/g)) {
  const d = (a.character_start_times_seconds[Math.min(s.length - 1, m.index + m[0].length + 1)] - a.character_start_times_seconds[m.index]) / K;
  if (d > 0.6) console.warn(`⚠ La marca ${m[0]} dura ${d.toFixed(2)} s: puede que la haya leído en voz alta. Escúchalo.`);
}
