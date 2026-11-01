/* SimuLab · core/persona.js
 * Personas "Memoji mini" de Cubic Lab, copiadas tal cual (ver PERSONA_3D.md de Cubic Lab).
 * Extra para el almacén: opc.seguridad (chaleco reflectante, pantalón de trabajo y botas) y opc.casco.
 * Miden 1,65 m y miran hacia +z. SimuLab.Persona.crear(semilla, opc) · SimuLab.Persona.caminar(grupo, fase)
 */
(function () {
  'use strict';
  var T = window.THREE;
  var PALETA = {
    torso: [0x8fac8b, 0xad94e6, 0xef8a3c, 0x2f3f6e, 0xe3c04a, 0xedeae3, 0x2a2a2e, 0xc8463e],
    pantalon: [0x2b2b30, 0x5a7fb0, 0xcdba96, 0x8a8c92],
    piel: [0xf1d0b5, 0xe0b48e, 0xb98559, 0x7e5236],
    pelo: [0x5a3a26, 0x1f1b18, 0x6b4a2e, 0xb7863f]
  };
  var FIJOS = [
    { torso: 0x8fac8b, pantalon: 0x2b2b30, piel: 0xe8c3a2, pelo: 0x5a3a26, peinado: 'mono', manga: 'larga', ancho: true },
    { torso: 0xc4a8ec, pantalon: 0x5a7fb0, piel: 0xe8c3a2, pelo: 0x5a3a26, peinado: 'coleta', manga: 'corta', bolsa: true },
    { torso: 0xe9813a, pantalon: 0xd8c8a6, piel: 0xe8c3a2, pelo: 0x4a3020, peinado: 'gorra', gorra: 0xc98a5a, manga: 'larga' },
    { torso: 0x2f3f6e, pantalon: 0x8a8c92, piel: 0xe8c3a2, pelo: 0x4a3020, peinado: 'corto', manga: 'corta', bolsa: true }
  ];
  var GEO = {}, MAT = {};
  function geo(clave, crear) { return GEO[clave] || (GEO[clave] = crear()); }
  // Vinilo mate: sombreado suave, sin brillo.
  function mate(c) { return MAT[c] || (MAT[c] = new T.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0 })); }
  function malla(g, m, x, y, z) { var o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); return o; }
  function esfera(r) { return geo('esf' + r, function () { return new T.SphereGeometry(r, 28, 20); }); }
  function capsula(r, l) { return geo('cap' + r + '_' + l, function () { return new T.CapsuleGeometry(r, l, 8, 20); }); }
  // Pieza de revolución a partir de un perfil [radio, altura] (torso, pantalón).
  function torno(clave, perfil) {
    return geo(clave, function () { return new T.LatheGeometry(perfil.map(function (q) { return new T.Vector2(q[0], q[1]); }), 28); });
  }

  // Cabeza ovalada de vinilo: lados rectos, arriba y abajo redondos (cápsula). Centro en 0.
  var CR = 0.235, CL = 0.06;
  function radioCabeza(y) { var a = Math.abs(y) - CL; return a <= 0 ? CR : Math.sqrt(Math.max(0, CR * CR - a * a)); }
  // Pelo o gorra que se pega a la cabeza: borde inferior lim(phi) (phi 0 = cara) y volumen extra(phi, y).
  function casquete(clave, lim, extra) {
    return geo(clave, function () {
      // Cabeza parametrizada por arco desde la coronilla; cada columna llega justo hasta su borde (sin dientes).
      var S1 = Math.PI * CR / 2, S2 = S1 + 2 * CL;
      function punto(sa) {
        if (sa < S1) { var a = sa / CR; return [CR * Math.sin(a), CL + CR * Math.cos(a), 0, CL]; }
        if (sa < S2) return [CR, CL - (sa - S1), 1, CL - (sa - S1)];
        var b = Math.PI / 2 + (sa - S2) / CR; return [CR * Math.sin(b), -CL + CR * Math.cos(b), 0, -CL];
      }
      function arco(y) { return y > CL ? CR * Math.acos(Math.min(1, (y - CL) / CR)) : (y >= -CL ? S1 + (CL - y) : S2 + CR * (Math.acos(Math.max(-1, (y + CL) / CR)) - Math.PI / 2)); }
      var NC = 96, NF = 40, pos = [], idx = [], i, j;
      for (i = 0; i <= NC; i++) {
        var phi = Math.PI + i / NC * Math.PI * 2, sl = arco(lim(phi)), sn = Math.sin(phi), cs = Math.cos(phi);
        for (j = 0; j <= NF; j++) {
          var sa = j / NF * sl, q = punto(sa), t = Math.min(1, (sl - sa) / 0.05), e = t * t * (3 - 2 * t);
          var nx = q[0], ny = q[1] - q[3], nl = Math.hypot(nx, ny) || 1;
          var off = (0.022 + extra(phi, q[1])) * e - (j === NF ? 0.004 : 0);
          pos.push((q[0] + nx / nl * off) * sn, q[1] + ny / nl * off, (q[0] + nx / nl * off) * cs);
        }
      }
      for (i = 0; i < NC; i++) for (j = 0; j < NF; j++) {
        var A = i * (NF + 1) + j, B = A + NF + 1;
        idx.push(A, A + 1, B, B, A + 1, B + 1);
      }
      var gg = new T.BufferGeometry();
      gg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
      return gg;
    });
  }
  function borde(F, B, S) { return function (phi) { var c = Math.cos(phi); return c >= 0 ? S + (F - S) * c : S + (B - S) * Math.sqrt(-c); }; }
  function campana(x, c, a) { return Math.exp(-Math.pow((x - c) / a, 2)); }
  // Mechón o coleta: tubo que adelgaza por una curva.
  function mechon(clave, puntos, r0, r1) {
    return geo(clave, function () {
      var curva = new T.CatmullRomCurve3(puntos.map(function (q) { return new T.Vector3(q[0], q[1], q[2]); }));
      var N = 24, R = 12, gg = new T.TubeGeometry(curva, N, 1, R, false), p = gg.attributes.position, v = new T.Vector3();
      for (var j = 0; j <= N; j++) {
        var u = j / N, c = curva.getPointAt(u), rr = r0 + (r1 - r0) * u, rr2 = rr;
        for (var i = 0; i <= R; i++) { var k = j * (R + 1) + i; v.fromBufferAttribute(p, k).sub(c).multiplyScalar(Math.max(rr2, 0.004)).add(c); p.setXYZ(k, v.x, v.y, v.z); }
      }
      gg.computeVertexNormals();
      return gg;
    });
  }

  function persona(k, opc) {
    var r = function (n, sal) { return (k * 7919 + sal * 104729) % n; };
    var o = (opc && opc.fijo) || FIJOS[k] || {
      torso: PALETA.torso[r(8, 1)], pantalon: PALETA.pantalon[r(4, 2)], piel: PALETA.piel[r(4, 3)], pelo: PALETA.pelo[r(4, 4)],
      peinado: ['corto', 'mono', 'coleta', 'corto', 'gorra'][r(5, 5)], gorra: PALETA.torso[r(8, 6)], manga: r(2, 7) ? 'larga' : 'corta', bolsa: r(10, 8) < 3
    };
    opc = opc || {};
    if (opc.seguridad) { // ropa de almacén: pantalón de trabajo, botas, sin bolsa ni gorra
      o = Object.assign({}, o, { pantalon: [0x3a3d46, 0x2f3f6e, 0x4a4a50][r(3, 9)], bolsa: false, ancho: false });
      if (o.peinado === 'gorra' || opc.casco) o.peinado = 'corto';
      if (o.peinado === 'mono') o.peinado = 'coleta';
    }
    var g = new T.Group(), cuerpo = new T.Group(), piel = mate(o.piel), ropa = mate(o.torso), pant = mate(o.pantalon), pelo = mate(o.pelo), blanco = mate(0xf6f4f0);
    g.add(cuerpo);
    var sombra = new T.Mesh(geo('sombra', function () { return new T.CircleGeometry(0.3, 24); }), new T.MeshBasicMaterial({ color: 0x1c1c1f, transparent: true, opacity: 0.16, depthWrite: false }));
    sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.01; g.add(sombra);

    // Piernas cortas y juntas (pivote en la cadera), pernera recta y zapatilla blanca redondeada.
    var piernas = [];
    [-1, 1].forEach(function (lado) {
      var cad = new T.Group(); cad.position.set(lado * 0.105, 0.6, 0);
      var pern = malla(capsula(0.1, 0.3), pant, 0, -0.22, 0); pern.scale.set(1, 1, 0.92); cad.add(pern);
      if (o.pantalon === 0x5a7fb0) cad.add(malla(geo('vuelta', function () { var t = new T.TorusGeometry(0.092, 0.026, 12, 28); t.rotateX(Math.PI / 2); return t; }), pant, 0, -0.43, 0));
      if (o.ancho) { var bc = malla(geo('cargo', function () { return new T.BoxGeometry(0.03, 0.1, 0.1); }), pant, lado * 0.098, -0.24, 0); cad.add(bc); }
      var zap = malla(capsula(0.08, 0.1), opc.seguridad ? mate(0x3b3532) : blanco, lado * 0.005, -0.5, 0.035);
      zap.rotation.x = Math.PI / 2; zap.scale.set(1.08, 1, 0.72); cad.add(zap);
      var su = malla(capsula(0.082, 0.1), mate(0xd6d1c9), lado * 0.005, -0.535, 0.035); su.rotation.x = Math.PI / 2; su.scale.set(1.12, 1, 0.3); cad.add(su);
      cuerpo.add(cad); piernas.push(cad);
    });

    // Cuerpecito pequeño y redondeado: sin hombros que sobresalgan.
    var ancho = o.ancho ? 1.06 : 1;
    var torso = malla(torno('torso2', [[0, 0], [0.19, 0], [0.214, 0.025], [0.22, 0.1], [0.222, 0.34], [0.212, 0.42], [0.175, 0.475], [0.1, 0.5], [0, 0.505]]), ropa, 0, 0.56, 0);
    torso.scale.set(ancho, 1, 0.74); cuerpo.add(torso);
    if (opc.seguridad) { // chaleco reflectante con dos bandas
      var ch = malla(torno('chaleco', [[0, 0.1], [0.229, 0.1], [0.231, 0.2], [0.232, 0.34], [0.222, 0.43], [0.16, 0.47], [0, 0.47]]), mate(0xd6ec3a), 0, 0.56, 0);
      ch.scale.set(1, 1, 0.76); cuerpo.add(ch);
      [0.2, 0.3].forEach(function (y) { var b = malla(torno('banda', [[0.236, 0], [0.236, 0.03]]), mate(0xf2f3f5), 0, 0.56 + y, 0); b.material.side = T.DoubleSide; b.scale.set(1, 1, 0.76); cuerpo.add(b); });
    }
    if (o.peinado === 'mono' && o.ancho) {
      // Sudadera: capucha a la espalda, bolsillo canguro y cordones.
      var cap = malla(capsula(0.075, 0.2), ropa, 0, 1.06, -0.1); cap.rotation.z = Math.PI / 2; cap.scale.set(1, 1, 0.8); cuerpo.add(cap);
      var bol = malla(capsula(0.065, 0.17), ropa, 0, 0.7, 0.155); bol.rotation.z = Math.PI / 2; bol.scale.set(1, 1, 0.4); cuerpo.add(bol);
      [-1, 1].forEach(function (lado) { cuerpo.add(malla(capsula(0.008, 0.1), mate(0xeeeeea), lado * 0.04, 0.97, 0.16)); });
    } else if (o.torso === 0x2f3f6e || o.polo) {
      // Polo: solapas y tapeta.
      [-1, 1].forEach(function (lado) {
        var sol = malla(geo('solapa', function () { return new T.BoxGeometry(0.085, 0.018, 0.07); }), ropa, lado * 0.045, 1.07, 0.085);
        sol.rotation.set(0.6, lado * 0.3, lado * -0.4); cuerpo.add(sol);
      });
      cuerpo.add(malla(geo('cuelloPolo', function () { var t = new T.TorusGeometry(0.07, 0.02, 10, 24); t.rotateX(Math.PI / 2); return t; }), ropa, 0, 1.065, 0));
      var tap = malla(capsula(0.012, 0.07), mate(0x283660), 0, 0.99, 0.158); cuerpo.add(tap);
    }

    // Brazos finos que caen algo separados del cuerpo, manga dentro de la silueta y mano redonda.
    var brazos = [];
    [-1, 1].forEach(function (lado) {
      var hom = new T.Group(); hom.position.set(lado * 0.178, 1.0, 0); hom.rotation.z = lado * 0.26;
      var corta = o.manga === 'corta';
      hom.add(malla(capsula(corta ? 0.046 : 0.056, 0.34), corta ? piel : ropa, 0, -0.2, 0));
      if (corta) hom.add(malla(capsula(0.06, 0.08), ropa, 0, -0.07, 0));
      var mano = malla(esfera(0.06), piel, 0, -0.42, 0.005); mano.scale.set(0.88, 1.12, 0.82); hom.add(mano);
      cuerpo.add(hom); brazos.push(hom);
    });
    var bolsa = null;
    if (o.bolsa) {
      bolsa = new T.Group(); bolsa.position.set(0, -0.56, 0); bolsa.rotation.z = -0.26; bolsa.visible = false;
      bolsa.add(malla(geo('bolsa', function () { return new T.BoxGeometry(0.08, 0.2, 0.2); }), mate(0xc9a57a)));
      var asa = malla(geo('asa', function () { return new T.TorusGeometry(0.05, 0.008, 6, 16, Math.PI); }), mate(0xa98557), 0, 0.1, 0); asa.rotation.y = Math.PI / 2; bolsa.add(asa);
      brazos[1].add(bolsa);
    }

    // Cabezota ovalada sin cara, con orejitas.
    cuerpo.add(malla(geo('cuello', function () { return new T.CylinderGeometry(0.06, 0.065, 0.08, 20); }), piel, 0, 1.08, 0));
    // La cabeza cuelga de la nuca para mecerse al andar.
    var nuca = new T.Group(); nuca.position.set(0, 1.1, 0); cuerpo.add(nuca);
    var cab = new T.Group(); cab.position.set(0, 0.245, 0); nuca.add(cab);
    var crane = malla(geo('craneo', function () { return new T.CapsuleGeometry(CR, CL * 2, 16, 40); }), piel); crane.scale.set(1, 1, 0.92); cab.add(crane);
    [-1, 1].forEach(function (lado) { var or = malla(esfera(0.045), piel, lado * 0.228, -0.02, -0.01); or.scale.set(0.55, 1, 0.85); cab.add(or); });
    var coletero = mate(o.coletero || 0xf08a9c), coleta = null;
    var pelosZ = function (m) { m.scale.set(1, 1, 0.92); cab.add(m); return m; };

    if (o.peinado === 'mono') {
      pelosZ(malla(casquete('pMono', borde(0.15, -0.12, 0.04), function (phi, y) { return 0.012 * Math.cos(phi * 14) * campana(phi, 0, 1.2) * (y > 0.12 ? 1 : 0); }), pelo));
      var mono = malla(esfera(0.11), pelo, 0, 0.31, -0.07); mono.scale.set(1, 0.92, 1); cab.add(mono);
      var nudo = malla(geo('nudo', function () { return new T.TorusGeometry(0.08, 0.032, 12, 28); }), pelo, 0, 0.27, -0.065); nudo.rotation.x = Math.PI / 2 - 0.35; cab.add(nudo);
      var scr = malla(geo('scrunchie', function () { return new T.TorusGeometry(0.085, 0.022, 10, 28); }), coletero, 0, 0.235, -0.06); scr.rotation.x = Math.PI / 2 - 0.35; cab.add(scr);
      [-1, 1].forEach(function (lado) { cab.add(malla(mechon('mechonL' + lado, [[lado * 0.17, 0.16, 0.12], [lado * 0.215, 0.02, 0.1], [lado * 0.2, -0.12, 0.09]], 0.03, 0.01), pelo)); });
    } else if (o.peinado === 'coleta') {
      // Raya al lado, pelo liso que tapa las sienes y coleta con gracia.
      pelosZ(malla(casquete('pColeta', function (phi) { return borde(0.13, -0.1, 0.0)(phi) - 0.04 * campana(phi, 0.55, 0.4) - 0.03 * campana(phi, -0.6, 0.35); },
        function (phi, y) { return -0.008 * campana(phi, 0.3, 0.07) * (y > 0.12 ? 1 : 0) + 0.012 * campana(phi, -0.3, 0.5) * (y > 0.1 ? 1 : 0); }), pelo));
      cab.add(malla(esfera(0.048), coletero, 0, 0.14, -0.23));
      coleta = new T.Group(); coleta.position.set(0, 0.14, -0.22); cab.add(coleta);
      coleta.add(malla(mechon('coleta', [[0, 0.14, -0.22], [0, 0.16, -0.32], [0, 0.04, -0.37], [0, -0.12, -0.33], [0, -0.2, -0.28]], 0.088, 0.03), pelo, 0, -0.14, 0.22));
    } else if (o.peinado === 'gorra') {
      var gm = mate(o.gorra);
      pelosZ(malla(casquete('pGorra', borde(0.12, -0.14, 0.0), function () { return 0; }), pelo));
      pelosZ(malla(casquete('gorra', borde(0.1, 0.06, 0.08), function () { return 0.012; }), gm));
      cab.add(malla(esfera(0.025), gm, 0, 0.35, 0));
      var vis = malla(esfera(0.2), gm, 0, 0.1, 0.17);
      vis.scale.set(1, 0.11, 1.05); vis.rotation.x = 0.3; cab.add(vis);
    } else {
      // Corto con tupé suave peinado hacia un lado y mechas marcadas.
      pelosZ(malla(casquete('pCorto', function (phi) { return borde(0.17, -0.16, 0.05)(phi) - 0.055 * campana(phi, -0.35, 0.5) + 0.02 * campana(phi, 0.45, 0.3); },
        function (phi, y) { return (0.11 * campana(phi, 0.15, 0.6) + 0.01 * Math.sin(phi * 9)) * Math.max(0, Math.min(1, (y - 0.1) / 0.15)) * campana(phi, 0, 1.6); }), pelo));
      cab.add(malla(mechon('flequillo2', [[0.12, 0.23, 0.13], [0.02, 0.215, 0.172], [-0.09, 0.18, 0.172], [-0.17, 0.11, 0.13]], 0.05, 0.016), pelo));
    }
    if (opc.casco) { // casco de obra encima del pelo
      var cm = mate(opc.casco === true ? 0xf2c230 : opc.casco);
      pelosZ(malla(casquete('casco', borde(0.12, 0.02, 0.07), function () { return 0.04; }), cm));
      var ala = malla(esfera(0.2), cm, 0, 0.11, 0.15); ala.scale.set(0.95, 0.08, 0.8); ala.rotation.x = 0.15; cab.add(ala);
    }
    cuerpo.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    g.userData = { cuerpo: cuerpo, piernas: piernas, brazos: brazos, bolsa: bolsa, nuca: nuca, coleta: coleta };
    return g;
  }

  // Paso de muñequito: pasitos cortos con rebote, contoneo de lado a lado, brazos que se balancean,
  // la cabeza se mece con algo de retraso y la coleta salta. fase en radianes.
  function caminar(g, fase) {
    var u = g.userData, s = Math.sin(fase), c = Math.cos(fase), b = Math.abs(c), apoyo = 1 - b;
    u.piernas[0].rotation.x = s * 0.42; u.piernas[1].rotation.x = -s * 0.42;
    u.brazos[0].rotation.x = -s * 0.5; u.brazos[1].rotation.x = s * 0.5;
    u.brazos[0].rotation.z = -0.26 - b * 0.08; u.brazos[1].rotation.z = 0.26 + b * 0.08;
    u.cuerpo.position.y = b * 0.05;
    u.cuerpo.rotation.set(0.04, 0, s * 0.07);
    u.cuerpo.scale.set(1 + apoyo * 0.03, 1 - apoyo * 0.035, 1 + apoyo * 0.03);
    u.nuca.rotation.set(-0.04 + b * 0.06, Math.sin(fase - 0.6) * 0.08, -Math.sin(fase - 0.5) * 0.12);
    if (u.coleta) u.coleta.rotation.set(-0.15 + apoyo * 0.35, 0, Math.sin(fase - 1.1) * 0.4);
  }

  window.SimuLab.Persona = { crear: persona, caminar: caminar };
})();
