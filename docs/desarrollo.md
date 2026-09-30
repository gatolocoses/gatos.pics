# Desarrollo

gatos.pics es a propósito un proyecto aburrido de construir: HTML, CSS y JS
planos, sin framework, sin gestor de paquetes, sin paso de build en uso. Si
sabes leer JS, sabes leer todo el producto.

## Estructura

```
viewer/            EL MOTOR: lo que ve quien abre una comparación
  index.html       shell: layout, estilos, SVG de la curva solar
  compare.js       DataSource (Embedded/Http), divisor, diff, recortes, S2 visible
  upload.js        progreso XHR, cancelación y reintento manual de subidas explícitas
app/               EL CREADOR: lo que usa quien arma la comparación
  index.html       markup + estilos del creador
  builder.js       estados, tres modos, exportaciones, zip STORE+CRC32
  s2.js            SSIMULACRA2 en JS puro (puerto validado bit-exacto)
  assets.js        GENERADO: no editar a mano
tools/
  build_app.py     inyecta viewer/* en app/assets.js y arma dist/gatos.html
  make_demo.py     regenera demo/demo.cmp y demo/demo.html (sintético)
  build_standalone.py  empaqueta un .cmp dentro del shell del visor
dist/
  gatos.html       el creador completo en un solo archivo (artefacto público)
demo/              demo sintética; S2 real si existe GATOS_S2_PYTHON
docs/              guía, formato .cmp, este archivo
```

## Ley de la fuente única

`viewer/` es el motor canónico. `app/assets.js` (que contiene el shell y el
motor como cadenas JS, porque `fetch` no funciona en `file://` y el creador
necesita generar la vista previa y los exports sin red) y `dist/gatos.html`
se **generan**. Después de tocar cualquier cosa:

```sh
python3 tools/build_app.py        # app/assets.js + dist/gatos.html
python3 tools/make_demo.py        # opcional: regenerar la demo
python3 tools/build_standalone.py # opcional: demo.html
```

Los tres corren con Python 3 puro, sin dependencias.

## Contratos que no se deben romper

- **`.cmp` = `gatos.pics/cmp@1`**: manifiesto + imágenes (`docs/formato-cmp.md`).
  Es el formato que el servicio hospedado va a aceptar como subida; cambios
  incompatibles suben el sufijo.
- **`per_frame` con objetos**: los valores de `metrics.per_frame` son objetos
  (`{"ssimulacra2": 67.0}`), no números sueltos; el visor y el kit histórico
  lo esperan así.
- **Local hasta publicar**: crear, editar, previsualizar y exportar funcionan
  sin llamadas de red. Ni CDN, fuentes remotas ni telemetría. Publicar y actualizar
  una imagen compartida requieren una acción explícita y son las únicas subidas.
- **`file://` primero**: todo lo que entre al creador debe funcionar abierto
  con doble clic, sin servidor.
- **UI en español latino**: el producto habla es-LA; nada de tuteo cruzado ni
  términos de España (`ordenador`, `fichero`, `vosotros`).

## El puerto de SSIMULACRA2

`app/s2.js` es un puerto fiel del paquete `ssimulacra2` de PyPI. Dos trampas
que ya costaron sudor y quedaron documentadas en el código:

1. Los arreglos XYB del paquete van **transpuestos** (W,H,C): su cero-pad
   "vertical" cae en los bordes izquierdo/derecho y su reflexión en
   superior/inferior. El blur del puerto es: horizontal con cero-padding,
   vertical con reflexión de borde incluido (`f(-1) = f(0)`).
2. El vector de 108 pesos se copia de la fuente, nunca a mano.

Validación: contra el paquete PyPI sobre los mismos PNG, el puntaje coincide a
4 decimales. Si tocas `s2.js`, revalida: el caso de prueba del repo es la demo
(`make_demo.py` recalcula sus S2 si exportas `GATOS_S2_PYTHON=/ruta/al/python`
con el paquete instalado; sin la variable, la demo se regenera sin métricas).

## Cómo se prueba

A mano y de verdad: abrir `dist/gatos.html` desde `file://`, pasar el flujo
completo (soltar archivos → vista previa → tres exportaciones), y abrir el
export. El zip se valida con `python3 -m zipfile -t`. Regresiones conocidas:
el manifiesto de la carpeta necesita `ext` por variante (si no, el visor
hospedado busca `.webp` y da 404).

## Contribuir

### Verificación de las correcciones de revisión

`tools/review_browser.cjs` usa Playwright solo como herramienta de desarrollo;
no agrega dependencias al producto. Levanta el servicio del subárbol
`service/` del master repo (o el que marque `GATOS_SERVICE`) y necesita
Chromium de Playwright. `GATOS_PLAYWRIGHT_MODULE` puede indicar una instalación
existente del módulo; `GATOS_REVIEW_OUT` el directorio de capturas y exports.
La prueba abre `dist/gatos.html` desde `file://` y usa un servicio temporal en
`127.0.0.1:8987`. Nunca publica en gatos.pics.

Comprueba importación, exportaciones, permisos de la imagen compartida, estado
de URL, diff, captura PNG con zoom, marca sin solapamientos y tamaños de pantalla
de 320 a 1920 px. La suite del servicio se ejecuta con `node test/e2e.mjs`.

`tools/review_round2.cjs` prueba el modo ciego, la ayuda, la importación en lote,
los resultados de captura por marca y las subidas con conexión limitada,
cancelación y errores. Usa un servidor de prueba en un puerto local libre;
`GATOS_REVIEW2_OUT` elige dónde guardar los resultados.

`tools/profile_browser.cjs` genera 60 frames × 6 variantes de PNG sintéticos
de 320×180 y mide importación, matriz, paquete, HTML y vista previa sin red.
`GATOS_PROFILE_HTML` permite elegir otro archivo del creador para comparar
versiones; `GATOS_PROFILE_OUT` elige el JSON de resultados. Ambos scripts usan
Playwright solo en desarrollo y aceptan `GATOS_PLAYWRIGHT_MODULE`.

Cualquier cosa que entre debe: no usar red, no añadir dependencias, seguir en
es-LA, y venir con la prueba de que sigue funcionando desde `file://`.
