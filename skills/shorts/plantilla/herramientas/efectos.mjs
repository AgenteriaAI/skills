#!/usr/bin/env node
// Genera una vez el juego de efectos (sonidos/*.mp3) con ElevenLabs. Opcional: cuesta unos 0,15-0,25 $ en total.
//
//   ELEVENLABS_API_KEY=… node herramientas/efectos.mjs
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Falta ELEVENLABS_API_KEY.'); process.exit(1); }
const JUEGO = {
  golpe: ['Short punchy cinematic impact hit, deep and clean, no reverb tail', 0.6],
  sello: ['Rubber stamp slammed on paper, crisp and satisfying', 0.5],
  aparece: ['Soft modern UI pop, short and bright', 0.4],
  desliza: ['Quick airy whoosh swipe transition', 0.5],
  clic: ['Single clean mouse click', 0.3],
  tecla: ['Two soft mechanical keyboard key presses', 0.4],
  contador: ['Fast digital counter ticking up, short', 0.8],
  acierto: ['Positive short success chime, modern UI', 0.6],
  fallo: ['Short soft error buzz, modern UI, not harsh', 0.5],
};
const out = path.join(DIR, 'sonidos'); fs.mkdirSync(out, { recursive: true });
for (const [tipo, [texto, dur]] of Object.entries(JUEGO)) {
  const f = path.join(out, tipo + '.mp3'); if (fs.existsSync(f)) continue;
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: texto, duration_seconds: dur, prompt_influence: 0.6 }),
  });
  if (!res.ok) { console.error(tipo, res.status, await res.text()); process.exit(1); }
  fs.writeFileSync(f, Buffer.from(await res.arrayBuffer())); console.log('ok', tipo);
}
