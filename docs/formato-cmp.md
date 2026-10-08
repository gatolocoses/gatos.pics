# Formato `.cmp` · especificación

Un paquete `.cmp` es un archivo JSON que describe una comparación completa:
metadatos + imágenes. Un solo formato con tres consumidores: el creador lo
exporta e importa, el visor embebido lo ejecuta, y el servicio hospedado de
gatos.pics lo acepta como contrato de publicación.

```json
{
  "format": "gatos.pics/cmp@1",
  "manifest": {
    "title": "Comparación de encodes",
    "version": 2,
    "frames": [6052, 25100, 90012],
    "frame_labels": { "6052": "intro", "90012": "grano" },
    "variants": [
      { "id": "src", "name": "Fuente", "color": "#7bd389" },
      { "id": "enc", "name": "Encode", "color": "#7bb3ff",
        "note": "AV1 · CRF 26 · 8.3 Mb/s",
        "cmd": "SvtAv1EncApp --crf 26 --preset 4 -i in.y4m -b out.ivf",
        "ext": "png" }
    ]
  },
  "images": {
    "src_6052": "data:image/png;base64,…",
    "enc_6052": "data:image/png;base64,…"
  }
}
```

## Campos

### Raíz

| Campo | Tipo | Obligatorio | Nota |
|---|---|---|---|
| `format` | string | sí | `"gatos.pics/cmp@1"`. Cambiará el sufijo si el formato rompe compatibilidad. |
| `manifest` | objeto | sí | Ver abajo. |
| `images` | objeto | sí | Clave `"<id>_<frame>"` → data URL (`data:image/png;base64,…`). |

### `manifest`

| Campo | Tipo | Obligatorio | Nota |
|---|---|---|---|
| `title` | string | no | Título de la página y de la pestaña. |
| `version` | number | no | Entero creciente; en hospedaje se usa como `?v=` para romper caché. |
| `frames` | array | sí | Identificadores de frame (número o string). Define el orden de los botones. |
| `frame_labels` | objeto | no | `String(frame)` → etiqueta bonita. Sin etiqueta, el botón muestra el id. |
| `frame_meta` | objeto | no | `String(frame)` → `{ "clip_s": 12.5 }`: metadato informativo por frame. |
| `clip` | objeto | no | `{ "start_label": "minuto 21" }`: contexto del origen de las capturas. |
| `variants` | array | sí | Mínimo 2 para una comparación. |

### `variants[]`

| Campo | Tipo | Obligatorio | Nota |
|---|---|---|---|
| `id` | string | sí | Corto, seguro para nombre de archivo (`[a-z0-9_-]`). Parte de la clave de imagen. |
| `name` | string | no | Nombre visible. Si falta, se muestra el id. |
| `color` | string | no | Punto de color del botón, `#rrggbb`. |
| `note` | string | no | Línea secundaria del botón. Convención: campos unidos por ` · ` (`codec · CRF 26 · Mb/s`). |
| `cmd` | string | no | Comando completo del encoder; se muestra como tooltip al mantener el botón. |
| `ext` | string | no | Extensión de archivo SOLO para el despliegue en carpeta (`img/<id>_<frame>.<ext>`). Ignorada en el paquete embebido. |
| `frames` | array | no | **Variante parcial**: los frames (subconjunto de `manifest.frames`) en los que esta variante tiene imágenes. Sin el campo, la variante tiene todos (lo de siempre). Ver "Variantes parciales" más abajo. |
| `image_exts` | objeto | no | `String(frame)` → extensión real de esa imagen. Tiene prioridad sobre `ext`; permite mezclar PNG, JPEG y otros formatos dentro de una variante. Lo generan el export ZIP y el servicio a partir de los archivos. |
| `metrics` | objeto | no | `ssimulacra2` (media), `per_frame: {frame: {ssimulacra2}}`, `psnr_avg`, `ssim_all`, `size_bytes`, `kbps`: se muestran bajo el nombre si existen. El creador puede calcular S2 (SSIMULACRA2) contra la primera variante con un toggle; es el mismo algoritmo que el paquete `ssimulacra2` de PyPI sobre RGB 8 bit (números comparables entre herramientas 8-bit, no contra salidas de otras rutas). |

## Reglas

