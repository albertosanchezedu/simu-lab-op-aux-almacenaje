# CLAUDE.md · SimuLab · Operaciones Auxiliares de Almacenaje

Lee **README.md** antes de nada.

## Reglas de trabajo
- **MÁXIMA**: lo que no es sencillo no se usa; lo complicado no se entiende. Pocas cosas en pantalla y solo lo que toca ahora.
- **Usuario**: Alberto, docente de FP de Comercio y Marketing. Respuestas breves, en castellano, sin introducciones.
- **Alumnado**: Grado Básico, conocimientos casi nulos, muchas NEE, apenas leen. Por eso:
  - frases MUY cortas, una idea por bocadillo, que se despliegan con «Siguiente»;
  - muchas preguntas intermedias, repetidas de muchas formas (tocar zona, elegir, V/F, ordenar);
  - ayuda progresiva en 3 niveles, sin castigar; sin límites de tiempo;
  - todo se puede parar y retomar (progreso guardado por equipo).
- **Personajes: el mínimo**. Solo Alberto y María. No inventar personajes nuevos: cada uno obliga a Alberto a crearlo. Si es imprescindible, pedirlo antes.
- **Estructura del mundo**: World Prompt Pack (mundo, vida, interacción, paneles de cristal, extras). Maqueta low-poly que se note simulada. Personas mini (estilo Cubic, sin cara) con ropa de seguridad: chaleco, botas y casco.
- **Look**: la MISMA interfaz que Cubic Lab, colores incluidos (morados): Cubic Lab es una extracción puntual de Simu Lab. Barra solo con «Simu Lab» (dos palabras). Los colores de Serenitos (mostaza, blanco, frambuesa) solo en el mundo 3D y la historia.
- **Historia**: Serenitos (crema de queso de oveja). Carmen (madre) y Manuela (abuela) solo se nombran.
- **Cada capítulo**: pantalla intermedia al entrar + teoría para copiar en el cuaderno (paso `cuaderno`) + preguntas.
- **Arquitectura**: lo genérico en `core/`; el mundo en `mundo/`; cada unidad en su carpeta `unidades/utN-*/`, independiente.
- **Sin dependencias externas en producción** (nada de CDN): debe abrir en Moodle y GitHub Pages.
- **Contenido** alineado con la programación (RA3, CE a–i para la UT3) y los apuntes de las unidades. Si algo los contradice, avisar.
- Commits pequeños y en castellano. **Se trabaja directamente en `main`** (sin PR): GitHub Pages sale de main. Permiso de Alberto (1/11).
