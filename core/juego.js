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

  J.escenario = null; // caja del escenario (la pone app.js)
  J.lamina = null;    // lámina que tapa el almacén para preguntar

  function lamina(nodo) {
    J.lamina.innerHTML = '';
    if (!nodo) { J.lamina.hidden = true; return; }
    J.lamina.appendChild(nodo); J.lamina.hidden = false;
  }
  J.verLamina = lamina;

  function linea(base, texto, gesto) {
    if (!texto) return null;
    if (typeof texto === 'object') return texto;
    return { quien: base || 'alberto', gesto: gesto || 'pensativo', texto: texto };
  }
  J.toast = function (txt, mal) {
    var t = SL.el('div', 'sl-toast' + (mal ? ' sl-toast--mal' : ''), txt);
    (J.escenario || document.body).appendChild(t); setTimeout(function () { t.remove(); }, 950);
  };
  function chip(txt) {
    var v = J.escenario && J.escenario.querySelector('.sl-toca');
    if (v) v.remove();
    if (txt) J.escenario.appendChild(SL.el('div', 'sl-toca', '☝ ' + txt));
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
    function limpiar() { chip(null); M3().modoTocarZonas(null); M3().limpiarZonas(); lamina(null); }

    if (p.tipo === 'tocar') {
      SL.Guia.decir([pregunta], null, { espera: 'Toca en el almacén' });
      lamina(null);
      chip(p.instruccion || 'Toca la zona en el almacén');
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
      var t = SL.el('div', 'sl-lamina__caja');
      t.innerHTML = '<p class="sl-lamina__ante">' + (p.tipo === 'vf' ? '¿Verdadero o falso?' : 'Elige la respuesta') + '</p>' +
        '<p class="sl-lamina__txt">' + (p.enunciado || p.pregunta.texto || p.pregunta) + '</p>';
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
      lamina(t);
      SL.Guia.decir([pregunta], null, { espera: 'Elige una respuesta' });
      return;
    }

    if (p.tipo === 'ordenar') {
      // Se ARRASTRA cada tarjeta a su número. Nada cambia de tamaño: la tarjeta colocada deja su hueco vacío.
      var items = p.items, puestos = 0;
      var tt = SL.el('div', 'sl-lamina__caja');
      tt.innerHTML = '<p class="sl-lamina__ante">Ordena</p><p class="sl-lamina__txt">' + (p.enunciado || 'Arrastra cada tarjeta a su número') + '</p>';
      var huecos = SL.el('div', 'sl-huecos'), fichas = SL.el('div', 'sl-fichas'), hs = [], fs = {};
      items.forEach(function (_, k) { var h = SL.el('div', 'sl-hueco'); h.dataset.n = k; hs.push(h); huecos.appendChild(h); });
      function soltarEn(i, x, y) {
        var bajo = document.elementFromPoint(x, y), h = bajo && bajo.closest ? bajo.closest('.sl-hueco') : null;
        if (!h || h.classList.contains('lleno')) return false;
        if (+h.dataset.n === i) {
          h.textContent = items[i]; h.classList.add('lleno'); fs[i].classList.add('puesta'); puestos++;
          Object.keys(fs).forEach(function (k) { fs[k].classList.remove('pista'); });
          hs.forEach(function (x2) { x2.classList.remove('pista'); });
          if (puestos === items.length) acierto(); else if (fallos >= 3) marcarBuena();
        } else { h.classList.remove('mal'); void h.offsetWidth; h.classList.add('mal'); fs[i].classList.add('mal'); setTimeout(function () { fs[i].classList.remove('mal'); }, 450); fallo(); }
        return true;
      }
      SL.barajar(items.map(function (_, i) { return i; })).forEach(function (i) {
        var f = SL.el('button', 'sl-ficha-ord', items[i]); fs[i] = f; f.type = 'button';
        f.addEventListener('pointerdown', function (e) {
          if (hecho || f.classList.contains('puesta')) return;
          e.preventDefault();
          var r = f.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
          var fant = f.cloneNode(true); fant.className = 'sl-ficha-ord sl-ficha-ord--fantasma';
          fant.style.width = r.width + 'px'; fant.style.left = r.left + 'px'; fant.style.top = r.top + 'px';
          document.body.appendChild(fant); f.classList.add('cogida');
          function mover(ev) {
            fant.style.left = (ev.clientX - dx) + 'px'; fant.style.top = (ev.clientY - dy) + 'px';
            var bajo = document.elementFromPoint(ev.clientX, ev.clientY), h = bajo && bajo.closest ? bajo.closest('.sl-hueco') : null;
            hs.forEach(function (x2) { x2.classList.toggle('encima', x2 === h && !x2.classList.contains('lleno')); });
          }
          function fin(ev) {
            document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', fin); document.removeEventListener('pointercancel', fin);
            hs.forEach(function (x2) { x2.classList.remove('encima'); });
            fant.style.visibility = 'hidden'; soltarEn(i, ev.clientX, ev.clientY); fant.remove(); f.classList.remove('cogida');
          }
          document.addEventListener('pointermove', mover); document.addEventListener('pointerup', fin); document.addEventListener('pointercancel', fin);
        });
        fichas.appendChild(f);
      });
      marcarBuena = function () {
        for (var k = 0; k < items.length; k++) if (!hs[k].classList.contains('lleno')) { fs[k].classList.add('pista'); hs[k].classList.add('pista'); return; }
      };
      tt.appendChild(huecos); tt.appendChild(fichas);
      lamina(tt);
      SL.Guia.decir([pregunta], null, { espera: 'Arrastra a su número' });
    }
  };
})();
