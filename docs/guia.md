# Guía de uso de gatos.pics

Todo lo que el creador y el visor saben hacer, explicado sin prisa.

**Índice**

1. [Instalar (si a eso se le puede llamar instalar)](#1-instalar)
2. [Modo Básico](#2-modo-básico)
3. [Modo Video](#3-modo-video)
4. [Modo Avanzado](#4-modo-avanzado)
5. [El visor, tecla por tecla](#5-el-visor-tecla-por-tecla)
6. [S2 (SSIMULACRA2) en lenguaje claro](#s2-ssimulacra2-en-lenguaje-claro)
7. [Exportaciones y proyectos](#7-exportaciones-y-proyectos)
8. [Privacidad](#8-privacidad)
9. [Preguntas frecuentes](#9-preguntas-frecuentes)

---

## 1. Instalar

No hay nada que instalar. Descarga **`dist/gatos.html`** (un solo archivo) y
ábrelo con doble clic · se abre en tu navegador y ya es todo el programa:
creador, visor, motor de captura y S2 incluidos. Funciona sin internet.

Si prefieres la versión en carpeta (por ejemplo para desarrollo), clona el repo
y abre `app/index.html`.

## 2. Modo Básico

Para cuando solo quieres comparar imágenes y nada más.

1. Suelta **todas** tus capturas de una vez en la zona grande (o haz clic para
   explorar).
2. Si los nombres dicen la versión y el cuadro, se agrupan solas: una fila por
   cuadro con todas sus versiones, sean 2, 3 o más. Sirven `fuente_01.png`,
   `Encode - 01.png`, `encode (1).png` o `01_encode.png`. La referencia
   (fuente, src, máster) queda a la izquierda. Los nombres de las versiones
   se pueden corregir arriba de las filas, y con **+ versión** agregas otra a
   mano.
3. Si los nombres no dan pista, se ordenan por nombre y cada **dos imágenes**
   forman un par: la primera a la izquierda, la segunda a la derecha.
4. Reordena con ↑↓, borra con ×, y si te sobra una imagen suéltala: completa
   el hueco de la última fila automáticamente.
5. **Vista previa** arriba a la derecha, y exporta con los botones que aparecen
   cuando los pares están completos.

Si dejas un par a medias, la página te avisa antes de exportar. Si mezclas
tamaños de imagen, también: el diff y los recortes 1:1 necesitan dimensiones
idénticas.

## 3. Modo Video

De los archivos de video a la comparación, sin capturar nada a mano.

1. Suelta el **máster** primero y los encodes después (el orden se ajusta con
   ↑↓; el primero siempre es la referencia).
2. Reproduce el máster, pausa donde quieras comparar, y dale **Marcar aquí**.
   Repite para cada momento: cada marca es un chip que puedes re-visitar con
   un clic o quitar con su ×.
3. 4. **Capturar todo**: la herramienta hace una captura en el instante pedido
   de cada video. No garantiza que dos archivos estén alineados por frame.
   Cada marca muestra la variante y su resultado; las fallas incluyen el motivo.
   Al terminar, "Seguir en Avanzado" te deja revisar las
   capturas en la tabla.

Consejos:

- Busca momentos difíciles: escenas oscuras, grano fino, degradados, acción.
- Para que las capturas de dos videos con distinto corte coincidan, marca en el
  máster y verifica a ojo en los otros antes de capturar todo.
- **Límites honestos**: se puede abrir lo que tu navegador decodifica (MP4 /
  WebM / MOV con H.264 / VP9 / AV1 van bien; HEVC depende de la plataforma;
  MKV casi solo Firefox). El HDR pasa por la conversión del navegador:
  consistente entre variantes (todas ven lo mismo), pero no es un pipeline
  controlado: para comparaciones exigentes de HDR usa capturas de tu propio
  proceso.

## 4. Modo Avanzado

Cinco pasos a la izquierda; puedes saltar entre ellos cuando quieras.

### Proyecto
Título (opcional: la página se ve mejor con uno) y versión para romper
caché cuando hospedas la carpeta.

### Variantes
Una por versión que comparas. La primera es la **referencia** (izquierda por
defecto); la segunda va a la derecha. Campos: nombre, codec, CRF, bitrate y una
nota libre (lo que llenes se muestra en el botón de la página final, unido con
puntos medios: `AV1 · CRF 26 · 8.3 Mb/s`). El comando completo del encoder
aparece como tooltip al dejar el cursor sobre el botón. El punto de color se
cicla con un clic.

### Frames
Un renglón por momento capturado. El **número** es el identificador que va en
los nombres de archivo (`variante_6052.png`); la **etiqueta** es el nombre
bonito del botón (`escena oscura`).

### Imágenes
La tabla variantes × frames (completa: cada variante necesita su imagen en
cada frame; las variantes parciales existen solo en los `.cmp` que se suben con
`frames`, ver más abajo). Tres formas de llenarla:

- **Volcado mágico**: suelta todos los archivos de golpe nombrados
  `variante_numero.png`: lo que no exista (variante o frame) se crea solo del
  nombre. `blu-ray_1001.png` crea la variante "Blu Ray" y el frame 1001.
- Clic en una casilla para elegir un archivo suelto, o arrastra uno encima.
- Los que no se pudieron emparejar quedan en "Archivos sin asignar" con su
  motivo y dos menús para acomodarlos a mano.

### Final
La lista de revisión: casillas vacías, tamaños mezclados, campos opcionales
pendientes (en rojo lo que rompe, en ámbar lo que solo afeita). Abajo, las
exportaciones y el toggle de S2.

## 5. El visor, tecla por tecla

La página que se lleva quien abre tu export.

| Atajo | Acción |
|---|---|
| `←` / `→` | frame anterior / siguiente |
| `Espacio` | siguiente variante en el lado derecho |
| `1`–`9` | saltar a la variante N (`Shift` = lado izquierdo) |
| `S` | intercambiar izquierda y derecha |
| `D` | **diff amplificado**: dónde golpea el encode |
| `B` | **parpadeo** A/B a 2 Hz |
| `G` | **modo ciego**: oculta qué variante es cuál |
| `L` | **curva solar**: revela banding |
| `C` | **recortes 1:1**: clic en un punto, todas las variantes píxel a píxel |
| `O` / `F` | 1:1 real / ajustar a la ventana |
| `N` | escala en píxeles nítidos (sin suavizado) |
| `+` / `−` | ganancia del diff |
| `H` | modo calor del diff |
| `?` / `Esc` | abrir ayuda / cerrar el panel abierto |
| `R` | revelar identidades en modo ciego |
| `,` / `.` | mover el divisor (con `Shift` da saltos) |
| rueda / pellizco | zoom anclado al cursor · arrastrar = mover · doble clic = ajustar |
| deslizar (teléfono) | con la vista ajustada, cambia de frame; las flechas junto a la tira hacen lo mismo |

- **Diff**: la diferencia entre las dos variantes amplificada ×5–×40; el color
  indica el canal que difiere. Con `H`, lo que supera cierto umbral se pinta
  rojo.
- **Ciego**: mezcla el orden de las variantes y les asigna números estables
  durante la sesión de esta pestaña, también en los recortes y atajos.
  Oculta nombres, notas, estadísticas, comandos y metadatos. Usa **Revelar**,
  `R` o `G` para ver las identidades de las imágenes elegidas.
  La asignación ciega no se incluye en el enlace. El PNG conserva las etiquetas
  anónimas; quien abra el enlace podrá ver las identidades. Las imágenes y el
  manifiesto siguen siendo inspeccionables: es una ayuda para juzgar sin sesgo.
- **Solar**: curva no lineal que convierte degradados suaves en escalones
  gigantes: el banding salta a la vista.
- Fuera del modo ciego, el estado (frame, variantes, zoom, divisor, modo) vive
  en la URL: cópiala para compartir la vista.

### La imagen para compartir se crea sola

Al publicar, el creador dibuja la imagen de «Compartir» (vista partida del
primer cuadro con las dos primeras versiones, etiquetas e insignia) y la sube
con la llave de la página. Los códigos para foros del recibo pasan a usarla en
cuanto está lista; si no se pudo crear, siguen con la primera imagen y puedes
hacerla desde la página con «Compartir». Para cambiarla por otra vista, usa
«Compartir» en la página con tu llave.

### Progreso al publicar o actualizar una imagen

**Publicar** y **Subir y obtener BBCode** muestran los MiB enviados y el
porcentaje. Al llegar a 100 %, esperan la confirmación del servidor.
**Cancelar envío** detiene la conexión; si el servidor ya recibió los datos,
puede haber creado la página o actualizado la imagen. El mensaje lo indica.
Los errores temporales permiten reintentar manualmente el mismo paquete o PNG.
Reintentar una publicación puede crear otra página; una imagen compartida
reemplaza la misma URL. Si la llave es incorrecta, corrígela antes de volver a subir.

### Actualizar una página ya publicada

Si publicaste una comparación y después cambia algo (terminó otra variante,
corregiste un frame, calculaste S2), no hace falta un enlace nuevo: abre tu
proyecto, pulsa **Actualizar página** (arriba, junto a Publicar; también en el
último paso del asistente), pega el enlace de la página y confirma. El
contenido se reemplaza entero, el enlace y la llave de borrado siguen siendo
los mismos, y los foros que ya lo enlazaban muestran la versión nueva.

- Se usa la llave de borrado que este navegador guardó al publicar esa página
  (dura mientras la pestaña siga abierta) o tu llave API; si no hay ninguna, el
  creador te la pide.
- La versión del proyecto sube sola en el servicio: no hace falta tocarla.
- Si falla (llave incorrecta, paquete inválido, se cortó la conexión), la
  página anterior sigue publicada tal cual. Reintentar es seguro: vuelve a
  reemplazar la misma página.
- La imagen compartida (BBCode) se actualiza aparte, desde el botón Compartir
  de la propia página, como antes.

Si una variante solo tiene imágenes de algunos de los frames (el encode de otra
persona salió de un clip más corto), se declara con `frames` en esa variante y
la página la muestra solo donde tiene imagen: en los demás frames su panel dice
"Esta variante no tiene este cuadro" y su botón se ve atenuado (se puede elegir
igual). Lo declara el `.cmp` que subes con tu script; el creador no lo hace.
Detalle en `formato-cmp.md`.

Si lo que cambia es una sola variante (terminó otro encode de la escalera), un
script tuyo puede mandar solo esas imágenes con `PATCH /api/page/<código>` en
vez de reenviar todo: se suman, se reemplazan o se quitan variantes y el resto
de la página queda como estaba. El detalle está en `formato-cmp.md`. El
creador todavía no tiene un botón para esto.

## S2 (SSIMULACRA2) en lenguaje claro

S2 es una métrica de calidad de imagen pensada para encode: mide qué tanto se
degradó una imagen respecto a su original, ponderando lo que el ojo humano
realmente nota (estructura, bordes, color) en vez de contar píxeles como una
máquina. **100 significa idéntico; menos puntos, más daño.**

De un vistazo:

| Puntaje | Lo que suelen significar tus ojos |
|---|---|
| **95–100** | No encontrarás la diferencia ni buscándola. |
| **85–95** | Imperceptible en uso normal; visible solo con diff amplificado o zoom extremo. |
| **70–85** | Diferencia fina perceptible al comparar lado a lado (grano más suave, textura). A menudo un buen encode. |
| **55–70** | Se nota mirando con atención: detalle perdido, bordes blandos. |
| **35–55** | Degradación clara a simple vista en escenas difíciles. |
| **≤ 0** | Maltrato: bloqueos, anillos, perdida grave de detalle. |

Matices que importan:

- **El grano engaña al número**. El ruido fino mueve el puntaje hacia abajo más
  de lo que molesta al ojo: un encode con síntesis de grano puede verse mejor
  de lo que su S2 sugiere. Compara encodes entre sí con el mismo tratamiento.
- **Compara manzanas con manzanas**. Los puntajes son comparables dentro de la
  misma fuente y el mismo conjunto de frames; no cruces rungs de eras o
  pipelines distintos y saques conclusiones absolutas.
- **Lo que ves vs lo que mides**. Un número nunca reemplaza tus ojos: usa S2
  para ordenar candidatos y el visor (diff, recortes, ciego) para decidir.
- En gatos.pics el S2 se calcula sobre las capturas tal cual (RGB 8 bit):
  comparar rungs entre sí es lo fiable; no lo compares con números producidos
  por otras rutas de la métrica.

Cómo se usa en el creador: marca **Calcular S2** en el paso Final, exporta, y
cada variante lleva su puntaje por frame y su media (visibles en la página
final bajo el nombre de cada variante).

## 7. Exportaciones y proyectos

| Formato | Qué es | Cuándo |
|---|---|---|
| **HTML de un solo archivo** | Motor + imágenes dentro de un .html | Mandar por chat, guardar, archivar |
| **Carpeta .zip** | `index.html` + `compare.js` + `manifest.json` + `img/` | Hospedar en cualquier servidor estático o GitHub Pages |
| **.cmp** | JSON: manifiesto + imágenes | Reabrir en el creador, o publicar en el servicio gatos.pics cuando abra |

- **Guardar proyecto** (Ctrl+S) baja un `.cmp` con todo tu trabajo; **Abrir**
  (o soltar el archivo en la ventana) lo restaura (incluidas las imágenes).
- La versión del proyecto rompe la caché cuando hospedas la carpeta y subes
  una revisión: súbela con +1.
- El peso del .html crece con las imágenes (van embebidas en base64). Para
  páginas de muchas capturas considera el .zip hospedado.

## 8. Privacidad

No hay nada que contar porque no hay a quién: el programa es un archivo local
sin red. Las imágenes se leen con las APIs de archivo del navegador, se
procesan en memoria y se embeben en el HTML que tú descargas. Sin telemetría,
sin analítica, sin llamadas a ningún servidor. Si quieres comprobarlo, abre el
archivo y léelo: son unos miles de líneas de JS plano sin una sola dirección
remota.

## 9. Preguntas frecuentes

**¿Necesito internet?**
No. Ni para crear ni para ver las páginas exportadas.

**¿Se puede usar en el teléfono?**
Ver páginas: sí. En el teléfono las herramientas y los selectores de variante
quedan abajo, al alcance del pulgar; desliza a los lados para cambiar de frame,
pellizca para acercar, arrastra el divisor y usa el botón **cmd** para leer el
comando de una variante. La página arranca ajustada a la pantalla; 1:1 queda a
un toque. Crear: mejor en computadora (arrastrar archivos es del ratón), pero el
creador también se acomoda al teléfono: pestañas y acciones grandes, pares en
dos columnas y la tabla de imágenes con su quitar siempre visible.

**¿Por qué mi video no abre?**
Tu navegador no lo decodifica (códec o contenedor). Prueba en otro navegador o
convierte a MP4 H.264. El mensaje junto al reproductor te lo dice.

**¿Por qué salen distintas las capturas de dos videos?**
Cortes o fps distintos: el mismo segundo puede caer en frames vecinos. Marca
en el máster y verifica en los otros antes de capturar todo.

**¿Mi comparación con 50 frames va a pesar?**
El .html embebido crece rápido (~1.3× el peso de las imágenes). Para páginas
grandes usa el .zip hospedado, o JPEG para las capturas.

**¿Puedo confiar en el S2 del navegador?**
Es el mismo algoritmo que la implementación de referencia (mismos números a
cuatro decimales sobre las mismas imágenes 8-bit). Lo que cambia entre rutas
de la métrica es el pipeline de entrada, no la matemática.
