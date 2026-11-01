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
  var cielo = null, meta = null;
  var escena, camara, render, contenedor, reloj, luzSol, luzCielo, raycaster, puntero;
  var mundo, est;
  var zonas = {};          // id -> { def, mallas:[], centro, tam }
  var tocables = [], elementos = [], camAntes = null;       // mallas con userData.ficha
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
  // Lámina con textura pegada a un marco (las cajas redondeadas no admiten una textura por cara).
  function cara(tx, w, h, x, y, z) {
    var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: tx, roughness: 0.7 }));
    m.position.set(x, y, z); return m;
  }
  function textoTextura(texto, opc) {
    opc = opc || {};
    var c = document.createElement('canvas'); c.width = opc.ancho || 1024; c.height = opc.alto || 256;
    var x = c.getContext('2d');
    x.fillStyle = opc.fondo || '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = opc.color || '#1c1c1f';
    var tam = opc.tam || 120, hueco = c.width * (opc.logo ? 0.62 : 0.88);
    var fuente = function () { x.font = (opc.peso || 800) + ' ' + tam + 'px "Bricolage Grotesque Variable", system-ui, sans-serif'; };
    fuente();
    while (tam > 24 && x.measureText(texto).width > hueco) { tam -= 4; fuente(); }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(texto, c.width / 2, c.height / 2 + 6);
    var t = new T.CanvasTexture(c); t.anisotropy = 4;
    if ('colorSpace' in t) t.colorSpace = 'srgb'; else t.encoding = T.sRGBEncoding;
    if (opc.logo) { // logo a la izquierda y el texto a su lado
      var im = new Image();
      im.onload = function () {
        var hL = c.height * 0.86, wL = hL * im.naturalWidth / im.naturalHeight, tw = x.measureText(texto).width, gap = c.height * 0.12;
        var x0 = (c.width - (wL + gap + tw)) / 2;
        x.fillStyle = opc.fondo || '#ffffff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, x0, (c.height - hL) / 2, wL, hL);
        x.fillStyle = opc.color || '#1c1c1f'; x.textAlign = 'left';
        x.fillText(texto, x0 + wL + gap, c.height / 2 + 6);
        t.needsUpdate = true;
      };
      im.src = SL.recurso(opc.logo);
    }
    return t;
  }
  // Textura suave de hierba seca y tierra (manchas y matas), en gris para teñirla con el color del material.
  var texHierba = {};
  function texturaHierba(rep) {
    if (texHierba[rep]) return texHierba[rep];
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d'), az = SL.azar(13);
    x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 70; i++) { x.fillStyle = 'rgba(' + (az() < 0.5 ? '255,255,255' : '150,150,150') + ',' + (0.12 + az() * 0.15) + ')'; x.beginPath(); x.ellipse(az() * 256, az() * 256, 10 + az() * 30, 6 + az() * 18, az() * 3, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(120,120,120,.35)'; x.lineWidth = 1.2;
    for (var k = 0; k < 500; k++) { var px = az() * 256, py = az() * 256; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (az() - 0.5) * 4, py - 3 - az() * 4); x.stroke(); }
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4;
    if ('colorSpace' in t) t.colorSpace = 'srgb'; else t.encoding = T.sRGBEncoding;
    return (texHierba[rep] = t);
  }
  // Copa low-poly facetada (se notan las caras, como una maqueta)
  function copa(r, color, x, y, z, semilla) {
    var g = new T.IcosahedronGeometry(r, 1), p = g.attributes.position, az = SL.azar(semilla || 3), v = new T.Vector3(), mapa = {};
    for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); var k = v.x.toFixed(2) + v.y.toFixed(2) + v.z.toFixed(2); var f = mapa[k] || (mapa[k] = 0.85 + az() * 0.3); v.multiplyScalar(f); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    var m = new T.Mesh(g, mat(color, { flatShading: true })); m.position.set(x, y, z); m.castShadow = true; return m;
  }
  function brillo(color) {
    var m = new T.MeshStandardMaterial({ color: color, emissive: new T.Color(color), emissiveIntensity: 0, roughness: 0.5 });
    emisivos.push(m); return m;
  }
  function ficha(obj, f) {
    if (!f) return;
    obj.traverse(function (o) { if (o.isMesh) { o.userData.ficha = f; o.userData.raiz = obj; tocables.push(o); } });
    elementos.push({ obj: obj, ficha: f });
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
      var film = new T.Mesh(geoCaja(1.24, filas * 0.37 + 0.05, 0.88, 0.05), new T.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, roughness: 0.2, depthWrite: false }));
      film.position.y = 0.13; g.add(film);
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
          var p = P.palet(true, azar); p.userData.esPalet = true;
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
    if (o.cisterna) { // cisterna de leche: cilindro plateado con aros de color
      var cis = new T.Mesh(new T.CylinderGeometry(1.25, 1.25, 7.2, 20), mat('#d9dde2', { metalness: 0.35, roughness: 0.35 }));
      cis.rotation.x = Math.PI / 2; cis.position.set(0, 2.2, 1.4); cis.castShadow = true; g.add(cis);
      [-1.6, 1.4, 4.4].forEach(function (z) { var a = new T.Mesh(new T.CylinderGeometry(1.29, 1.29, 0.25, 20), mat(o.cabina || est.acento)); a.rotation.x = Math.PI / 2; a.position.set(0, 2.2, z); g.add(a); });
      g.add(caja(0.6, 0.25, 0.6, '#b9bec5', 0, 3.4, 1.4));
    } else
    g.add(caja(2.4, 2.6, 7.6, color, 0, 0.9, 1.4, 0.12));                  // remolque
    g.add(caja(2.3, 0.35, 7.4, '#3a3a40', 0, 0.55, 1.4));                    // chasis
    g.add(caja(2.4, 2.2, 2.2, o.cabina || est.acento, 0, 0.7, -3.6, 0.35)); // cabina (mira a -z)
    g.add(caja(2.0, 0.8, 0.05, '#bcd7ea', 0, 1.9, -4.72, 0, { roughness: 0.15 })); // parabrisas
    [-3.6, 0.2, 1.4, 3.8].forEach(function (z) {
      [-1.05, 1.05].forEach(function (x) {
        var r = cilindro(0.48, 0.48, 0.38, '#26262b', x, 0.48, z, 14); r.rotation.z = Math.PI / 2; r.position.y = 0.48; g.add(r);
      });
    });
    if (o.rotulo && !o.cisterna) {
      var t = textoTextura(o.rotulo, { color: '#ffffff', fondo: o.cabinaRotulo || est.acento, tam: 120, ancho: 1280, alto: 240 });
      [-1.21, 1.21].forEach(function (x) {
        var r = new T.Mesh(new T.PlaneGeometry(6.4, 1.2), new T.MeshStandardMaterial({ map: t, roughness: 0.8 }));
        r.position.set(x, 2.3, 1.4); r.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2; g.add(r);
      });
    }
    var cond = P.persona({ sentado: true, semilla: o.semilla || 2, chaleco: true }); cond.position.set(0.5, 1.45, -3.75); g.add(cond);
    var faro = new T.Mesh(geoCaja(0.4, 0.2, 0.06), brillo('#fff3c4')); // faros
    [-0.8, 0.8].forEach(function (x) { var f = faro.clone(); f.position.set(x, 1.0, -4.72); g.add(f); });
    // carga visible cuando el camión va lleno
    var carga = new T.Group();
    for (var i = 0; i < 4; i++) { var p = P.palet(true, SL.azar(30 + i)); p.rotation.y = Math.PI / 2; p.position.set(0, 1.25, -0.9 + i * 1.5); carga.add(p); }
    carga.visible = false; g.add(carga); g.userData.carga = carga;
    if (o.ruta) { // camión que circula: cabeza y remolque articulados en la quinta rueda (z = -2.2)
      var PIV = -2.2, cab = new T.Group(), rem = new T.Group();
      g.children.slice().forEach(function (ch) {
        var delante = ch.position.z < -2.45 || ch === cond;
        (delante ? cab : rem).add(ch); ch.position.z -= PIV;
      });
      cab.position.z = rem.position.z = PIV; g.add(cab); g.add(rem);
      g.userData.cabeza = cab; g.userData.remolque = rem;
    }
    return g;
  };
  function difAng(a, b) { return ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI; }

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
    var cond = P.persona({ sentado: true, casco: true, chaleco: true, semilla: (o.semilla || 1) + 3 }); cond.position.set(0, 1.35, 0.35); g.add(cond);
    var p = P.palet(true, SL.azar(o.semilla || 3)); p.position.set(0, 0.0, -1.45); p.rotation.y = Math.PI / 2;
    p.visible = false; horq.add(p); g.userData.carga = p; g.userData.horquillas = horq;
    return g;
  };

  P.transpaleta = function (o) {
    var g = new T.Group(), c = o.color || '#ef8a3c';
    g.add(caja(0.8, 1.0, 0.6, c, 0, 0.12, 0.35, 0.12));
    var lanza = caja(0.06, 0.75, 0.06, '#3a3a40', 0, 0, 0); lanza.position.set(0, 0.55, 0.6); lanza.rotation.x = 0.5; g.add(lanza); // timón inclinado hacia el operario
    g.add(caja(0.42, 0.06, 0.08, '#3a3a40', 0, 1.18, 0.95));                  // mango, a la altura de las manos
    [-0.25, 0.25].forEach(function (x) { g.add(caja(0.18, 0.08, 1.15, '#55555c', x, 0.06, -0.55)); });
    var p = P.palet(true, SL.azar(o.semilla || 5)); p.position.set(0, 0.02, -0.55); p.rotation.y = Math.PI / 2;
    p.visible = false; g.add(p); g.userData.carga = p;
    var op = P.persona({ chaleco: true, semilla: (o.semilla || 4) + 7 }); op.position.set(0, 0, 1.45); g.add(op); g.userData.operario = op;
    return g;
  };

  // Personas: las mismas de Cubic Lab (core/persona.js), con ropa de seguridad. Aquí miran a -z como las demás piezas.
  P.persona = function (o) {
    var w = new T.Group(), p = SL.Persona.crear(o.semilla || 1, { seguridad: o.chaleco !== false, casco: o.casco });
    p.rotation.y = Math.PI; w.add(p);
    var u = p.userData;
    if (o.sentado) {
      u.piernas.forEach(function (l) { l.rotation.x = -1.45; });
      u.brazos.forEach(function (b) { b.rotation.x = -0.9; });
      u.cuerpo.position.y = -0.6;
    }
    w.userData = u;
    return w;
  };
  function esferaGeo(rr) { var kk = 's' + rr; return geos[kk] || (geos[kk] = new T.SphereGeometry(rr, 14, 10)); }
  function caminar(g, fase, parado) {
    if (!g.userData.piernas) return;
    if (parado) { g.userData.piernas.forEach(function (l) { l.rotation.x = 0; }); g.userData.brazos[0].rotation.x = g.userData.brazos[1].rotation.x = 0; g.userData.cuerpo.position.y = 0; return; }
    SL.Persona.caminar(g, fase);
  }

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
    var g = new T.Group(), olivo = o.especie ? o.especie === 'olivo' : azar() < 0.55;
    if (olivo) { // tronco retorcido que se abre en dos y copa de muchas matitas gris verdoso
      var tr = cilindro(0.2, 0.32, 1.1, '#7d6650'); tr.rotation.z = 0.12; g.add(tr);
      [[-0.45, 0.5], [0.45, -0.4]].forEach(function (r) { var b = cilindro(0.1, 0.16, 1.0, '#7d6650', r[0] * 0.4, 0.95, 0); b.rotation.z = r[1]; g.add(b); });
      for (var q = 0; q < 9; q++) {
        var an = q / 9 * Math.PI * 2 + azar(), rr = q === 0 ? 0 : 0.6 + azar() * 0.5;
        var s = copa(0.42 + azar() * 0.2, azar() < 0.5 ? '#9aa68e' : '#8a9a80', Math.cos(an) * rr, 1.9 + azar() * 0.5, Math.sin(an) * rr, Math.floor(azar() * 999));
        s.scale.y = 0.8; g.add(s);
      }
    } else {
      var h = 1.6 + azar() * 0.8;
      g.add(cilindro(0.2, 0.28, h, '#6e5643'));
      var c = copa(1.7 + azar() * 0.5, est.arbol2 || '#5e7a4c', 0, h + 1.1, 0, Math.floor(azar() * 999)); c.scale.y = 0.8; g.add(c);
      g.add(copa(0.9, est.arbol2 || '#5e7a4c', 0.9, h + 1.6, 0.3, Math.floor(azar() * 999)));
    }
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
    // norte, con huecos de paso (o.puertasNorte: [{ x, ancho }])
    var pn = (o.puertasNorte || []).slice().sort(function (a, b) { return a.x - b.x; }), xa = x0 - e / 2;
    pn.forEach(function (p) {
      var a = p.x - p.ancho / 2, b = p.x + p.ancho / 2;
      if (a - xa > 0.05) g.add(caja(a - xa, h, e, muro, (xa + a) / 2, 0.2, z0, 0.05));
      g.add(caja(p.ancho, h - 2.6, e, muro, p.x, 2.8, z0, 0.05));                // dintel
      g.add(caja(p.ancho + 0.3, 0.18, e + 0.06, est.acento, p.x, 2.62, z0));     // marco
      [-1, 1].forEach(function (k) { g.add(caja(0.15, 2.45, e + 0.06, est.acento, p.x + k * (p.ancho / 2 + 0.07), 0.2, z0)); });
      xa = b;
    });
    g.add(caja(x1 + e / 2 - xa, h, e, muro, (xa + x1 + e / 2) / 2, 0.2, z0, 0.05));
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
        var s = lado === 'oeste' ? -1 : 1, xo = x + s * e / 2;
        g.add(caja(e, h - 3.8, anchoH, muro, x, 4.0, z, 0.05));             // dintel
        g.add(caja(0.14, 1.4, anchoH - 0.3, est.acento, x + s * 0.05, 2.6, z)); // puerta seccional medio abierta
        // abrigo de muelle: marco acolchado oscuro que abraza la trasera del camión
        g.add(caja(0.7, 4.0, 0.4, '#4a4a52', xo + s * 0.35, 0, z - anchoH / 2 - 0.1, 0.08));
        g.add(caja(0.7, 4.0, 0.4, '#4a4a52', xo + s * 0.35, 0, z + anchoH / 2 + 0.1, 0.08));
        g.add(caja(0.7, 0.5, anchoH + 0.6, '#4a4a52', xo + s * 0.35, 3.8, z, 0.08));
        g.add(caja(0.5, 0.06, anchoH - 0.4, '#9a9da4', xo + s * 0.25, 0.2, z));  // niveladora
        [-1, 1].forEach(function (k) { g.add(caja(0.25, 0.4, 0.3, '#1f1f23', xo + s * 0.12, 0.25, z + k * (anchoH / 2 - 0.5))); }); // topes
        // semáforo: verde = puede acercarse
        g.add(caja(0.3, 0.7, 0.2, '#2a2a2e', xo + s * 0.1, 3.0, z + anchoH / 2 + 0.8));
        var verde = new T.Mesh(esferaGeo(0.1), brillo('#3fbf6a')); verde.position.set(xo + s * 0.22, 3.2, z + anchoH / 2 + 0.8); g.add(verde);
        var rojo = new T.Mesh(esferaGeo(0.1), mat('#7a2a2a')); rojo.position.set(xo + s * 0.22, 2.9, z + anchoH / 2 + 0.8); g.add(rojo);
        // guías amarillas en el suelo para entrar marcha atrás
        [-1, 1].forEach(function (k) { var gl = plano(12, 0.18, '#f2c230', xo + s * 6.5, 0.04, z + k * 1.7); g.add(gl); });
      });
    });
    // columnas
    for (var cx = x0 + 11; cx < x1 - 1; cx += 11) g.add(caja(0.4, h, 0.4, '#e2ddd3', cx, 0.2, z0 + 0.4));
    return g;
  };

  P.lineasSuelo = function (o) {
    // Señalización del suelo: líneas amarillas de pasillo y paso de peatones verde.
    var g = new T.Group();
    (o.lineas || []).forEach(function (l) {
      var dx = l[2] - l[0], dz = l[3] - l[1], largo = Math.sqrt(dx * dx + dz * dz);
      var m = plano(l[4] || 0.16, largo, l[5] || '#f2c230', (l[0] + l[2]) / 2, o.y != null ? o.y : (l[4] > 0.5 ? 0.225 : 0.23), (l[1] + l[3]) / 2);
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
    // Enfardadora: el palé gira y el carro sube y baja dejando el film; se ve cómo crece la envoltura.
    var g = new T.Group();
    g.add(cilindro(1.4, 1.4, 0.15, '#8c8f97', 0, 0, 0, 24));
    var giro = new T.Group(); giro.position.y = 0.15; g.add(giro);
    var p = P.palet(true, SL.azar(11)); giro.add(p);
    var altoCarga = p.children[p.children.length - 1].geometry.parameters ? 1.2 : 1.2;
    var filmMat = new T.MeshStandardMaterial({ color: '#dff0fb', transparent: true, opacity: 0.55, roughness: 0.15, depthWrite: false });
    var film = new T.Mesh(geoCaja(1.26, 1, 0.9, 0.05), filmMat); film.position.y = 0.13; giro.add(film);
    g.add(caja(0.3, 3.0, 0.3, '#3a3a40', 1.9, 0, 0));                         // columna
    var carro = new T.Group(); g.add(carro);
    carro.add(caja(0.5, 0.6, 0.4, est.acento, 1.75, 0, 0, 0.06));
    var rollo = cilindro(0.15, 0.15, 0.55, '#e9f2f7', 1.45, 0.02, 0); carro.add(rollo);
    var hilo = new T.Mesh(new T.PlaneGeometry(1, 0.5), filmMat); hilo.position.set(1.0, 0.3, 0); hilo.rotation.y = Math.PI / 2; carro.add(hilo);
    animables.push(function (t) {
      var ciclo = 12, k = (t % ciclo) / ciclo;                                 // 0-1: envolver; al final se reinicia
      giro.rotation.y = t * 2.2;
      var subir = k < 0.5 ? k * 2 : 2 - k * 2;                                 // sube y baja
      carro.position.y = 0.2 + subir * (altoCarga - 0.3);
      var hecho = Math.min(1, k * 1.3);
      film.scale.y = Math.max(0.02, Math.min(1, (k < 0.5 ? subir : 1)) * altoCarga);
      filmMat.opacity = 0.25 + hecho * 0.45;
      hilo.visible = k < 0.92; film.visible = k < 0.97;
    });
    return g;
  };

  // Trabajador quieto haciendo una tarea: etiquetar, revisar (con lector) o preparar pedidos.
  P.trabajador = function (o) {
    var g = P.persona({ chaleco: true, casco: o.casco, semilla: o.semilla || 50 }), u = g.userData, acc = o.accion || 'revisar';
    var mano = u.brazos[0], fase = (o.semilla || 1) * 1.7;
    if (acc === 'revisar') { // lector de códigos en la mano
      mano.add(caja(0.07, 0.14, 0.11, '#2a2a2e', 0, -0.52, 0.04)); var luz = new T.Mesh(geoCaja(0.04, 0.02, 0.04), brillo('#ff4040')); luz.position.set(0, -0.56, 0.1); mano.add(luz);
    }
    var cajaMano = null;
    if (acc === 'preparar') { cajaMano = caja(0.36, 0.26, 0.28, est.cajas ? est.cajas[0] : '#c9a06a', 0, 0.66, 0.36, 0.03); u.cuerpo.add(cajaMano); }
    // Movimientos LENTOS y con pausas: trabajan con las manos, sin girar la cintura.
    var cuerpoP = g.children[0];
    function suave(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    function tramo(k, a1, b1) { return suave((k - a1) / (b1 - a1)); }
    animables.push(function (t) {
      if (acc === 'etiquetar') { // coge la caja, la pesa y pega la etiqueta (ciclo de 7 s)
        var k = ((t + fase) % 7) / 7;
        var alcanza = tramo(k, 0.05, 0.25) - tramo(k, 0.55, 0.75);          // brazo derecho a la impresora y vuelta
        var pega = k > 0.75 && k < 0.95 ? Math.sin((k - 0.75) / 0.2 * Math.PI) : 0;
        u.brazos[0].rotation.x = -0.95 - alcanza * 0.25 - pega * 0.15;
        u.brazos[0].rotation.z = -0.26 + alcanza * 0.2;
        u.brazos[1].rotation.x = -0.9;
        u.cuerpo.rotation.x = 0.1 + pega * 0.04;
      } else if (acc === 'revisar') { // mira el albarán y pasa el lector por las cajas (ciclo de 9 s)
        var k2 = ((t + fase) % 9) / 9;
        var mira = tramo(k2, 0.1, 0.3) - tramo(k2, 0.6, 0.8);
        u.brazos[0].rotation.x = -0.5 - mira * 0.7;
        u.brazos[1].rotation.x = -0.6;
        cuerpoP.rotation.y = Math.PI + (tramo(k2, 0.3, 0.45) - tramo(k2, 0.85, 1)) * 0.5;
        u.cuerpo.rotation.x = 0.06;
      } else { // coge una caja a un lado y la deja en el palé del otro (ciclo de 10 s)
        var k3 = ((t + fase) % 10) / 10;
        var gira = tramo(k3, 0.25, 0.45) - tramo(k3, 0.8, 0.98);            // de la estantería al palé
        var agacha = Math.max(k3 > 0.1 && k3 < 0.25 ? Math.sin((k3 - 0.1) / 0.15 * Math.PI) : 0,
                              k3 > 0.5 && k3 < 0.7 ? Math.sin((k3 - 0.5) / 0.2 * Math.PI) : 0);
        cuerpoP.rotation.y = Math.PI + (gira - 0.5) * 1.6;
        u.cuerpo.rotation.x = agacha * 0.35;
        u.brazos[0].rotation.x = u.brazos[1].rotation.x = -0.8 - agacha * 0.3;
        cajaMano.visible = k3 > 0.18 && k3 < 0.62;
      }
    });
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
      var ofi = P.persona({ sentado: true, semilla: 20 + i * 5 }); ofi.position.set(x, 0.7, 0.75); g.add(ofi);
      // silla de oficina: base de estrella, pie, asiento y respaldo
      g.add(cilindro(0.32, 0.32, 0.05, '#2e2e33', x, 0.32, 0.85, 10)); g.add(cilindro(0.04, 0.04, 0.42, '#55555c', x, 0.34, 0.85));
      g.add(caja(0.55, 0.1, 0.5, '#3a3a40', x, 0.66, 0.8, 0.04)); g.add(caja(0.5, 0.6, 0.08, '#3a3a40', x, 0.76, 1.1, 0.04));
    }
    return g;
  };

  P.fabrica = function (o) {
    var g = new T.Group(), w = o.ancho || 26, d = o.fondo || 12, h = 6, ac = est.acento;
    g.add(caja(w, h, d, est.fabrica || '#f7f2e8', 0, 0, 0, 0.15));
    g.add(caja(w + 0.1, 0.6, d + 0.1, ac, 0, 0, 0));                         // zócalo
    // tejado a dos aguas (prisma) con alero
    var forma = new T.Shape(); forma.moveTo(-d / 2 - 0.6, 0); forma.lineTo(d / 2 + 0.6, 0); forma.lineTo(0, 3.2); forma.lineTo(-d / 2 - 0.6, 0);
    var gt = new T.ExtrudeGeometry(forma, { depth: w + 1, bevelEnabled: false }); gt.translate(0, 0, -(w + 1) / 2);
    var tej = new T.Mesh(gt, mat(est.tejado || '#e3a83f')); tej.rotation.y = Math.PI / 2; tej.position.y = h; tej.castShadow = true; g.add(tej);
    [-w / 2 - 0.02, w / 2 + 0.02].forEach(function (x) { // hastiales blancos
      var fh = new T.Shape(); fh.moveTo(-d / 2, 0); fh.lineTo(d / 2, 0); fh.lineTo(0, 2.9); fh.lineTo(-d / 2, 0);
      var m = new T.Mesh(new T.ShapeGeometry(fh), mat(est.fabrica || '#f7f2e8', { side: T.DoubleSide })); m.rotation.y = Math.PI / 2; m.position.set(x, h, 0); g.add(m);
    });
    // ventanas con marco frambuesa y puertas enrollables
    for (var v = 0; v < 5; v++) {
      var vx = -w / 2 + 9 + v * (w - 12) / 4;
      g.add(caja(2.0, 1.5, 0.1, ac, vx, 2.6, d / 2 + 0.02));
      var win = new T.Mesh(geoCaja(1.7, 1.2, 0.08), brillo('#ffe1a3')); win.position.set(vx, 2.75, d / 2 + 0.06); g.add(win);
    }
    g.add(caja(4.4, 4.4, 0.12, ac, -w / 2 + 4, 0, d / 2 + 0.03));
    g.add(caja(4.0, 4.1, 0.12, '#e9e2d6', -w / 2 + 4, 0, d / 2 + 0.08));
    g.add(caja(3.4, 3.4, 0.12, ac, w / 2 - 3, 0, d / 2 + 0.03)); g.add(caja(3.0, 3.1, 0.12, '#e9e2d6', w / 2 - 3, 0, d / 2 + 0.08)); // salida de producto
    if (o.rotulo) {
      var tx = textoTextura(o.rotulo, { color: ac, fondo: '#ffffff', tam: 150, logo: 'assets/marca/serenitos-isologo.png' });
      var r = caja(12.8, 3.6, 0.6, ac, 2, h - 0.5, d / 2 + 1.2, 0.2);          // marco gordo
      g.add(r); g.add(cara(tx, 11.6, 2.5, 2, h + 1.3, d / 2 + 1.52));
      g.add(caja(13.2, 0.3, 0.9, ac, 2, h - 0.65, d / 2 + 1.2, 0.08));
      [-4, 8].forEach(function (x) { g.add(caja(0.2, 1.2, 1.1, '#8c8f97', x, h - 0.6, d / 2 + 0.6)); });
    }
    // silo de leche y depósito de agua al lado
    var sx = w / 2 + 3.2;
    g.add(cilindro(2, 2, 8, '#e6e8eb', sx, 1.4, -1, 18));
    var cono = new T.Mesh(new T.ConeGeometry(2.05, 1.4, 18), mat(ac)); cono.position.set(sx, 10.1, -1); cono.castShadow = true; g.add(cono);
    [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(function (p) { g.add(cilindro(0.12, 0.12, 1.5, '#8c8f97', sx + p[0], 0, -1 + p[1])); });
    g.add(cilindro(1.1, 1.1, 2.4, ac, sx + 0.6, 0, 3.4, 16));
    return g;
  };

  P.camara = function (o) {
    var g = new T.Group(), w = o.ancho || 8, d = o.fondo || 6, h = 3.6, panel = '#f4f7fa';
    var px = o.puerta || 0, pa = 2.2;
    [[-d / 2], [d / 2]].forEach(function (zz) { // muros norte y sur con hueco de puerta
      var z = zz[0], a = -w / 2, b = px - pa / 2, c = px + pa / 2;
      g.add(caja(b - a, h, 0.2, panel, (a + b) / 2, 0.2, z, 0.04)); g.add(caja(w / 2 - c, h, 0.2, panel, (c + w / 2) / 2, 0.2, z, 0.04));
      g.add(caja(pa, h - 2.8, 0.2, panel, px, 3.0, z, 0.04));
      for (var k = 0; k < 7; k++) { // cortina de lamas: no se escapa el frío
        var l = new T.Mesh(geoCaja(0.28, 2.6, 0.02), new T.MeshStandardMaterial({ color: '#cfe6f5', transparent: true, opacity: 0.55, roughness: 0.2 }));
        l.position.set(px - pa / 2 + 0.17 + k * 0.31, 0.3, z); g.add(l);
      }
    });
    g.add(caja(0.2, h, d, panel, -w / 2, 0.2, 0, 0.04)); g.add(caja(0.2, h, d, panel, w / 2, 0.2, 0, 0.04));
    g.add(caja(w + 0.3, 0.2, d + 0.3, '#7fb3e8', 0, h + 0.2, 0, 0.05));      // techo con borde azul frío
    g.add(caja(w, 0.06, d, '#e7f1f8', 0, h + 0.15, 0));
    g.add(caja(1.6, 0.6, 0.8, '#b9c3cc', w / 2 - 1.5, h + 0.4, 0, 0.08));      // equipo de frío
    var ter = textoTextura('3 °C', { color: '#ffffff', fondo: '#2f6fb0', tam: 140, ancho: 512, alto: 256 });
    var t = new T.Mesh(new T.PlaneGeometry(1.0, 0.5), new T.MeshStandardMaterial({ map: ter })); t.position.set(px + 1.8, 2.3, d / 2 + 0.12); g.add(t);
    var cop = textoTextura('❄', { color: '#7fb3e8', fondo: panel, tam: 200, ancho: 256, alto: 256 });
    var s2 = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), new T.MeshStandardMaterial({ map: cop })); s2.position.set(px - 2, 2.4, d / 2 + 0.12); g.add(s2);
    var pa2 = P.palets({ semilla: 17, puntos: [[-w / 2 + 1.2, -d / 2 + 1.0], [-w / 2 + 1.2, d / 2 - 1.0], [w / 2 - 1.2, -d / 2 + 1.0], [w / 2 - 1.2, d / 2 - 1.0]] }); g.add(pa2);
    return g;
  };

  // Señales de seguridad (cartelería de almacén): 'carretillas' (peligro), 'epi' (obligatorio chaleco), 'peatones', 'salida'
  P.senal = function (o) {
    var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d'), tipo = o.senal || 'carretillas';
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
    if (tipo === 'carretillas') {
      x.fillStyle = '#f2c230'; x.strokeStyle = '#1c1c1f'; x.lineWidth = 14; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(128, 22); x.lineTo(238, 222); x.lineTo(18, 222); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#1c1c1f'; x.fillRect(86, 140, 70, 36); x.fillRect(104, 108, 34, 34); x.fillRect(158, 100, 8, 76); x.fillRect(160, 168, 40, 8);
      x.beginPath(); x.arc(98, 186, 12, 0, 7); x.arc(146, 186, 12, 0, 7); x.fill();
    } else if (tipo === 'epi') {
      x.fillStyle = '#2f6fb0'; x.beginPath(); x.arc(128, 128, 118, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(84, 70); x.lineTo(110, 60); x.lineTo(128, 86); x.lineTo(146, 60); x.lineTo(172, 70); x.lineTo(182, 196); x.lineTo(74, 196); x.closePath(); x.fill();
      x.fillStyle = '#2f6fb0'; x.fillRect(76, 128, 104, 12); x.fillRect(76, 158, 104, 12);
    } else if (tipo === 'peatones') {
      x.fillStyle = '#3f9b5a'; x.fillRect(10, 10, 236, 236);
      x.fillStyle = '#fff'; x.beginPath(); x.arc(128, 62, 22, 0, 7); x.fill(); x.fillRect(112, 88, 32, 70);
      x.save(); x.translate(128, 156); x.rotate(0.35); x.fillRect(-8, 0, 16, 70); x.restore(); x.save(); x.translate(128, 156); x.rotate(-0.35); x.fillRect(-8, 0, 16, 70); x.restore();
    } else {
      x.fillStyle = '#3f9b5a'; x.fillRect(0, 40, 256, 176); x.fillStyle = '#fff'; x.font = '800 64px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SALIDA', 128, 128);
    }
    var t = new T.CanvasTexture(c); if ('colorSpace' in t) t.colorSpace = 'srgb'; else t.encoding = T.sRGBEncoding;
    var g = new T.Group(), tam = o.tam || 0.9, mb = mat('#ffffff');
    var m = new T.Mesh(geoCaja(tam, tam, 0.05), [mb, mb, mb, mb, new T.MeshStandardMaterial({ map: t }), mb]); m.position.y = o.alto || 2.4; g.add(m);
    if (o.poste) g.add(caja(0.08, (o.alto || 2.4), 0.08, '#55555c', 0, 0, -0.06));
    return g;
  };

  // Bolardos y barandilla amarilla que separan el paso de peatones del de las máquinas
  P.barandilla = function (o) {
    var g = new T.Group(), dx = o.x2 - o.x1, dz = o.z2 - o.z1, L = Math.hypot(dx, dz), n = Math.max(1, Math.round(L / 1.6));
    for (var i = 0; i <= n; i++) g.add(caja(0.12, 1.0, 0.12, '#f2c230', o.x1 + dx * i / n, 0.21, o.z1 + dz * i / n));
    var r = caja(L, 0.08, 0.08, '#f2c230', (o.x1 + o.x2) / 2, 1.1, (o.z1 + o.z2) / 2); r.rotation.y = -Math.atan2(dz, dx); g.add(r);
    var r2 = caja(L, 0.06, 0.06, '#1c1c1f', (o.x1 + o.x2) / 2, 0.65, (o.z1 + o.z2) / 2); r2.rotation.y = -Math.atan2(dz, dx); g.add(r2);
    return g;
  };

  // Manguera de descarga de leche (de la cisterna al silo)
  P.manguera = function (o) {
    var curva = new T.CatmullRomCurve3([new T.Vector3(o.x1, 1.2, o.z1), new T.Vector3((o.x1 + o.x2) / 2, 0.3, (o.z1 + o.z2) / 2), new T.Vector3(o.x2, 1.0, o.z2)]);
    var g = new T.Group(); g.add(new T.Mesh(new T.TubeGeometry(curva, 20, 0.12, 8, false), mat('#2f2f35')));
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
    var g = new T.Group(), ac = est.acento;
    g.add(caja(6.8, 0.35, 0.9, '#b9b2a6', 0, 0, 0, 0.08));                 // zócalo de piedra
    g.add(caja(0.3, 2.4, 0.3, '#55555c', -2.9, 0.3)); g.add(caja(0.3, 2.4, 0.3, '#55555c', 2.9, 0.3));
    g.add(caja(7, 2.5, 0.6, ac, 0, 1.3, 0, 0.18));                           // marco gordo con canto
    var tx = textoTextura(o.texto || '', { color: ac, fondo: '#ffffff', tam: 110, logo: o.logo });
    g.add(cara(tx, 6, 1.6, 0, 2.55, 0.31));                                   // cara hacia la carretera
    var atras = cara(tx, 6, 1.6, 0, 2.55, -0.31); atras.rotation.y = Math.PI; g.add(atras);
    return g;
  };

  P.muroPiedra = function (o) { // muro bajo de piedra seca, de (x1,z1) a (x2,z2) relativo
    var g = new T.Group(), az = SL.azar(o.semilla || 5), dx = o.x2 - o.x1, dz = o.z2 - o.z1, L = Math.sqrt(dx * dx + dz * dz), n = Math.round(L / 0.9);
    for (var i = 0; i < n; i++) for (var f = 0; f < 2; f++) {
      var t = (i + 0.5 + f * 0.5) / n; if (t > 1) continue;
      var c = ['#b9b2a6', '#a59e92', '#c8c1b4'][Math.floor(az() * 3)];
      var p = caja(0.9 + az() * 0.3, 0.42, 0.7, c, o.x1 + dx * t, f * 0.4, o.z1 + dz * t, 0.12);
      p.rotation.y = Math.atan2(dx, dz) + Math.PI / 2 + (az() - 0.5) * 0.3; g.add(p);
    }
    return g;
  };

  P.caseta = function (o) { // control de entrada: caseta y barrera
    var g = new T.Group();
    g.add(caja(2.6, 2.6, 2.6, '#f7f2e8', 0, 0, 0, 0.1));
    g.add(caja(3.0, 0.25, 3.0, est.acento, 0, 2.6, 0, 0.05));
    var v = new T.Mesh(geoCaja(2.0, 0.9, 0.06), brillo('#cfe4f2')); v.position.set(0, 1.3, 1.31); g.add(v);
    g.add(caja(0.4, 1.0, 0.4, '#34343a', 1.8, 0, 1.3));
    var brazo = new T.Group(); brazo.position.set(1.8, 0.95, 1.3); g.add(brazo);
    for (var k = 0; k < 7; k++) brazo.add(caja(0.8, 0.12, 0.12, k % 2 ? '#ffffff' : est.acento, 0.4 + k * 0.8, 0, 0));
    brazo.rotation.z = o.abierta === false ? 0 : 1.2;
    return g;
  };

  P.aparcamiento = function (o) { // plazas del personal
    var g = new T.Group(), n = o.plazas || 6, w = n * 2.6;
    g.add(plano(w + 1, 5.6, est.asfalto || '#cfc9bd', 0, 0.03, 0));
    for (var k = 0; k <= n; k++) g.add(plano(0.12, 4.6, '#ffffff', -w / 2 + k * 2.6, 0.04, -0.3));
    var cols = ['#2f4fa3', '#edeae3', '#c8463e', '#55565c'];
    (o.coches || [0, 2, 3]).forEach(function (k, i) { var c = P.coche({ color: cols[i % cols.length] }); c.position.set(-w / 2 + 1.3 + k * 2.6, 0, -0.3); g.add(c); });
    return g;
  };

  P.palets = function (o) { // montón de palés con carga en el suelo
    var g = new T.Group(), az = SL.azar(o.semilla || 9);
    (o.puntos || [[0, 0]]).forEach(function (p) { var pl = P.palet(o.carga !== false, az); pl.userData.esPalet = true; pl.position.set(p[0], 0.22, p[1]); pl.rotation.y = p[2] || 0; g.add(pl); });
    return g;
  };

  // ---------- vehículos con ruta y cesión de paso ----------
  function Vehiculo(def, i) {
    this.id = i; this.def = def;
    var pieza = P[def.tipo === 'retractil' ? 'carretilla' : def.tipo];
    this.obj = pieza(def);
    var crudo = def.ruta.map(function (p) { return { x: p[0], z: p[1], o: p[2] || {} }; });
    var R = def.giro != null ? def.giro : def.tipo === 'camion' ? 5 : def.tipo === 'coche' ? 4 : def.tipo === 'persona' ? 0.4 : 1.2;
    var ruta = [], indice = [];
    crudo.forEach(function (p, k) {
      indice[k] = ruta.length;
      var a = crudo[k - 1], b = crudo[k + 1];
      var limpio = !p.o.espera && !p.o.salto && p.o.carga == null && a && b && !b.o.salto && !!b.o.atras === !!p.o.atras;
      if (!limpio || R <= 0) { ruta.push(p); return; }
      var d1x = p.x - a.x, d1z = p.z - a.z, l1 = Math.hypot(d1x, d1z), d2x = b.x - p.x, d2z = b.z - p.z, l2 = Math.hypot(d2x, d2z);
      if (l1 < 0.01 || l2 < 0.01 || Math.abs(d1x * d2z - d1z * d2x) / (l1 * l2) < 0.05) { ruta.push(p); return; }
      var r = Math.min(R, l1 * 0.48, l2 * 0.48), ax = p.x - d1x / l1 * r, az = p.z - d1z / l1 * r, bx = p.x + d2x / l2 * r, bz = p.z + d2z / l2 * r;
      for (var n = 0; n <= 8; n++) { var t = n / 8, u = 1 - t;
        ruta.push({ x: u * u * ax + 2 * u * t * p.x + t * t * bx, z: u * u * az + 2 * u * t * p.z + t * t * bz, o: { atras: p.o.atras } }); }
    });
    this.ruta = ruta;
    this.i = indice[def.inicio || 0]; this.pos = new T.Vector3(this.ruta[this.i].x, 0, this.ruta[this.i].z);
    this.vel = def.vel || 3; this.espera = 0; this.bloqueado = false; this.ang = 0;
    this.radio = def.tipo === 'camion' ? 5.5 : def.tipo === 'coche' ? 3 : def.tipo === 'persona' ? 0.7 : 2.2;
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
    var paso = this.vel * dt * (obj.o.atras ? 0.55 : 1); // marcha atrás, despacio
    if (paso >= dist) { this.pos.set(obj.x, 0, obj.z); this.llegar(obj); }
    else { this.pos.x += dirx * paso; this.pos.z += dirz * paso; }
    var ang = Math.atan2(-dirx, -dirz) + (obj.o.atras ? Math.PI : 0); // las piezas miran a -z
    var dA = ((ang - this.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.ang += dA * Math.min(1, dt * (this.def.tipo === 'persona' ? 6 : 9));
  };
  Vehiculo.prototype.llegar = function (p) {
    this.i = (this.i + 1) % this.ruta.length;
    if (p.o.salto) this.pos.set(p.x, 0, p.z);
    if (p.o.espera) this.espera = p.o.espera;
    var c = this.obj.userData.carga;
    if (c && p.o.carga != null) {
      // La mercancía no desaparece: al descargar queda un palé en el suelo; al cargar se recoge el que haya cerca.
      var donde = this.puntoCarga();
      if (p.o.carga) recoger(donde); else if (c.visible && !p.o.guardar) dejar(donde, this.obj.rotation.y);
      c.visible = !!p.o.carga;
    }
  };
  Vehiculo.prototype.puntoCarga = function () {
    this.obj.updateMatrixWorld(true);
    if (this.def.tipo === 'camion') { var v = this.obj.localToWorld(new T.Vector3(0, 0, 6.6)); v.y = 0.21; return v; } // detrás del camión, ya dentro del muelle
    var w = new T.Vector3(); this.obj.userData.carga.getWorldPosition(w);
    if (this.def.retractil) { w.x += this.def.huecoX || 1.75; w.y = 3.2; } // la retráctil lo deja arriba, en la estantería
    return w;
  };
  var sueltos = []; // palés dejados en el suelo o en la estantería
  // Todos los palés (fijos y sueltos) en una sola lista: nunca se montan dos en el mismo hueco
  // (eso hacía que se vieran a rayas) y ninguno desaparece: se esconde donde se coge y aparece donde se deja.
  var fijos = null;
  function listaFijos() {
    if (fijos) return fijos; fijos = [];
    escena.traverse(function (o) { if (o.userData && o.userData.esPalet) { var w = new T.Vector3(); o.getWorldPosition(w); fijos.push({ obj: o, pos: w }); } });
    return fijos;
  }
  function cerca(pos, max, soloVisibles) {
    var mejor = null, dm = max;
    listaFijos().concat(sueltos.map(function (p) { return { obj: p, pos: p.position, suelto: true }; })).forEach(function (e) {
      if (soloVisibles && !e.obj.visible) return;
      var d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) + Math.abs(e.pos.y - pos.y) * 0.5;
      if (d < dm) { dm = d; mejor = e; }
    });
    return mejor;
  }
  function dejar(pos, giro) {
    var e = cerca(pos, 1.1, false);
    if (e) { e.obj.visible = true; return; }
    var pl = P.palet(true, SL.azar(sueltos.length + 70)); pl.position.copy(pos); pl.rotation.y = giro + Math.PI / 2;
    escena.add(pl); sueltos.push(pl);
  }
  function recoger(pos) {
    var e = cerca(pos, 3, true);
    if (!e) return;
    if (e.suelto) { escena.remove(e.obj); sueltos.splice(sueltos.indexOf(e.obj), 1); } else e.obj.visible = false;
  }
  Vehiculo.prototype.pintar = function (t) {
    var u0 = this.obj.userData;
    if (u0.remolque) { // articulado: el cuerpo que va delante sigue la ruta y el otro le sigue sin derrapar
      var dd = this.ultX == null ? 0 : Math.hypot(this.pos.x - this.ultX, this.pos.z - this.ultZ);
      this.ultX = this.pos.x; this.ultZ = this.pos.z;
      if (this.hC == null || dd > 3) { this.hC = this.hT = this.ang; dd = 0; } // inicio o salto de ruta
      if (!this.objetivo().o.atras) { this.hC = this.ang; this.hT += Math.sin(difAng(this.hC, this.hT)) * dd / 5.5; }
      else { this.hT += difAng(this.ang, this.hT) * Math.min(1, dd * 0.6); this.hC += Math.sin(difAng(this.hT, this.hC)) * dd / 2.6; }
      u0.cabeza.rotation.y = difAng(this.hC, this.ang); u0.remolque.rotation.y = difAng(this.hT, this.ang);
    }
    this.obj.position.set(this.pos.x, this.y0, this.pos.z);
    this.obj.rotation.y = this.ang;
    var h = this.obj.userData.horquillas;
    var anda = this.espera <= 0 && !this.bloqueado;
    if (this.obj.userData.piernas) caminar(this.obj, t * 7 + this.id, !anda);
    if (this.obj.userData.operario) { // anda empujando: las dos manos en el mango
      var op = this.obj.userData.operario; caminar(op, t * 6 + this.id, !anda);
      op.userData.brazos[0].rotation.x = op.userData.brazos[1].rotation.x = -0.95;
      op.userData.brazos[0].rotation.z = -0.05; op.userData.brazos[1].rotation.z = 0.05;
      op.userData.cuerpo.rotation.x = 0.12;
    }
    if (h) { var arriba = this.espera > 0 && this.def.tipo === 'retractil'; h.position.y += ((arriba ? 3.3 : 0.12) - h.position.y) * 0.04; }
  };

  // Matas de hierba seca (como las del diorama): dan textura al suelo sin pintar el suelo.
  function matas() {
    var az = SL.azar(321), sx = mundo.suelo.ancho / 2 + 1, sz = mundo.suelo.fondo / 2 + 1, pts = [];
    var libre = function (x, z) {
      if (Math.abs(z - 26) < 5.5) return false;                                  // carretera
      return true;
    };
    for (var i = 0; i < 2600 && pts.length < 1500; i++) {
      var a = az() * Math.PI * 2, r = 8 + Math.sqrt(az()) * 120, x = Math.cos(a) * r * 1.2, z = Math.sin(a) * r;
      if (Math.abs(x) < sx && Math.abs(z) < sz) continue;
      if (libre(x, z)) pts.push([x, z]);
    }
    var hojas = 4, geo = new T.ConeGeometry(0.09, 0.75, 4); geo.translate(0, 0.37, 0);
    var im = new T.InstancedMesh(geo, mat('#ffffff', { flatShading: true }), pts.length * hojas);
    var m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), p = new T.Vector3(), col = new T.Color();
    var tonos = ['#d8b45c', '#c99a3e', '#e2c477', '#b98c3a', '#d6a64c'], n2 = 0;
    pts.forEach(function (pt) {
      var tam = 0.6 + az() * 0.8, tono = tonos[Math.floor(az() * tonos.length)];
      for (var h = 0; h < hojas; h++) {
        e.set((az() - 0.5) * 0.9, az() * 6, (az() - 0.5) * 0.9); q.setFromEuler(e);
        sc.set(tam, tam * (0.7 + az() * 0.6), tam); p.set(pt[0] + (az() - 0.5) * 0.3, 0, pt[1] + (az() - 0.5) * 0.3);
        m4.compose(p, q, sc); im.setMatrixAt(n2, m4); im.setColorAt(n2, col.set(tono)); n2++;
      }
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    escena.add(im);
  }

  // ---------- construcción ----------
  function construir() {
    est = mundo.estilo || {};
    var campo = new T.Mesh(new T.CircleGeometry(900, 48), new T.MeshStandardMaterial({ color: est.campo || est.cesped || '#e2c47a', roughness: 1 }));
    campo.rotation.x = -Math.PI / 2; campo.position.y = -0.02; campo.receiveShadow = true; escena.add(campo);
    var suelo = plano(mundo.suelo.ancho, mundo.suelo.fondo, est.suelo || '#efe9df', 0, 0, 0);
    escena.add(suelo);
    // lomas suaves de la dehesa a lo lejos (se funden con la niebla)
    var azL = SL.azar(77);
    for (var li = 0; li < 34; li++) {
      var ang = li / 34 * Math.PI * 2 + azL() * 0.15, rad = 230 + azL() * 90;
      var lm = new T.Mesh(new T.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(azL() < 0.5 ? (est.loma || '#cdb46e') : (est.loma2 || '#a9a46c')));
      lm.scale.set(40 + azL() * 40, 10 + azL() * 16, 30 + azL() * 20); lm.position.set(Math.cos(ang) * rad, -1, Math.sin(ang) * rad); lm.rotation.y = -ang;
      escena.add(lm);
    }
    if (mundo.entorno !== false) entorno();
    var azE = SL.azar(55); // encinas sueltas por el campo
    for (var ei = 0; ei < 60; ei++) {
      var ea = azE() * Math.PI * 2, er = 75 + azE() * 130, en = P.arbol({ especie: azE() < 0.6 ? 'encina' : 'olivo' }, azE);
      en.position.set(Math.cos(ea) * er * 1.3, 0, Math.sin(ea) * er); en.scale.setScalar(1.2 + azE() * 0.6); escena.add(en);
    }
    (mundo.cesped || []).forEach(function (c) { var pc = plano(c[2] - c[0], c[3] - c[1], est.cesped || '#cfe0c4', (c[0] + c[2]) / 2, 0.015, (c[1] + c[3]) / 2); escena.add(pc); });
    matas();
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
      if (o.info) ficha(g, Object.assign({ tipo: 'objeto', grupo: /^(rack|mesaEtiquetado|retractiladora|oficina)$/.test(o.tipo) ? 'Dentro de la nave' : o.tipo === 'camion' ? 'Camiones' : undefined }, o.info));
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
    anillo = new T.Mesh(new T.RingGeometry(1.6, 2.0, 40), new T.MeshBasicMaterial({ color: est.acento, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
    anillo.rotation.x = -Math.PI / 2; anillo.visible = false; anillo.renderOrder = 5; // respeta lo que tiene delante escena.add(anillo);
  }

  // ---------- alrededores (fondo con poco peso visual) ----------
  function entorno() {
    var az = SL.azar(404), palido = function (c) { return mat(c); };
    // campos de cultivo (vegas del Guadiana): franjas de surcos
    [[-120, -90, 70, 50, '#c7cf9a'], [110, -95, 80, 45, '#d9c58a'], [-150, 40, 60, 40, '#b9c690'], [150, 60, 70, 50, '#cfc08e'], [0, -130, 90, 40, '#c2cc96']].forEach(function (f) {
      var c = document.createElement('canvas'); c.width = 64; c.height = 64; var x = c.getContext('2d');
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(0,0,0,.12)'; for (var k = 0; k < 64; k += 8) x.fillRect(0, k, 64, 3);
      var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1, f[3] / 3);
      var m = new T.Mesh(new T.PlaneGeometry(f[2], f[3]), new T.MeshStandardMaterial({ color: f[4], map: t, roughness: 1 }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = az() * 0.6; m.position.set(f[0], 0.01, f[1]); m.receiveShadow = true; escena.add(m);
    });
    // olivar en hileras (lo más típico de la zona)
    for (var ox = 0; ox < 8; ox++) for (var oz = 0; oz < 6; oz++) {
      var ol = P.arbol({ especie: 'olivo' }, az); ol.position.set(70 + ox * 7 + (az() - 0.5), 0, 45 + oz * 7 + (az() - 0.5)); ol.rotation.y = az() * 6; escena.add(ol);
    }
    for (var ox2 = 0; ox2 < 6; ox2++) for (var oz2 = 0; oz2 < 5; oz2++) {
      var ol2 = P.arbol({ especie: 'olivo' }, az); ol2.position.set(-75 - ox2 * 7, 0, -60 - oz2 * 7); ol2.rotation.y = az() * 6; escena.add(ol2);
    }
    // otra nave industrial, gris y en llano
    var nave2 = caja(30, 7, 18, '#d6d6d2', 115, 0, -80, 0.2); escena.add(nave2); escena.add(caja(31, 0.4, 19, '#bfc3c6', 115, 7, -80));
    // ovejas pastando (se mueven despacio)
    var ovejas = [];
    for (var o = 0; o < 14; o++) {
      var ov = new T.Group(), cuerpo = esfera(0.7, '#f4f1ea', 0, 0.8, 0); cuerpo.scale.set(1.3, 0.9, 0.9); ov.add(cuerpo);
      ov.add(esfera(0.3, '#3a3330', 0.9, 0.95, 0));
      [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25], [0.4, 0.25]].forEach(function (p) { ov.add(caja(0.1, 0.45, 0.1, '#3a3330', p[0], 0, p[1])); });
      var cx = -95 + az() * 30, cz = 60 + az() * 25; ov.position.set(cx, 0, cz); ov.rotation.y = az() * 6;
      ov.userData = { cx: cx, cz: cz, f: az() * 6 }; escena.add(ov); ovejas.push(ov);
    }
    // tractor que trabaja el campo de ida y vuelta
    var tr = new T.Group();
    tr.add(caja(1.6, 1.2, 2.6, '#7a9a5a', 0, 0.6, 0, 0.15)); tr.add(caja(1.3, 1.1, 1.2, '#7a9a5a', 0, 1.8, 0.4, 0.1));
    var rg = cilindro(0.8, 0.8, 0.4, '#2a2a2e', 0.95, 0.8, 0.7, 12); rg.rotation.z = Math.PI / 2; rg.position.y = 0.8; tr.add(rg);
    var rg2 = rg.clone(); rg2.position.x = -0.95; tr.add(rg2);
    escena.add(tr);
    animables.push(function (t) {
      ovejas.forEach(function (ov) { var u = ov.userData; ov.position.x = u.cx + Math.sin(t * 0.05 + u.f) * 3; ov.position.z = u.cz + Math.cos(t * 0.04 + u.f) * 2; ov.rotation.y = t * 0.05 + u.f; });
      var k = (t * 0.02) % 2, d = k < 1 ? k : 2 - k; tr.position.set(-140 + d * 60, 0, -95); tr.rotation.y = k < 1 ? Math.PI / 2 : -Math.PI / 2;
    });
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
    if (modo2D) { a.az = 0; a.el = EL2D; }
    var dAz = ((a.az - desde.az + Math.PI * 3) % (Math.PI * 2)) - Math.PI; a.az = desde.az + dAz;
    meta = null;
    vuelo = { desde: desde, a: a, t: 0, dur: SL.sinMovimiento ? 0.01 : (dur == null ? 1.4 : dur), fin: alTerminar };
  };
  M.camara = function () { return Object.assign({}, camEstado); };
  M.vistaZona = function (id, extra) {
    var z = zonas[id]; if (!z) return null;
    return Object.assign({ x: z.cx, z: z.cz + 1, dist: Math.max(30, z.tam * 2.4), el: 0.78 }, extra || {});
  };
  M.inicio = function (dur) { M.volarA(mundo.camaraInicial, dur); };

  var modo2D = false, EL2D = 1.5;
  M.vista2D = function (si) {
    modo2D = !!si; meta = null;
    M.volarA(si ? { az: 0, el: EL2D, dist: Math.max(camEstado.dist, 70) } : { az: mundo.camaraInicial.az, el: mundo.camaraInicial.el }, 0.9);
    return modo2D;
  };
  M.es2D = function () { return modo2D; };
  var DMIN = 24, DMAX = 110, EMIN = 0.32, EMAX = 1.3, zoomU = 1;
  // Distancia según la inclinación: al bajar la vista la cámara se acerca y al subirla se aleja (como el encuadre de Cubic).
  function distEl(e) { var c = mundo.camaraInicial; return c.dist * (0.7 + 0.3 * Math.sin(e)) / (0.7 + 0.3 * Math.sin(c.el)); } // zoom: ni dentro de una caja ni perdido en el horizonte
  function controles() {
    var el = render.domElement, arr = null, movido = 0;
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('pointerdown', function (e) {
      // Arrastrar = girar alrededor de la nave. Botón derecho o Mayús = desplazar un poco (con límite).
      arr = { x: e.clientX, y: e.clientY, girar: !(e.button === 2 || e.shiftKey), id: e.pointerId };
      movido = 0; el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      actualizarPuntero(e);
      if (!arr) return;
      var dx = e.clientX - arr.x, dy = e.clientY - arr.y; arr.x = e.clientX; arr.y = e.clientY;
      movido += Math.abs(dx) + Math.abs(dy);
      if (movido < 4) return;
      if (vuelo || !meta) { meta = Object.assign({}, camEstado); zoomU = camEstado.dist / distEl(camEstado.el); }
      vuelo = null; siguiendo = null;
      if (arr.girar && modo2D) { M.vista2D(false); if (M.alCambiarVista) M.alCambiarVista(false); arr = null; return; } // como en Cubic: arrastrar en 2D pasa a 3D
      if (arr.girar) {
        meta.az -= dx * 0.006; arr.vaz = -dx * 0.006;
        // elevación con tope blando (se estira un poco y vuelve) y el encuadre se acerca o aleja con ella
        var fuera = meta.el > EMAX || meta.el < EMIN;
        meta.el += dy * 0.0045 * (fuera ? 0.3 : 1);
        meta.el = Math.max(EMIN - 0.12, Math.min(EMAX + 0.12, meta.el));
        meta.dist = distEl(meta.el) * zoomU;
      } else {
        var k = meta.dist * 0.0016, s = Math.sin(meta.az), c = Math.cos(meta.az);
        meta.x -= (dx * c + dy * s) * k;
        meta.z -= (-dx * s + dy * c) * k;
        var lim = mundo.limite || 16;
        var lx = Math.max(lim, Math.abs(camEstado.x)), lz = Math.max(lim, Math.abs(camEstado.z));
        meta.x = Math.max(-lx, Math.min(lx, meta.x)); meta.z = Math.max(-lz, Math.min(lz, meta.z));
      }
    });
    el.addEventListener('pointerup', function (e) {
      if (arr && movido < 6) tocar(e);
      if (arr && meta && movido >= 6) { // inercia suave al soltar y vuelta del tope blando
        if (arr.vaz) meta.az += arr.vaz * 8;
        meta.el = Math.max(EMIN, Math.min(EMAX, meta.el)); meta.dist = distEl(meta.el) * zoomU;
      }
      arr = null;
    });
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (vuelo || !meta) { meta = Object.assign({}, camEstado); zoomU = camEstado.dist / distEl(camEstado.el); }
      vuelo = null;
      zoomU = Math.min(DMAX / distEl(meta.el), Math.max(DMIN / distEl(meta.el), zoomU * (1 + Math.sign(e.deltaY) * 0.1)));
      meta.dist = distEl(meta.el) * zoomU;
    }, { passive: false });
  }
  M.zoom = function (f) { M.volarA({ dist: Math.min(DMAX, Math.max(DMIN, camEstado.dist * f)) }, 0.4); };

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
    else if (seleccion || camAntes) { camAntes = null; M.seleccionar(null); M.inicio(1.0); } // tocar fuera: vuelta a la vista inicial
    else M.seleccionar(null);
  }

  M.elementos = function () { return elementos; };
  // Al cerrar la ficha se vuelve a la vista de antes.
  M.volver = function () { var c = camAntes; camAntes = null; M.seleccionar(null); if (c) M.volarA(c, 1.0); };
  M.seleccionar = function (obj, f, viajar) {
    if (obj && !seleccion && !camAntes) camAntes = Object.assign({}, camEstado);
    if (!obj) siguiendo = null;
    seleccion = obj ? { obj: obj, ficha: f } : null;
    anillo.visible = !!obj;
    if (obj) {
      var p = new T.Vector3(); obj.getWorldPosition(p);
      var veh = f.tipo === 'vehiculo';
      if (viajar) M.volarA({ x: p.x, z: p.z, dist: veh ? 26 : Math.max(camEstado.dist * 0.6, 24) }, 1.1, function () { if (veh) siguiendo = obj; });
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
    if (cielo) { cielo.material.uniforms.abajo.value.copy(cTmp); cielo.material.uniforms.noche.value = k; cielo.position.copy(camara.position); }
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
    escena.fog = new T.Fog(cDia.clone(), 150, 420);
    camara = new T.PerspectiveCamera(30, 1, 1, 2000);
    // cúpula de cielo: azul suave arriba y el color de la niebla en el horizonte
    cielo = new T.Mesh(new T.SphereGeometry(1500, 24, 12), new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { arriba: { value: new T.Color(e.cieloAlto || '#a9cbe3') }, abajo: { value: cDia.clone() }, noche: { value: 0 } },
      vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 arriba; uniform vec3 abajo; uniform float noche; varying float vY; void main(){ float k = smoothstep(0.0, 0.35, vY); vec3 c = mix(abajo, arriba, k); gl_FragColor = vec4(mix(c, abajo, noche), 1.0); }'
    }));
    escena.add(cielo);
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
      } else if (meta) {
        var kk = SL.sinMovimiento ? 1 : 1 - Math.exp(-dt * 6);
        ['x', 'z', 'dist', 'az', 'el'].forEach(function (p) { camEstado[p] += (meta[p] - camEstado[p]) * kk; });
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
