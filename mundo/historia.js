/* SimuLab · mundo/historia.js
 * Textos propios de ESTE simulador: módulo, personajes, prólogo y créditos.
 * Reparto: María pone el problema · Alberto pone el estándar profesional · el alumno pone la solución.
 * Mínimo de personajes: solo Alberto y María. Carmen (la madre) y la abuela Manuela solo se nombran.
 * Frases cortas: una idea por bocadillo.
 */
(function () {
  'use strict';
  var SL = window.SimuLab;

  SL.historia = {
    // Este simulador concreto (la marca SimuLab es común: core/simulab.js)
    modulo: 'Operaciones Auxiliares de Almacenaje',
    ciclo: 'Grado Básico en Servicios Comerciales',

    personajes: {
      alberto: {
        nombre: 'Alberto', etiqueta: 'Dual & Co.',
        gestoBase: 'explica',
        gestos: { explica: 'ALB_01', senala: 'ALB_02', pulgar: 'ALB_03', pensativo: 'ALB_04', ojo: 'ALB_05', celebra: 'ALB_06', cuaderno: 'ALB_01' }
      },
      maria: {
        // Cuando lleguen sus PNG: gestos: { explica: 'MAR_01', senala: 'MAR_02', preocupada: 'MAR_03', piensa: 'MAR_04', cuaderno: 'MAR_05', celebra: 'MAR_06' }
        nombre: 'María', etiqueta: 'Serenitos',
        color: '#e3a83f', pelo: '#4a3226', gestos: null
      }
    },

    prologo: [
      { quien: 'alberto', gesto: 'explica', texto: '¡Equipo! Tenemos cliente nuevo.' },
      { quien: 'alberto', gesto: 'senala', texto: 'Se llama **Serenitos**. Hacen crema de queso de oveja en Santa Aurelia.' },
      { quien: 'maria', texto: '¡Hola! Soy María. Tengo 21 años.' },
      { quien: 'maria', texto: 'La receta es de mi abuela Manuela. Mi madre, Carmen, montó esta nave.' },
      { quien: 'maria', texto: 'Mi madre se jubila. Ahora la nave es cosa mía.' },
      { quien: 'maria', texto: 'Un supermercado quiere nuestros tarritos en **40 tiendas**.' },
      { quien: 'maria', texto: 'Hay que hacer 10 veces más. Y mi almacén… es un caos.' },
      { quien: 'alberto', gesto: 'pensativo', texto: 'Vosotros sois la consultora. Vamos a ayudar a María.' }
    ],

    mapa: {
      bienvenida: { quien: 'alberto', gesto: 'senala', texto: 'Cada número es una parte del almacén. Toca el **3** para empezar.' },
      girar: { quien: 'alberto', gesto: 'ojo', texto: 'Arrastra para girar alrededor de la nave. Con la rueda, te acercas.' },
      vista: { quien: 'alberto', gesto: 'ojo', texto: 'Esto ya lo visteis en clase. Pronto podréis repasarlo aquí.' },
      bloqueada: { quien: 'alberto', gesto: 'pensativo', texto: 'Todavía no. Primero, el almacenaje.' },
      capitulos: { quien: 'alberto', gesto: 'senala', texto: 'Elige un capítulo. Empieza por el primero.' }
    },

    creditos: {
      autor: 'Alberto Sánchez Cabanillas',
      cargo: 'Docente de Comercio y Marketing',
      web: 'https://albertosanchezcabanillas.vercel.app/',
      licencia: 'CC BY-NC-SA 4.0',
      licenciaUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es'
    }
  };
})();
