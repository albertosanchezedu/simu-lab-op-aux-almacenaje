/* SimuLab · core/guia.js
 * Panel de la guía: personaje (PNG) y bocadillo. Una frase por bocadillo.
 * El texto aparece poco a poco y se avanza con «Siguiente». «Atrás» repite la frase anterior.
 * Si un personaje aún no tiene imagen, se dibuja una silueta provisional con su color.
 */
(function () {
  'use strict';
  var SL = window.SimuLab;
  var G = SL.Guia = {};
  var raiz, elQuien, elTexto, elPie, elFig, elRol;
  var lineas = [], idx = 0, alTerminar = null, escribiendo = null, modoEspera = false;

  function personaje(id) { return (SL.historia && SL.historia.personajes[id]) || { nombre: id }; }

  function silueta(p) {
    var c = p.color || 'var(--marca)';
    return '<svg class="sl-maria-prov" viewBox="0 0 220 300" role="img" aria-label="' + p.nombre + ' (imagen provisional)">' +
      '<defs><linearGradient id="slg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c + '" stop-opacity=".95"/><stop offset="1" stop-color="' + c + '" stop-opacity=".55"/></linearGradient></defs>' +
      '<ellipse cx="110" cy="92" rx="52" ry="58" fill="url(#slg)"/>' +
      '<path d="M58 70c6-40 98-46 108 4-18-14-50-22-108-4z" fill="#3b1f33" opacity=".35"/>' +
      '<path d="M22 300c0-74 38-128 88-128s88 54 88 128z" fill="url(#slg)"/>' +
      '<rect x="56" y="232" width="108" height="30" rx="15" fill="#fff" opacity=".9"/>' +
      '<text x="110" y="252" text-anchor="middle" fill="#3b1f33">' + p.nombre + ' · pronto</text></svg>';
  }

  G.iniciar = function (contenedor) {
    raiz = contenedor;
    raiz.innerHTML =
      '<div class="sl-bocadillo"><p class="sl-bocadillo__quien"></p><p class="sl-bocadillo__texto" aria-live="polite"></p><div class="sl-bocadillo__pie"></div></div>' +
      '<figure class="sl-personaje"><span class="sl-personaje__rol"></span></figure>';
    elQuien = raiz.querySelector('.sl-bocadillo__quien');
    elTexto = raiz.querySelector('.sl-bocadillo__texto');
    elPie = raiz.querySelector('.sl-bocadillo__pie');
    elFig = raiz.querySelector('.sl-personaje');
    elRol = raiz.querySelector('.sl-personaje__rol');
    elTexto.addEventListener('click', completar);
  };

  var figActual = null;
  function pintarFigura(quien, gesto) {
    var p = personaje(quien), cod = p.gestos && (p.gestos[gesto] || p.gestos[p.gestoBase]);
    var clave = quien + '|' + (cod || '');
    if (clave === figActual) return;
    figActual = clave;
    elFig.classList.add('cambia');
    setTimeout(function () {
      var vieja = elFig.querySelector('img, svg'); if (vieja) vieja.remove();
      if (cod) {
        var img = new Image(); img.alt = p.nombre; img.src = SL.recurso('assets/personajes/' + cod + '.png');
        img.onerror = function () { img.replaceWith(htmlNodo(silueta(p))); };
        elFig.insertBefore(img, elRol);
      } else elFig.insertBefore(htmlNodo(silueta(p)), elRol);
      elRol.textContent = p.rol || '';
      requestAnimationFrame(function () { elFig.classList.remove('cambia'); });
    }, figActual ? 160 : 0);
  }
  function htmlNodo(h) { var d = document.createElement('div'); d.innerHTML = h; return d.firstChild; }

  function escribir(texto) {
    clearInterval(escribiendo);
    // **negrita** → <strong>
    var html = texto.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (SL.sinMovimiento) { elTexto.innerHTML = html; return; }
    var limpio = html.replace(/<[^>]+>/g, ''), n = 0;
    elTexto.dataset.completo = html;
    escribiendo = setInterval(function () {
      n += 2;
      if (n >= limpio.length) { clearInterval(escribiendo); escribiendo = null; elTexto.innerHTML = html; return; }
      elTexto.textContent = limpio.slice(0, n);
    }, 24);
  }
  function completar() {
    if (escribiendo) { clearInterval(escribiendo); escribiendo = null; elTexto.innerHTML = elTexto.dataset.completo || elTexto.innerHTML; return true; }
    return false;
  }

  function mostrar() {
    var l = lineas[idx], p = personaje(l.quien);
    elQuien.innerHTML = p.nombre + (p.etiqueta ? ' <small>' + p.etiqueta + '</small>' : '');
    pintarFigura(l.quien, l.gesto);
    escribir(l.texto);
    if (l.alMostrar) l.alMostrar();
    pie();
  }

  function pie() {
    elPie.innerHTML = '';
    var puntos = SL.el('div', 'sl-puntos');
    if (lineas.length > 1) for (var i = 0; i < lineas.length; i++) puntos.appendChild(SL.el('i', i <= idx ? 'on' : ''));
    var atras = SL.el('button', 'sl-btn sl-btn--mini', '‹');
    atras.setAttribute('aria-label', 'Repetir la frase anterior');
    atras.disabled = idx === 0;
    atras.onclick = function () { if (idx > 0) { idx--; mostrar(); } };
    elPie.appendChild(atras); elPie.appendChild(puntos);
    if (modoEspera && idx === lineas.length - 1) {
      elPie.appendChild(SL.el('span', 'sl-bocadillo__espera', modoEspera === true ? 'Te toca' : modoEspera));
      return;
    }
    if (idx === lineas.length - 1 && !alTerminar) return;
    var sig = SL.el('button', 'sl-btn sl-btn--oscuro', (idx === lineas.length - 1 && lineas.textoFin) ? lineas.textoFin : 'Siguiente ›');
    sig.onclick = function () {
      if (completar()) return;
      if (idx < lineas.length - 1) { idx++; mostrar(); }
      else if (alTerminar) { var f = alTerminar; alTerminar = null; f(); }
    };
    elPie.appendChild(sig);
    setTimeout(function () { try { sig.focus({ preventScroll: true }); } catch (e) { } }, 50);
  }

  /** Muestra una o varias frases. opc: { espera: true|'texto' (no hay Siguiente al final), fin: 'Texto botón' } */
  G.decir = function (ls, terminar, opc) {
    opc = opc || {};
    lineas = (Array.isArray(ls) ? ls : [ls]).filter(Boolean);
    lineas.textoFin = opc.fin;
    idx = Math.min(opc.desde || 0, Math.max(0, lineas.length - 1)); alTerminar = terminar || null; modoEspera = opc.espera || false;
    if (!lineas.length) { if (terminar) terminar(); return; }
    mostrar();
  };
  G.espera = function (v) { modoEspera = v; pie(); };
})();
