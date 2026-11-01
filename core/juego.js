/* SimuLab · core/juego.js
 * Las preguntas del mundo. Tipos: tocar (una zona del almacén), elegir (opciones), vf (verdadero/falso), ordenar.
 * Ayuda progresiva sin castigar: 1.er fallo = pregunta-pista, 2.º = pista concreta, 3.º = explicación y se marca la buena.
 * Devuelve si se acertó a la primera.
 */
(function () {
  'use strict';
  var SL = window.SimuLab;
  var J = SL.Juego = {};
  var M3 = function () { return SL.Mundo3D; };
  var PISTAS = ['Casi. Piénsalo otra vez.', 'Fíjate bien en el nombre.', 'Mira la respuesta marcada y tócala.'];

  J.centro = null; // contenedor de tarjetas (lo pone app.js)
  J.chip = null;

  function linea(base, texto, gesto) {
    if (!texto) return null;
    if (typeof texto === 'object') return texto;
    return { quien: base || 'alberto', gesto: gesto || 'pensativo', texto: texto };
  }
  J.toast = function (txt, mal) {
    var t = SL.el('div', 'sl-toast' + (mal ? ' sl-toast--mal' : ''), txt);
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 950);
  };
  function chip(txt) {
    if (!J.chip) return;
    J.chip.hidden = !txt;
    if (txt) J.chip.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 11.2V5.5a2 2 0 1 1 4 0v4.3l4.2.8a2.3 2.3 0 0 1 1.8 2.6l-.8 5.3A3 3 0 0 1 15.2 21h-4a3 3 0 0 1-2.4-1.2l-3.6-4.8a1.6 1.6 0 0 1 2.4-2.1z"/></svg>' + txt;
  }
  function pistaDe(p, n) {
    var t = (p.pistas && p.pistas[Math.min(n, p.pistas.length - 1)]) || PISTAS[Math.min(n, 2)];
    if (n >= 2 && p.porque && !(p.pistas && p.pistas[2])) t = p.porque;
    return linea('alberto', t, n >= 2 ? 'explica' : 'pensativo');
  }
  function bien(p) { return linea('alberto', p.bien || 'Eso es.', 'pulgar'); }

  J.jugar = function (p, fin) {
    var fallos = 0, hecho = false;
    J.actual = p; // (para pruebas automáticas)
    var pregunta = linea(p.quien || 'maria', p.pregunta, p.gesto || 'explica');

    function acierto() {
      if (hecho) return; hecho = true;
      J.toast('¡Bien!');
      var b = bien(p);
      SL.Guia.decir(b, function () { limpiar(); fin(fallos === 0); });
    }
    function fallo() {
      J.toast('Casi…', true);
      SL.Guia.decir([pregunta, pistaDe(p, fallos)], null, { desde: 1, espera: p.tipo === 'tocar' ? 'Toca en el almacén' : 'Elige otra vez' });
      fallos++;
      if (fallos >= 3 && marcarBuena) marcarBuena();
    }
    var marcarBuena = null;
    function limpiar() { chip(null); M3().modoTocarZonas(null); M3().limpiarZonas(); J.centro.innerHTML = ''; }

    if (p.tipo === 'tocar') {
      SL.Guia.decir([pregunta], null, { espera: 'Toca en el almacén' });
      chip(p.instruccion || 'Toca una zona del almacén');
      M3().inicio(1.2);
      marcarBuena = function () { M3().resaltarZona(p.correcta, 'pista'); };
      M3().modoTocarZonas(function (id) {
        if (hecho) return;
        if (id === p.correcta) { M3().limpiarZonas(); M3().resaltarZona(id, 'bien'); M3().modoTocarZonas(null); chip(null); acierto(); }
        else { M3().resaltarZona(id, 'mal', 700); fallo(); }
      });
      return;
    }

    if (p.tipo === 'elegir' || p.tipo === 'vf') {
      var ops = p.tipo === 'vf' ? ['Verdadero', 'Falso'] : p.opciones;
      var buena = p.tipo === 'vf' ? (p.correcta ? 0 : 1) : (p.correcta || 0);
      var orden = p.tipo === 'vf' ? [0, 1] : SL.barajar(ops.map(function (_, i) { return i; }));
      var t = SL.el('div', 'sl-tarjeta sl-cristal sl-pregunta');
      t.innerHTML = '<p class="sl-tarjeta__ante">' + (p.tipo === 'vf' ? '¿Verdadero o falso?' : 'Elige la respuesta') + '</p>' +
        '<p class="sl-pregunta__txt">' + (p.enunciado || p.pregunta.texto || p.pregunta) + '</p>';
      var lista = SL.el('div', 'sl-opciones' + (p.tipo === 'vf' ? ' sl-opciones--vf' : ''));
      var botones = [];
      orden.forEach(function (i, k) {
        var b = SL.el('button', 'sl-opcion', (p.tipo === 'vf' ? '' : '<b>' + 'ABCD'[k] + '</b>') + '<span>' + ops[i] + '</span>');
        b.onclick = function () {
          if (hecho) return;
          if (i === buena) { b.classList.remove('sl-opcion--pista'); b.classList.add('sl-opcion--bien'); botones.forEach(function (x) { x.disabled = true; }); acierto(); }
          else { b.classList.remove('sl-opcion--mal'); void b.offsetWidth; b.classList.add('sl-opcion--mal'); b.disabled = true; fallo(); }
        };
        botones[i] = b; lista.appendChild(b);
      });
      marcarBuena = function () { botones[buena].classList.add('sl-opcion--pista'); };
      t.appendChild(lista);
      J.centro.innerHTML = ''; J.centro.appendChild(t);
      SL.Guia.decir([pregunta], null, { espera: 'Elige una respuesta' });
      return;
    }

    if (p.tipo === 'ordenar') {
      var items = p.items, siguiente = 0;
      var tt = SL.el('div', 'sl-tarjeta sl-cristal');
      tt.innerHTML = '<p class="sl-tarjeta__ante">Ordena</p><p class="sl-pregunta__txt">' + (p.enunciado || 'Toca en orden') + '</p>';
      var huecos = SL.el('div', 'sl-huecos'), fichas = SL.el('div', 'sl-fichas'), hs = [], fs = {};
      items.forEach(function () { var h = SL.el('div', 'sl-hueco'); hs.push(h); huecos.appendChild(h); });
      SL.barajar(items.map(function (_, i) { return i; })).forEach(function (i) {
        var f = SL.el('button', 'sl-ficha-ord', items[i]); fs[i] = f;
        f.onclick = function () {
          if (hecho) return;
          if (i === siguiente) {
            hs[siguiente].textContent = items[i]; hs[siguiente].classList.add('lleno'); f.remove(); siguiente++;
            Object.keys(fs).forEach(function (k) { fs[k].classList.remove('pista'); });
            if (siguiente === items.length) acierto();
            else if (fallos >= 3) fs[siguiente].classList.add('pista');
          } else { f.classList.remove('mal'); void f.offsetWidth; f.classList.add('mal'); fallo(); }
        };
        fichas.appendChild(f);
      });
      marcarBuena = function () { if (fs[siguiente]) fs[siguiente].classList.add('pista'); };
      tt.appendChild(huecos); tt.appendChild(fichas);
      J.centro.innerHTML = ''; J.centro.appendChild(tt);
      SL.Guia.decir([pregunta], null, { espera: 'Toca en orden' });
    }
  };
})();
