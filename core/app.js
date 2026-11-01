/* SimuLab · core/app.js
 * Recorrido: portada → (equipo) → prólogo → mapa de unidades → misiones.
 * Interfaz al estilo del World Prompt Pack: barra con selector de unidades, 3 indicadores,
 * guía a la derecha, marcador de progreso abajo a la izquierda, ficha de lo que se toca.
 */
(function () {
  'use strict';
  var SL = window.SimuLab;
  var A = SL.App = {};
  var M3, H, ui = {}, modo = 'mapa', unidadActual = null, pins = {};

  // ---------- utilidades ----------
  function estado(u) { // 'vista' | 'activa' | 'bloqueada'
    if (SL.unidades[u.id] && (SL.unidades[u.id].misiones || []).some(function (m) { return !m.proximamente; })) return 'activa';
    return u.n < 3 ? 'vista' : 'bloqueada';
  }
  function estrellasTxt(n) { var s = ''; for (var i = 0; i < 3; i++) s += i < n ? '★' : '☆'; return s; }
  function conVer(lineas) {
    return lineas.map(function (l) {
      if (!l.ver) return l;
      return Object.assign({}, l, { alMostrar: function () { M3.limpiarZonas(); M3.resaltarZona(l.ver, 'ver'); M3.volarA(M3.vistaZona(l.ver), 1.2); } });
    });
  }

  // ---------- construcción de la interfaz ----------
  function construir() {
    var b = document.body;
    ui.mundo = SL.el('div', 'sl-mundo'); b.appendChild(ui.mundo);

    ui.barra = SL.el('header', 'sl-barra sl-cristal');
    ui.barra.innerHTML =
      '<div class="sl-marca"><span class="sl-marca__logo">Simu<b>Lab</b> <span class="sl-sep">✦</span></span><span class="sl-marca__mod">Operaciones Auxiliares<br>de Almacenaje</span></div>' +
      '<nav class="sl-unidades" aria-label="Unidades"></nav>' +
      '<div class="sl-acciones">' +
      '<button class="sl-btn sl-btn--mini sl-equipo" data-a="equipo"></button>' +
      '<button class="sl-btn sl-btn--icono" data-a="nombres" aria-pressed="false" title="Ver nombres de las zonas">Aa</button>' +
      '<button class="sl-btn sl-btn--icono" data-a="noche" title="Día / noche">☾</button>' +
      '<button class="sl-btn sl-btn--mini sl-btn--oscuro" data-a="mapa">Mapa</button>' +
      '<button class="sl-btn sl-btn--icono" data-a="creditos" title="Créditos">?</button></div>';
    b.appendChild(ui.barra);
    var nav = ui.barra.querySelector('.sl-unidades');
    SL.mundo.unidades.forEach(function (u) {
      var e = estado(u), bt = SL.el('button', 'es-' + e, '<b>' + u.n + '</b><span>' + u.titulo + '</span>');
      bt.title = 'UT' + u.n + ' · ' + u.titulo; bt.dataset.ut = u.id;
      bt.onclick = function () { if (modo === 'mision') return confirmarSalida(function () { abrirUnidad(u); }); abrirUnidad(u); };
      nav.appendChild(bt);
    });
    ui.barra.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-a]'); if (!t) return;
      var a = t.getAttribute('data-a');
      if (a === 'equipo') SL.Sesion.abrir();
      if (a === 'nombres') { var on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', on); t.classList.toggle('sl-btn--oscuro', on); M3.verGrupo('zona', on); }
      if (a === 'noche') { var n = M3.noche(); t.textContent = n ? '☀' : '☾'; }
      if (a === 'mapa') { if (modo === 'mision') confirmarSalida(irMapa); else irMapa(); }
      if (a === 'creditos') creditos();
    });

    ui.kpis = SL.el('div', 'sl-kpis'); b.appendChild(ui.kpis);
    ui.vista = SL.el('div', 'sl-vista sl-cristal');
    ui.vista.innerHTML = '<button class="sl-btn" title="Acercar">+</button><button class="sl-btn" title="Alejar">−</button><button class="sl-btn" title="Ver todo">⌂</button>';
    var vb = ui.vista.querySelectorAll('button');
    vb[0].onclick = function () { M3.zoom(0.75); }; vb[1].onclick = function () { M3.zoom(1.33); }; vb[2].onclick = function () { M3.inicio(); };
    b.appendChild(ui.vista);

    ui.guia = SL.el('aside', 'sl-guia sl-cristal'); b.appendChild(ui.guia);
    ui.centro = SL.el('div', 'sl-centro'); b.appendChild(ui.centro);
    ui.chip = SL.el('div', 'sl-chip sl-cristal'); ui.chip.hidden = true; b.appendChild(ui.chip);
    ui.tracker = SL.el('div', 'sl-tracker sl-cristal'); ui.tracker.hidden = true; b.appendChild(ui.tracker);
    ui.ficha = SL.el('div', 'sl-ficha sl-cristal'); ui.ficha.hidden = true; b.appendChild(ui.ficha);
    SL.Juego.centro = ui.centro; SL.Juego.chip = ui.chip;
  }

  function pintarEquipo() {
    var s = SL.Sesion.actual(), b = ui.barra.querySelector('.sl-equipo');
    b.innerHTML = s ? '<i>' + (s.ordenador || s.nombre.charAt(0).toUpperCase()) + '</i><span>' + s.nombre + '</span>' : '<i>?</i><span>Invitado · Guardar</span>';
    b.title = s ? 'Guardar partida o cerrar sesión' : 'Crear equipo para guardar la partida';
  }

  function pintarKpis() {
    var p = SL.progreso.cargar(), total = 0, hechas = 0, est = 0;
    Object.keys(SL.unidades).forEach(function (k) {
      (SL.unidades[k].misiones || []).forEach(function (m) {
        total++; var e = p.misiones[m.id];
        if (e && e.hecha) { hechas++; est += e.estrellas || 0; }
      });
    });
    var pct = p.preguntas ? Math.round(100 * (p.primera || 0) / p.preguntas) + '%' : '—';
    ui.kpis.innerHTML =
      '<div class="sl-kpi sl-cristal"><small>Misiones</small><strong>' + hechas + '<span style="font-size:16px;color:var(--muted)"> / ' + total + '</span></strong></div>' +
      '<div class="sl-kpi sl-cristal"><small>Estrellas</small><strong><em>★</em> ' + est + '</strong></div>' +
      '<div class="sl-kpi sl-cristal"><small>A la primera</small><strong>' + pct + '</strong></div>';
  }

  // ---------- chinchetas de unidades ----------
  function crearPins() {
    SL.mundo.unidades.forEach(function (u) {
      var e = estado(u);
      var el = SL.el('button', 'sl-pin sl-pin--' + e,
        '<span class="sl-pin__txt">' + (u.corto || u.titulo) + '</span><span class="sl-pin__num">' + u.n + '</span><span class="sl-pin__palo"></span>');
      el.setAttribute('aria-label', 'Unidad ' + u.n + ': ' + u.titulo);
      el.onclick = function () { abrirUnidad(u); };
      el.title = 'UT' + u.n + ' · ' + u.titulo;
      pins[u.id] = M3.anclar(el, u.x, u.alto || 7.5, u.z, 'unidad');
    });
  }

  // ---------- modos ----------
  function irMapa() {
    modo = 'mapa'; unidadActual = null;
    ui.centro.innerHTML = ''; ui.tracker.hidden = true; ui.chip.hidden = true; ui.ficha.hidden = true;
    M3.modoTocarZonas(null); M3.limpiarZonas(); M3.verGrupo('unidad', true); M3.seleccionar(null);
    marcarUnidad(null);
    M3.inicio();
    pintarKpis();
    SL.Guia.decir([H.mapa.bienvenida, H.mapa.explorar]);
  }
  function marcarUnidad(id) {
    ui.barra.querySelectorAll('.sl-unidades button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.ut === id ? 'true' : 'false'); });
  }
  function confirmarSalida(fn) {
    var t = SL.el('div', 'sl-tarjeta sl-cristal');
    t.innerHTML = '<p class="sl-tarjeta__ante">Misión en marcha</p><h2>¿Salir de la misión?</h2><p class="sl-tarjeta__sub">Tranquilo: se guarda dónde ibas.</p>' +
      '<div class="sl-tarjeta__botones"><button class="sl-btn" data-x="no">Seguir aquí</button><button class="sl-btn sl-btn--oscuro" data-x="si">Salir</button></div>';
    var previo = Array.prototype.slice.call(ui.centro.childNodes);
    previo.forEach(function (n) { n.style.display = 'none'; });
    ui.centro.appendChild(t);
    t.querySelector('[data-x=no]').onclick = function () { t.remove(); previo.forEach(function (n) { n.style.display = ''; }); };
    t.querySelector('[data-x=si]').onclick = function () { t.remove(); fn(); };
  }

  function abrirUnidad(u) {
    ui.ficha.hidden = true; M3.seleccionar(null);
    var e = estado(u);
    modo = 'mapa'; ui.centro.innerHTML = ''; ui.tracker.hidden = true; ui.chip.hidden = true; M3.modoTocarZonas(null); M3.limpiarZonas();
    M3.verGrupo('unidad', true); marcarUnidad(u.id);
    M3.volarA(M3.vistaZona(u.zona, { dist: 46 }), 1.3);
    M3.resaltarZona(u.zona, 'ver');
    if (e === 'vista') { SL.Guia.decir([H.mapa.vista]); return; }
    if (e === 'bloqueada') { SL.Guia.decir([H.mapa.bloqueada]); return; }
    tarjetaUnidad(SL.unidades[u.id]);
  }

  function tarjetaUnidad(uni) {
    unidadActual = uni;
    var p = SL.progreso.cargar();
    var t = SL.el('div', 'sl-tarjeta sl-cristal sl-tarjeta--lado');
    var lista = uni.misiones.map(function (m, i) {
      var e = p.misiones[m.id] || {}, hecha = e.hecha, enCurso = !hecha && e.paso > 0;
      var der = m.proximamente ? '<span class="sl-mision__e" style="color:var(--muted);font-size:12px;letter-spacing:0">Pronto</span>'
        : '<span class="sl-mision__e' + (hecha ? '' : ' vacia') + '">' + estrellasTxt(e.estrellas || 0) + '</span>';
      return '<li><button class="sl-mision' + (hecha ? ' sl-mision--hecha' : '') + '" data-i="' + i + '"' + (m.proximamente ? ' disabled' : '') + '>' +
        '<span class="sl-mision__n">' + (hecha ? '✓' : i + 1) + '</span><span class="sl-mision__t">' + m.titulo + '<small>' + (enCurso ? 'A medias · sigue donde lo dejaste' : m.resumen) + '</small></span>' + der + '</button></li>';
    }).join('');
    var hayRepaso = uni.misiones.some(function (m) { return (p.misiones[m.id] || {}).hecha && uni.bancos && uni.bancos[m.id]; });
    t.innerHTML = '<button class="sl-btn sl-btn--icono sl-tarjeta__cerrar" aria-label="Cerrar">✕</button>' +
      '<p class="sl-tarjeta__ante">Unidad ' + uni.n + '</p><h2>' + uni.titulo + '</h2><p class="sl-tarjeta__sub">' + uni.descripcion + '</p>' +
      '<ul class="sl-misiones">' + lista + '</ul>' +
      '<div class="sl-tarjeta__botones"><button class="sl-btn" data-x="repaso"' + (hayRepaso ? '' : ' disabled title="Termina una misión primero"') + '>⚡ Repaso rápido</button>' +
      '<button class="sl-btn" data-x="explorar">Explorar libre</button></div>';
    ui.centro.innerHTML = ''; ui.centro.appendChild(t);
    t.querySelector('.sl-tarjeta__cerrar').onclick = function () { ui.centro.innerHTML = ''; SL.Guia.decir([H.mapa.explorar]); };
    t.querySelectorAll('.sl-mision').forEach(function (b) { b.onclick = function () { empezarMision(uni, uni.misiones[+b.dataset.i]); }; });
    t.querySelector('[data-x=repaso]').onclick = function () { repasoRapido(uni); };
    t.querySelector('[data-x=explorar]').onclick = function () { ui.centro.innerHTML = ''; M3.limpiarZonas(); SL.Guia.decir([H.mapa.explorar]); };
    var sig = uni.misiones.filter(function (m) { return !m.proximamente && !(p.misiones[m.id] || {}).hecha; })[0];
    SL.Guia.decir([{ quien: 'alberto', gesto: 'senala', texto: sig ? 'Elige una misión. Te recomiendo: **' + sig.titulo + '**.' : '¡Todo hecho! Repite para sacar 3 estrellas o haz un repaso rápido.' }]);
  }

  // ---------- misiones ----------
  function expandir(pasos) {
    var r = [];
    pasos.forEach(function (p) {
      if (p.tipo === 'repaso') SL.barajar(p.banco).slice(0, p.n).forEach(function (q) { r.push(Object.assign({ etapa: p.etapa }, q)); });
      else r.push(p);
    });
    return r;
  }

  function empezarMision(uni, m) {
    var e = SL.progreso.mision(m.id);
    if (e.hecha || !e.paso) { e.paso = 0; e.intento = { preguntas: 0, primera: 0 }; }
    e.intento = e.intento || { preguntas: 0, primera: 0 };
    SL.progreso.guardar();
    correr({ uni: uni, mision: m, pasos: expandir(m.pasos), estado: e, guardar: true });
  }

  function repasoRapido(uni) {
    var p = SL.progreso.cargar(), banco = [];
    uni.misiones.forEach(function (m) { if ((p.misiones[m.id] || {}).hecha && uni.bancos[m.id]) banco = banco.concat(uni.bancos[m.id]); });
    var pasos = expandir([{ tipo: 'repaso', n: Math.min(6, banco.length), banco: banco, etapa: 0 }]);
    correr({ uni: uni, mision: { id: 'repaso', titulo: 'Repaso rápido', etapas: ['Repaso'] }, pasos: pasos, estado: { paso: 0, intento: { preguntas: 0, primera: 0 } }, guardar: false });
  }

  function correr(r) {
    modo = 'mision';
    ui.centro.innerHTML = ''; ui.ficha.hidden = true; M3.seleccionar(null);
    M3.verGrupo('unidad', false); M3.limpiarZonas();
    ui.tracker.hidden = false;

    function tracker() {
      var et = r.mision.etapas || [], actualEt = (r.pasos[r.estado.paso] || {}).etapa || 0, fin = r.estado.paso >= r.pasos.length;
      ui.tracker.innerHTML = '<h3>' + r.mision.titulo + ' <small>' + Math.min(r.estado.paso + 1, r.pasos.length) + ' / ' + r.pasos.length + '</small></h3>' +
        '<ol class="sl-etapas">' + et.map(function (t, i) { return '<li class="' + (fin || i < actualEt ? 'hecha' : i === actualEt ? 'ahora' : '') + '">' + t + '</li>'; }).join('') + '</ol>';
    }
    function siguiente() {
      if (r.guardar) SL.progreso.guardar();
      tracker();
      if (r.estado.paso >= r.pasos.length) return terminar(r);
      var p = r.pasos[r.estado.paso];
      if (p.tipo === 'dialogo') {
        SL.Guia.decir(conVer(p.lineas), function () { M3.limpiarZonas(); r.estado.paso++; siguiente(); });
        if (!p.lineas.some(function (l) { return l.ver; })) M3.inicio(1.2);
      } else {
        SL.Juego.jugar(p, function (primera) {
          var g = SL.progreso.cargar();
          r.estado.intento.preguntas++; if (primera) r.estado.intento.primera++;
          g.preguntas = (g.preguntas || 0) + 1; if (primera) g.primera = (g.primera || 0) + 1;
          r.estado.paso++; pintarKpis(); siguiente();
        });
      }
    }
    siguiente();
  }

  function terminar(r) {
    var it = r.estado.intento, ratio = it.preguntas ? it.primera / it.preguntas : 1;
    var est = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    if (r.guardar) {
      r.estado.hecha = true; r.estado.paso = 0;
      r.estado.estrellas = Math.max(r.estado.estrellas || 0, est);
      SL.progreso.guardar();
    }
    pintarKpis();
    ui.tracker.hidden = true;
    var t = SL.el('div', 'sl-tarjeta sl-cristal sl-final');
    var s = ''; for (var i = 0; i < 3; i++) s += '<span class="' + (i < est ? '' : 'off') + '">★</span>';
    t.innerHTML = '<p class="sl-tarjeta__ante">' + (r.guardar ? 'Misión completada' : 'Repaso terminado') + '</p><h2>' + r.mision.titulo + '</h2>' +
      '<div class="sl-estrellas">' + s + '</div><p class="sl-tarjeta__sub">' + it.primera + ' de ' + it.preguntas + ' a la primera</p>' +
      '<div class="sl-tarjeta__botones"><button class="sl-btn" data-x="otra">↺ Otra vez</button><button class="sl-btn sl-btn--oscuro" data-x="unidad">Volver a la unidad</button></div>';
    ui.centro.innerHTML = ''; ui.centro.appendChild(t);
    t.querySelector('[data-x=otra]').onclick = function () { if (r.guardar) empezarMision(r.uni, r.mision); else repasoRapido(r.uni); };
    t.querySelector('[data-x=unidad]').onclick = function () {
      var u = SL.mundo.unidades.filter(function (x) { return x.id === r.uni.id; })[0]; abrirUnidad(u);
    };
    var fin = [{ quien: 'alberto', gesto: est === 3 ? 'celebra' : 'pulgar', texto: est === 3 ? '¡Perfecto! Tres estrellas.' : 'Bien hecho. Repite para conseguir las 3 estrellas.' }];
    if (r.guardar && SL.Sesion.actual() == null) fin.push({ quien: 'alberto', gesto: 'senala', texto: 'Consejo: cread un **equipo** (arriba) para guardar la partida.' });
    SL.Guia.decir(fin);
  }

  // ---------- ficha de objetos (explorar) ----------
  function ficha(f) {
    if (!f || modo === 'mision') { ui.ficha.hidden = true; return; }
    ui.ficha.hidden = false;
    ui.ficha.innerHTML = '<button class="sl-btn sl-btn--icono sl-tarjeta__cerrar" aria-label="Cerrar">✕</button><h3>' + f.nombre + '</h3><p>' + (f.texto || '') + '</p>' +
      (f.datos ? '<dl>' + f.datos.map(function (d) { return '<dt>' + d[0] + '</dt><dd>' + d[1] + '</dd>'; }).join('') + '</dl>' : '');
    ui.ficha.querySelector('button').onclick = function () { M3.seleccionar(null); };
  }

  // ---------- créditos ----------
  function creditos() {
    var c = H.creditos, v = SL.el('div', 'sl-velo'), t = SL.el('div', 'sl-sesion sl-cristal sl-creditos');
    t.innerHTML = '<button class="sl-btn sl-btn--icono sl-tarjeta__cerrar">✕</button><h2>' + c.titulo + '</h2><p>' + c.autor + '<br><a href="' + c.web + '" target="_blank" rel="noopener">' + c.web.replace('https://', '') + '</a></p><p style="font-size:13px">' + c.licencia + '</p>';
    v.appendChild(t); document.body.appendChild(v);
    var cerrar = function () { v.remove(); };
    t.querySelector('button').onclick = cerrar; v.onclick = function (e) { if (e.target === v) cerrar(); };
  }

  // ---------- arranque ----------
  function portada(entrar) {
    var P = H.portada, el = SL.el('div', 'sl-portada');
    el.innerHTML = '<div class="sl-vivo"><i></i><i></i><i></i></div><div class="sl-portada__in">' +
      '<p class="sl-portada__ante">' + P.ante + '</p><h1>Simu<b>Lab</b></h1>' +
      '<p class="sl-portada__mod">' + P.modulo + '</p><p class="sl-portada__caso">' + P.caso + '</p>' +
      '<button class="sl-btn sl-btn--grande">Entrar</button></div>';
    document.body.appendChild(el);
    var b = el.querySelector('button'); b.focus();
    b.onclick = function () { el.classList.add('sl-portada--fuera'); setTimeout(function () { el.remove(); }, 900); entrar(); };
  }

  function empezar() {
    var p = SL.progreso.cargar();
    pintarEquipo(); pintarKpis();
    if (!p.prologo) {
      M3.volarA({ x: -4, z: -10, dist: 70, az: 0.2, el: 0.5 }, 0.01);
      M3.volarA(SL.mundo.camaraInicial, 9);
      M3.verGrupo('unidad', false);
      SL.Guia.decir(H.prologo, function () { p.prologo = true; SL.progreso.guardar(); irMapa(); }, { fin: '¡Vamos! ›' });
    } else irMapa();
  }

  A.iniciar = function () {
    M3 = SL.Mundo3D; H = SL.historia;
    M3.margenDerecho = function () { return window.innerWidth > 760 ? ui.guia.offsetWidth + 24 : 0; };
    construir();
    SL.Guia.iniciar(ui.guia);
    M3.iniciar(ui.mundo);
    M3.alSeleccionar(ficha);
    crearPins();
    SL.Sesion.alCambiar(function () { pintarEquipo(); pintarKpis(); if (modo === 'mapa' && unidadActual) tarjetaUnidad(unidadActual); });
    SL.Guia.decir([{ quien: 'alberto', gesto: 'explica', texto: 'Cargando el almacén…' }], null, { espera: ' ' });
    portada(function () {
      if (SL.config.pedirSesion && !SL.Sesion.actual()) { SL.Sesion.abrir('inicio'); SL.Sesion.alCambiar(function () { pintarEquipo(); pintarKpis(); SL.Sesion.alCambiar(function () { pintarEquipo(); pintarKpis(); }); empezar(); }); }
      else empezar();
    });
  };
})();