1. **Dimensiones idénticas**: todas las imágenes de una comparación deben tener
   el mismo ancho/alto: el diff y los recortes 1:1 lo exigen.
2. **Cada combinación presente al compartir**: el creador bloquea la vista previa,
   HTML, ZIP y publicación si faltan imágenes. Guardar `.cmp` sí permite proyectos
   incompletos para continuar después. El servicio rechaza matrices incompletas,
   salvo en las variantes que declaran `frames` (ver "Variantes parciales").
3. **`note` con ` · `**: el visor parte la nota en ese separador para componer
   el botón; úsalo para alinear columnas visuales.
4. **PNG para grano**: si la comparación depende de grano o textura fina,
   evita formatos con pérdida en las capturas.
5. **Sin rutas absolutas ni datos personales**: un `.cmp` está pensado para
   compartirse tal cual.

## Variantes parciales (`frames` en la variante)

A veces una variante solo cubre algunos frames de la página (por ejemplo, el
encode de otra persona salió de un clip más corto). En vez de quitar frames o
inventar imágenes, esa variante declara los frames que sí tiene:

```json
{ "id": "ajeno", "name": "Encode ajeno", "frames": [25100, 90012] }
```

- `frames` es una lista **no vacía**, **sin repetidos**, de frames que existan
  en `manifest.frames`; el orden no importa (se guarda en el orden de la
  página). Si no cumple, el servicio responde 422.
- Esa variante lleva imágenes **solo** de esos frames: una imagen suelta de
  otro frame se rechaza (422), igual que una que falte de los declarados.
  `image_exts` también lista solo esos frames.
- Las variantes sin `frames` siguen necesitando todos los frames. Un `frames`
  que cubre todos los de la página equivale a no ponerlo (el servicio lo quita)
  y esa variante sigue siendo completa: si después agregas un frame, también le
  pedirá su imagen. Lo mismo que hacía el kit viejo (`variants[].frames` con
  todos los frames) sigue funcionando.
- Todas las imágenes de la página, parciales o no, miden lo mismo.
- En la página, en un frame donde la variante no tiene imagen el panel dice
  "Esta variante no tiene este cuadro" (sin imagen rota); su botón se ve
  atenuado pero se puede elegir. El diff no está disponible en ese cuadro
  (la nota lo dice), el parpadeo sigue alternando lo que muestre cada lado, los
  recortes marcan "sin este cuadro" en esa fila y la imagen de compartir
  dibuja el mismo aviso. Los enlaces con `#` y los atajos funcionan igual.
- El creador no genera `frames`: sus exportaciones son siempre matrices
  completas. La declaración se hace en el `.cmp` que publicas con `POST`,
  `PUT` o `PATCH`.

## Vista hospedada (carpeta)

El mismo `manifest.json` (sin `images`) junto a `img/<id>_<frame>.<ext>` sirve
una página estática: es exactamente lo que exporta el creador como .zip. El
campo `image_exts` por variante le dice al visor cómo construir cada URL;
`ext` sigue funcionando como respaldo para manifiestos anteriores.

## Actualizar una página publicada sin cambiar su enlace

Una página publicada en gatos.pics se puede reemplazar entera con
`PUT /api/page/<token>`: el cuerpo es el mismo `.cmp` que recibe
`POST /api/upload` y pasa por la misma validación y los mismos topes. El
enlace, el código y la llave de borrado no cambian. Se autoriza con la llave de
borrado de esa página (`x-delete-key`) o con la llave API (`x-api-key`); sin
una llave válida responde 403, con un código desconocido 404, y con un paquete
inválido (422) o demasiado grande (413) la página anterior queda intacta.

- `manifest.version` siempre sube: si el paquete nuevo trae la misma versión (o
  una menor, o ninguna), el servicio la deja en la anterior + 1. Así el `?v=`
  de las imágenes, que los navegadores guardan hasta 30 días, cambia y todos
  ven las imágenes nuevas.
- El cambio es atómico: la página nueva se arma aparte y se intercambia de un
  golpe; quien la esté abriendo ve la vieja o la nueva, nunca una mezcla. Las
  imágenes que la versión nueva ya no usa (por ejemplo, una variante que
  quitaste) se borran.
