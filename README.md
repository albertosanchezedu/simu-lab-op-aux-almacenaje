# SimuLab ✦ Operaciones Auxiliares de Almacenaje

Mundo 3D para aprender **Operaciones Auxiliares de Almacenaje** (FP Grado Básico Servicios Comerciales) jugando.
Caso: **Serenitos** (crema de queso de oveja, Santa Aurelia). La receta es de la abuela Manuela; Carmen, la madre, se jubila y María (21) se queda la nave justo cuando un supermercado pide 40 tiendas (× 10). El alumnado es el equipo de la consultora **Dual & Co.**: María (la clienta) pone el problema, Alberto (el jefe) pone el estándar profesional y el alumno pone la solución.

No da nota: es «el libro sin ser un libro». Las actividades y exámenes van aparte.

## Abrir
- **Web**: `index.html` (sin CDN: Three.js r149 y las fuentes van en el repositorio).
- **Un solo archivo** (Moodle o vista previa): `python3 herramientas/construir_autonomo.py` → `dist/simulab-op-aux-almacenaje.html`.

## Estructura
| Carpeta | Qué hay |
|---|---|
| `core/` | Motor común: `mundo3d.js` (maqueta 3D, cámara, vida, zonas, día/noche), `guia.js` (bocadillos), `juego.js` (preguntas: tocar zona, elegir, verdadero/falso, ordenar), `sesion.js` (equipos y código de partida), `app.js` (portada, mapa de unidades, misiones), `estilo.css` |
| `mundo/` | El mundo común: `mundo.js` (recinto, zonas, máquinas, rutas de los vehículos, situación de las 5 unidades) e `historia.js` (personajes, prólogo, textos) |
| `unidades/utN-*/` | **Una carpeta por unidad**, independiente. Solo datos: misiones y bancos de preguntas |
| `vendor/` | Three.js r149 |
| `assets/` | Fuentes y personajes (PNG sin fondo) |

### Mapa: las 5 unidades en el almacén
El almacén sigue el camino de la mercancía, de izquierda a derecha:

| N.º | Zona | Unidad | Estado |
|---|---|---|---|
| 1 | Recepción | UT1 · Recepción de mercancías | Vista en clase · contenido pendiente |
| 2 | Control y etiquetado | UT2 · Etiquetas y codificación | Vista en clase · contenido pendiente |
| 3 | Almacenaje | **UT3 · Almacenaje de mercancías** | **En desarrollo** (misión 1 jugable) |
| 4 | Oficina | UT4 · Control de existencias | Bloqueada |
| 5 | Expedición | UT5 · Expedición de mercancías | Bloqueada |

## Añadir una misión o una unidad
1. Copia el formato de `unidades/ut3-almacenaje/ut3.js` (tipos de paso al principio del archivo).
2. Las misiones **nunca se reordenan**: las nuevas, al final (el código de partida guarda las estrellas por posición).
3. Una unidad nueva: crea su `utN.js`, regístrala con `SimuLab.registrarUnidad({...})` y añade su `<script>` en `index.html` **antes** de `core/sesion.js`.

## Equipos y partida guardada
- Cada pareja crea un **equipo** (nombre + n.º de ordenador + clave de 4 números). Varios grupos pueden usar el mismo PC.
- «Guardar partida» da un **código** con el progreso dentro: sirve para seguir en otro ordenador (código + nombre + clave).
- De momento está en **modo pruebas** (se entra como invitado). Para pedir equipo al entrar: en `core/sesion.js`, `SL.config.pedirSesion = true`.

## Personajes
Solo **Alberto** (PNG ALB_01…06) y **María** (pendiente: silueta provisional). Cuando lleguen sus imágenes: `assets/personajes/MAR_0N.png` y sus gestos en `mundo/historia.js`.
Identidad: la paleta de María y Serenitos (mostaza, blanco y frambuesa: `--sl-*` en `core/estilo.css` y `mundo/mundo.js`).

**Recorrido** (igual que Cubic Lab): portada → almacén (mapa central con las unidades) → capítulos de la unidad → pantalla intermedia → capítulo. Cada capítulo lleva obligatoriamente un paso `cuaderno` (teoría para copiar, proyectada).

---
SimuLab (marca y `core/`) © Alberto Sánchez Cabanillas · Todos los derechos reservados.
Contenido: Alberto Sánchez Cabanillas · CC BY-NC-SA 4.0 · Three.js (MIT) · Inter y Bricolage Grotesque (SIL OFL 1.1)
