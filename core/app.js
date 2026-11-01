/* SimuLab · core/app.js
 * Recorrido: portada → almacén (mapa central con las unidades) → capítulos de la unidad → pantalla intermedia → capítulo.
 * Mismo marco que Cubic Lab: barra (solo «SimuLab», dónde estoy y Mapa), escenario, panel del personaje, pie y «?».
 * MÁXIMA: si no es sencillo, no se usa. En cada momento solo se ve lo que toca.
 */
(function () {
  'use strict';
  var SL = window.SimuLab;
  var A = SL.App = {};
  var M3, H, $ = SL.$, enCapitulo = false;

  // ---------- utilidades ----------
  function estado(u) { // 'activa' | 'vista' | 'bloq'
    var uni = SL.unidades[u.id];
    if (uni && uni.misiones.some(function (m) { return !m.proximamente; })) return 'activa';
    return u.n < 3 ? 'vista' : 'bloq';
  }
  function hecha(id) { return !!(SL.progreso.cargar().misiones[id] || {}).hecha; }
  function conVer(lineas) {
    return lineas.map(function (l) {
      if (!l.ver) return l;
      return Object.assign({}, l, { alMostrar: function () { M3.limpiarZonas(); M3.resaltarZona(l.ver, 'ver'); M3.volarA(M3.vistaZona(l.ver), 1.2); } });
    });
  }
  function donde(html, k, n) {
    $('.sl-donde').style.visibility = n ? '' : 'hidden'; // en la pantalla principal no hay barra
    $('#sl-donde').innerHTML = html;
    $('#sl-donde-barra').style.width = (n ? Math.round(100 * k / n) : 0) + '%';
  }
  function lamina(nodo) { SL.Juego.verLamina(nodo); }

  // ---------- pie, «?» y créditos (como en Cubic Lab) ----------
  function pie() {
    $('#sl-pie').innerHTML = H.modulo + ' <span class="sl-sep">✦</span> ' + H.ciclo;
  }
  function creditos() {
    var c = H.creditos, m = SL.marca, dlg = $('#sl-creditos'), btn = $('#sl-ayuda');
    dlg.innerHTML =
      '<p class="sl-creditos__titulo">' + m.nombre + '</p>' +
      '<p class="sl-creditos__tema">' + H.modulo + '</p>' +
      '<p class="sl-creditos__autor">Creado por <a href="' + c.web + '" target="_blank" rel="noopener">' + c.autor + '</a><br>' + c.cargo + '</p>' +
      '<button type="button" class="sl-btn sl-btn--marca" id="sl-equipo">Guardar la partida</button>' +
      '<button type="button" class="sl-btn sl-btn--suave" id="sl-completa" hidden>⛶ Ver en pantalla completa</button>' +
      '<p class="sl-creditos__legal">© El concepto ' + m.nombre + ' es propiedad de ' + c.autor + ', quien guarda todos los derechos reservados.<br>' +
      'Este ' + m.nombre + ' de ' + H.modulo.charAt(0).toLowerCase() + H.modulo.slice(1) + ' tiene licencia <a href="' + c.licenciaUrl + '" target="_blank" rel="noopener">' + c.licencia + '</a>: puedes usarlo en tu aula citando al autor y sin fines comerciales.</p>';
    function abrir(si) {
      $('#sl-completa').hidden = !SL.Pantallas.puedePantallaCompleta();
      var s = SL.Sesion.actual();
      $('#sl-equipo').textContent = s ? 'Equipo ' + s.nombre + ' · ver código' : 'Guardar la partida';
      dlg.hidden = !si; btn.setAttribute('aria-expanded', si); document.body.classList.toggle('sl-con-creditos', si);
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); abrir(dlg.hidden); });
    document.addEventListener('click', function (e) { if (!dlg.hidden && !dlg.contains(e.target)) abrir(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !dlg.hidden) { abrir(false); btn.focus(); } });
    $('#sl-completa').addEventListener('click', function () { abrir(false); SL.Pantallas.pantallaCompleta(); });
    $('#sl-equipo').addEventListener('click', function () { abrir(false); SL.Sesion.abrir(SL.Sesion.actual() ? 'guardar' : 'inicio'); });
  }

  // ---------- el almacén: mapa central ----------
  function crearPins() {
    SL.mundo.unidades.forEach(function (u) {
      var e = estado(u), uni = SL.unidades[u.id];
      var todo = uni && uni.misiones.filter(function (m) { return !m.proximamente; }).every(function (m) { return hecha(m.id); });
      var el = SL.el('button', 'sl-pin sl-pin--' + e,
        '<span class="sl-pin__txt">' + (u.corto || u.titulo) + '</span><span class="sl-pin__num">' + (e === 'bloq' ? '🔒' : u.n) + '</span><span class="sl-pin__palo"></span>');
      el.type = 'button';
      el.setAttribute('aria-label', 'Unidad ' + u.n + ': ' + u.titulo);
      el.onclick = function () { abrirUnidad(u); };
      M3.anclar(el, u.x, u.alto || 7.5, u.z, 'unidad');
      if (todo) el.classList.add('sl-pin--hecha');
    });
  }

  function irMapa() {
    enCapitulo = false;
    $('#sl-app').classList.remove('sl-app--capitulo');
    cerrarHoja(); lamina(null);
    M3.modoTocarZonas(null); M3.limpiarZonas(); M3.seleccionar(null); M3.verGrupo('zona', nombres); M3.verGrupo('unidad', true);
    M3.inicio(1.4);
    var hechos = 0, total = 0;
    Object.keys(SL.unidades).forEach(function (k) { SL.unidades[k].misiones.forEach(function (m) { if (!m.proximamente) { total++; if (hecha(m.id)) hechos++; } }); });
    donde('', 0, 0);
    SL.Guia.decir([H.mapa.bienvenida, H.mapa.girar]);
  }

  function abrirUnidad(u) {
    if (enCapitulo) return;
    var e = estado(u);
    M3.limpiarZonas(); M3.resaltarZona(u.zona, 'ver');
    M3.volarA(M3.vistaZona(u.zona, { dist: 50 }), 1.2);
    if (e === 'vista') return SL.Guia.decir([H.mapa.vista]);
    if (e === 'bloq') return SL.Guia.decir([H.mapa.bloqueada]);
    hoja(SL.unidades[u.id]);
  }

  // Hoja con los capítulos de la unidad (la misma que la de los Labs del Cubic)
  function cerrarHoja() { var h = $('.sl-hoja-velo'); if (h) h.remove(); }
  function hoja(uni) {
    cerrarHoja();
    var v = SL.el('div', 'sl-hoja-velo');
    v.innerHTML = '<div class="sl-mapa__hoja" role="dialog" aria-label="Unidad ' + uni.n + '">' +
      '<button type="button" class="sl-mapa__atras"><svg class="sl-flecha" viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3m4.5-4.5L3 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Almacén</span></button>' +
      '<small>Unidad ' + uni.n + '</small><h3>' + uni.titulo + '</h3><p>' + uni.descripcion + '</p><div class="sl-mapa__pasos">' +
      uni.misiones.map(function (m, i) {
        var h = hecha(m.id);
        return '<button type="button" class="sl-mapa__paso' + (h ? ' sl-mapa__paso--hecho' : '') + (m.proximamente ? ' sl-mapa__paso--pronto' : '') + '" data-i="' + i + '"' + (m.proximamente ? ' disabled' : '') + '>' +
          '<span>' + (h ? '✓' : i + 1) + '</span>' + m.titulo + (m.proximamente ? '<em class="sl-cap__estado">Pronto</em>' : '') + '</button>';
      }).join('') + '</div></div>';
    $('#sl-escenario').appendChild(v);
    v.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (e.target === v || (b && b.classList.contains('sl-mapa__atras'))) { cerrarHoja(); M3.inicio(1.2); M3.limpiarZonas(); return SL.Guia.decir([H.mapa.bienvenida]); }
      if (b && b.dataset.i != null) entrarCapitulo(uni, +b.dataset.i);
    });
    SL.Guia.decir([H.mapa.capitulos]);
  }

  // ---------- capítulos ----------
  function expandir(pasos) {
    var r = [];
    pasos.forEach(function (p) {
      if (p.tipo === 'repaso') SL.barajar(p.banco).slice(0, p.n).forEach(function (q) { r.push(Object.assign({ etapa: p.etapa }, q)); });
      else r.push(p);
    });
    return r;
  }

  // Pantalla intermedia: se ve claro que cambiamos de espacio.
  function entrarCapitulo(uni, i) {
    var m = uni.misiones[i];
    cerrarHoja();
    $('#sl-raiz').setAttribute('inert', '');
    SL.Pantallas.divisor({
      num: i + 1, etiqueta: 'Unidad ' + uni.n + ' · Capítulo ' + (i + 1), titulo: m.titulo, gancho: m.gancho,
      puntos: uni.misiones.filter(function (x) { return !x.proximamente; }).map(function (x) { return hecha(x.id); }),
      boton: 'Empezar', alVolver: function () { $('#sl-raiz').removeAttribute('inert'); irMapa(); }
    }, function () { $('#sl-raiz').removeAttribute('inert'); correr(uni, m); });
  }

  function correr(uni, m) {
    enCapitulo = true;
    $('#sl-app').classList.add('sl-app--capitulo');
    M3.verGrupo('unidad', false); M3.verGrupo('zona', false); M3.limpiarZonas(); M3.seleccionar(null); cerrarExplorar();
    var e = SL.progreso.mision(m.id);
    if (e.hecha || !e.paso) { e.paso = 0; e.intento = { preguntas: 0, primera: 0 }; }
    e.intento = e.intento || { preguntas: 0, primera: 0 };
    var pasos = expandir(m.pasos);
    SL.progreso.guardar();

    function siguiente() {
      SL.progreso.guardar();
      if (!enCapitulo) return;
      if (e.paso >= pasos.length) return terminar(uni, m, e);
      donde('<strong>Unidad ' + uni.n + '</strong> · ' + m.titulo, e.paso, pasos.length);
      var p = pasos[e.paso];
      var avanzar = function () { M3.limpiarZonas(); lamina(null); e.paso++; siguiente(); };
      if (p.tipo === 'dialogo') {
        lamina(null);
        if (!p.lineas.some(function (l) { return l.ver; })) M3.inicio(1.2);
        SL.Guia.decir(conVer(p.lineas), avanzar);
      } else if (p.tipo === 'cuaderno') {
        var c = SL.el('div', 'sl-cuaderno');
        c.innerHTML = '<span class="sl-cuaderno__ante">✎ Copia en tu cuaderno</span><p class="sl-cuaderno__tit">' + p.titulo + '</p><ol>' +
          p.lineas.map(function (t) { return '<li>' + t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') + '</li>'; }).join('') + '</ol>';
        lamina(c);
        SL.Guia.decir([p.dice || { quien: 'alberto', gesto: 'senala', texto: 'Sacad el cuaderno. Copiad esto.' }], avanzar, { fin: 'Ya lo hemos copiado →' });
      } else {
        SL.Juego.jugar(p, function (primera) {
          var g = SL.progreso.cargar();
          e.intento.preguntas++; if (primera) e.intento.primera++;
          g.preguntas = (g.preguntas || 0) + 1; if (primera) g.primera = (g.primera || 0) + 1;
          e.paso++; siguiente();
        });
      }
    }
    siguiente();
  }

  function terminar(uni, m, e) {
    var it = e.intento, ratio = it.preguntas ? it.primera / it.preguntas : 1;
    var est = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    e.hecha = true; e.paso = 0; e.estrellas = Math.max(e.estrellas || 0, est);
    SL.progreso.guardar();
    enCapitulo = false;
    var i = uni.misiones.indexOf(m), sig = uni.misiones[i + 1];
    var hay = sig && !sig.proximamente;
    var estrellas = '★★★'.slice(0, est) + '☆☆☆'.slice(0, 3 - est);
    $('#sl-raiz').setAttribute('inert', '');
    SL.Pantallas.divisor({
      hecho: m.titulo, num: i + 2, fin: !hay,
      etiqueta: hay ? 'Capítulo ' + (i + 2) : '',
      titulo: hay ? sig.titulo : '¡Capítulo superado!',
      gancho: estrellas + ' · ' + it.primera + ' de ' + it.preguntas + ' a la primera',
      puntos: uni.misiones.filter(function (x) { return !x.proximamente; }).map(function (x) { return hecha(x.id); }),
      boton: hay ? 'Empezar' : 'Volver al almacén',
      alVolver: hay ? function () { $('#sl-raiz').removeAttribute('inert'); irMapa(); } : null
    }, function () { $('#sl-raiz').removeAttribute('inert'); if (hay) correr(uni, sig); else irMapa(); });
  }

  // ---------- explorar: tocar una máquina o un edificio en el mapa ----------
  function ficha(f) {
    var el = $('#sl-ficha');
    if (!f || enCapitulo) { el.hidden = true; return; }
    el.hidden = false;
    var datos = (f.datos || []).map(function (d) { return '<li><span>' + d[0] + '</span><b>' + d[1] + '</b></li>'; }).join('');
    el.innerHTML = '<button type="button" class="sl-ficha__cerrar" aria-label="Cerrar">×</button><p class="sl-ficha__titulo">' + f.nombre + '</p><p style="margin:0;font-size:14px">' + (f.texto || '') + '</p>' +
      (datos ? '<ul class="sl-ficha__datos">' + datos + '</ul>' : '') +
      '<button type="button" class="sl-btn sl-ficha__volver">← Volver a la vista</button>';
    el.querySelector('.sl-ficha__cerrar').onclick = el.querySelector('.sl-ficha__volver').onclick = function () { M3.volver(); };
  }

  // ---------- mandos del mapa: 2D/3D, nombres, día/noche, zoom y explorar ----------
  var nombres = false;
  var ICO = {
    mas: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    menos: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    casa: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
  };
  function mandos() {
    var esc = $('#sl-escenario');
    var vista = SL.el('div', 'sl-seg sl-vista sl-mando', '<button type="button" data-vista="2d" aria-pressed="false">2D</button><button type="button" data-vista="3d" aria-pressed="true">3D</button>');
    vista.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var es2 = M3.vista2D(b.dataset.vista === '2d');
      vista.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String((x.dataset.vista === '2d') === es2)); });
    };
    var zoom = SL.el('div', 'sl-zoom sl-mando',
      '<button type="button" class="sl-redondo" data-z="mas" aria-label="Acercar">' + ICO.mas + '</button>' +
      '<button type="button" class="sl-redondo" data-z="menos" aria-label="Alejar">' + ICO.menos + '</button>' +
      '<button type="button" class="sl-redondo" data-z="casa" aria-label="Ver todo">' + ICO.casa + '</button>');
    zoom.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.z === 'mas') M3.zoom(0.8); else if (b.dataset.z === 'menos') M3.zoom(1.25); else { M3.seleccionar(null); M3.inicio(1); }
    };
    var ver = SL.el('div', 'sl-seg sl-ver sl-mando',
      '<button type="button" data-v="nombres" aria-pressed="false">Nombres</button><button type="button" data-v="noche" aria-pressed="false" aria-label="Día o noche">☾</button>');
    ver.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.v === 'nombres') { nombres = !nombres; M3.verGrupo('zona', nombres && !enCapitulo); b.setAttribute('aria-pressed', String(nombres)); }
      else { var n = M3.noche(); b.setAttribute('aria-pressed', String(n)); b.textContent = n ? '☀' : '☾'; }
    };
    var exp = SL.el('div', 'sl-explorar sl-mando',
      '<button type="button" class="sl-btn sl-explorar__abrir" aria-expanded="false">☰ Explorar</button><div class="sl-explorar__lista sl-cristal" hidden></div>');
    exp.querySelector('.sl-explorar__abrir').onclick = function () { var l = exp.querySelector('.sl-explorar__lista'); l.hidden ? abrirExplorar() : cerrarExplorar(); };
    [vista, zoom, ver, exp].forEach(function (n) { esc.appendChild(n); });
  }
  // Grupos para moverse por lo que hay en el mapa
  function grupoDe(f) {
    if (f.tipo === 'vehiculo') { var t = f.vehiculo.def.tipo; return t === 'camion' ? 'Camiones' : t === 'persona' ? 'Personas' : t === 'coche' ? null : 'Máquinas'; }
    return f.grupo || 'Edificios y zonas';
  }
  function abrirExplorar() {
    var l = $('.sl-explorar__lista'), grupos = {}, orden = ['Edificios y zonas', 'Dentro de la nave', 'Camiones', 'Máquinas', 'Personas'], vistos = {};
    M3.elementos().forEach(function (e) {
      var g = grupoDe(e.ficha); if (!g) return;
      var clave = g + e.ficha.nombre; if (vistos[clave]) return; vistos[clave] = 1;
      (grupos[g] = grupos[g] || []).push(e);
    });
    l.innerHTML = '';
    orden.forEach(function (g) {
      if (!grupos[g]) return;
      l.appendChild(SL.el('p', 'sl-explorar__grupo', g));
      grupos[g].forEach(function (e) {
        var b = SL.el('button', 'sl-explorar__item', e.ficha.nombre); b.type = 'button';
        b.onclick = function () { M3.seleccionar(e.obj, e.ficha); };
        l.appendChild(b);
      });
    });
    l.hidden = false; $('.sl-explorar__abrir').setAttribute('aria-expanded', 'true');
  }
  function cerrarExplorar() { var l = $('.sl-explorar__lista'); if (l) { l.hidden = true; $('.sl-explorar__abrir').setAttribute('aria-expanded', 'false'); } }

  // ---------- arranque ----------
  function empezar() {
    var p = SL.progreso.cargar();
    if (!p.prologo) {
      M3.verGrupo('unidad', false);
      M3.volarA({ x: -4, z: -10, dist: 70, az: 0.2, el: 0.5 }, 0.01);
      M3.volarA(SL.mundo.camaraInicial, 9);
      SL.Guia.decir(H.prologo, function () { p.prologo = true; SL.progreso.guardar(); irMapa(); }, { fin: '¡Vamos! →' });
    } else irMapa();
  }

  A.iniciar = function () {
    M3 = SL.Mundo3D; H = SL.historia;
    document.title = SL.marca.nombre + ' · ' + H.modulo;
    pie(); creditos();
    SL.Guia.iniciar($('#sl-panel'), $('#sl-siguiente'), $('#sl-atras'));
    SL.Juego.escenario = $('#sl-escenario'); SL.Juego.lamina = $('#sl-lamina');
    M3.margenDerecho = function () { return 0; };
    M3.iniciar($('#sl-lienzo'));
    M3.alSeleccionar(ficha);
    crearPins(); mandos(); donde('', 0, 0);
    $('#sl-mapa').addEventListener('click', function () { if (!document.querySelector('.sl-pantalla')) irMapa(); });
    $('#sl-marca').addEventListener('click', function () { if (!document.querySelector('.sl-pantalla')) irMapa(); });
    SL.Guia.decir([{ quien: 'alberto', gesto: 'explica', texto: 'Cargando el almacén…' }], null, { espera: '…' });
    SL.Pantallas.portada({ tema: H.modulo, boton: 'Entrar' }, SL.marca, function () {
      if (SL.config.pedirSesion && !SL.Sesion.actual()) {
        SL.Sesion.abrir('inicio');
        SL.Sesion.alCambiar(function () { SL.Sesion.alCambiar(null); empezar(); });
      } else empezar();
    });
  };
})();
