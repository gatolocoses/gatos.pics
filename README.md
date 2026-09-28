# gatos.pics

**Páginas de comparación de imágenes — locales, gratis y sin subir nada.**

Compara capturas de encodes, remuxes, versiones de streaming o cualquier par de
imágenes con la seriedad de una sala de cine: divisor arrastrable, diff
amplificado, recortes 1:1, zoom hasta 800 %, modo ciego y puntaje S2. Todo corre
en tu computadora; ninguna imagen sale de tu pestaña.

- **Sin cuentas, sin subidas, sin límites** — ni de archivos, ni por día, ni de tamaño.
- **Sin dependencias** — un archivo HTML con JS puro. Sin instalar, sin internet.
- **Linux · Windows · macOS** — cualquier navegador moderno.
- **Tus comparaciones viven para siempre** — el export es un archivo tuyo que
  funciona dentro de diez años igual que hoy.

| Documentación | |
|---|---|
| **[Guía de uso completa](docs/guia.md)** | los tres modos, el visor tecla por tecla, S2 explicado |
| **[Formato .cmp](docs/formato-cmp.md)** | especificación del paquete (el contrato de publicación) |
| **[Desarrollo](docs/desarrollo.md)** | estructura del repo, cómo regenerar, cómo contribuir |

## Empezar en 20 segundos

1. Descarga **`dist/gatos.html`** — un solo archivo, ese es todo el programa.
2. Ábrelo con doble clic. Funciona sin internet y sin instalar nada.
3. Suelta dos imágenes. Ya tienes una comparación.

> Alternativa: clona el repo y abre `app/index.html` — misma cosa, en carpeta.

## Los tres modos

### Básico — pares, nada más
Suelta imágenes; cada dos forman un par (izquierda contra derecha). Sin títulos,
sin configuración. Exporta HTML, carpeta .zip o .cmp cuando quieras.

### Video — de los archivos a la comparación
Suelta el máster y los encodes, marca momentos en la línea de tiempo y la
herramienta **captura el frame exacto de cada variante sola** — sin ffmpeg, sin
capturar a mano. PNG sin pérdida por defecto (para grano), JPEG si prefieres
ligero.

Límites honestos: abre lo que tu navegador sepa decodificar (MP4 / WebM / MOV;
HEVC depende de la plataforma, MKV casi solo Firefox). El HDR pasa por la
conversión del navegador: consistente entre variantes, no controlada — para
páginas de encode exigentes usa capturas de tu propio pipeline.

### Avanzado — para comparaciones serias
- **Variantes** con codec / CRF / bitrate en el botón y el comando del encoder
  como tooltip.
- **Frames** con número y etiqueta (`6052 · escena oscura`).
- **Volcado mágico**: suelta `blu-ray_1001.png` y la variante "Blu Ray" y el
  frame 1001 se crean solos.
- **S2 opcional** (ver abajo).
- Todo campo es opcional — pero la página se ve mejor con ellos, y el creador
  te lo avisa.

## El visor

- Divisor vertical arrastrable · **diff amplificado ×5–×40** con modo calor.
- **Parpadeo A/B** a 2 Hz · **modo ciego** que oculta qué variante es cuál.
- **Curva solar** que convierte el banding en acantilados visibles.
- **Recortes 1:1** de todas las variantes en el punto que elijas.
- Zoom hasta 800 % anclado al cursor, arrastre, escala en píxeles nítidos.
- Estado compartible por URL (`#f=6052&a=src&b=enc&diff=1`).
- En el teléfono: menús desplegables y pellizco.

| Atajo | Acción | Atajo | Acción |
|---|---|---|---|
| `←/→` | frame anterior/siguiente | `Espacio` | siguiente variante |
| `1–9` | variante (`Shift` = izquierda) | `S` | intercambiar |
| `D` | diff | `B` | parpadeo |
| `G` | ciego | `L` | curva solar |
| `C` | recortes 1:1 | `O` / `F` | 1:1 / ajustar |
| `N` | píxeles nítidos | `+/−` | ganancia del diff |
| `H` | modo calor | `,/.` | mover el divisor |

## S2 (SSIMULACRA2) integrado

Con un toggle, el creador puntúa cada frame de cada variante contra la
referencia y la página lo muestra bajo el nombre (`S2 67.0 @6052s · S2 media
57.0`). Es el mismo algoritmo que la implementación de referencia en Python,
corriendo localmente en tu navegador. La
[guía](docs/guia.md#s2-ssimulacra2-en-lenguaje-claro) explica qué significan
los números — el resumen de un vistazo: 100 es idéntico, más de ~85 suele ser
imperceptible, debajo de ~60 ya se nota mirando de cerca.

## Las tres exportaciones

| Formato | Para qué |
|---|---|
| **HTML de un solo archivo** | Se envía por chat, se abre con doble clic, vive sin servidor. |
| **Carpeta .zip** (`index.html` + `img/`) | Cualquier hosting estático: GitHub Pages, nginx, lo que tengas. |
| **Paquete .cmp** | El formato nativo de gatos.pics — súbelo directo al servicio cuando abra al público. |

Los proyectos se guardan y abren como `.cmp` (Ctrl+S / botón Abrir / o suelta
el archivo en la ventana).

## Por qué no slow.pics / comp.pics

Son buenas herramientas — para subirlas todo al servidor de alguien más:

- **Nada se sube**: sin cooldowns de un minuto, sin límites diarios, sin borrado
  a los 2 años por falta de visitas.
- **Zoom de verdad**: los servicios conocidos no tienen zoom ni arrastre — su
  "1:1" es tamaño natural + scrollbar. Aquí hay zoom anclado al cursor,
  arrastre y recortes 1:1.
- **Diff amplificado, calor, ciego y curva solar**: nadie más los ofrece.
- **Del video a la página en un paso**: ellos solo aceptan imágenes ya hechas.
- **Vive para siempre en un archivo**: screenshotcomparison.com e imgsli.com ya
  murieron — lo hospedado se pudre.

## Repo

```
viewer/   el motor (index.html + compare.js) — también sirve hospedado
app/      el creador (index.html + builder.js + s2.js + assets.js generado)
dist/     gatos.html — todo el creador en un solo archivo
tools/    build_app.py (regenera assets.js y dist), make_demo.py
demo/     demo sintética con S2 real, sin material ajeno
docs/     guía de uso, formato .cmp, desarrollo
```

Sin framework, sin build system en uso, sin CDN: HTML, CSS y JS planos.
Después de tocar `viewer/` o `app/`: `python3 tools/build_app.py` — ver
[desarrollo](docs/desarrollo.md).

## Licencia

MIT — ver [LICENSE](LICENSE).