- La imagen compartida `/s/<token>.png` no se toca: se reemplaza aparte, como
  siempre.

## Imagen compartida de una página publicada por la API

Una página publicada con `POST /api/upload` nace sin imagen compartida:
`/s/<token>.png` responde 404 y el BBCode
`[url=…/p/<token>/][img]…/s/<token>.png[/img][/url]` muestra una imagen rota
hasta que se sube una. La respuesta de la publicación lo dice
(`"share_image": null`) y trae la dirección de subida (`share_image_upload`).

- Con la imagen del visor, sin abrir un navegador a mano:
  `GATOS_DELETE_KEY=<llave> node tools/share_image.cjs https://gatos.pics/p/<token>/`.
  Abre la página en un navegador sin ventana, toma la misma imagen que dibuja
  "Compartir" (vista partida, etiquetas, insignia) y la sube. La URL puede
  llevar el `#…` de una vista concreta. Necesita Playwright.
- Con una imagen propia: `POST /api/shot/<token>` con el PNG crudo como cuerpo
  y el encabezado `x-delete-key`. Máximo 16 MiB y 8000 px por lado.
- No cuenta contra el cupo de páginas.

## Sumar, reemplazar o quitar variantes sin reenviar las demás

Cuando una página crece de a una variante, no hace falta volver a mandar las
imágenes que ya están: `PATCH /api/page/<token>` recibe un `.cmp` **parcial**
con las mismas dos llaves que el `PUT` (`x-delete-key` de la página o
`x-api-key`) y une los cambios a lo publicado. Cuerpo:

```json
{
  "format": "gatos.pics/cmp@1",
  "manifest": { "variants": [ { "id": "crf30", "name": "CRF 30" } ] },
  "images": { "crf30_6052": "data:image/png;base64,…", "crf30_25100": "data:image/png;base64,…" },
  "remove": ["crf40"]
}
```

Cómo se une:

- `manifest.variants` se une por `id`: si el `id` ya existe, esa variante se
  reemplaza en su lugar (la entrada completa: lo que el parche no trae, como el
  color o las métricas, se pierde); si es nuevo, va al final, en el orden dado.
  `remove` es una lista de `id` que se quitan junto con sus imágenes.
- `images` solo trae las imágenes nuevas. Cada una reemplaza la del mismo
  `<id>_<frame>`; las demás imágenes de esa variante, y todas las de las
  variantes que no mencionas, quedan como estaban.
- `title`, `frames`, `frame_labels` y `clip`: si vienen reemplazan lo guardado;
  si no vienen se conservan. Un frame nuevo solo se acepta si el parche trae su
  imagen para **todas** las variantes que quedan en la página, salvo las
  variantes parciales (su `frames` no lo incluye, no lo necesitan).
- Sumar una variante parcial: `{"id": "ajeno", "frames": [25100, 90012]}` en
  `manifest.variants` más solo esas dos imágenes; no pide imágenes en los otros
  frames y no toca las de las demás variantes. Como el reemplazo es del objeto
  entero, para cambiar solo el nombre de una parcial hay que repetir su
  `frames` (sin él pasaría a ser completa y el servicio pediría todo lo que
  le falta). Si el parche cambia `manifest.frames`, el `frames` de las parciales
  guardadas se recorta a los que quedan; una parcial que se quedaría sin
  ninguno es un 422.
- Al terminar de unir se aplican las mismas reglas de siempre: cada variante x
  frame tiene su imagen (si no, 422 y la página no cambia), todas las imágenes
  miden lo mismo que las ya publicadas, y puedes mezclar PNG, WEBP y demás
  (`image_exts` se rehace solo). La página debe quedar con 2 a 12 variantes.
- Sigue valiendo todo lo del `PUT`: el enlace y la llave de borrado no cambian,
  `manifest.version` siempre sube, el cambio es atómico (quien abre la página
  ve la vieja o la nueva) y un error deja la página anterior intacta. 409 si ya
  hay otra actualización de esa página en curso. No cuenta contra el cupo de
  páginas y no toca la imagen compartida.
- Los topes de un envío (peso por imagen y total del envío) aplican al
  **parche**, no a la página completa: así una página puede acabar pesando más
  de lo que cabe en un solo envío. La página resultante también tiene un tope
  propio del servicio.
