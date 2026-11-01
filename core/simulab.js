/* SimuLab · core/simulab.js
 * Espacio de nombres común, utilidades y progreso guardado.
 * El motor (core/) no sabe nada de mermeladas ni de unidades concretas:
 * el mundo se describe en mundo/ y cada unidad en unidades/<ut>/.
 */
(function () {
  'use strict';
  var SL = window.SimuLab = window.SimuLab || {};

  SL.unidades = {};          // se rellenan con SL.registrarUnidad()
  SL.imagenes = SL.imagenes || {}; // en la versión de un solo archivo, recursos incrustados

  SL.recurso = function (ruta) { return SL.imagenes[ruta] || ruta; };

  SL.registrarUnidad = function (u) { SL.unidades[u.id] = u; };

  SL.sinMovimiento = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- utilidades ----------
  SL.$ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  SL.el = function (tag, clase, html) {
    var e = document.createElement(tag);
    if (clase) e.className = clase;
    if (html != null) e.innerHTML = html;
    return e;
  };
  SL.barajar = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  // Azar con semilla fija: el mismo mundo siempre igual.
  SL.azar = function (semilla) {
    var s = semilla >>> 0 || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  };

  // El progreso guardado (por equipo) vive en core/sesion.js → SL.progreso.
})();
