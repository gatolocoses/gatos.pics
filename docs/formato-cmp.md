# Formato `.cmp` — especificación

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
| `frame_meta` | objeto | no | `String(frame)` → `{ "clip_s": 12.5 }` — metadato informativo por frame. |
| `clip` | objeto | no | `{ "start_label": "minuto 21" }` — contexto del origen de las capturas. |
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
| `metrics` | objeto | no | `psnr_avg`, `ssim_all`, `per_frame` — se muestran bajo el nombre si existen. |

## Reglas

1. **Dimensiones idénticas**: todas las imágenes de una comparación deben tener
   el mismo ancho/alto — el diff y los recortes 1:1 lo exigen.
2. **Cada combinación presente**: una clave faltante en `images` se renderiza
   como casilla rota; el creador lo marca antes de exportar.
3. **`note` con ` · `**: el visor parte la nota en ese separador para componer
   el botón; úsalo para alinear columnas visuales.
4. **PNG para grano**: si la comparación depende de grano o textura fina,
   evita formatos con pérdida en las capturas.
5. **Sin rutas absolutas ni datos personales**: un `.cmp` está pensado para
   compartirse tal cual.

## Vista hospedada (carpeta)

El mismo `manifest.json` (sin `images`) junto a `img/<id>_<frame>.<ext>` sirve
una página estática: es exactamente lo que exporta el creador como .zip. El
campo `ext` por variante le dice al visor cómo construir cada URL.
