/* SimuLab · mundo/mundo.js
 * El MUNDO común a todas las unidades: la nave de Serenitos (crema de queso de oveja) a las afueras de Santa Aurelia.
 * Solo datos. Medidas en metros. Plano visto desde arriba: x de izquierda a derecha,
 * z de atrás (norte, fábrica) hacia delante (sur, carretera).
 * El flujo de la mercancía va de izquierda a derecha: ① recepción → ② control → ③ almacenaje → ④ control de existencias → ⑤ expedición.
 */
(function () {
  'use strict';
  var SL = window.SimuLab;

  // Colores del mundo: la paleta de María y Serenitos (mostaza, blanco, frambuesa) sobre neutros cálidos.
  var ACENTO = '#b8324f', MOSTAZA = '#e3a83f';

  SL.mundo = {
    nombre: 'Serenitos',
    estilo: {
      acento: ACENTO,
      cielo: '#ece9e0', cieloAlto: '#a8c8e0', cieloNoche: '#1d2438',
      suelo: '#e4dccb', cesped: '#d3c08a', campo: '#d4c491', loma: '#c9b67e', loma2: '#a3a476', asfalto: '#cfc9bd',
      losa: '#e7e1d6', sueloNave: '#f8f5ef', muro: '#f3efe8',
      rackPuntal: '#5a4a40', rackLarguero: MOSTAZA, madera: '#d2a96f',
      cajas: ['#c9a06a', '#d8b47e', '#f7f2e8', ACENTO, MOSTAZA],
      arbol: '#a3ad8c', arbol2: '#5e7a4c', fabrica: '#f7f2e8', tejado: MOSTAZA
    },
    suelo: { ancho: 280, fondo: 200 },
    limite: 16,
    camaraInicial: { x: 0, z: -4, dist: 100, az: 0.55, el: 0.62 },

    cesped: [[-42, 13.5, 42, 21], [-40, -40, 40, -34], [26, -20, 42, -12], [-42, -22, -26, -12]],
    // [x1, z1, x2, z2, ancho, rayas]
    carreteras: [
      [-140, 26, 140, 26, 8],
      [-47, 22, -47, -10, 9, false],
      [47, 22, 47, 0, 9, false],
      [-35, -12, -35, 6, 25, false],  // patio de maniobras de recepción
      [35, -3, 35, 13, 25, false]     // patio de maniobras de expedición
    ],

    zonas: [
      { id: 'carga', nombre: 'Carga y descarga', color: '#6f86c9', rects: [[-37, -10.5, -22.8, 4.5], [22.8, -0.5, 37, 11.5]] },
      { id: 'recepcion', nombre: 'Recepción', color: '#3f9ccb', rects: [[-21.7, -11.7, -13.1, 11.7]] },
      { id: 'control', nombre: 'Control y etiquetado', color: '#9a7fd1', rects: [[-13.1, -11.7, -7.3, 11.7]] },
      { id: 'almacenaje', nombre: 'Almacenaje', color: '#e0a33a', rects: [[-7.3, -11.7, 10.9, 11.7]] },
      { id: 'oficinas', nombre: 'Oficina', color: '#8c8f97', rects: [[10.9, -11.7, 21.7, -5.6]] },
      { id: 'preparacion', nombre: 'Preparación de pedidos', color: '#d9744a', rects: [[10.9, -5.6, 16.9, 11.7]] },
      { id: 'expedicion', nombre: 'Expedición', color: '#4f9a63', rects: [[16.9, -5.6, 21.7, 11.7]] }
    ],

    // Las cinco unidades de trabajo, situadas en el mapa.
    unidades: [
      { n: 1, id: 'ut1', titulo: 'Recepción de mercancías', corto: 'Recepción', x: -17.8, z: 0, alto: 6, zona: 'recepcion' },
      { n: 2, id: 'ut2', titulo: 'Etiquetas y codificación', corto: 'Etiquetado', x: -10, z: 2, alto: 13, zona: 'control' },
      { n: 3, id: 'ut3', titulo: 'Almacenaje de mercancías', corto: 'Almacenaje', x: 2, z: -2, alto: 8, zona: 'almacenaje' },
      { n: 4, id: 'ut4', titulo: 'Control de existencias', corto: 'Existencias', x: 16.3, z: -8.6, alto: 7, zona: 'oficinas' },
      { n: 5, id: 'ut5', titulo: 'Expedición de mercancías', corto: 'Expedición', x: 19.3, z: 4, alto: 10, zona: 'expedicion' }
    ],

    objetos: [
      { tipo: 'nave', x: 0, z: 0, ancho: 44, fondo: 24, alto: 6, altoFrente: 1.0,
        muelles: [{ lado: 'oeste', z: -6 }, { lado: 'oeste', z: 1 }, { lado: 'este', z: 2 }, { lado: 'este', z: 8 }],
        info: { nombre: 'Nave del almacén', texto: 'Almacén cubierto de producto terminado. Aquí se guardan los tarritos listos para vender.', datos: [['Superficie', '1.056 m²'], ['Altura', '6 m'], ['Muelles', '4']] } },
      { tipo: 'lineasSuelo', lineas: [[-21.5, 4.8, 10.8, 4.8], [-21.5, 11.3, 21.5, 11.3], [11, -5.4, 21.5, -5.4, 0.16, '#4f9a63']], pasos: [[16, -4.6, 1.6]] },
      // ③ Almacenaje: estanterías convencionales de palés
      { tipo: 'rack', x: -5, z: -3.2, largo: 14, niveles: 3, semilla: 3, info: { nombre: 'Estantería de palés', texto: 'Estantería convencional. Los palés se guardan en alto, por niveles.', datos: [['Niveles', '3'], ['Altura', '5 m'], ['Carga por hueco', '1.000 kg']], anillo: 4 } },
      { tipo: 'rack', x: -1.5, z: -3.2, largo: 14, niveles: 3, semilla: 5, info: { nombre: 'Estantería de palés', texto: 'Estantería convencional. Los palés se guardan en alto, por niveles.', datos: [['Niveles', '3'], ['Altura', '5 m']], anillo: 4 } },
      { tipo: 'rack', x: 2, z: -3.2, largo: 14, niveles: 3, semilla: 8, info: { nombre: 'Estantería de palés', texto: 'Estantería convencional. Los palés se guardan en alto, por niveles.', datos: [['Niveles', '3'], ['Altura', '5 m']], anillo: 4 } },
      { tipo: 'rack', x: 5.5, z: -3.2, largo: 14, niveles: 3, semilla: 13, info: { nombre: 'Estantería de palés', texto: 'Estantería convencional. Los palés se guardan en alto, por niveles.', datos: [['Niveles', '3'], ['Altura', '5 m']], anillo: 4 } },
      { tipo: 'rack', x: 9, z: -3.2, largo: 14, niveles: 3, semilla: 21, info: { nombre: 'Estantería de palés', texto: 'Estantería convencional. Los palés se guardan en alto, por niveles.', datos: [['Niveles', '3'], ['Altura', '5 m']], anillo: 4 } },
      // ① Recepción y ② control
      { tipo: 'palets', semilla: 4, puntos: [[-15.5, 0.5], [-15.5, 2], [-14, 0.5], [-17.5, -9], [-16, -9]] },
      { tipo: 'mesaEtiquetado', x: -10.2, z: -3.5, giro: 0, info: { nombre: 'Puesto de etiquetado', texto: 'Aquí se pesa la caja y se le pone su etiqueta.', datos: [['Equipos', 'Báscula y etiquetadora']] } },
      { tipo: 'palets', semilla: 6, puntos: [[-10.2, -8.5], [-9, 9.2], [-11, 9.2]] },
      // Personas trabajando (chaleco reflectante): se ve qué hace cada uno
      { tipo: 'trabajador', accion: 'etiquetar', x: -10.2, y: 0.21, z: -2.6, giro: Math.PI, semilla: 41,
        info: { nombre: 'Etiquetadora', texto: 'Pesa cada caja y le pone su etiqueta con el código.', datos: [['Herramienta', 'Báscula y etiquetadora']], grupo: 'Personas' } },
      { tipo: 'trabajador', accion: 'revisar', x: -16.8, y: 0.21, z: 1.2, giro: -Math.PI / 2, semilla: 43,
        info: { nombre: 'Recepcionista', texto: 'Revisa lo que llega: cuenta las cajas y mira que no estén rotas.', datos: [['Herramienta', 'Lector de códigos'], ['Documento', 'Albarán']], grupo: 'Personas' } },
      { tipo: 'trabajador', accion: 'preparar', x: 12.2, y: 0.21, z: 6.4, giro: Math.PI / 2, semilla: 47,
        info: { nombre: 'Preparador de pedidos', texto: 'Coge las cajas de cada pedido y monta el palé para la tienda.', datos: [['Pedidos', '40 tiendas'], ['Documento', 'Hoja de pedido']], grupo: 'Personas' } },
      // ④ Oficina
      { tipo: 'oficina', x: 16.3, z: -8.65, ancho: 10, fondo: 5.4, info: { nombre: 'Oficina del almacén', texto: 'Desde aquí se controla qué hay en el almacén y qué falta.', datos: [['Puestos', '2 ordenadores']] } },
      // ⑤ Preparación y expedición
      { tipo: 'retractiladora', x: 13.5, z: -1, info: { nombre: 'Retractiladora', texto: 'Envuelve el palé con plástico para que la carga no se mueva.', datos: [['Vueltas', '12 por palé'], ['Tiempo', '90 s']] } },
      { tipo: 'palets', semilla: 9, puntos: [[13, 5.5, 1.57], [13, 7.3, 1.57], [15, 9.5, 1.57], [19.5, -3.5, 1.57], [19.5, -2, 1.57], [19.5, 4.6, 1.57]] },
      // Exterior
      { tipo: 'camion', x: -28, z: 1, giro: Math.PI / 2, cisterna: true, cabina: ACENTO, rotulo: 'LÁCTEOS LA SERENA',
        info: { nombre: 'Camión de la cooperativa', texto: 'Trae la leche de oveja refrigerada. Espera su turno en el muelle 2.', datos: [['Matrícula', '7309 HGT'], ['Carga', 'Leche a 4 °C'], ['Origen', 'La Serena']], anillo: 3 } },
      { tipo: 'fabrica', x: -4, z: -27, ancho: 30, fondo: 12, rotulo: 'Serenitos',
        info: { nombre: 'Obrador', texto: 'Aquí se hace la crema de queso con la receta de la abuela Manuela. Lo que sale va a la nave.', datos: [['Producción', '3.000 tarritos al día'], ['Objetivo', '× 10']], anillo: 6 } },
      { tipo: 'camara', x: 20, z: -25, ancho: 9, fondo: 7, info: { nombre: 'Cámara frigorífica', texto: 'Almacén con frío. Guarda la leche y los tarritos que caducan pronto.', datos: [['Temperatura', '2 a 4 °C'], ['Contenido', 'Leche y crema de queso']], anillo: 3 } },
      { tipo: 'patioAireLibre', x: -33, z: 12, ancho: 11, fondo: 6, info: { nombre: 'Almacén al aire libre', texto: 'Sin techo. Solo para lo que no se estropea: palés vacíos.', datos: [['Palés vacíos', '≈ 60']], anillo: 3 } },
      { tipo: 'cartel', x: -14, z: 20.5, texto: 'Santa Aurelia', logo: 'assets/marca/serenitos-isologo.png' },
      { tipo: 'caseta', x: -55, z: 18, giro: Math.PI / 2 }, { tipo: 'caseta', x: 55, z: 18, giro: -Math.PI / 2 },
      { tipo: 'aparcamiento', x: 4, z: 17, plazas: 7, coches: [0, 1, 3, 5] },
      // muros de piedra seca de la finca (como en la dehesa)
      { tipo: 'muroPiedra', x1: -44, z1: 22, x2: -20, z2: 22, semilla: 3 }, { tipo: 'muroPiedra', x1: -8, z1: 22, x2: 44, z2: 22, semilla: 4 },
      { tipo: 'muroPiedra', x1: -44, z1: -41, x2: 44, z2: -41, semilla: 6 }, { tipo: 'muroPiedra', x1: 44, z1: -41, x2: 44, z2: 6, semilla: 8 },
      { tipo: 'muroPiedra', x1: -44, z1: -41, x2: -44, z2: -10, semilla: 9 },
      { tipo: 'farola', x: -30, z: 21.5 }, { tipo: 'farola', x: -10, z: 21.5 }, { tipo: 'farola', x: 10, z: 21.5 }, { tipo: 'farola', x: 30, z: 21.5 },
      { tipo: 'farola', x: -38, z: -12 }, { tipo: 'farola', x: 38, z: -2 },
      { tipo: 'arbol', x: -38, z: 18 }, { tipo: 'arbol', x: -30, z: 17.5 }, { tipo: 'arbol', x: -22, z: 18 }, 
      { tipo: 'arbol', x: 16, z: 17.5 }, { tipo: 'arbol', x: 26, z: 18 }, { tipo: 'arbol', x: 36, z: 17.5 },
      { tipo: 'arbol', x: -36, z: -38 }, { tipo: 'arbol', x: -26, z: -37 }, { tipo: 'arbol', x: -14, z: -38 }, { tipo: 'arbol', x: 2, z: -37 },
      { tipo: 'arbol', x: 14, z: -38 }, { tipo: 'arbol', x: 30, z: -37 }, { tipo: 'arbol', x: 38, z: -16 }, { tipo: 'arbol', x: 30, z: -14 },
      { tipo: 'arbol', x: -38, z: -18 }, { tipo: 'arbol', x: -30, z: -15 }, { tipo: 'arbol', x: 56, z: 18 }, { tipo: 'arbol', x: -58, z: 17 },
      { tipo: 'arbol', x: 62, z: -6 }, { tipo: 'arbol', x: -62, z: -4 }, { tipo: 'arbol', x: 58, z: -24 }, { tipo: 'arbol', x: -56, z: -26 }
    ],

    // Vida: rutas en bucle. [x, z, { espera, atras, carga, salto }]. capa: solo se ceden el paso los de la misma capa.
    vehiculos: [
      { tipo: 'camion', capa: 'fuera', vel: 6, color: '#f4f2ee', rotulo: 'VIDRIOS DEL GUADIANA', cargaInicial: true,
        info: { nombre: 'Camión del proveedor', texto: 'Trae tarros de cristal vacíos, tapas y etiquetas.', datos: [['Matrícula', '4821 KLM'], ['Carga', '18 palés'], ['Destino', 'Muelle 1']] },
        // llega, pasa el muelle, se para y entra marcha atrás; descarga y sale de frente
        ruta: [[-125, 24.5], [-45, 24.5], [-45, -6], [-52, -6], [-28, -6, { atras: true, espera: 4 }], [-27.9, -6, { atras: true, espera: 6, carga: false }],
               [-49, -6], [-49, 27.5], [-125, 27.5], [-125, 24.5, { salto: true, carga: true }]] },
      { tipo: 'camion', capa: 'fuera', vel: 6, color: '#ffffff', rotulo: 'SERENITOS', inicio: 2,
        info: { nombre: 'Camión hacia el supermercado', texto: 'Se lleva los pedidos a las 40 tiendas.', datos: [['Matrícula', '1156 MBR'], ['Pedido', '22 palés'], ['Destino', 'Plataforma regional']] },
        ruta: [[125, 27.5], [45, 27.5], [45, 8], [52, 8], [28, 8, { atras: true, espera: 4 }], [27.9, 8, { atras: true, espera: 6, carga: true }],
               [49, 8], [49, 24.5], [125, 24.5], [125, 27.5, { salto: true, carga: false }]] },
      { tipo: 'coche', capa: 'fuera', vel: 9, color: '#2f4fa3', inicio: 1, ruta: [[-135, 24.5], [135, 24.5], [135, 27.5, { salto: true }], [-135, 27.5], [-135, 24.5, { salto: true }]] },
      { tipo: 'coche', capa: 'fuera', vel: 8, color: '#e3c04a', inicio: 3, ruta: [[-135, 24.5], [135, 24.5], [135, 27.5, { salto: true }], [-135, 27.5], [-135, 24.5, { salto: true }]] },
      // Dentro de la nave: personas con chaleco (andan por los pasillos)
      { tipo: 'persona', capa: 'peaton', vel: 1.1, chaleco: true, semilla: 31, info: { nombre: 'Mozo de almacén', texto: 'Lleva y trae mercancía entre zonas. Siempre por el pasillo peatonal.', datos: [['Ropa', 'Chaleco y botas de seguridad']] }, ruta: [[-19.5, 9.5, { espera: 3 }], [-9, 9.5, { espera: 2 }]] },
      { tipo: 'persona', capa: 'peaton', vel: 1.0, chaleco: true, casco: true, semilla: 33, info: { nombre: 'Jefa de recepción', texto: 'Comprueba que lo que llega coincide con el pedido.', datos: [['Ropa', 'Chaleco y casco']] }, ruta: [[-20.5, -10.5, { espera: 4 }], [-14, -10.5, { espera: 3 }]] },
      { tipo: 'persona', capa: 'peaton', vel: 1.1, chaleco: true, semilla: 36, info: { nombre: 'Encargado de expedición', texto: 'Revisa que cada palé sube al camión correcto.', datos: [['Herramienta', 'Tablet']] }, ruta: [[12, 10.5, { espera: 3 }], [20.5, 10.5, { espera: 4 }]] },
      { tipo: 'persona', capa: 'peaton', vel: 1.0, chaleco: true, semilla: 38, info: { nombre: 'Preparadora de pedidos', texto: 'Va a por las cajas de cada pedido.', datos: [['Pedidos', '40 tiendas']] }, ruta: [[11.8, -3.5, { espera: 5 }], [11.8, 3.5, { espera: 3 }]] },
      { tipo: 'carretilla', capa: 'dentro', vel: 2.6, color: '#f2b632',
        info: { nombre: 'Carretilla contrapesada', texto: 'Lleva palés pesados. Detrás tiene un contrapeso para no volcar.', datos: [['Carga', 'hasta 2.500 kg'], ['Pasillo', '3 a 4 m']] },
        ruta: [[-20, -6, { espera: 2, carga: true }], [-16, -6], [-16, -2.5, { espera: 2, carga: false }], [-19, -2.5]] },
      { tipo: 'transpaleta', capa: 'dentro', vel: 1.8, color: '#ef8a3c',
        info: { nombre: 'Transpalé eléctrico', texto: 'Mueve palés cerca del suelo. No los sube.', datos: [['Pasillo', '1,5 a 2 m'], ['Carga', '2.000 kg']] },
        ruta: [[-14.5, 6, { espera: 2, carga: true }], [-9.5, 6], [-9.5, 2.5, { espera: 3, carga: false }], [-14.5, 2.5]] },
      { tipo: 'retractil', capa: 'dentro', vel: 2.2, color: '#e3c04a', retractil: true,
        info: { nombre: 'Carretilla retráctil', texto: 'Sube los palés a lo alto de las estanterías.', datos: [['Altura', 'hasta 12 m'], ['Carga', '1 a 3 t']] },
        ruta: [[-6.5, 8, { espera: 2, carga: true }], [0.25, 8], [0.25, -2, { espera: 4, carga: false }], [0.25, 8, { atras: true }], [-6.5, 8.01]] },
      { tipo: 'transpaleta', capa: 'dentro', vel: 1.8, color: '#4f9a63', semilla: 8,
        info: { nombre: 'Transpalé eléctrico', texto: 'Lleva los palés de la estantería a preparación de pedidos.', datos: [['Pasillo', '1,5 a 2 m']] },
        ruta: [[7.25, 3.5, { espera: 2, carga: true }], [7.25, 9.6], [12.8, 9.6, { espera: 2, carga: false }], [7.25, 9.61, { atras: true }]] },
      { tipo: 'carretilla', capa: 'dentro', vel: 2.4, color: '#f2b632', semilla: 12,
        info: { nombre: 'Carretilla contrapesada', texto: 'Sube los pedidos al camión por el muelle.', datos: [['Carga', 'hasta 2.500 kg']] },
        ruta: [[15.6, 2.2, { espera: 2, carga: true }], [18.6, 2.2], [18.6, 8], [20.6, 8, { espera: 2, carga: false }], [18.6, 8.01, { atras: true }], [18.6, 2.21]] }
    ]
  };
})();
