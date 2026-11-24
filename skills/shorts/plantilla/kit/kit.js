// Kit de animación de Shorts (Agentería) · ayudas para GSAP (script clásico: define window.Kit)
//
// Todo lo que hay aquí añade tweens a una línea de tiempo en pausa que le pasas: nada corre solo,
// nada mira el reloj. Se puede saltar a cualquier fotograma.
//
// Tiempos: las animaciones se anclan a palabras de la voz con Kit.anclas(TIEMPOS[tramo]).
// Curvas (guía de ritmo): entradas de 250-400 ms con salida suave, cámara de 600-900 ms
// con aceleración y frenada, rebote pequeño solo en etiquetas y cifras, escalonado de 40-70 ms.

(function () {
  const Kit = {};

  // ---------- anclaje a palabras ----------
  const norm = (s) => s.toLowerCase().replace(/[.,:;¿?¡!«»"()…]/g, '').trim();

  /** A.p(fila, 'palabra', n=1) → inicio (s, tiempo local del tramo) de la n-ésima aparición de esa palabra en la fila.
   *  A.f(fila, 'palabra', n=1) → su final. A.fila(n) → {ini, fin}. A.dur → duración del tramo. */
  Kit.anclas = function (T) {
    function buscar(fila, palabra, n) {
      const w = norm(palabra);
      let k = 0;
      for (const p of T.palabras) {
        if (p.fila === fila && norm(p.w) === w && ++k === (n || 1)) return p;
      }
      throw new Error(`Kit.anclas: no encuentro «${palabra}» (${n || 1}ª) en la fila ${fila} del tramo ${T.tramo}`);
    }
    return {
      p: (fila, palabra, n) => buscar(fila, palabra, n).ini,
      f: (fila, palabra, n) => buscar(fila, palabra, n).fin,
      fila: (n) => T.filas[n],
      dur: T.duracion,
      T,
    };
  };

  // ---------- curvas por tramos (cámara 3D, valores sueltos) ----------
  const curvas = {
    lineal: (x) => x,
    suave: (x) => x * x * (3 - 2 * x),
    io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    sale: (x) => 1 - Math.pow(1 - x, 3),
    entra: (x) => x * x * x,
  };
  Kit.curvas = curvas;

  /** Kit.pista([{t, v, curva}]) → f(t): interpola números o listas de números entre llaves.
   *  La curva de cada llave se usa para el tramo que llega a ella (por defecto 'io'). */
  Kit.pista = function (llaves) {
    const L = llaves.slice().sort((a, b) => a.t - b.t);
    return function (t) {
      if (t <= L[0].t) return L[0].v;
      for (let i = 1; i < L.length; i++) {
        if (t <= L[i].t) {
          const a = L[i - 1], b = L[i];
          const x = (curvas[b.curva || 'io'])((t - a.t) / (b.t - a.t || 1));
          return Array.isArray(a.v) ? a.v.map((va, k) => va + (b.v[k] - va) * x) : a.v + (b.v - a.v) * x;
        }
      }
      return L[L.length - 1].v;
    };
  };

  // ---------- texto ----------
  const fmtES = (n, dec) => n.toLocaleString('es-ES', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0, useGrouping: 'always' });
  Kit.formato = fmtES;

  /** Texto que se teclea letra a letra entre t0 y t0+dur. El sitio del texto completo se reserva desde el
   *  principio (no salta el renglón). opciones.cursor: true deja un cursor que se apaga en opciones.cursorFin. */
  Kit.teclear = function (tl, el, texto, t0, dur, opciones) {
    const o = Object.assign({ cursor: true, cursorFin: null, fino: false }, opciones);
    el.classList.add('k-teclear');
    el.innerHTML = '';
    const hecho = document.createElement('span'); hecho.className = 'k-hecho';
    const cur = document.createElement('span'); cur.className = 'k-cursor' + (o.fino ? ' k-cursor--fino' : '');
    const falta = document.createElement('span'); falta.className = 'k-falta'; falta.textContent = texto;
    el.append(hecho, cur, falta);
    const estado = { n: 0 };
    const pintar = () => {
      const n = Math.round(estado.n);
      hecho.textContent = texto.slice(0, n);
      falta.textContent = texto.slice(n);
    };
    pintar();
    cur.style.opacity = o.cursor ? '1' : '0';
    tl.to(estado, { n: texto.length, duration: dur, ease: 'none', onUpdate: pintar }, t0);
    if (o.cursor && o.cursorFin != null) tl.to(cur, { opacity: 0, duration: 0.12, ease: 'none' }, o.cursorFin);
    return { hecho, cursor: cur, falta };
  };

  /** Contador que sube de «de» a «a» entre t0 y t0+dur. formato(n) → texto. */
  Kit.contar = function (tl, el, de, a, t0, dur, formato, curva) {
    const f = formato || ((n) => fmtES(Math.round(n)));
    const estado = { v: de };
    el.textContent = f(de);
    tl.to(estado, { v: a, duration: dur, ease: curva || 'power2.out', onUpdate: () => { el.textContent = f(estado.v); } }, t0);
  };

  // ---------- entradas y salidas ----------
  /** Ventana o panel que entra con perspectiva y sombra (desde abajo por defecto). */
  Kit.entrarVentana = function (tl, el, t, o) {
    o = Object.assign({ y: 140, x: 0, rotX: 16, rotY: 0, escala: 0.9, dur: 0.75 }, o);
    // Voz enérgica: entradas un 30 % más cortas y con un pequeño rebote al llegar.
    tl.fromTo(el, { opacity: 0, x: o.x, y: o.y, rotationX: o.rotX, rotationY: o.rotY, scale: o.escala, transformPerspective: 1800 },
      { opacity: 1, x: 0, y: 0, rotationX: 0, rotationY: 0, scale: 1, duration: o.dur * 0.7, ease: 'back.out(1.3)' }, t);
  };

  /** Elementos de una lista que entran escalonados (40-70 ms). */
  Kit.escalonar = function (tl, els, t, o) {
    o = Object.assign({ y: 40, x: 0, dur: 0.3, paso: 0.045 }, o);
    tl.fromTo(els, { opacity: 0, y: o.y, x: o.x }, { opacity: 1, y: 0, x: 0, duration: o.dur, ease: 'power3.out', stagger: o.paso }, t);
  };

  /** Etiqueta que se estampa: cae girada desde grande, rebota un poco y deja una onda. */
  Kit.sellar = function (tl, el, t, o) {
    o = Object.assign({ giro: -4, onda: null, sacudir: null }, o);
    tl.fromTo(el, { opacity: 0, scale: 2.1, rotation: o.giro + 14 },
      { opacity: 1, scale: 1, rotation: o.giro, duration: 0.3, ease: 'back.out(1.9)' }, t);
    if (o.onda) tl.fromTo(o.onda, { opacity: 0.85, scale: 1 }, { opacity: 0, scale: 1.45, duration: 0.5, ease: 'power2.out', immediateRender: false }, t + 0.2);
    if (o.sacudir) tl.fromTo(o.sacudir, { x: 0, y: 0 }, { keyframes: [{ x: -7, y: 5, duration: 0.05 }, { x: 5, y: -3, duration: 0.05 }, { x: -2, y: 1, duration: 0.05 }, { x: 0, y: 0, duration: 0.06 }], ease: 'none' }, t + 0.2);
  };

  // ---------- cortinilla amarilla (< 0,6 s): la barra tapa la pantalla en tCorte ----------
  Kit.cortinilla = function (tl, raiz, tCorte, o) {
    o = Object.assign({ ancho: 1920, entra: 0.2, sale: 0.22 }, o);
    const barra = raiz.querySelector('.k-cortinilla__barra');
    const raya = raiz.querySelector('.k-cortinilla__raya');
    const simbolo = raiz.querySelector('.k-cortinilla__simbolo');
    const W = 2300;
    tl.fromTo(barra, { x: -W - 500, skewX: -27 }, { x: (o.ancho - W) / 2, skewX: -27, duration: o.entra, ease: 'power3.in' }, tCorte - o.entra);
    tl.to(barra, { x: o.ancho + 500, duration: o.sale, ease: 'power3.out' }, tCorte);
    if (raya) {
      tl.fromTo(raya, { x: -W - 500 + W * 0.18, skewX: -27 }, { x: (o.ancho - W) / 2 + W * 0.18, skewX: -27, duration: o.entra, ease: 'power2.in' }, tCorte - o.entra);
      tl.to(raya, { x: o.ancho + 500 + W * 0.62, duration: o.sale * 0.9, ease: 'power2.out' }, tCorte);
    }
    if (simbolo) tl.fromTo(simbolo, { scale: 0.2, rotation: 0, opacity: 0 }, { keyframes: [{ scale: 1, rotation: 27, opacity: 1, duration: 0.12 }, { scale: 0.6, opacity: 0, duration: 0.12 }], ease: 'power2.out' }, tCorte - 0.08);
  };

  // ---------- diagrama: flecha que se dibuja y punto azul que viaja ----------
  Kit.dibujarFlecha = function (tl, path, t, dur) {
    const L = path.getTotalLength();
    path.style.strokeDasharray = L;
    tl.fromTo(path, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: dur || 0.6, ease: 'power2.inOut' }, t);
  };
  Kit.viajarPunto = function (tl, punto, path, t, dur, veces) {
    const L = path.getTotalLength();
    const e = { u: 0 };
    const pintar = () => { const p = path.getPointAtLength((e.u % 1) * L); punto.setAttribute('cx', p.x); punto.setAttribute('cy', p.y); };
    pintar();
    tl.fromTo(punto, { opacity: 0 }, { opacity: 1, duration: 0.12 }, t);
    tl.to(e, { u: (veces || 1) - 0.0001, duration: dur, ease: veces > 1 ? 'none' : 'power1.inOut', onUpdate: pintar }, t);
    tl.to(punto, { opacity: 0, duration: 0.12 }, t + dur - 0.1);
  };

  // ---------- puntero y clic ----------
  Kit.clic = function (tl, puntero, onda, t) {
    tl.to(puntero, { scale: 0.86, duration: 0.08, ease: 'power2.in' }, t - 0.08);
    tl.to(puntero, { scale: 1, duration: 0.16, ease: 'back.out(2)' }, t);
    if (onda) tl.fromTo(onda, { opacity: 0.9, scale: 0.3 }, { opacity: 0, scale: 1.4, duration: 0.45, ease: 'power2.out', immediateRender: false }, t);
  };

  // ---------- subtítulos palabra a palabra (Short) ----------
  /** Crea en «caja» grupos de hasta «max» palabras (corta también en puntuación) y los enseña palabra a palabra
   *  con los tiempos de la voz. palabras: [{ w, ini, fin }]. */
  Kit.subtitulos = function (tl, caja, palabras, o) {
    o = Object.assign({ max: 3, maxLetras: 99, resaltar: null, acento: null, previa: 0.35 }, o);
    const grupos = [];
    let g = [];
    palabras.forEach((p, i) => {
      const letras = g.reduce((n, x) => n + x.w.length + 1, 0) + p.w.length;
      if (g.length && letras > o.maxLetras) { grupos.push(g); g = []; }
      g.push(p);
      const corte = /[.,:;?!»]$/.test(p.w) || g.length >= o.max || i === palabras.length - 1;
      if (corte) { grupos.push(g); g = []; }
    });
    grupos.forEach((gr, k) => {
      const div = document.createElement('div');
      div.className = 'k-subs__grupo';
      div.style.cssText = 'position:absolute;inset:0;padding:0 .5em;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;align-content:center;gap:0 .26em;opacity:0';   // centrado en la caja, en los dos ejes
      gr.forEach((p) => { const s = document.createElement('span'); s.textContent = p.w; div.appendChild(s); });
      caja.appendChild(div);
      const ini = gr[0].ini - 0.04;
      const fin = k < grupos.length - 1 ? grupos[k + 1][0].ini - 0.04 : gr[gr.length - 1].fin + 0.6;
      tl.set(div, { opacity: 1 }, ini);
      tl.set(div, { opacity: 0 }, fin);
      Array.from(div.children).forEach((s, j) => {
        // el grupo entero se ve desde el principio, tenue, y cada palabra se enciende al decirla: así el texto
        // siempre queda centrado en la caja (antes las palabras por decir reservaban su hueco y la frase se veía descentrada)
        tl.fromTo(s, { opacity: o.previa, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.12, ease: 'back.out(2)', immediateRender: true }, gr[j].ini - 0.04);
        // acento en cada exclamación: el grupo da un golpe de escala y, si se pasa, la escena se sacude
        if (/!$/.test(gr[j].w)) {
          tl.fromTo(div, { scale: 1.22 }, { scale: 1, duration: 0.2, ease: 'back.out(2.5)', immediateRender: false }, gr[j].ini - 0.04);
          if (o.acento) tl.fromTo(o.acento, { x: 0, y: 0 }, { keyframes: [{ x: -9, y: 6, duration: 0.04 }, { x: 7, y: -4, duration: 0.04 }, { x: -3, y: 2, duration: 0.04 }, { x: 0, y: 0, duration: 0.05 }], ease: 'none', immediateRender: false }, gr[j].ini - 0.02);
        }
        if (o.resaltar) {
          tl.set(s, { color: o.resaltar }, gr[j].ini - 0.04);
          const sig = j < gr.length - 1 ? gr[j + 1].ini - 0.04 : null;
          if (sig != null) tl.set(s, { color: '#F4F1EA' }, sig);
        }
      });
    });
  };

  // ---------- marcadores «pendiente» con vida ----------
  /** Las rayas del marcador se desplazan y las barras de esqueleto laten durante todo el tramo:
   *  el plano no se queda muerto aunque falte la grabación o la respuesta. */
  Kit.animarPendientes = function (tl, raiz, dur) {
    raiz.querySelectorAll('.k-pendiente, .k-pend').forEach((el) => {
      tl.fromTo(el, { backgroundPosition: '0px 0px' }, { backgroundPosition: Math.round(dur * 60) + 'px 0px', duration: dur, ease: 'none' }, 0);
    });
    const barras = raiz.querySelectorAll('.k-esqueleto i, .k-pend .k-esqueleto s');
    if (barras.length) {
      const veces = Math.max(1, Math.floor(dur / 1.2));
      tl.fromTo(barras, { opacity: 1 }, { opacity: 0.35, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: veces * 2 - 1, stagger: { each: 0.05, from: 'start' } }, 0);
    }
  };

  // ---------- logotipos de herramienta ----------
  Kit.logo = (nombre) => (window.KitLogos && window.KitLogos[nombre]) || '';
  /** Rellena todos los .k-logo-herr[data-logo] dentro de raiz con su SVG. */
  Kit.logos = function (raiz) {
    (raiz || document).querySelectorAll('.k-logo-herr[data-logo]').forEach((el) => { if (!el.querySelector('svg')) el.innerHTML = Kit.logo(el.dataset.logo); });
  };

  // ---------- marco de captura con vídeo real ----------
  /** Zoom animado a una zona del vídeo. lienzo = .k-captura__lienzo (transform-origin 0 0).
   *  zona = { x, y, escala } en píxeles del marco: el punto (x, y) queda en el centro, sin enseñar bordes vacíos. */
  Kit.zoomA = function (tl, lienzo, t, zona, dur) {
    const W = lienzo.offsetWidth, H = lienzo.offsetHeight, s = zona.escala || 1;
    let tx = W / 2 - zona.x * s, ty = H / 2 - zona.y * s;
    tx = Math.min(0, Math.max(W - W * s, tx)); ty = Math.min(0, Math.max(H - H * s, ty));
    tl.to(lienzo, { x: tx, y: ty, scale: s, transformOrigin: '0 0', duration: dur || 0.8, ease: 'power3.inOut' }, t);
  };
  /** Rectángulo amarillo que se dibuja sobre una zona (en píxeles del marco, antes del zoom: va dentro del lienzo). */
  Kit.resaltar = function (tl, el, t, r, hasta) {
    Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    tl.fromTo(el, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.8)' }, t);
    if (hasta != null) tl.to(el, { opacity: 0, duration: 0.2 }, hasta);
  };
  /** Halo que sigue al cursor del vídeo: puntos [{ t, x, y }] en píxeles del marco. */
  Kit.cursorFoco = function (tl, el, puntos) {
    if (!puntos.length) return;
    tl.set(el, { x: puntos[0].x, y: puntos[0].y }, 0);
    tl.fromTo(el, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.25 }, puntos[0].t);
    for (let k = 1; k < puntos.length; k++) tl.to(el, { x: puntos[k].x, y: puntos[k].y, duration: Math.max(0.15, puntos[k].t - puntos[k - 1].t), ease: 'power2.inOut' }, puntos[k - 1].t);
  };
  /** Rótulo de paso «1», «2», «3» que se estampa. */
  Kit.paso = function (tl, el, t, hasta) {
    tl.fromTo(el, { opacity: 0, scale: 1.8, rotation: -12 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.3, ease: 'back.out(2)' }, t);
    if (hasta != null) tl.to(el, { opacity: 0, y: -20, duration: 0.25 }, hasta);
  };

  /** Casilla de una .k-lista que se marca: verde, palomita y un pequeño golpe (ilustraciones de pasos). */
  Kit.marcar = function (tl, item, t) {
    const caja = item.querySelector('.k-lista__caja');
    tl.fromTo(caja, { backgroundColor: 'rgba(34,197,94,0)', borderColor: caja ? getComputedStyle(caja).borderColor : '#4a4e5b', '--hecho': 0 },
      { backgroundColor: 'rgba(34,197,94,1)', borderColor: '#22C55E', '--hecho': 1, duration: 0.15, immediateRender: false }, t);
    tl.fromTo(caja, { scale: 1 }, { keyframes: [{ scale: 1.3, duration: 0.08 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' }], immediateRender: false }, t);
    tl.to(item, { color: '#F4F1EA', duration: 0.15 }, t);
  };

  window.Kit = Kit;
})();
