/* SimuLab · core/pantallas.js  (la misma mecánica que Cubic Lab)
 *  - portada: siempre al entrar. Antetítulo genérico de SimuLab, «SimuLab» grande y el módulo debajo.
 *  - divisor: pantalla intermedia al entrar en un capítulo (cambio de espacio) y al terminarlo.
 *  - cierre: al terminar una unidad.
 */
(function () {
  'use strict';
  var SL = window.SimuLab;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  // «← Texto»: la flecha va dibujada (SVG), así queda centrada en vertical con cualquier fuente.
  function flecha(t) {
    t = String(t);
    return t.charAt(0) !== '←' ? t : '<svg class="sl-flecha" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3m4.5-4.5L3 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>' + t.slice(1).trim() + '</span>';
  }

  // Fondo vivo: manchas de luz que flotan despacio y destellos (✦) que parpadean.
  function fondoVivo() {
    var f = el('div', 'sl-vivo', '<i></i><i></i><i></i>');
    for (var k = 0; k < 14; k++) {
      var d = el('b', null, '✦');
      d.style.left = (Math.random() * 100).toFixed(1) + '%';
      d.style.top = (Math.random() * 100).toFixed(1) + '%';
      d.style.animationDelay = (Math.random() * 6).toFixed(2) + 's';
      d.style.fontSize = (8 + Math.random() * 14).toFixed(0) + 'px';
      f.appendChild(d);
    }
    return f;
  }

  // Letras que suben una a una.
  function letras(texto) {
    return texto.split('').map(function (c, i) {
      return '<span style="--i:' + i + '">' + (c === ' ' ? '&nbsp;' : c) + '</span>';
    }).join('');
  }

  // El mismo pie que la ventana habitual (el «?» queda por encima), para que nada salte al cambiar de pantalla.
  function pieApp(p) {
    var pie = document.getElementById('sl-pie');
    if (pie && pie.innerHTML) p.appendChild(el('footer', 'sl-pie sl-pie--fijo', pie.innerHTML));
  }

  function salir(capa, listo) {
    capa.classList.add('sl-pantalla--fuera');
    setTimeout(function () { if (capa.parentNode) capa.parentNode.removeChild(capa); }, 950);
    if (listo) listo();
  }

  // Pantalla completa: solo en pantallas táctiles pequeñas donde el navegador la permite (Android; iPhone no).
  // Con pantalla completa, la barra baja por debajo del notch o de la cámara.
  document.addEventListener('fullscreenchange', function () { document.documentElement.classList.toggle('sl-completa', !!document.fullscreenElement); });
  function puedePantallaCompleta() {
    var d = document.documentElement;
    var ios = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return !ios && !document.fullscreenElement && !!(d.requestFullscreen || d.webkitRequestFullscreen) &&
      document.fullscreenEnabled !== false && window.matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 820;
  }

  SL.Pantallas = {
    puedePantallaCompleta: function () { return puedePantallaCompleta(); },
    pantallaCompleta: function () {
      var d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen;
      try { var r = f.call(d, { navigationUI: 'hide' }); if (r && r.catch) r.catch(function () {}); } catch (e) { /* sin pantalla completa: seguimos */ }
    },
    portada: function (t, marca, alEntrar) {
      var p = el('section', 'sl-pantalla sl-portada');
      p.setAttribute('aria-label', 'Portada');
      p.appendChild(fondoVivo());
      p.appendChild(el('div', 'sl-portada__caja',
        (marca.antetitulo ? '<p class="sl-portada__ante">' + marca.antetitulo + '</p>' : '') +
        '<h1 class="sl-portada__titulo" aria-label="' + marca.nombre + '">' + letras(marca.nombre) + '</h1>' +
        (t.tema ? '<p class="sl-portada__tema">' + t.tema + '</p>' : '') +
        (t.lema ? '<p class="sl-portada__lema">' + t.lema + '</p>' : '') +
        '<button type="button" class="sl-btn sl-btn--portada">' + (t.boton || 'Entrar') + '</button>'));
      // Pie: la última parte de los derechos («Todos los derechos reservados») baja a su propia línea en el móvil.
      var partes = marca.derechos.split(' · '), ultima = partes.length > 1 ? partes.pop() : '';
      p.appendChild(el('p', 'sl-portada__pie', marca.nombre + ' · ' + partes.join(' · ') +
        (ultima ? '<span class="sl-portada__sep"> · </span><span class="sl-portada__reservados">' + ultima + '</span>' : '')));
      document.body.appendChild(p);
      var b = p.querySelector('button');
      b.addEventListener('click', function () {
        // En el móvil (Android) se invita a verlo a pantalla completa antes de entrar.
        if (!puedePantallaCompleta()) return entrar();
        b.disabled = true;
        var t2 = (SL.textos && SL.textos.pantallaCompleta) || {};
        var m = el('div', 'sl-pc', '<div class="sl-pc__caja">' +
          '<p class="sl-pc__titulo">' + (t2.titulo || '¿Lo vemos en grande?') + '</p>' +
          '<button type="button" class="sl-btn sl-pc__si">' + (t2.si || '⛶ Pantalla completa') + '</button>' +
          '<button type="button" class="sl-pc__no">' + (t2.no || 'Seguir en pequeño') + '</button></div>');
        p.appendChild(m);
        m.querySelector('.sl-pc__si').addEventListener('click', function () { SL.Pantallas.pantallaCompleta(); entrar(); });
        m.querySelector('.sl-pc__no').addEventListener('click', entrar);
        setTimeout(function () { m.querySelector('.sl-pc__si').focus({ preventScroll: true }); }, 50);
      });
      function entrar() { document.body.classList.add('sl-arrancado'); salir(p, alEntrar); }
      setTimeout(function () { b.focus({ preventScroll: true }); }, 100);
    },

    // Cierre: la misma estética que la portada, al terminar el último Lab; vuelve al mapa.
    cierre: function (t, marca, alVolver, alInforme) {
      var p = el('section', 'sl-pantalla sl-portada sl-cierre');
      p.setAttribute('aria-label', 'Fin');
      p.appendChild(fondoVivo());
      p.appendChild(el('div', 'sl-portada__caja',
        '<p class="sl-portada__ante">' + (t.ante || 'Fin del recorrido') + '</p>' +
        '<h1 class="sl-portada__titulo" aria-label="' + marca.nombre + '">' + letras(marca.nombre) + '</h1>' +
        (t.tema ? '<p class="sl-portada__tema">' + t.tema + '</p>' : '') +
        (t.lema ? '<p class="sl-portada__lema">' + t.lema + '</p>' : '') +
        '<div class="sl-cierre__botones">' +
        (alInforme ? '<button type="button" class="sl-btn sl-btn--portada sl-cierre__informe">' + (t.informe || '⤓ Descargar mi informe') + '</button>' : '') +
        '<button type="button" class="sl-btn ' + (alInforme ? 'sl-cierre__mapa' : 'sl-btn--portada') + '">' + (t.boton || 'Volver al almacén') + '</button></div>'));
      p.appendChild(el('p', 'sl-portada__pie', marca.nombre + ' · ' + marca.derechos));
      document.body.appendChild(p);
      var b = p.querySelector('.sl-cierre__informe') || p.querySelector('button');
      if (alInforme) b.addEventListener('click', alInforme);
      p.querySelector('.sl-cierre__botones button:last-child').addEventListener('click', function () { salir(p, alVolver); });
      setTimeout(function () { b.focus({ preventScroll: true }); }, 100);
    },

    /* o: { num, total, titulo, gancho, hecho (título del capítulo superado), puntos: [true/false…], boton, fin } */
    divisor: function (o, alSeguir) {
      var p = el('section', 'sl-pantalla sl-divisor' + (o.hecho ? ' sl-divisor--hecho' : ''));
      p.setAttribute('aria-label', o.etiqueta || 'Paso ' + o.num);
      p.appendChild(fondoVivo());
      var puntos = (o.puntos || []).map(function (h, i) {
        return '<span class="sl-divisor__punto' + (h ? ' sl-divisor__punto--hecho' : '') + (i === o.num - 1 && !o.fin ? ' sl-divisor__punto--ahora' : '') + '">' + (h ? '✓' : i + 1) + '</span>';
      }).join('');
      p.appendChild(el('div', 'sl-divisor__caja',
        (o.hecho ? '<p class="sl-divisor__hecho"><span>✓</span> ' + o.hecho + '</p>' : '') +
        '<div class="sl-divisor__puntos">' + puntos + '</div>' +
        (o.fin ? '' : '<p class="sl-divisor__num">' + (o.etiqueta || 'Paso ' + o.num) + '</p>') +
        '<h2 class="sl-divisor__titulo">' + o.titulo + '</h2>' +
        (o.gancho ? '<p class="sl-divisor__gancho">' + o.gancho + '</p>' : '') +
        '<button type="button" class="sl-btn sl-btn--oscuro sl-btn--grande">' + (o.boton || 'Empezar') + '</button>'));
      pieApp(p);
      // Entrando desde el mapa: se puede volver a él.
      if (o.alVolver) {
        var bv = el('button', 'sl-btn sl-divisor__volver', flecha(o.volver || '← Volver al almacén'));
        bv.type = 'button';
        bv.addEventListener('click', function () { salir(p, o.alVolver); });
        p.appendChild(bv);
      }
      document.body.appendChild(p);
      var b = p.querySelector('.sl-divisor__caja button');
      b.addEventListener('click', function () { salir(p, alSeguir); });
      setTimeout(function () { b.focus({ preventScroll: true }); }, 100);
    },
  };
})();
