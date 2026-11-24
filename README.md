# Skills de Agentería

Skills gratis para [Claude Code](https://claude.com/claude-code): le enseñan a Claude a hacer un trabajo entero, paso a paso.

Del canal de YouTube [@Agenteria](https://www.youtube.com/@Agenteria): IA y agentes que sirven para algo.

## `shorts`: un YouTube Short entero con Claude

Le dices el tema y Claude hace el resto:

1. Escribe el guion, con una fuente para cada dato, y espera a que lo apruebes.
2. Genera la voz con ElevenLabs.
3. Anima cada frase en HTML con [HyperFrames](https://github.com/heygen-com/hyperframes), con subtítulos palabra a palabra.
4. Mezcla voz, música y efectos a −14 LUFS.
5. Revisa los fotogramas.
6. Te deja el vídeo, el título y la descripción listos.

Si tienes Claude in Chrome, también lo sube a YouTube, pero solo cuando le dices que sí.

Es la versión pública de la skill con la que hago los Shorts del canal, como «Este Short lo ha hecho Claude»: dos mensajes míos y unos 11 minutos de trabajo de Claude.

### Instalar

```bash
git clone https://github.com/AgenteriaAI/skills.git
cd skills
./instalar.sh
```

Después abre Claude Code en la carpeta donde quieras tus vídeos y pídele: **«Hazme un Short sobre …»**.

### Qué necesitas

- **Claude Code.**
- **Node 22 o más.** Con Node 20 falla el render.
- **ffmpeg** (`brew install ffmpeg` en Mac).
- **Una clave de ElevenLabs para la voz** (`ELEVENLABS_API_KEY`).
  - La voz **es de pago**: unos 0,10 $ por Short de 30 s. Claude te dice el coste antes de generarla.
  - Sin clave puedes montar el vídeo con tiempos de prueba, pero sin voz.
- **Opcional: Claude in Chrome** para que lo suba él a YouTube Studio.

### Lo que tienes que saber

- **Gratis es la skill**, no la voz: ElevenLabs cobra lo suyo.
- **Música:** no trae ninguna, porque la mayoría no se puede redistribuir. Pon en `musica/` una pista con licencia, por ejemplo de la Biblioteca de audio de YouTube.
- **Efectos:** tampoco trae; `herramientas/efectos.mjs` genera un juego con ElevenLabs por unos 0,20 $, una sola vez.
- **Fondo:** cambia de fondo y de estilo en cada Short. YouTube desmonetiza el contenido hecho en serie con la misma plantilla, y la skill se lo recuerda a Claude.
- **Datos:** Claude no se inventa cifras. Cada dato del guion lleva su fuente, pero revísalas tú antes de publicar.
- **Publicar** lo decides tú: Claude nunca sube nada sin tu sí.

## Licencia

MIT. Las fuentes incluidas (Archivo y JetBrains Mono) son SIL OFL 1.1.
