# gatos.pics

Páginas de comparación de imágenes — **locales, gratis y sin subir nada**.

Compara capturas de encodes, remuxes, versiones de streaming o lo que sea, con la
seriedad de una sala de cine: divisor arrastrable, diff amplificado, recortes 1:1,
zoom hasta 800 %. Todo corre en tu computadora; ninguna imagen sale de tu pestaña.

## Empezar en 10 segundos

1. Descarga **`dist/gatos.html`** (un solo archivo).
2. Ábrelo con doble clic — funciona sin internet, sin instalar nada, en Linux,
   Windows o macOS.
3. Suelta tus capturas y exporta.

> Alternativa: clona el repo y abre `app/index.html`. Misma cosa, en carpeta.

## Dos modos

**Básico** — solo pares. Suelta imágenes; cada dos forman un par (izquierda contra
derecha). Nada más que decidir.

**Avanzado** — para comparaciones de encode serias:

- **Variantes**: fuente, encodes, lo que quieras. Codec, CRF y bitrate van en el
  botón; el comando completo del encoder queda como tooltip.
- **Frames**: número + etiqueta (`6052 · escena oscura`).
- **Volcado mágico**: suelta todos los archivos de golpe — `blu-ray_1001.png`
  crea la variante "Blu Ray" y el frame 1001 solos, y llena su casilla.
- Todo campo es opcional — pero la página se ve mejor con ellos llenos, y el
  creador te lo avisa.

El proyecto se guarda como `.cmp` (Ctrl+S) y se abre de nuevo con el botón
Abrir o soltándolo en la ventana.

## Tres exportaciones

| Formato | Para qué |
|---|---|
| **HTML de un solo archivo** | Se envía por chat, se abre con doble clic, vive para siempre sin servidor. |
| **Carpeta .zip** (`index.html` + `img/`) | Súbela a cualquier hosting estático: GitHub Pages, nginx, lo que tengas. |
| **Paquete .cmp** | El formato nativo de gatos.pics — para publicar directo en el servicio cuando abra al público. |

## El visor

- Divisor vertical arrastrable + **diff amplificado ×5–×40** con modo calor.
- **Parpadeo A/B** a 2 Hz para cazar diferencias a simple ojo.
- **Modo ciego**: oculta qué variante es cuál — juzga sin sesgo de marca.
- **Curva solar**: estira los tonos oscuros y convierte el banding en acantilados
  visibles.
- **Recortes 1:1**: elige un punto, compara píxel por píxel todas las variantes.
- Zoom hasta 800 % con arrastre, ajuste exacto a píxeles del dispositivo.
- Estado compartible por URL (`#f=6052&a=src&b=enc&diff=1`).
- Funciona en el teléfono: menús desplegables, pellizco para zoom.

Atajos: `←/→` frame · `Espacio` siguiente variante · `1–9` variante (`Shift` =
izquierda) · `S` intercambiar · `D` diff · `B` parpadeo · `G` ciego · `L` solar ·
`C` recortes · `O` 1:1 · `F` ajustar · `N` píxeles nítidos · `+/−` ganancia ·
`H` calor · `,/.` divisor.

## Por qué no slow.pics / comp.pics

Son buenas herramientas — para subirlas todo a un servidor de alguien más. Con
gatos.pics la comparación es tuya:

- **Nada se sube**: sin cuentas, sin cooldowns de un minuto, sin límites
  diarios, sin borrado a los 2 años por falta de visitas.
- **Zoom de verdad**: los servicios conocidos no tienen zoom ni arrastre — su
  "1:1" es tamaño natural + scrollbar. Aquí hay zoom al 800 %, arrastre y
  recortes 1:1 de todas las variantes en un clic.
- **Diff amplificado y modo calor**: nadie más lo ofrece; es la forma más
  rápida de ver dónde golpeó un encode.
- **Escala en píxeles nítidos** para inspección honesta al hacer zoom.
- **Vive para siempre en un archivo**: el HTML exportado funciona sin internet
  dentro de diez años igual que hoy. Los servicios mueren — ya enterraron a
  screenshotcomparison.com e imgsli.com.
- **Cicla variantes con la barra espaciadora** en el mismo frame, como la
  comunidad espera.

## Formato .cmp

Un `.cmp` es JSON: manifiesto + imágenes en base64. Es el mismo contrato que
consume el visor embebido y el que aceptará el servicio hospedado — ver
[`docs/formato-cmp.md`](docs/formato-cmp.md).

## Repo

```
viewer/   el motor (index.html + compare.js) — también sirve hospedado
app/      el creador (index.html + builder.js + assets.js generado)
dist/     gatos.html — todo el creador en un solo archivo
tools/    build_app.py (regenera assets.js y dist), make_demo.py
demo/     demo sintética, sin material real
```

Después de tocar `viewer/` o `app/`: `python3 tools/build_app.py`.
No hay dependencias, ni build system, ni framework: HTML, CSS y JS planos.

## Licencia

MIT.
