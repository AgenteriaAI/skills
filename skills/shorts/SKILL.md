---
name: shorts
description: Produce un YouTube Short vertical (1080×1920, 20-45 s) de principio a fin con Claude — idea, guion, voz con ElevenLabs, animación en HTML con HyperFrames, sonido, revisión y paquete para subir, y si la persona quiere, la subida a YouTube con Claude in Chrome. Úsala cuando pidan un Short, un vídeo vertical o un reel sobre un tema.
---

# Shorts con Claude

Haces un Short entero: la persona da el tema y aprueba; tú haces lo demás. Hay dos paradas en las que **esperas su respuesta**: el guion (antes de gastar en voz) y la subida (publicar es suyo).

Todo lo que ve el espectador va en el idioma de la persona. Si no dice otra cosa, español.

## 0. Preparar la carpeta

1. Copia la plantilla a una carpeta nueva del proyecto de la persona: `cp -R ~/.claude/skills/shorts/plantilla <carpeta>/short-<tema>`.
2. Dentro: `npm install` y `npm run preparar` (copia GSAP a `vendor/`).
3. Requisitos: Node 22 o más (con Node 20 falla el render), `ffmpeg` y, para la voz, `ELEVENLABS_API_KEY` en el entorno. Si falta algo, dilo antes de seguir.

## 1. Guion — PARADA

Escribe en el chat, en una tabla, una fila por frase:

| # | Voz (texto exacto) | Pantalla (qué se ve y qué cambia) | Rótulo | Fuente |
|---|---|---|---|---|

- 20-45 s: unas 60-120 palabras, frases de 6 a 16.
- **El primer segundo enseña el resultado** (una cifra, la prueba, lo raro), no contexto. Prohibido «hola» o «en este vídeo».
- Cada frase cambia algo en pantalla. Si una fila no tiene nada que cambie, sobra la frase.
- **Cada cifra o dato tiene fuente** (medición propia, documento oficial, enlace). Sin fuente no entra. No inventes números.
- Última frase: la llamada (seguir, ver el vídeo largo, el enlace).
- Di el coste de la voz (unos 0,10 $ por Short) y **espera el visto bueno**.

Con el visto bueno, escribe `guion/voz.json`: `voz` es lo que sale en los subtítulos y `hablado` lo que se manda a la voz, con exclamaciones y marcas como `[excited]`, `[fast]` o `[amazed]` para que suene con energía.

## 2. Voz

`node herramientas/voz.mjs`, y después `node herramientas/tiempos.mjs`.

- Si el script avisa de que una marca dura más de 0,6 s, la ha leído en voz alta: quítala y regenera, diciendo antes el coste.
- `tiempos.mjs` avisa si alguna palabra no cuadra con el guion. Arréglalo antes de animar.
- Sin clave, `tiempos.mjs` genera tiempos sintéticos y puedes montar un borrador gratis.

## 3. Animación

Edita `compositions/short.html`. La plantilla trae un ejemplo de 4 filas con las piezas del kit (`kit/kit.js`):

- `Kit.anclas(T)`: `A.p(fila, 'palabra')` da el segundo en que se dice esa palabra. **Ancla cada aparición a la palabra que la nombra**, nunca a segundos escritos a mano.
- `Kit.subtitulos`: subtítulos palabra a palabra.
- `Kit.sellar`: etiqueta que se estampa.
- `Kit.contar`: contador.
- `Kit.teclear`: texto que se escribe.
- `Kit.entrarVentana` y `Kit.escalonar`: entradas.
- `Kit.zoomA` y `Kit.resaltar`: zoom y recuadro sobre una captura.

Reglas:

- Zona segura de Shorts: lo importante entre y 230 y 1310 y entre x 60 y 888. Los subtítulos, en la franja 1344-1460.
- El plano que sale se va antes de que entre el siguiente (función `fuera`); golpe de cámara y destello en cada corte.
- **Fondo y estilo propios en cada Short** (`index.html`). YouTube desmonetiza el contenido hecho en serie con la misma plantilla. Cambia al menos el fondo, la paleta y el tipo de plano de un Short a otro.
- Las capturas de pantalla reales valen más que las ilustraciones. Van en `assets/` dentro de la carpeta: el render no sigue rutas de fuera.
- Nada de logotipos, personajes o portadas ajenas, salvo las herramientas de las que trata el vídeo.

Comprueba con `npm run check` (0 errores) y mira fotogramas con `npx hyperframes@0.9.70 snapshot --at 1,5,10`. Los avisos `line_unread` de los subtítulos son normales.

## 4. Sonido y render

1. Música opcional: un `.mp3` con licencia en `musica/` (por ejemplo, de la Biblioteca de audio de YouTube). Apunta título y autor para la descripción.
2. Efectos opcionales: `guion/efectos.json`, con los sonidos en `sonidos/`. `herramientas/efectos.mjs` genera un juego una sola vez (unos 0,20 $, dilo antes).
3. `npm run render`, luego `npm run sonido` y después `npm run final`. Sale `renders/short.mp4`, a −14 LUFS.

## 5. Revisión antes de enseñar

- Hoja de fotogramas: `ffmpeg -i renders/short.mp4 -vf "fps=1/1.25,scale=216:-1,tile=7x4" -frames:v 1 hoja.jpg`. Mírala entera: nada cortado, nada tapado, nada que se cruce en los cortes.
- Fotogramas grandes del primer segundo y de cada cifra.
- Cada cifra coincide con su fuente.
- Si no puedes escucharlo, dilo: has comprobado el sonido midiendo, no de oído.

## 6. Paquete y subida — PARADA

Prepara título (tres opciones, menos de 60 caracteres), descripción, etiquetas y ajustes. Enséñaselos con el vídeo.

**Subir es publicar: solo con su sí expreso para ese vídeo.** Si dice que sí y tiene Claude in Chrome:

- Abre `studio.youtube.com` en su navegador y comprueba que está en el canal correcto.
- Sube el archivo; si pasa de 10 MB, recodifícalo antes con `-c:v libx264 -crf 20 -maxrate 2400k -bufsize 4800k`.
- Rellena título, descripción y ajustes.
- Publica cuando lo confirme.

Si no tiene Claude in Chrome, déjale el paquete en una carpeta y dile dónde está.
