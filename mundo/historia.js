/* SimuLab · mundo/historia.js
 * Personajes y prólogo comunes a todas las unidades.
 * Reparto: María pone el problema · Alberto pone el estándar profesional · el alumno pone la solución.
 * Mínimo de personajes: solo Alberto y María. La madre de María solo se nombra.
 * Frases cortas: una idea por bocadillo.
 */
(function () {
  'use strict';
  var SL = window.SimuLab;

  SL.historia = {
    personajes: {
      alberto: {
        nombre: 'Alberto', etiqueta: 'Dual & Co.', rol: 'Tu jefe · Director de Dual & Co.',
        gestoBase: 'explica',
        gestos: { explica: 'ALB_01', senala: 'ALB_02', pulgar: 'ALB_03', pensativo: 'ALB_04', ojo: 'ALB_05', celebra: 'ALB_06' }
      },
      maria: {
        // Imágenes pendientes: cuando lleguen, añadir aquí los gestos (p. ej. explica: 'MAR_01').
        nombre: 'María', etiqueta: 'Mermeladas de mi Abuela', rol: 'Tu clienta · 21 años',
        color: '#d6455d', gestos: null
      }
    },

    portada: {
      ante: 'Aprende jugando en un almacén',
      modulo: 'Operaciones Auxiliares de Almacenaje',
      caso: 'Caso real: Mermeladas de mi Abuela ✦ Dual & Co.'
    },

    prologo: [
      { quien: 'alberto', gesto: 'explica', texto: '¡Equipo! Tenemos cliente nuevo.' },
      { quien: 'alberto', gesto: 'senala', texto: 'Se llama **Mermeladas de mi Abuela**. Una fábrica de mermeladas de pueblo.' },
      { quien: 'maria', texto: '¡Hola! Soy María. Tengo 21 años.' },
      { quien: 'maria', texto: 'Mi madre empezó con la receta de mi abuela. Ahora se jubila y la empresa es mía.' },
      { quien: 'maria', texto: 'Un supermercado quiere nuestras mermeladas en **40 tiendas**.' },
      { quien: 'maria', texto: 'Tenemos que vender 10 veces más. Y mi almacén… es un caos.' },
      { quien: 'alberto', gesto: 'pensativo', texto: 'Vosotros sois la consultora. Vamos a ayudar a María.' },
      { quien: 'alberto', gesto: 'senala', texto: 'Cada número es una parte del almacén. Empezamos por el **3**.' }
    ],

    mapa: {
      bienvenida: { quien: 'alberto', gesto: 'senala', texto: 'Toca el **3** para empezar. Puedes mover el almacén con el ratón.' },
      vista: { quien: 'alberto', gesto: 'ojo', texto: 'Esto ya lo visteis en clase. Muy pronto podréis repasarlo aquí.' },
      bloqueada: { quien: 'alberto', gesto: 'pensativo', texto: 'Todavía no. Primero, el almacenaje.' },
      explorar: { quien: 'alberto', gesto: 'ojo', texto: 'Toca cualquier máquina o edificio para ver qué es.' }
    },

    creditos: {
      titulo: 'SimuLab ✦ Operaciones Auxiliares de Almacenaje',
      autor: 'Alberto Sánchez Cabanillas · Docente de Comercio y Marketing',
      web: 'https://albertosanchezcabanillas.vercel.app/',
      licencia: 'Contenido: CC BY-NC-SA 4.0 · Three.js (MIT) · Inter y Bricolage Grotesque (SIL OFL 1.1)'
    }
  };
})();
