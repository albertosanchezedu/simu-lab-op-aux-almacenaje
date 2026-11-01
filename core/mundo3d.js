/* SimuLab · core/mundo3d.js
 * Maqueta 3D low-poly (Three.js r149, local). Todo se construye en código, sin modelos externos.
 * Lee la descripción del mundo de SimuLab.mundo (mundo/mundo.js) y ofrece:
 *  - cámara de maqueta: arrastrar = mover, botón derecho = girar, rueda = zoom; vuelos suaves.
 *  - vida: vehículos que siguen rutas en bucle y se ceden el paso (nadie se solapa).
 *  - zonas tocables, objetos con ficha, etiquetas HTML ancladas al plano, día/noche.
 */
(function () {
  'use strict';
  var SL = window.SimuLab;
  var T = window.THREE;

  var M = SL.Mundo3D = {};
  var escena, camara, render, contenedor, reloj, luzSol, luzCielo, raycaster, puntero;
  var mundo, est;
  var zonas = {};          // id -> { def, mallas:[], centro, tam }
  var tocables = [];       // mallas con userData.ficha
  var vehiculos = [];
  var anclas = [];         // { el, pos:Vector3, siempre }
  var animables = [];      // funciones (t, dt)
  var emisivos = [];       // materiales que brillan de noche
  var esNoche = false, mezclaNoche = 0;
  var cbTocarZona = null, cbSeleccion = null;
  var seleccion = null, anillo = null;
  var camEstado = { x: 0, z: 0, dist: 80, az: 0.6, el: 0.66 };
  var vuelo = null, siguiendo = null;

  // ---------- materiales y geometrías con caché ----------
  var mats = {};
  function mat(color, extra) {
    var k = color + (extra ? JSON.stringify(extra) : '');
    if (mats[k]) return mats[k];
    var o = { color: color, roughness: 0.82, metalness: 0 };
    if (extra) for (var p in extra) o[p] = extra[p];
    return (mats[k] = new T.MeshStandardMaterial(o));
  }
  var geos = {};
  function geoCaja(w, h, d, r) {
    var k = [w, h, d, r || 0].join('|');
    if (geos[k]) return geos[k];
    var g;
    r = Math.min(r || 0, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    if (r > 0.01) {
      var s = new T.Shape(), x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
      s.moveTo(x, y); s.lineTo(x + W, y); s.lineTo(x + W, y + H); s.lineTo(x, y + H); s.lineTo(x, y);
      g = new T.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3 });
      g.translate(0, h / 2, -(d - 2 * r) / 2);
    } else {
      g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
    }
    return (geos[k] = g);
  }
  // Caja con la base en y = 0 (o en y si se indica).
  function caja(w, h, d, color, x, y, z, r, extra) {
    var m = new T.Mesh(geoCaja(w, h, d, r), typeof color === 'string' ? mat(color, extra) : color);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cilindro(rt, rb, h, color, x, y, z, seg) {
    var k = 'c' + [rt, rb, h, seg || 12].join('|');
    var g = geos[k] || (geos[k] = (function () { var c = new T.CylinderGeometry(rt, rb, h, seg || 12); c.translate(0, h / 2, 0); return c; })());
    var m = new T.Mesh(g, mat(color)); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function esfera(r, color, x, y, z) {
    var k = 's' + r;
    var g = geos[k] || (geos[k] = new T.SphereGeometry(r, 14, 10));
    var m = new T.Mesh(g, mat(color)); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true;
    return m;
  }
  function plano(w, d, color, x, y, z, opacidad) {
    var mt = new T.MeshStandardMaterial({ color: color, roughness: 1, transparent: opacidad != null, opacity: opacidad == null ? 1 : opacidad, depthWrite: opacidad == null });
    var m = new T.Mesh(new T.PlaneGeometry(w, d), mt);
    m.rotation.x = -Math.PI / 2; m.position.set(x || 0, y || 0.01, z || 0); m.receiveShadow = true;
    return m;
  }
  function textoTextura(texto, opc) {
    opc = opc || {};
    var c = document.createElement('canvas'); c.width = opc.ancho || 1024; c.height = opc.alto || 256;
    var x = c.getContext('2d');
    x.fillStyle = opc.fondo || '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = opc.color || '#1c1c1f';
    x.font = (opc.peso || 800) + ' ' + (opc.tam || 120) + 'px "Bricolage Grotesque Variable", system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(texto, c.width / 2, c.height / 2 + 6);
    var t = new T.CanvasTexture(c); t.anisotropy = 4;
    if ('colorSpace' in t) t.colorSpace = 'srgb'; else t.encoding = T.sRGBEncoding;
    return t;
  }
  function brillo(color) {
    var m = new T.MeshStandardMaterial({ color: color, emissive: new T.Color(color), emissiveIntensity: 0, roughness: 0.5 });
    emisivos.push(m); return m;
  }
  function ficha(obj, f) {
    if (!f) return;
    obj.traverse(function (o) { if (o.isMesh) { o.userData.ficha = f; o.userData.raiz = obj; tocables.push(o); } });
    obj.userData.ficha = f;
  }

  // ---------- piezas de la maqueta ----------
  var P = M.piezas = {};

  P.palet = function (carga, azar, colores) {
    var g = new T.Group(), madera = est.madera || '#d2a96f';
    g.add(caja(1.2, 0.04, 0.8, madera, 0, 0.11));
    [-0.5, 0, 0.5].forEach(function (x) { g.add(caja(0.14, 0.11, 0.8, '#b98d55', x, 0)); });
    if (carga) {
      var cols = colores || est.cajas || ['#c9a06a'];
      var filas = 1 + Math.floor((azar ? azar() : 0.5) * 3);
      for (var f = 0; f < filas; f++)
        for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
          var cc = cols[Math.floor((azar ? azar() : 0) * cols.length) % cols.length];
          g.add(caja(0.56, 0.36, 0.38, cc, -0.29 + i * 0.58, 0.15 + f * 0.37, -0.2 + j * 0.4, 0.03));
        }
      // film retráctil
      var film = new T.Mesh(geoCaja(1.2, filas * 0.37 + 0.02, 0.84, 0.05), new T.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, roughness: 0.2 }));
      film.position.y = 0.14; g.add(film);
    }
    return g;
  };

  P.rack = function (o) {
    var g = new T.Group(), largo = o.largo || 12, niveles = o.niveles || 3, fondo = 1.1, altoNivel = 1.6;
    var vanos = Math.round(largo / 2.7), paso = largo / vanos, azar = SL.azar(o.semilla || 7);
    var alto = niveles * altoNivel + 0.4;
    for (var v = 0; v <= vanos; v++) {
      var z = -largo / 2 + v * paso;
      g.add(caja(0.09, alto, 0.09, est.rackPuntal, -fondo / 2, 0, z));
      g.add(caja(0.09, alto, 0.09, est.rackPuntal, fondo / 2, 0, z));
    }
    for (var n = 0; n < niveles; n++) {
      var y = 0.15 + n * altoNivel;
      if (n > 0) {
        g.add(caja(0.08, 0.14, largo, est.rackLarguero, -fondo / 2, y - 0.14, 0));
        g.add(caja(0.08, 0.14, largo, est.rackLarguero, fondo / 2, y - 0.14, 0));
      }
      for (var b = 0; b < vanos; b++) {
        if (azar() < (o.llenado == null ? 0.78 : o.llenado)) {
          var p = P.palet(true, azar);
          p.rotation.y = Math.PI / 2;
          p.position.set(0, y - 0.15, -largo / 2 + paso * (b + 0.5));
          g.add(p);
        }
      }
    }
    return g;
  };

  P.camion = function (o) {
    var g = new T.Group(), color = o.color || '#ffffff';
    g.add(caja(2.4, 2.6, 7.6, color, 0, 0.9, 1.4, 0.12));                  // remolque
    g.add(caja(2.3, 0.35, 7.4, '#3a3a40', 0, 0.55, 1.4));                    // chasis
    g.add(caja(2.4, 2.2, 2.2, o.cabina || est.acento, 0, 0.7, -3.6, 0.35)); // cabina (mira a -z)
    g.add(caja(2.0, 0.8, 0.05, '#bcd7ea', 0, 1.9, -4.72, 0, { roughness: 0.15 })); // parabrisas
    [-3.6, 0.2, 1.4, 3.8].forEach(function (z) {
      [-1.05, 1.05].forEach(function (x) {
        var r = cilindro(0.48, 0.48, 0.38, '#26262b', x, 0.48, z, 14); r.rotation.z = Math.PI / 2; r.position.y = 0.48; g.add(r);
      });
    });
    if (o.rotulo) {
      var t = textoTextura(o.rotulo, { color: '#ffffff', fondo: o.cabinaRotulo || est.acento, tam: 96 });
      [-1.21, 1.21].forEach(function (x) {
        var r = new T.Mesh(new T.PlaneGeometry(6.4, 1.2), new T.MeshStandardMaterial({ map: t, roughness: 0.8 }));
        r.position.set(x, 2.3, 1.4); r.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2; g.add(r);
      });
    }
    var faro = new T.Mesh(geoCaja(0.4, 0.2, 0.06), brillo('#fff3c4')); // faros
    [-0.8, 0.8].forEach(function (x) { var f = faro.clone(); f.position.set(x, 1.0, -4.72); g.add(f); });
    // carga visible cuando el camión va lleno
    var carga = new T.Group();
    for (var i = 0; i < 4; i++) { var p = P.palet(true, SL.azar(30 + i)); p.rotation.y = Math.PI / 2; p.position.set(0, 1.25, -0.9 + i * 1.5); carga.add(p); }
    carga.visible = false; g.add(carga); g.userData.carga = carga;
    return g;
  };

  P.carretilla = function (o) {
    // Carretilla contrapesada (o retráctil si o.retractil). Mira a -z (las horquillas delante).
    var g = new T.Group(), c = o.color || '#f2b632', alto = o.retractil ? 4.6 : 3.0;
    g.add(caja(1.1, 0.9, 1.8, c, 0, 0.25, 0.2, 0.15));
    g.add(caja(1.1, 0.7, 0.5, '#3a3a40', 0, 0.35, 1.1, 0.12));             // contrapeso
    g.add(caja(0.5, 0.5, 0.5, '#2e2e33', 0, 1.15, 0.3, 0.1));              // asiento
    [-0.5, 0.5].forEach(function (x) { g.add(caja(0.07, 1.4, 0.07, '#3a3a40', x, 1.15, -0.45)); g.add(caja(0.07, 1.4, 0.07, '#3a3a40', x, 1.15, 0.9)); });
    g.add(caja(1.1, 0.06, 1.45, '#3a3a40', 0, 2.55, 0.22));                // techo protector
    [-0.3, 0.3].forEach(function (x) { g.add(caja(0.09, alto, 0.12, '#55555c', x, 0.1, -0.8)); }); // mástil
    var horq = new T.Group();
    [-0.28, 0.28].forEach(function (x) { horq.add(caja(0.12, 0.05, 1.2, '#55555c', x, 0, -1.45)); });
    horq.add(caja(0.8, 0.5, 0.06, '#55555c', 0, 0, -0.86));
    horq.position.y = 0.12; g.add(horq);
    [[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.9], [0.5, 0.9]].forEach(function (p) {
      var r = cilindro(0.26, 0.26, 0.22, '#26262b', p[0], 0.26, p[1], 12); r.rotation.z = Math.PI / 2; r.position.y = 0.26; g.add(r);
    });
    g.add(caja(0.18, 0.12, 0.18, '#ff8a2a', 0, 2.62, 0.7, 0.04));          // luz rotativa
    var p = P.palet(true, SL.azar(o.semilla || 3)); p.position.set(0, 0.0, -1.45); p.rotation.y = Math.PI / 2;
    p.visible = false; horq.add(p); g.userData.carga = p; g.userData.horquillas = horq;
    return g;
  };

  P.transpaleta = function (o) {
    var g = new T.Group(), c = o.color || '#ef8a3c';
    g.add(caja(0.8, 1.0, 0.6, c, 0, 0.12, 0.35, 0.12));
    g.add(caja(0.06, 0.9, 0.06, '#3a3a40', 0, 1.0, 0.55));
    g.add(caja(0.5, 0.06, 0.08, '#3a3a40', 0, 1.88, 0.62));
    [-0.25, 0.25].forEach(function (x) { g.add(caja(0.18, 0.08, 1.15, '#55555c', x, 0.06, -0.55)); });
    var p = P.palet(true, SL.azar(o.semilla || 5)); p.position.set(0, 0.02, -0.55); p.rotation.y = Math.PI / 2;
    p.visible = false; g.add(p); g.userData.carga = p;
    return g;
  };

  P.coche = function (o) {
    var g = new T.Group();
    g.add(caja(1.8, 0.7, 4.0, o.color || '#2f4fa3', 0, 0.3, 0, 0.3));
    g.add(caja(1.6, 0.6, 2.0, o.color || '#2f4fa3', 0, 0.95, 0.2, 0.3));
    g.add(caja(1.62, 0.4, 1.9, '#bcd7ea', 0, 1.0, 0.2, 0.15, { roughness: 0.15 }));
    [[-0.85, -1.3], [0.85, -1.3], [-0.85, 1.3], [0.85, 1.3]].forEach(function (p) {
      var r = cilindro(0.33, 0.33, 0.24, '#26262b', p[0], 0.33, p[1]); r.rotation.z = Math.PI / 2; r.position.y = 0.33; g.add(r);
    });
    return g;
  };

  P.arbol = function (o, azar) {
    var g = new T.Group(), h = 2.2 + azar() * 1.8;
    g.add(cilindro(0.16, 0.2, h * 0.45, '#9b7653'));
    var k = azar() < 0.5;
    if (k) { var s = esfera(1.0 + azar() * 0.5, est.arbol || '#8fac8b', 0, h * 0.55 + 0.6, 0); s.scale.y = 1.15; g.add(s); }
    else { var cono = new T.Mesh(new T.ConeGeometry(1.1, h * 1.1, 9), mat(est.arbol2 || '#6f9a72')); cono.position.y = h * 0.4 + h * 0.55; cono.castShadow = true; g.add(cono); }
    return g;
  };

  P.farola = function () {
    var g = new T.Group();
    g.add(cilindro(0.08, 0.1, 5, '#55555c'));
    g.add(caja(0.9, 0.12, 0.3, '#55555c', 0.35, 4.95, 0));
    var l = new T.Mesh(geoCaja(0.6, 0.06, 0.24), brillo('#ffe9a8')); l.position.set(0.45, 4.9, 0); g.add(l);
    return g;
  };

  P.nave = function (o) {
    // Nave con "corte de maqueta": muro trasero y laterales altos, frontal bajo para ver dentro.
    var g = new T.Group(), w = o.ancho, d = o.fondo, h = o.alto || 6, e = 0.35;
    var x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
    g.add(caja(w + 0.6, 0.2, d + 0.6, est.losa || '#ece7de', 0, 0, 0, 0.08));
    var suelo = plano(w, d, est.sueloNave || '#f7f4ee', 0, 0.21, 0); g.add(suelo);
    var muro = est.muro || '#f2eee6';
    g.add(caja(w + e, h, e, muro, 0, 0.2, z0, 0.05));                       // norte
    g.add(caja(w + e, o.altoFrente || 1.0, e, muro, 0, 0.2, z1, 0.05));     // sur (bajo)
    g.add(caja(w + e, 0.25, e + 0.02, est.acento, 0, h + 0.2, z0));          // remate de color
    // laterales con huecos para los muelles
    ['oeste', 'este'].forEach(function (lado) {
      var x = lado === 'oeste' ? x0 : x1;
      var huecos = (o.muelles || []).filter(function (m) { return m.lado === lado; }).map(function (m) { return m.z; }).sort(function (a, b) { return a - b; });
      var cortes = [z0], anchoH = 3.4;
      huecos.forEach(function (z) { cortes.push(z - anchoH / 2, z + anchoH / 2); });
      cortes.push(z1);
      for (var i = 0; i < cortes.length; i += 2) {
        var a = cortes[i], b = cortes[i + 1], largo = b - a;
        if (largo > 0.05) {
          var alto = h - (h - (o.altoFrente || 1)) * Math.max(0, (a + b) / 2 - z0) / d * 0.0; // laterales altos
          g.add(caja(e, alto, largo, muro, x, 0.2, (a + b) / 2, 0.05));
        }
      }
      huecos.forEach(function (z) {
        g.add(caja(e, h - 4.2, anchoH, muro, x, 4.4, z, 0.05));             // dintel
        var puerta = caja(0.12, 0.6, anchoH - 0.2, '#b9bcc4', x, 3.75, z); g.add(puerta); // persiana enrollada
        var s = lado === 'oeste' ? -1 : 1;
        g.add(caja(1.4, 0.18, anchoH - 0.4, '#8c8f97', x + s * 0.7, 1.0, z)); // rampa niveladora
        g.add(caja(0.3, 0.5, 0.35, '#2a2a2e', x + s * 0.25, 1.0, z - anchoH / 2 + 0.3));
        g.add(caja(0.3, 0.5, 0.35, '#2a2a2e', x + s * 0.25, 1.0, z + anchoH / 2 - 0.3));
        g.add(caja(1.6, 1.0, anchoH + 1, est.losa || '#ece7de', x + s * 0.8, 0, z)); // andén
        var luz = new T.Mesh(geoCaja(0.3, 0.3, 0.3), brillo(est.acento)); luz.position.set(x + s * 0.2, 4.1, z + anchoH / 2 + 0.3); g.add(luz);
      });
    });
    // columnas
    for (var cx = x0 + 11; cx < x1 - 1; cx += 11) g.add(caja(0.4, h, 0.4, '#e2ddd3', cx, 0.2, z0 + 0.4));
    // pantallas de luz del techo (se encienden de noche)
    var lamp = brillo('#fff6d8');
    for (var lx = x0 + 5; lx < x1; lx += 9) for (var lz = z0 + 5; lz < z1; lz += 8) {
      var l = new T.Mesh(geoCaja(2.4, 0.08, 0.4), lamp); l.position.set(lx, h - 0.3, lz); g.add(l);
    }
    return g;
  };

  P.lineasSuelo = function (o) {
    // Señalización del suelo: líneas amarillas de pasillo y paso de peatones verde.
    var g = new T.Group();
    (o.lineas || []).forEach(function (l) {
      var dx = l[2] - l[0], dz = l[3] - l[1], largo = Math.sqrt(dx * dx + dz * dz);
      var m = plano(l[4] || 0.16, largo, l[5] || '#f2c230', (l[0] + l[2]) / 2, 0.23, (l[1] + l[3]) / 2);
      m.rotation.z = -Math.atan2(dx, dz); g.add(m);
    });
    (o.pasos || []).forEach(function (p) { // pasos de peatones
      for (var i = 0; i < 6; i++) g.add(plano(0.5, p[2] || 2, '#ffffff', p[0] - 1.5 + i * 0.6, 0.235, p[1]));
    });
    return g;
  };

  P.mesaEtiquetado = function () {
    var g = new T.Group();
    g.add(caja(3, 0.08, 1.2, '#e8e2d6', 0, 0.9, 0, 0.03));
    [[-1.4, -0.5], [1.4, -0.5], [-1.4, 0.5], [1.4, 0.5]].forEach(function (p) { g.add(caja(0.08, 0.9, 0.08, '#8c8f97', p[0], 0, p[1])); });
    g.add(caja(0.6, 0.45, 0.5, '#3a3a40', -0.8, 0.98, 0, 0.06));             // impresora de etiquetas
    g.add(caja(0.4, 0.02, 0.3, '#ffffff', -0.8, 1.44, 0.05));
    g.add(caja(0.8, 0.12, 0.8, '#b9bcc4', 0.7, 0.98, 0, 0.04));               // báscula
    g.add(caja(0.25, 0.3, 0.06, '#2f4fa3', 0.7, 1.1, -0.42, 0.02));
    g.add(caja(0.5, 0.35, 0.35, est.cajas ? est.cajas[0] : '#c9a06a', 0.7, 1.1, 0, 0.03));
    return g;
  };

  P.retractiladora = function () {
    var g = new T.Group();
    g.add(cilindro(1.4, 1.4, 0.15, '#8c8f97', 0, 0, 0, 24));
    var giro = new T.Group(); giro.position.y = 0.15; g.add(giro);
    var p = P.palet(true, SL.azar(11)); p.position.set(0, 0, 0); giro.add(p);
    g.add(caja(0.3, 3.0, 0.3, '#3a3a40', 1.9, 0, 0));
    var rollo = cilindro(0.16, 0.16, 0.5, '#e9f2f7', 1.7, 0.5, 0); g.add(rollo);
    animables.push(function (t) { giro.rotation.y = t * 1.2; rollo.position.y = 0.3 + (Math.sin(t * 0.6) + 1) * 0.5; });
    return g;
  };

  P.oficina = function (o) {
    var g = new T.Group(), w = o.ancho, d = o.fondo, h = 3;
    var cristal = new T.MeshStandardMaterial({ color: '#cfe4f2', transparent: true, opacity: 0.32, roughness: 0.1 });
    g.add(caja(w, 0.1, d, '#e6e0d4', 0, 0.2));
    [[0, -d / 2, w, 0.1], [0, d / 2, w, 0.1], [-w / 2, 0, 0.1, d], [w / 2, 0, 0.1, d]].forEach(function (p) {
      var m = new T.Mesh(geoCaja(p[2], h, p[3]), cristal); m.position.set(p[0], 0.3, p[1]); g.add(m);
    });
    [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].forEach(function (p) { g.add(caja(0.12, h, 0.12, '#55555c', p[0], 0.3, p[1])); });
    [[0, -d / 2, w + 0.2, 0.16], [0, d / 2, w + 0.2, 0.16], [-w / 2, 0, 0.16, d], [w / 2, 0, 0.16, d]].forEach(function (p) { g.add(caja(p[2], 0.16, p[3], est.acento, p[0], h + 0.3, p[1])); });
    for (var i = 0; i < 2; i++) {
      var x = -w / 4 + i * w / 2;
      g.add(caja(1.8, 0.06, 0.8, '#ffffff', x, 1.05, 0));
      g.add(caja(0.06, 0.8, 0.06, '#8c8f97', x - 0.8, 0.3, 0)); g.add(caja(0.06, 0.8, 0.06, '#8c8f97', x + 0.8, 0.3, 0));
      var pant = new T.Mesh(geoCaja(0.7, 0.45, 0.05), brillo('#7fb3e8')); pant.position.set(x, 1.15, -0.25); g.add(pant);
    }
    return g;
  };

  P.fabrica = function (o) {
    var g = new T.Group(), w = o.ancho || 26, d = o.fondo || 12, h = 7;
    g.add(caja(w, h, d, est.fabrica || '#efe2cf', 0, 0, 0, 0.2));
    var n = Math.round(w / 4.2);
    for (var i = 0; i < n; i++) { // tejado en diente de sierra
      var x = -w / 2 + (i + 0.5) * (w / n);
      var t = caja(w / n - 0.1, 1.6, d - 0.4, est.tejado || '#d9cbb6', x, h, 0, 0.1); t.rotation.x = 0.0; g.add(t);
      var vid = new T.Mesh(geoCaja(w / n - 0.4, 1.2, 0.08), brillo('#ffe1a3')); vid.position.set(x, h + 0.2, d / 2 - 0.25); g.add(vid);
    }
    for (var v = 0; v < 6; v++) { var win = new T.Mesh(geoCaja(2.2, 1.4, 0.08), brillo('#ffe1a3')); win.position.set(-w / 2 + 2.5 + v * (w - 5) / 5, 3, d / 2 + 0.02); g.add(win); }
    var chimenea = cilindro(0.7, 0.9, 6, '#d7c6ad', w / 2 - 3, h, -2); g.add(chimenea);
    g.add(cilindro(0.75, 0.75, 0.4, est.acento, w / 2 - 3, h + 5.6, -2));
    // vapor
    var humo = [];
    for (var k = 0; k < 8; k++) {
      var s = new T.Mesh(new T.SphereGeometry(0.7, 10, 8), new T.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, roughness: 1 }));
      g.add(s); humo.push(s);
    }
    animables.push(function (t) {
      humo.forEach(function (s, i) {
        var f = ((t * 0.18) + i / humo.length) % 1;
        s.position.set(w / 2 - 3 + Math.sin(f * 4 + i) * 0.6 + f * 2.5, h + 6.2 + f * 6, -2);
        s.scale.setScalar(0.6 + f * 1.8); s.material.opacity = 0.55 * (1 - f);
      });
    });
    if (o.rotulo) {
      var tx = textoTextura(o.rotulo, { color: '#ffffff', fondo: est.acento, tam: 110 });
      var r = new T.Mesh(new T.PlaneGeometry(14, 2.4), new T.MeshStandardMaterial({ map: tx, roughness: 0.8 }));
      r.position.set(-2, 5.4, d / 2 + 0.06); g.add(r);
    }
    g.add(caja(4, 4, 0.1, '#b9bcc4', -w / 2 + 4, 0, d / 2 + 0.03)); // puerta
    return g;
  };

  P.camara = function (o) {
    var g = new T.Group(), w = o.ancho || 8, d = o.fondo || 6;
    g.add(caja(w, 4, d, '#f7f9fb', 0, 0, 0, 0.25));
    g.add(caja(w + 0.1, 0.3, d + 0.1, '#7fb3e8', 0, 4, 0, 0.1));
    g.add(caja(2, 3, 0.12, '#7fb3e8', 0, 0, d / 2 + 0.02, 0.05));
    var cop = textoTextura('❄', { color: '#7fb3e8', fondo: '#f7f9fb', tam: 200, ancho: 256, alto: 256 });
    var s = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), new T.MeshStandardMaterial({ map: cop })); s.position.set(-2.4, 2.4, d / 2 + 0.03); g.add(s);
    return g;
  };

  P.patioAireLibre = function (o) {
    var g = new T.Group(), w = o.ancho || 12, d = o.fondo || 8;
    g.add(plano(w, d, '#e3dccd', 0, 0.02, 0));
    for (var x = -w / 2; x <= w / 2 + 0.01; x += 1.5) { g.add(caja(0.08, 1.2, 0.08, '#8c8f97', x, 0, -d / 2)); g.add(caja(0.08, 1.2, 0.08, '#8c8f97', x, 0, d / 2)); }
    for (var z = -d / 2; z <= d / 2 + 0.01; z += 1.5) { g.add(caja(0.08, 1.2, 0.08, '#8c8f97', -w / 2, 0, z)); g.add(caja(0.08, 1.2, 0.08, '#8c8f97', w / 2, 0, z)); }
    g.add(caja(w, 0.05, 0.03, '#8c8f97', 0, 1.15, -d / 2)); g.add(caja(w, 0.05, 0.03, '#8c8f97', 0, 1.15, d / 2));
    g.add(caja(0.03, 0.05, d, '#8c8f97', -w / 2, 1.15, 0)); g.add(caja(0.03, 0.05, d, '#8c8f97', w / 2, 1.15, 0));
    // pilas de palés vacíos
    var az = SL.azar(21);
    for (var i = 0; i < 6; i++) {
      var n = 4 + Math.floor(az() * 8), px = -w / 2 + 2 + (i % 3) * 3.6, pz = -d / 4 + Math.floor(i / 3) * (d / 2);
      for (var k = 0; k < n; k++) { var p = P.palet(false); p.position.set(px, k * 0.16, pz); g.add(p); }
    }
    return g;
  };

  P.cartel = function (o) {
    var g = new T.Group();
    g.add(caja(0.2, 2.2, 0.2, '#55555c', -2.6, 0)); g.add(caja(0.2, 2.2, 0.2, '#55555c', 2.6, 0));
    var tx = textoTextura(o.texto || '', { color: '#ffffff', fondo: est.acento, tam: 92 });
    var m = new T.Mesh(geoCaja(6, 1.5, 0.2, 0.1), [mat(est.acento), mat(est.acento), mat(est.acento), mat(est.acento), new T.MeshStandardMaterial({ map: tx }), mat(est.acento)]);
    m.position.y = 2.0; m.castShadow = true; g.add(m);
    return g;
  };

  P.palets = function (o) { // montón de palés con carga en el suelo
    var g = new T.Group(), az = SL.azar(o.semilla || 9);
    (o.puntos || [[0, 0]]).forEach(function (p) { var pl = P.palet(o.carga !== false, az); pl.position.set(p[0], 0.22, p[1]); pl.rotation.y = p[2] || 0; g.add(pl); });
    return g;
  };

  // ---------- vehículos con ruta y cesión de paso ----------
  function Vehiculo(def, i) {
    this.id = i; this.def = def;
    var pieza = P[def.tipo === 'retractil' ? 'carretilla' : def.tipo];
    this.obj = pieza(def);
    this.ruta = def.ruta.map(function (p) { return { x: p[0], z: p[1], o: p[2] || {} }; });
    this.i = def.inicio || 0; this.pos = new T.Vector3(this.ruta[this.i].x, 0, this.ruta[this.i].z);
    this.vel = def.vel || 3; this.espera = 0; this.bloqueado = false; this.ang = 0;
    this.radio = def.tipo === 'camion' ? 5.5 : def.tipo === 'coche' ? 3 : 2.2;
    this.obj.position.copy(this.pos);
    if (def.cargaInicial && this.obj.userData.carga) this.obj.userData.carga.visible = true;
    var sig = this.objetivo(); this.ang = Math.atan2(-(sig.x - this.pos.x), -(sig.z - this.pos.z)) || 0;
    this.y0 = def.y || (def.tipo === 'camion' || def.tipo === 'coche' ? 0 : 0.21);
    ficha(this.obj, def.info ? Object.assign({ tipo: 'vehiculo', vehiculo: this }, def.info) : null);
  }
  Vehiculo.prototype.objetivo = function () { return this.ruta[(this.i + 1) % this.ruta.length]; };
  Vehiculo.prototype.mover = function (dt) {
    if (this.espera > 0) { this.espera -= dt; return; }
    var obj = this.objetivo(), dx = obj.x - this.pos.x, dz = obj.z - this.pos.z, dist = Math.sqrt(dx * dx + dz * dz);
    if (obj.o.salto) { this.llegar(obj); return; }
    // ¿alguien delante? se cede el paso (prioridad al de menor id si se bloquean mutuamente)
    var yo = this, dirx = dx / (dist || 1), dirz = dz / (dist || 1);
    this.bloqueado = vehiculos.some(function (v) {
      if (v === yo || v.def.capa !== yo.def.capa) return false;
      var ox = v.pos.x - yo.pos.x, oz = v.pos.z - yo.pos.z, d = Math.sqrt(ox * ox + oz * oz);
      if (d > yo.radio + v.radio * 0.6 || d < 0.01) return false;
      var delante = (ox * dirx + oz * dirz) / d > 0.55;
      if (!delante) return false;
      if (v.bloqueado && v.bloqueadoPor === yo && yo.id < v.id) return false;
      yo.bloqueadoPor = v; return true;
    });
    if (this.bloqueado) return;
    var paso = this.vel * dt;
    if (paso >= dist) { this.pos.set(obj.x, 0, obj.z); this.llegar(obj); }
    else { this.pos.x += dirx * paso; this.pos.z += dirz * paso; }
    var ang = Math.atan2(-dirx, -dirz) + (obj.o.atras ? Math.PI : 0); // las piezas miran a -z
    var dA = ((ang - this.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.ang += dA * Math.min(1, dt * 5);
  };
  Vehiculo.prototype.llegar = function (p) {
    this.i = (this.i + 1) % this.ruta.length;
    if (p.o.salto) this.pos.set(p.x, 0, p.z);
    if (p.o.espera) this.espera = p.o.espera;
    var c = this.obj.userData.carga;
    if (c && p.o.carga != null) c.visible = !!p.o.carga;
  };
  Vehiculo.prototype.pintar = function (t) {
    this.obj.position.set(this.pos.x, this.y0, this.pos.z);
    this.obj.rotation.y = this.ang;
    var h = this.obj.userData.horquillas;
    if (h) { var arriba = this.espera > 0 && this.def.tipo === 'retractil'; h.position.y += ((arriba ? 3.3 : 0.12) - h.position.y) * 0.04; }
  };

  // ---------- construcción ----------
  function construir() {
    est = mundo.estilo || {};
    var suelo = plano(mundo.suelo.ancho, mundo.suelo.fondo, est.suelo || '#efe9df', 0, 0, 0);
    escena.add(suelo);
    (mundo.cesped || []).forEach(function (c) { escena.add(plano(c[2] - c[0], c[3] - c[1], est.cesped || '#cfe0c4', (c[0] + c[2]) / 2, 0.015, (c[1] + c[3]) / 2)); });
    (mundo.carreteras || []).forEach(function (c) {
      var dx = c[2] - c[0], dz = c[3] - c[1], largo = Math.sqrt(dx * dx + dz * dz), ancho = c[4] || 8;
      var m = plano(ancho, largo, est.asfalto || '#d6d3cd', (c[0] + c[2]) / 2, 0.02, (c[1] + c[3]) / 2); m.rotation.z = -Math.atan2(dx, dz); escena.add(m);
      if (c[5] !== false) for (var s = 2; s < largo - 2; s += 5) {
        var r = plano(0.18, 2.2, '#ffffff', c[0] + dx * s / largo, 0.03, c[1] + dz * s / largo); r.rotation.z = m.rotation.z; escena.add(r);
      }
    });
    var azArb = SL.azar(99);
    (mundo.objetos || []).forEach(function (o) {
      var g = o.tipo === 'arbol' ? P.arbol(o, azArb) : P[o.tipo](o);
      g.position.set(o.x || 0, o.y || 0, o.z || 0);
      g.rotation.y = o.giro || 0;
      escena.add(g);
      if (o.info) ficha(g, Object.assign({ tipo: 'objeto' }, o.info));
    });
    // zonas tocables (planos de color sobre el suelo)
    (mundo.zonas || []).forEach(function (z) {
      var reg = zonas[z.id] = { def: z, mallas: [], cx: 0, cz: 0, tam: 0 };
      var minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
      z.rects.forEach(function (r) {
        var w = r[2] - r[0], d = r[3] - r[1];
        var m = plano(w, d, z.color || est.acento, (r[0] + r[2]) / 2, z.y || 0.24, (r[1] + r[3]) / 2, 0.0);
        m.userData.zona = z.id; m.renderOrder = 2; escena.add(m); reg.mallas.push(m);
        var borde = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(w, d)), new T.LineBasicMaterial({ color: z.color || est.acento, transparent: true, opacity: 0 }));
        borde.rotation.x = -Math.PI / 2; borde.position.copy(m.position); borde.position.y += 0.01; escena.add(borde); m.userData.borde = borde;
        minx = Math.min(minx, r[0]); maxx = Math.max(maxx, r[2]); minz = Math.min(minz, r[1]); maxz = Math.max(maxz, r[3]);
      });
      var r0 = z.rects[0];
      reg.cx = (r0[0] + r0[2]) / 2; reg.cz = (r0[1] + r0[3]) / 2;
      reg.tam = Math.max(r0[2] - r0[0], r0[3] - r0[1]);
      reg.etiqueta = M.anclar(SL.el('div', 'sl-etq sl-etq--zona', z.nombre), reg.cx, 0.6, reg.cz, 'zona');
    });
    (mundo.vehiculos || []).forEach(function (v, i) { var veh = new Vehiculo(v, i); vehiculos.push(veh); escena.add(veh.obj); });
    // anillo de selección
    anillo = new T.Mesh(new T.RingGeometry(1.6, 2.0, 40), new T.MeshBasicMaterial({ color: est.acento, transparent: true, opacity: 0.9, side: T.DoubleSide, depthTest: false }));
    anillo.rotation.x = -Math.PI / 2; anillo.visible = false; anillo.renderOrder = 5; escena.add(anillo);
  }

  // ---------- cámara de maqueta ----------
  function aplicarCamara() {
    var c = camEstado;
    camara.position.set(c.x + c.dist * Math.sin(c.az) * Math.cos(c.el), c.dist * Math.sin(c.el), c.z + c.dist * Math.cos(c.az) * Math.cos(c.el));
    camara.lookAt(c.x, 0, c.z);
  }
  function suave(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  M.volarA = function (dest, dur, alTerminar) {
    siguiendo = null;
    var desde = Object.assign({}, camEstado), a = Object.assign({}, camEstado, dest);
    var dAz = ((a.az - desde.az + Math.PI * 3) % (Math.PI * 2)) - Math.PI; a.az = desde.az + dAz;
    vuelo = { desde: desde, a: a, t: 0, dur: SL.sinMovimiento ? 0.01 : (dur == null ? 1.4 : dur), fin: alTerminar };
  };
  M.camara = function () { return Object.assign({}, camEstado); };
  M.vistaZona = function (id, extra) {
    var z = zonas[id]; if (!z) return null;
    return Object.assign({ x: z.cx, z: z.cz + 1, dist: Math.max(30, z.tam * 2.4), el: 0.78 }, extra || {});
  };
  M.inicio = function (dur) { M.volarA(mundo.camaraInicial, dur); };

  function controles() {
    var el = render.domElement, arr = null, movido = 0;
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('pointerdown', function (e) {
      arr = { x: e.clientX, y: e.clientY, girar: e.button === 2 || e.shiftKey, id: e.pointerId };
      movido = 0; el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      actualizarPuntero(e);
      if (!arr) return;
      var dx = e.clientX - arr.x, dy = e.clientY - arr.y; arr.x = e.clientX; arr.y = e.clientY;
      movido += Math.abs(dx) + Math.abs(dy);
      if (movido < 4) return;
      vuelo = null; siguiendo = null;
      if (arr.girar) {
        camEstado.az -= dx * 0.006;
        camEstado.el = Math.min(1.35, Math.max(0.3, camEstado.el + dy * 0.004));
      } else {
        var k = camEstado.dist * 0.0016, s = Math.sin(camEstado.az), c = Math.cos(camEstado.az);
        camEstado.x -= (dx * c + dy * s) * k;
        camEstado.z -= (-dx * s + dy * c) * k;
        var lim = mundo.limite || 60;
        camEstado.x = Math.max(-lim, Math.min(lim, camEstado.x)); camEstado.z = Math.max(-lim, Math.min(lim, camEstado.z));
      }
    });
    el.addEventListener('pointerup', function (e) {
      if (arr && movido < 6) tocar(e);
      arr = null;
    });
    el.addEventListener('wheel', function (e) {
      e.preventDefault(); vuelo = null;
      camEstado.dist = Math.min(150, Math.max(14, camEstado.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    }, { passive: false });
  }
  M.zoom = function (f) { M.volarA({ dist: Math.min(150, Math.max(14, camEstado.dist * f)) }, 0.4); };

  function actualizarPuntero(e) {
    var r = render.domElement.getBoundingClientRect();
    puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (cbTocarZona) {
      raycaster.setFromCamera(puntero, camara);
      var hit = raycaster.intersectObjects(todasZonas())[0];
      hover(hit ? hit.object.userData.zona : null);
    }
  }
  var zonaHover = null;
  function hover(id) {
    if (id === zonaHover) return;
    zonaHover = id; render.domElement.style.cursor = id ? 'pointer' : '';
    Object.keys(zonas).forEach(function (k) { pintarZona(k); });
  }
  function todasZonas() {
    var l = [];
    Object.keys(zonas).forEach(function (k) { if (!zonas[k].def.noTocable) l = l.concat(zonas[k].mallas); });
    return l;
  }
  function tocar(e) {
    actualizarPuntero(e);
    raycaster.setFromCamera(puntero, camara);
    if (cbTocarZona) {
      var hz = raycaster.intersectObjects(todasZonas())[0];
      if (hz) cbTocarZona(hz.object.userData.zona);
      return;
    }
    var hit = raycaster.intersectObjects(tocables, false)[0];
    if (hit) M.seleccionar(hit.object.userData.raiz, hit.object.userData.ficha);
    else M.seleccionar(null);
  }

  M.seleccionar = function (obj, f) {
    seleccion = obj ? { obj: obj, ficha: f } : null;
    anillo.visible = !!obj;
    if (obj) {
      var p = new T.Vector3(); obj.getWorldPosition(p);
      var veh = f.tipo === 'vehiculo';
      M.volarA({ x: p.x, z: p.z, dist: veh ? 26 : Math.max(camEstado.dist * 0.6, 24) }, 1.1, function () { if (veh) siguiendo = obj; });
      var esc = f.anillo || (veh ? (f.vehiculo.def.tipo === 'camion' ? 3 : 1.3) : 2);
      anillo.scale.setScalar(esc);
    }
    if (cbSeleccion) cbSeleccion(f || null);
  };

  // ---------- zonas: resaltado ----------
  var modos = {}; // id -> 'suave' | 'pista' | 'bien' | 'mal' | 'ver'
  function pintarZona(id) {
    var z = zonas[id], m = modos[id], hov = zonaHover === id;
    var op = 0, ob = 0, col = z.def.color || est.acento;
    if (cbTocarZona) { op = hov ? 0.38 : 0.12; ob = hov ? 1 : 0.55; }
    if (m === 'ver') { op = 0.45; ob = 1; }
    if (m === 'pista') { op = 0.5; ob = 1; }
    if (m === 'bien') { op = 0.55; ob = 1; col = '#4f9a63'; }
    if (m === 'mal') { op = 0.5; ob = 1; col = '#d63e2a'; }
    z.mallas.forEach(function (ms) {
      ms.material.opacity = op; ms.material.color.set(col);
      ms.userData.borde.material.opacity = ob; ms.userData.borde.material.color.set(col);
    });
  }
  M.resaltarZona = function (id, modo, ms) {
    if (!zonas[id]) return;
    modos[id] = modo; pintarZona(id);
    if (ms) setTimeout(function () { if (modos[id] === modo) { modos[id] = null; pintarZona(id); } }, ms);
  };
  M.limpiarZonas = function () { modos = {}; Object.keys(zonas).forEach(pintarZona); };
  M.modoTocarZonas = function (cb) {
    cbTocarZona = cb; zonaHover = null; render.domElement.style.cursor = '';
    if (anillo) anillo.visible = false;
    Object.keys(zonas).forEach(pintarZona);
  };
  M.tocarZona = function (id) { if (cbTocarZona) cbTocarZona(id); }; // equivale a tocarla con el ratón
  M.alSeleccionar = function (cb) { cbSeleccion = cb; };
  M.nombreZona = function (id) { return zonas[id] ? zonas[id].def.nombre : id; };

  // ---------- etiquetas HTML ancladas ----------
  var capaAnclas;
  M.anclar = function (el, x, y, z, grupo) {
    el.classList.add('sl-ancla'); capaAnclas.appendChild(el);
    var a = { el: el, pos: new T.Vector3(x, y, z), grupo: grupo || 'libre' };
    anclas.push(a); return a;
  };
  var gruposVisibles = { zona: false, libre: true, unidad: true };
  M.verGrupo = function (g, v) { gruposVisibles[g] = v; };
  function proyectar() {
    var w = contenedor.clientWidth, h = contenedor.clientHeight, v = new T.Vector3();
    anclas.forEach(function (a) {
      v.copy(a.pos).project(camara);
      var vis = gruposVisibles[a.grupo] && v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
      a.el.style.display = vis ? '' : 'none';
      if (vis) a.el.style.transform = 'translate(-50%,-100%) translate(' + ((v.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - v.y) / 2 * h).toFixed(1) + 'px)';
    });
  }

  // ---------- día / noche ----------
  M.noche = function (si) { esNoche = si == null ? !esNoche : !!si; return esNoche; };
  var cDia, cNoche, cSolDia, cSolNoche, cTmp = null;
  function luz(dt) {
    var objetivo = esNoche ? 1 : 0;
    mezclaNoche += (objetivo - mezclaNoche) * Math.min(1, dt * (SL.sinMovimiento ? 50 : 1.8));
    var k = mezclaNoche;
    cTmp.copy(cDia).lerp(cNoche, k);
    escena.background.copy(cTmp); escena.fog.color.copy(cTmp);
    luzCielo.intensity = 0.62 - 0.46 * k;
    luzSol.intensity = 1.0 - 0.8 * k;
    luzSol.color.copy(cSolDia).lerp(cSolNoche, k);
    emisivos.forEach(function (m) { m.emissiveIntensity = k * 1.6; });
  }

  // ---------- arranque ----------
  M.iniciar = function (cont) {
    mundo = SL.mundo; contenedor = cont;
    if (T.ColorManagement && 'legacyMode' in T.ColorManagement) T.ColorManagement.legacyMode = false; // colores hex en sRGB
    render = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    render.shadowMap.enabled = true; render.shadowMap.type = T.PCFSoftShadowMap;
    if ('outputColorSpace' in render) render.outputColorSpace = 'srgb'; else render.outputEncoding = T.sRGBEncoding;
    cont.appendChild(render.domElement);
    capaAnclas = SL.el('div', 'sl-anclas'); cont.appendChild(capaAnclas);

    escena = new T.Scene();
    var e = mundo.estilo || {};
    cDia = new T.Color(e.cielo || '#f3efe8'); cNoche = new T.Color(e.cieloNoche || '#1d2438');
    cSolDia = new T.Color('#fff4e2'); cSolNoche = new T.Color('#8fa4d8'); cTmp = new T.Color();
    escena.background = cDia.clone();
    escena.fog = new T.Fog(cDia.clone(), 120, 260);
    camara = new T.PerspectiveCamera(30, 1, 1, 600);
    luzCielo = new T.HemisphereLight('#ffffff', '#d9cfbf', 0.95); escena.add(luzCielo);
    luzSol = new T.DirectionalLight('#fff4e2', 1.25);
    luzSol.position.set(-40, 70, 35); luzSol.castShadow = true;
    luzSol.shadow.mapSize.set(2048, 2048);
    var sc = luzSol.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 60; sc.bottom = -60; sc.far = 220;
    luzSol.shadow.bias = -0.0006; luzSol.shadow.normalBias = 0.04;
    escena.add(luzSol);
    raycaster = new T.Raycaster(); puntero = new T.Vector2();

    construir();
    Object.assign(camEstado, mundo.camaraInicial);
    controles();
    var ajustar = function () {
      var w = cont.clientWidth, h = cont.clientHeight; if (!w || !h) return;
      render.setSize(w, h, false); camara.aspect = w / h;
      // El centro de la vista queda en la parte libre (a la izquierda del panel de la guía)
      var px = Math.min(w * 0.4, M.margenDerecho ? M.margenDerecho() : 0);
      if (px > 0) camara.setViewOffset(w + px, h, px, 0, w, h); else camara.clearViewOffset();
      camara.updateProjectionMatrix();
    };
    if (window.ResizeObserver) new ResizeObserver(ajustar).observe(cont); else window.addEventListener('resize', ajustar);
    ajustar();

    reloj = new T.Clock();
    var t = 0;
    (function bucle() {
      requestAnimationFrame(bucle);
      var dt = Math.min(0.05, reloj.getDelta()); t += dt;
      if (vuelo) {
        vuelo.t += dt / vuelo.dur; var k = suave(Math.min(1, vuelo.t));
        ['x', 'z', 'dist', 'az', 'el'].forEach(function (p) { camEstado[p] = vuelo.desde[p] + (vuelo.a[p] - vuelo.desde[p]) * k; });
        if (vuelo.t >= 1) { var f = vuelo.fin; vuelo = null; if (f) f(); }
      } else if (siguiendo) {
        camEstado.x += (siguiendo.position.x - camEstado.x) * Math.min(1, dt * 3);
        camEstado.z += (siguiendo.position.z - camEstado.z) * Math.min(1, dt * 3);
      }
      vehiculos.forEach(function (v) { v.mover(dt); });
      vehiculos.forEach(function (v) { v.pintar(t); });
      animables.forEach(function (fn) { fn(t, dt); });
      if (seleccion && anillo.visible) {
        seleccion.obj.getWorldPosition(anillo.position); anillo.position.y = 0.3;
        anillo.material.opacity = 0.55 + Math.sin(t * 4) * 0.35;
      }
      luz(dt);
      aplicarCamara();
      render.render(escena, camara);
      proyectar();
    })();
  };
})();
