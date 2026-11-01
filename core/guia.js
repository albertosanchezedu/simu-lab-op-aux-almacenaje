/* SimuLab · core/guia.js
 * Panel del personaje que guía (como en Cubic Lab): bocadillo de alto fijo, figura PNG y los botones
 * Atrás / Siguiente debajo. Una frase por bocadillo; el texto y la figura cambian con un fundido suave.
 * Si un personaje aún no tiene imagen, se dibuja una silueta con sus colores.
 *   decir(lineas, alTerminar, { espera: 'texto del botón mientras se responde', fin: 'texto del último botón', desde })
 */
(function () {
  'use strict';
  var SL = window.SimuLab;
  var G = SL.Guia = {};
  var RUTA = 'assets/personajes/';
  var elTexto, elQuien, elImg, elPanel, btnSig, btnAtras;
  var lineas = [], idx = 0, alTerminar = null, espera = false, codigo = null, reloj = null;

  function personaje(id) { return (SL.historia && SL.historia.personajes[id]) || { nombre: id }; }

  // Silueta provisional con los colores del personaje (María: chaqueta mostaza, pelo castaño).
  function silueta(p) {
    var ropa = p.color || '#e3a83f', pelo = p.pelo || '#4a3226';
    return '<svg class="sl-silueta" viewBox="0 0 200 300" role="img" aria-label="' + p.nombre + '">' +
      '<path d="M48 300c0-70 22-118 52-126 30 8 52 56 52 126z" fill="' + ropa + '"/>' +
      '<path d="M88 176h24v40H88z" fill="#fff"/>' +
      '<ellipse cx="100" cy="98" rx="44" ry="50" fill="#f1c9a5"/>' +
      '<path d="M54 104c-4-52 26-74 46-74s52 18 46 74c-6 40-2 70 6 82-14-6-18-30-18-58 0-28-6-44-34-50-28 6-34 22-34 50 0 28-4 52-18 58 8-12 12-42 6-82z" fill="' + pelo + '"/>' +
      '<text x="100" y="290" text-anchor="middle" class="sl-silueta__cod">' + p.nombre + '</text></svg>';
  }

  // Centra la figura por lo que ocupa de verdad (igual que en Cubic Lab).
  var CAJAS = {};
  function caja(img) {
    if (CAJAS[img.src]) return CAJAS[img.src];
    try {
      var w = 180, h = Math.round(w * img.naturalHeight / img.naturalWidth), cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      var c = cv.getContext('2d'); c.drawImage(img, 0, 0, w, h);
      var d = c.getImageData(0, 0, w, h).data, x0 = w, x1 = 0, y0 = -1, c0 = w, c1 = 0;
      for (var y = 0; y < h * 0.89; y++) for (var x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y0 < 0) y0 = y;
        if (y < y0 + h * 0.12) { if (x < c0) c0 = x; if (x > c1) c1 = x; }
      }
      return (CAJAS[img.src] = x1 > x0 ? { x0: x0 / w, x1: (x1 + 1) / w, cab: (c0 + c1 + 1) / 2 / w } : null);
    } catch (e) { return (CAJAS[img.src] = null); }
  }
  function encajar(img) {
    var b = caja(img), W = elImg.clientWidth, w = img.offsetWidth;
    if (!b || !W || !w) return;
    var cw = (b.x1 - b.x0) * w, off = ((cw > W - 6 ? b.cab : (b.x0 + b.x1) / 2) - 0.5) * w;
    img.style.transform = 'translateX(-50%) translateX(' + (-off).toFixed(1) + 'px)';
  }

  // Como en Cubic Lab: la pose se carga ANTES de enseñarla, se coloca y solo entonces se funde.
  // Así no hay saltos ni parpadeos al cambiar de gesto o de personaje.
  var listas = {};
  function precargar(cod, listo) {
    if (cod in listas) { if (listas[cod] === 'cargando') setTimeout(function () { precargar(cod, listo); }, 40); else listo(listas[cod]); return; }
    listas[cod] = 'cargando';
    var im = new Image();
    im.onload = function () { listas[cod] = true; listo(true); };
    im.onerror = function () { listas[cod] = false; listo(false); };
    im.src = SL.recurso(RUTA + cod + '.png');
  }
  G.precargarTodo = function () {
    var ps = (SL.historia && SL.historia.personajes) || {};
    Object.keys(ps).forEach(function (k) { var g = ps[k].gestos || {}; Object.keys(g).forEach(function (n) { precargar(g[n], function () {}); }); });
  };
  function figura(quien, gesto) {
    var p = personaje(quien), cod = p.gestos && (p.gestos[gesto] || p.gestos[p.gestoBase]);
    var clave = quien + '|' + (cod || '');
    if (clave === codigo) return;
    codigo = clave;
    var poner2 = function (hay) {
      if (codigo !== clave) return;                                           // ya habla otro: llega tarde
      var capa = SL.el('div', 'sl-personaje__capa');
      if (hay) { var im = new Image(); im.alt = p.nombre; im.src = SL.recurso(RUTA + cod + '.png'); capa.appendChild(im); }
      else capa.innerHTML = silueta(p);
      var viejas = elImg.querySelectorAll('.sl-personaje__capa');
      elImg.appendChild(capa);
      requestAnimationFrame(function () {
        if (im) encajar(im);
        requestAnimationFrame(function () {
          capa.classList.add('sl-personaje__capa--ve');
          viejas.forEach(function (v) { v.classList.remove('sl-personaje__capa--ve'); setTimeout(function () { v.remove(); }, 450); });
        });
      });
    };
    if (cod) precargar(cod, poner2); else poner2(false);
  }

  function poner(texto, sinFundido) {
    var html = String(texto).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    clearTimeout(reloj);
    if (SL.sinMovimiento || sinFundido) { elTexto.innerHTML = html; return; }
    elTexto.classList.add('sl-bocadillo__texto--cambia');
    reloj = setTimeout(function () { elTexto.innerHTML = html; elTexto.classList.remove('sl-bocadillo__texto--cambia'); }, 220);
  }

  function mostrar() {
    var l = lineas[idx], p = personaje(l.quien);
    elPanel.dataset.quien = l.quien;
    elQuien.textContent = p.nombre + (p.etiqueta ? ' · ' + p.etiqueta : '');
    figura(l.quien, l.gesto);
    poner(l.texto, !elTexto.textContent);
    if (l.alMostrar) l.alMostrar();
    botones();
  }

  function botones() {
    var ultima = idx >= lineas.length - 1;
    btnAtras.disabled = idx === 0;
    if (ultima && espera) { btnSig.disabled = true; btnSig.textContent = espera === true ? 'Te toca' : espera; return; }
    btnSig.disabled = ultima && !alTerminar;
    btnSig.textContent = ultima && lineas.fin ? lineas.fin : 'Siguiente →';
    if (!btnSig.disabled) setTimeout(function () { try { btnSig.focus({ preventScroll: true }); } catch (e) { /* nada */ } }, 60);
  }

  G.iniciar = function (contenido, sig, atras) {
    elPanel = contenido.closest('.sl-panel') || contenido;
    contenido.innerHTML =
      '<div class="sl-bocadillo"><p class="sl-bocadillo__quien"></p><p class="sl-bocadillo__texto" aria-live="polite"></p></div>' +
      '<figure class="sl-personaje"><div class="sl-personaje__img"></div></figure>';
    elTexto = contenido.querySelector('.sl-bocadillo__texto');
    elQuien = contenido.querySelector('.sl-bocadillo__quien');
    elImg = contenido.querySelector('.sl-personaje__img');
    btnSig = sig; btnAtras = atras;
    if (window.ResizeObserver) new ResizeObserver(function () { elPanel.style.setProperty('--ancho-panel', elPanel.clientWidth + 'px'); }).observe(elPanel);
    window.addEventListener('resize', function () { elImg.querySelectorAll('img').forEach(encajar); });
    G.precargarTodo();
    btnSig.addEventListener('click', function () {
      if (idx < lineas.length - 1) { idx++; mostrar(); }
      else if (alTerminar) { var f = alTerminar; alTerminar = null; f(); }
    });
    btnAtras.addEventListener('click', function () { if (idx > 0) { idx--; mostrar(); } });
  };

  G.decir = function (ls, terminar, opc) {
    opc = opc || {};
    lineas = (Array.isArray(ls) ? ls : [ls]).filter(Boolean);
    lineas.fin = opc.fin;
    alTerminar = terminar || null; espera = opc.espera || false;
    idx = Math.min(opc.desde || 0, Math.max(0, lineas.length - 1));
    if (!lineas.length) { if (terminar) terminar(); return; }
    mostrar();
  };
  G.espera = function (v) { espera = v; botones(); };
})();
