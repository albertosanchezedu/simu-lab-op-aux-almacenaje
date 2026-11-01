/* SimuLab · core/sesion.js
 * Equipos y partida guardada (inspirado en el canjeador de códigos del banner de actividades).
 *  - Cada equipo (pareja de un ordenador) tiene nombre + número de ordenador + clave de 4 números.
 *  - El progreso se guarda solo en este navegador, por equipo: varios grupos pueden usar el mismo PC.
 *  - «Guardar partida» da un CÓDIGO que lleva el progreso dentro: sirve para seguir en otro ordenador
 *    o si se borra el navegador. Para recuperarlo hacen falta el código, el nombre del equipo y la clave.
 *  - Mientras SL.config.pedirSesion sea false se entra directamente como «Invitado» (modo pruebas).
 */
(function () {
  'use strict';
  var SL = window.SimuLab;
  SL.config = SL.config || {};
  if (SL.config.pedirSesion == null) SL.config.pedirSesion = false; // ← cambiar a true cuando terminen las pruebas

  var PREF = 'simulab-op-aux-almacenaje-v1';
  var SECRETO = 52817; // no cambiar tras publicar: invalidaría los códigos
  var ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var MAX_MISIONES = 12; // huecos fijos por unidad: añadir misiones al final nunca rompe códigos antiguos

  function leer(k, def) { try { var v = localStorage.getItem(PREF + ':' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function escribir(k, v) { try { localStorage.setItem(PREF + ':' + k, JSON.stringify(v)); } catch (e) { } }
  function norm(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function hash(str, semilla) { var h = semilla | 0; for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0; return Math.abs(h); }
  function aBase(n, largo) { var s = ''; for (var i = 0; i < largo; i++) { s = ABC[n % 32] + s; n = Math.floor(n / 32); } return s; }
  function deBase(s) { var n = 0; for (var i = 0; i < s.length; i++) { var k = ABC.indexOf(s[i]); if (k < 0) return null; n = n * 32 + k; } return n; }
  function idEquipo(nombre, clave) { return aBase(hash(norm(nombre) + '|' + clave, SECRETO) % 1048576, 4); }

  // ---------- estado ----------
  var equipos = leer('equipos', {});        // id -> { nombre, ordenador, clave, progreso }
  var actual = leer('activo', null);         // id o null
  var invitado = leer('invitado', null) || nuevoProgreso();
  if (actual && !equipos[actual]) actual = null;

  function nuevoProgreso() { return { prologo: false, misiones: {} }; }
  function progresoActual() { return actual ? equipos[actual].progreso : invitado; }

  SL.progreso = {
    cargar: function () { var p = progresoActual(); if (!p.misiones) p.misiones = {}; return p; },
    guardar: function () { if (actual) escribir('equipos', equipos); else escribir('invitado', invitado); },
    mision: function (id) {
      var m = SL.progreso.cargar().misiones;
      return m[id] || (m[id] = { paso: 0, hecha: false, estrellas: 0 });
    }
  };

  // ---------- código de partida ----------
  // Formato: ID-UNIDADES-CC. Cada unidad con progreso: número de unidad + 5 caracteres (12 misiones × 2 bits = estrellas 0-3).
  function codificar(id, prog) {
    var partes = [];
    (SL.mundo.unidades || []).forEach(function (u) {
      var uni = SL.unidades[u.id]; if (!uni) return;
      var bits = 0, alguna = false;
      (uni.misiones || []).forEach(function (m, i) {
        if (i >= MAX_MISIONES) return;
        var e = prog.misiones[m.id]; var v = e && e.hecha ? Math.max(1, Math.min(3, e.estrellas || 1)) : 0;
        if (v) alguna = true;
        bits += v * Math.pow(4, i);
      });
      if (alguna) partes.push(u.n + aBase((bits ^ (hash(id, SECRETO + u.n) % 16777216)) >>> 0, 5));
    });
    var cuerpo = partes.join('-') || (prog.prologo ? '0' : '00');
    var cc = aBase(hash(id + cuerpo, SECRETO) % 1024, 2);
    return id + '-' + cuerpo + '-' + cc;
  }
  function decodificar(codigo, id) {
    var p = (codigo || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').split('-').filter(Boolean);
    if (p.length < 3 || p[0] !== id) return null;
    var cc = p[p.length - 1], cuerpo = p.slice(1, -1).join('-');
    if (aBase(hash(id + cuerpo, SECRETO) % 1024, 2) !== cc) return null;
    var prog = nuevoProgreso(); prog.prologo = cuerpo !== '00';
    p.slice(1, -1).forEach(function (seg) {
      if (seg === '0' || seg === '00') return;
      var n = +seg[0], u = (SL.mundo.unidades || []).filter(function (x) { return x.n === n; })[0];
      var uni = u && SL.unidades[u.id], v = deBase(seg.slice(1));
      if (!uni || v == null) return;
      var bits = (v ^ (hash(id, SECRETO + n) % 16777216)) >>> 0;
      (uni.misiones || []).forEach(function (m, i) {
        var e = Math.floor(bits / Math.pow(4, i)) % 4;
        if (e) prog.misiones[m.id] = { paso: 0, hecha: true, estrellas: e };
      });
    });
    return prog;
  }

  // ---------- interfaz ----------
  var velo, caja, alCambiar = null;
  SL.Sesion = {
    actual: function () { return actual ? Object.assign({ id: actual }, equipos[actual]) : null; },
    alCambiar: function (fn) { alCambiar = fn; },
    abrir: function (inicio) { abrir(inicio); },
    cerrar: cerrar
  };
  function cambio() { escribir('activo', actual); if (alCambiar) alCambiar(); }

  function abrir(pantalla) {
    if (!velo) {
      velo = SL.el('div', 'sl-velo'); caja = SL.el('div', 'sl-sesion sl-cristal');
      velo.appendChild(caja); document.body.appendChild(velo);
      velo.addEventListener('click', function (e) { if (e.target === velo && !obligatorio()) cerrar(); });
    }
    velo.hidden = false;
    (pantallas[pantalla] || pantallas.inicio)();
  }
  function cerrar() { if (velo) velo.hidden = true; }
  function obligatorio() { return SL.config.pedirSesion && !actual; }

  function botonCerrar() {
    if (obligatorio()) return '';
    return '<button class="sl-btn sl-btn--icono sl-tarjeta__cerrar" data-a="cerrar" aria-label="Cerrar">✕</button>';
  }
  function pintar(html, acciones) {
    caja.innerHTML = botonCerrar() + html;
    caja.querySelectorAll('[data-a]').forEach(function (b) {
      b.addEventListener('click', function () { var a = b.getAttribute('data-a'); if (a === 'cerrar') cerrar(); else if (acciones[a]) acciones[a](b); });
    });
    var f = caja.querySelector('input'); if (f) setTimeout(function () { f.focus(); }, 60);
    caja.querySelectorAll('input').forEach(function (i) {
      i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && acciones.enter) acciones.enter(); });
    });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function claveValida(c) { return /^\d{4}$/.test(c); }

  var pantallas = {
    inicio: function () {
      if (actual) return pantallas.guardar();
      var ids = Object.keys(equipos);
      var lista = ids.map(function (id) {
        var e = equipos[id];
        return '<button class="sl-mision" data-a="equipo" data-id="' + id + '"><span class="sl-mision__n">' + esc(e.ordenador || '·') + '</span><span class="sl-mision__t">' + esc(e.nombre) + '<small>Ordenador ' + esc(e.ordenador || '—') + '</small></span></button>';
      }).join('');
      pintar('<h2>¿Quién juega?</h2><p>Elegid vuestro equipo para seguir donde lo dejasteis.</p>' +
        (ids.length ? '<div class="sl-lista-equipos">' + lista + '</div>' : '') +
        '<div class="sl-sesion__fila"><button class="sl-btn sl-btn--marca" data-a="nuevo">Equipo nuevo</button><button class="sl-btn" data-a="codigo">Tengo un código</button></div>' +
        (SL.config.pedirSesion && !actual ? '<p style="margin:14px 0 0;text-align:center"><button class="sl-enlace" data-a="invitado">Entrar sin guardar</button></p>' : ''), {
        nuevo: pantallas.nuevo, codigo: pantallas.recuperar,
        invitado: function () { cerrar(); cambio(); },
        equipo: function (b) { pantallas.entrar(b.getAttribute('data-id')); }
      });
    },
    nuevo: function () {
      var opts = ''; for (var i = 1; i <= 30; i++) opts += '<option>' + i + '</option>';
      pintar('<h2>Equipo nuevo</h2><p>Inventad un nombre y una clave fácil de 4 números. ¡Que no se os olvide!</p>' +
        '<label class="sl-campo">Nombre del equipo<input id="slNom" maxlength="24" placeholder="Ej.: Los Tarros"></label>' +
        '<div class="sl-sesion__fila"><label class="sl-campo" style="flex:1">Ordenador<select id="slOrd">' + opts + '</select></label>' +
        '<label class="sl-campo" style="flex:1">Clave (4 números)<input id="slCla" class="sl-clave" inputmode="numeric" maxlength="4" placeholder="····"></label></div>' +
        '<p class="sl-error" id="slErr" hidden></p>' +
        '<div class="sl-sesion__fila"><button class="sl-btn" data-a="volver">‹ Volver</button><button class="sl-btn sl-btn--oscuro" data-a="crear">Crear equipo</button></div>', {
        volver: pantallas.inicio, crear: crear, enter: crear
      });
      function crear() {
        var n = SL.$('#slNom').value.trim(), c = SL.$('#slCla').value.trim(), err = SL.$('#slErr');
        if (norm(n).length < 2) { err.hidden = false; err.textContent = 'Escribid un nombre de equipo.'; return; }
        if (!claveValida(c)) { err.hidden = false; err.textContent = 'La clave son 4 números.'; return; }
        var id = idEquipo(n, c);
        if (!equipos[id]) {
          // El equipo empieza con lo que llevaba el invitado (útil si empezaron sin equipo)
          equipos[id] = { nombre: n, ordenador: SL.$('#slOrd').value, clave: c, progreso: JSON.parse(JSON.stringify(invitado)) };
        }
        actual = id; escribir('equipos', equipos); cerrar(); cambio();
      }
    },
    entrar: function (id) {
      var e = equipos[id];
      pintar('<h2>' + esc(e.nombre) + '</h2><p>Escribid vuestra clave de 4 números.</p>' +
        '<label class="sl-campo">Clave<input id="slCla" class="sl-clave" inputmode="numeric" maxlength="4" placeholder="····"></label>' +
        '<p class="sl-error" id="slErr" hidden></p>' +
        '<div class="sl-sesion__fila"><button class="sl-btn" data-a="volver">‹ Volver</button><button class="sl-btn sl-btn--oscuro" data-a="ok">Entrar</button></div>', {
        volver: pantallas.inicio, ok: ok, enter: ok
      });
      function ok() {
        if (SL.$('#slCla').value.trim() !== e.clave) { var er = SL.$('#slErr'); er.hidden = false; er.textContent = 'Esa clave no es. Probad otra vez.'; return; }
        actual = id; cerrar(); cambio();
      }
    },
    recuperar: function () {
      pintar('<h2>Tengo un código</h2><p>Escribid el código, el nombre del equipo y la clave.</p>' +
        '<label class="sl-campo">Código<input id="slCod" placeholder="Ej.: K7QD-3ABCDE-XY" style="text-transform:uppercase"></label>' +
        '<label class="sl-campo">Nombre del equipo<input id="slNom" maxlength="24"></label>' +
        '<label class="sl-campo">Clave (4 números)<input id="slCla" class="sl-clave" inputmode="numeric" maxlength="4" placeholder="····"></label>' +
        '<p class="sl-error" id="slErr" hidden></p>' +
        '<div class="sl-sesion__fila"><button class="sl-btn" data-a="volver">‹ Volver</button><button class="sl-btn sl-btn--oscuro" data-a="ok">Recuperar</button></div>', {
        volver: pantallas.inicio, ok: ok, enter: ok
      });
      function ok() {
        var n = SL.$('#slNom').value.trim(), c = SL.$('#slCla').value.trim(), err = SL.$('#slErr');
        var id = idEquipo(n, c), prog = claveValida(c) && decodificar(SL.$('#slCod').value, id);
        if (!prog) { err.hidden = false; err.textContent = 'No coincide. Revisad el código, el nombre y la clave.'; return; }
        var prev = equipos[id];
        if (prev) { // se queda con lo mejor de cada misión
          Object.keys(prog.misiones).forEach(function (k) {
            var a = prev.progreso.misiones[k];
            if (!a || !a.hecha || (a.estrellas || 0) < prog.misiones[k].estrellas) prev.progreso.misiones[k] = prog.misiones[k];
          });
          prev.progreso.prologo = prev.progreso.prologo || prog.prologo;
        } else equipos[id] = { nombre: n, ordenador: '', clave: c, progreso: prog };
        actual = id; escribir('equipos', equipos); cerrar(); cambio();
      }
    },
    guardar: function () {
      var e = equipos[actual], cod = codificar(actual, e.progreso);
      SL.progreso.guardar();
      pintar('<h2>Partida guardada</h2><p>Equipo <b>' + esc(e.nombre) + '</b>. Apuntad este código: sirve para seguir en otro ordenador.</p>' +
        '<div class="sl-codigo">' + cod + '</div>' +
        '<div class="sl-sesion__fila"><button class="sl-btn" data-a="copiar">Copiar código</button><button class="sl-btn sl-btn--oscuro" data-a="seguir">Seguir jugando</button></div>' +
        '<p style="margin:14px 0 0;text-align:center"><button class="sl-enlace" data-a="salir">Cerrar sesión</button></p>', {
        copiar: function (b) { try { navigator.clipboard.writeText(cod); b.textContent = 'Copiado ✓'; } catch (x) { } },
        seguir: cerrar,
        salir: function () { actual = null; cambio(); pantallas.inicio(); }
      });
    }
  };
})();
