/* SimuLab · UT3 · Almacenaje de mercancías (RA3)
 * Solo datos. Cada misión: pasos cortos. Tipos de paso:
 *   dialogo  { lineas: [{ quien, gesto, texto, ver: 'zona' }] }   (ver = la cámara vuela y la zona se ilumina)
 *   tocar    { pregunta, correcta: 'zona', pistas: [3], bien }
 *   elegir   { pregunta, enunciado, opciones, correcta: índice, pistas, bien }
 *   vf       { pregunta, enunciado, correcta: true|false, porque }
 *   ordenar  { pregunta, enunciado, items (en el orden correcto), pistas, bien }
 *   repaso   { n, banco: [preguntas] }   (cada vez salen n al azar: se repite lo mismo de muchas formas)
 * etapa = índice de la etapa del marcador de progreso.
 * Las misiones nunca se reordenan: las nuevas se añaden al final (el código de partida depende del orden).
 */
(function () {
  'use strict';
  var SL = window.SimuLab;

  var A = function (gesto, texto, ver) { return { quien: 'alberto', gesto: gesto, texto: texto, ver: ver }; };
  var Ma = function (texto, ver) { return { quien: 'maria', texto: texto, ver: ver }; };

  // Banco de repaso de la misión 1 (zonas del almacén · CE b)
  var bancoZonas = [
    { tipo: 'vf', pregunta: A('pensativo', 'Verdadero o falso. Piensa antes de tocar.'), enunciado: 'En expedición se guarda la mercancía durante meses.', correcta: false, porque: 'Falso. En expedición la mercancía solo espera para salir. Se guarda en almacenaje.' },
    { tipo: 'vf', pregunta: A('pensativo', 'Verdadero o falso.'), enunciado: 'La zona de almacenaje suele ser la más grande del almacén.', correcta: true, porque: 'Verdadero. Es donde se guarda la mercancía: necesita mucho sitio.' },
    { tipo: 'vf', pregunta: A('pensativo', 'Verdadero o falso.'), enunciado: 'La zona de carga y descarga está dentro de la nave.', correcta: false, porque: 'Falso. Está fuera: es donde paran los camiones.' },
    { tipo: 'vf', pregunta: A('pensativo', 'Verdadero o falso.'), enunciado: 'En recepción se comprueba que la mercancía llega bien.', correcta: true, porque: 'Verdadero. Se cuenta y se mira si hay algo roto.' },
    { tipo: 'elegir', pregunta: Ma('Tengo una caja sin etiqueta. ¿A dónde la llevo?'), enunciado: '¿Dónde se pone la etiqueta a la caja?', opciones: ['Control y etiquetado', 'Expedición', 'Carga y descarga'], correcta: 0, porque: 'En control y etiquetado: se revisa y se pone la etiqueta.' },
    { tipo: 'elegir', pregunta: Ma('El supermercado ha hecho un pedido.'), enunciado: '¿Qué zona junta los productos de cada pedido?', opciones: ['Preparación de pedidos', 'Recepción', 'Oficina'], correcta: 0, porque: 'Preparación de pedidos: se junta el pedido y se envuelve.' },
    { tipo: 'elegir', pregunta: Ma('Llega un camión con azúcar.'), enunciado: '¿Cuál es la primera zona de DENTRO de la nave que pisa el azúcar?', opciones: ['Recepción', 'Almacenaje', 'Expedición'], correcta: 0, porque: 'Recepción: lo primero al entrar es revisar.' },
    { tipo: 'elegir', pregunta: A('pensativo', 'Pregunta de jefe.'), enunciado: '¿Para qué sirve la retractiladora?', opciones: ['Envolver el palé con plástico', 'Subir palés a lo alto', 'Pesar las cajas'], correcta: 0, porque: 'Envuelve el palé con plástico para que la carga no se mueva.' },
    { tipo: 'tocar', pregunta: A('ojo', 'Toca la zona donde se guardan las cajas.'), correcta: 'almacenaje', porque: 'Es almacenaje: la zona grande de las estanterías.' },
    { tipo: 'tocar', pregunta: A('ojo', 'Toca la zona por donde sale el pedido al cliente.'), correcta: 'expedicion', porque: 'Es expedición: junto a los muelles de la derecha.' },
    { tipo: 'tocar', pregunta: A('ojo', 'Toca la zona donde aparcan los camiones.'), correcta: 'carga', porque: 'Es carga y descarga: fuera de la nave, en los muelles.' },
    { tipo: 'tocar', pregunta: A('ojo', 'Toca la zona donde se revisa lo que llega.'), correcta: 'recepcion', porque: 'Es recepción: nada más entrar por los muelles de la izquierda.' }
  ];

  SL.registrarUnidad({
    id: 'ut3', n: 3,
    titulo: 'Almacenaje de mercancías',
    descripcion: 'Dónde y cómo se guarda la mercancía, con qué máquinas y con seguridad.',
    misiones: [
      {
        id: 'ut3-zonas', titulo: 'Las zonas del almacén', resumen: 'Cada zona tiene un trabajo', ce: 'b',
        etapas: ['Conocer', 'Localizar', 'Pensar', 'Ordenar', 'Repasar'],
        pasos: [
          { tipo: 'dialogo', etapa: 0, lineas: [
            Ma('Llegan camiones cada día. Dejamos las cajas donde hay hueco.'),
            Ma('Luego nadie encuentra nada.'),
            A('explica', 'Un almacén tiene **zonas**. Cada zona tiene un trabajo.'),
            A('senala', 'Te las enseño una a una. Mira lo que se ilumina.')
          ] },
          { tipo: 'dialogo', etapa: 0, lineas: [
            A('senala', '**Carga y descarga.** Está fuera. Aquí paran los camiones.', 'carga'),
            A('senala', '**Recepción.** Aquí entra la mercancía y se revisa.', 'recepcion'),
            A('senala', '**Control y etiquetado.** Se mira la calidad y se pone la etiqueta.', 'control'),
            A('senala', '**Almacenaje.** Aquí se guarda: en el suelo, en bloques o en estanterías.', 'almacenaje'),
            A('senala', '**Preparación de pedidos.** Se junta cada pedido y se envuelve.', 'preparacion'),
            A('senala', '**Expedición.** Por aquí sale la mercancía hacia el cliente.', 'expedicion'),
            A('senala', 'Y la **oficina**: desde aquí se controla todo.', 'oficinas'),
            A('ojo', 'Ahora te toca a ti. Toca en el almacén.')
          ] },
          { tipo: 'tocar', etapa: 1, pregunta: Ma('Llega un camión con tarros vacíos. ¿Dónde aparca?'), correcta: 'carga',
            pistas: ['¿Dónde cabe un camión: dentro o fuera de la nave?', 'Busca fuera, junto a las puertas grandes de la izquierda.', 'Es **carga y descarga**: fuera, junto a los muelles. Tócala.'],
            bien: '¡Eso es! El camión se queda fuera, pegado al muelle.' },
          { tipo: 'tocar', etapa: 1, pregunta: Ma('Hay que contar las cajas y ver si alguna está rota. ¿Dónde?'), correcta: 'recepcion',
            pistas: ['¿Qué zona está justo al entrar?', 'Está pegada a los muelles de la izquierda, por dentro.', 'Es **recepción**: se revisa nada más entrar. Tócala.'],
            bien: 'Bien. En recepción se revisa todo antes de guardarlo.' },
          { tipo: 'tocar', etapa: 1, pregunta: Ma('Las cajas están bien. ¿Dónde las guardamos?'), correcta: 'almacenaje',
            pistas: ['¿Dónde están las estanterías?', 'Es la zona más grande, en el centro.', 'Es **almacenaje**: la zona de las estanterías. Tócala.'],
            bien: 'Perfecto. Almacenaje es la zona más grande.' },
          { tipo: 'elegir', etapa: 2, pregunta: A('pensativo', 'Pregunta de jefe. Piensa como un profesional.'), enunciado: '¿Qué se hace en recepción?',
            opciones: ['Se revisa la mercancía que llega', 'Se envuelven los pedidos', 'Se cargan los camiones del cliente'], correcta: 0,
            pistas: ['Piensa: la mercancía acaba de llegar.', 'Antes de guardar algo, hay que mirarlo.', 'En recepción **se revisa lo que llega**: cuántas cajas y en qué estado.'],
            bien: 'Exacto. Primero se revisa. Luego se guarda.' },
          { tipo: 'tocar', etapa: 1, pregunta: Ma('El supermercado pide 200 tarros. Hay que juntarlos y envolverlos. ¿Dónde?'), correcta: 'preparacion',
            pistas: ['¿Dónde está la máquina que envuelve los palés?', 'Está entre las estanterías y los muelles de la derecha.', 'Es **preparación de pedidos**. Tócala.'],
            bien: '¡Muy bien! Ahí está la retractiladora: envuelve el palé con plástico.' },
          { tipo: 'tocar', etapa: 1, pregunta: Ma('El pedido está listo. ¿Por dónde sale?'), correcta: 'expedicion',
            pistas: ['Es lo contrario de recepción…', 'Está junto a los muelles de la derecha.', 'Es **expedición**: la salida hacia el cliente. Tócala.'],
            bien: 'Eso es. Por expedición sale la mercancía.' },
          { tipo: 'elegir', etapa: 2, pregunta: A('pensativo', 'Otra de jefe.'), enunciado: '¿Por qué recepción y expedición van en lados distintos?',
            opciones: ['Para que lo que entra no se mezcle con lo que sale', 'Porque queda más bonito', 'Para que los camiones esperen más'], correcta: 0,
            pistas: ['¿Qué pasaría si lo que llega y lo que sale estuvieran juntos?', 'Piensa en cajas mezcladas y errores.', 'Separadas, **lo que entra no se mezcla con lo que sale**. Menos errores.'],
            bien: 'Muy bien pensado. Separar evita errores.' },
          { tipo: 'ordenar', etapa: 3, pregunta: A('explica', 'Último reto. Ordena el camino de un tarro.'), enunciado: '¿Por qué zonas pasa la mercancía? Toca en orden.',
            items: ['Carga y descarga', 'Recepción', 'Almacenaje', 'Preparación de pedidos', 'Expedición'],
            pistas: ['¿Qué pasa primero: llega o sale?', 'Empieza por donde para el camión.', 'Orden: descarga → recepción → almacenaje → preparación → expedición.'],
            bien: '¡Perfecto! Ese es el camino de la mercancía.' },
          { tipo: 'dialogo', etapa: 4, lineas: [A('ojo', 'Repaso rápido. Las preguntas cambian cada vez que juegas.')] },
          { tipo: 'repaso', etapa: 4, n: 4, banco: bancoZonas },
          { tipo: 'dialogo', etapa: 4, lineas: [
            A('celebra', 'Eso es pensar como un profesional del almacén.'),
            Ma('¡Gracias, equipo! Ahora sé dónde va cada cosa.')
          ] }
        ]
      },
      { id: 'ut3-tipos', titulo: '¿Qué tipo de almacén es?', resumen: 'Cubierto, al aire libre, de materias primas…', ce: 'a', proximamente: true },
      { id: 'ut3-maquinas', titulo: 'Las máquinas del almacén', resumen: 'Transpalé, carretillas, retractiladora…', ce: 'e', proximamente: true },
      { id: 'ut3-abc', titulo: '¿Dónde lo coloco?', resumen: 'El criterio ABC', ce: 'c, f', proximamente: true },
      { id: 'ut3-formas', titulo: 'Formas de colocar', resumen: 'Suelo, bloques y estanterías', ce: 'f', proximamente: true },
      { id: 'ut3-ordenes', titulo: 'Órdenes de movimiento', resumen: 'Llevar cada palé a su sitio', ce: 'd, g', proximamente: true },
      { id: 'ut3-seguridad', titulo: 'Seguridad, orden y limpieza', resumen: 'Señales y riesgos', ce: 'h, i', proximamente: true },
      { id: 'ut3-reto', titulo: 'Reto final: almacén × 10', resumen: 'Todo junto', ce: 'a-i', proximamente: true }
    ],
    // Repaso rápido de la unidad: mezcla los bancos de todas las misiones hechas
    bancos: { 'ut3-zonas': bancoZonas }
  });
})();
