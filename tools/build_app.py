#!/usr/bin/env python3
"""Construye los artefactos del creador a partir de las fuentes.

Fuentes de verdad: viewer/index.html + viewer/src/*.js (el motor, en partes) y
app/index.html + app/builder.js (el creador).

Salidas:
  viewer/compare.js — el motor: las partes de viewer/src/ en orden de nombre,
                    unidas con una línea en blanco. Es lo único que leen el servicio,
                    las exportaciones y las páginas; se edita en las partes,
                    nunca aquí (el gate falla si no coincide)
  app/assets.js   — la copia del visor que el creador necesita para generar
                    vista previa y exportaciones sin fetch (no funciona en
                    file://): shell + motor + upload en un JSON comprimido
                    (gzip + base64) que el navegador descomprime al cargar
  dist/gatos.html — el creador completo en UN solo archivo (para compartir
                    o abrir con doble clic sin carpeta)

Sin dependencias más allá de Python 3. Correr tras tocar viewer/ o app/.
"""
import base64
import gzip
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
VIEWER = ROOT / "viewer"
APP = ROOT / "app"
DIST = ROOT / "dist"

# La copia del visor viaja comprimida para que el creador de un solo archivo
# quepa en el presupuesto de GOALS (< 200 KiB). base64 no lleva comillas ni
# "</", así que va tal cual dentro de la cadena y del <script>.
ASSETS_JS = """\
/* Generado por tools/build_app.py — no editar a mano.
   viewer/index.html, viewer/compare.js y viewer/upload.js viajan juntos en
   VIEWER_GZ (JSON + gzip + base64). VIEWER_ASSETS los descomprime una vez con
   DecompressionStream (nativo: sin red, sirve en file://) y llena SHELL_HTML,
   ENGINE_SRC y UPLOAD_SRC; quien los use espera antes: await VIEWER_ASSETS. */
const VIEWER_GZ = "@GZ@";
let SHELL_HTML, ENGINE_SRC, UPLOAD_SRC;
const VIEWER_ASSETS = (async () => {
  if (typeof DecompressionStream === 'undefined')
    throw new Error(T('Este navegador no puede armar la vista previa ni exportar: actualízalo.'));
  const bytes = Uint8Array.from(atob(VIEWER_GZ), c => c.charCodeAt(0));
  const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  ({shell: SHELL_HTML, engine: ENGINE_SRC, upload: UPLOAD_SRC} = JSON.parse(text));
})();
VIEWER_ASSETS.catch(() => {});  // sin ruido al cargar: quien espera VIEWER_ASSETS recibe el error
"""

def viewer_gz(shell: str, engine: str, upload: str) -> str:
    viewer = {"shell": shell, "engine": engine, "upload": upload}
    raw = json.dumps(viewer, ensure_ascii=False).encode("utf-8")
    gz = base64.b64encode(gzip.compress(raw, compresslevel=9, mtime=0)).decode("ascii")
    assert json.loads(gzip.decompress(base64.b64decode(gz))) == viewer, "VIEWER_GZ no reproduce el visor"
    return gz

def build_engine() -> str:
    parts = sorted((VIEWER / "src").glob("*.js"))
    assert parts, "no hay partes del motor en viewer/src/"
    # cada parte termina en su última línea de código; la línea en blanco que
    # separa las secciones la pone la unión (git rechaza blancos al final)
    engine = b"\n".join(p.read_bytes() for p in parts)
    out = VIEWER / "compare.js"
    if out.exists() and out.read_bytes() != engine:
        # red de seguridad: un cambio hecho a mano en compare.js no se pierde
        (VIEWER / "compare.js.prev").write_bytes(out.read_bytes())
        print("viewer/compare.js regenerado desde viewer/src/ (el anterior quedó en viewer/compare.js.prev)")
    out.write_bytes(engine)
    return engine.decode("utf-8")

def build():
    engine = build_engine()
    shell = (VIEWER / "index.html").read_text(encoding="utf-8")
    upload = (VIEWER / "upload.js").read_text(encoding="utf-8")

    assets = ASSETS_JS.replace("@GZ@", viewer_gz(shell, engine, upload))
    (APP / "assets.js").write_text(assets, encoding="utf-8")

    DIST.mkdir(exist_ok=True)
    idx = (APP / "index.html").read_text(encoding="utf-8")
    builder_js = (APP / "builder.js").read_text(encoding="utf-8")
    s2_js = (APP / "s2.js").read_text(encoding="utf-8")
    zip_js = (APP / "zip.js").read_text(encoding="utf-8")
    capture_js = (APP / "capture.js").read_text(encoding="utf-8")
    publish_js = (APP / "publish.js").read_text(encoding="utf-8")
    guide_js = (APP / "guide.js").read_text(encoding="utf-8")
    i18n_js = (VIEWER / "src" / "05-i18n.js").read_text(encoding="utf-8")
    lang_upload_js = (VIEWER / "src" / "06-lang-upload.js").read_text(encoding="utf-8")
    lang_js = (APP / "lang.js").read_text(encoding="utf-8")
    tags = ('<script src="../viewer/src/05-i18n.js"></script>\n'
            '<script src="../viewer/src/06-lang-upload.js"></script>\n'
            '<script src="lang.js"></script>\n'
            '<script src="assets.js"></script>\n'
            '<script src="../viewer/upload.js"></script>\n'
            '<script src="s2.js"></script>\n'
            '<script src="zip.js"></script>\n'
            '<script src="builder.js"></script>\n'
            '<script src="capture.js"></script>\n'
            '<script src="publish.js"></script>\n'
            '<script src="guide.js"></script>')
    assert tags in idx, "no se encontraron las etiquetas <script> esperadas en app/index.html"
    single = idx.replace(
        tags,
        "<script>\n" + i18n_js + lang_upload_js + lang_js + "</script>\n<script>\n" + assets + "</script>\n<script>\n" + upload + "</script>\n<script>\n" + s2_js + "</script>\n<script>\n" + zip_js + "</script>\n<script>\n" + builder_js + "</script>\n<script>\n" + capture_js + "</script>\n<script>\n" + publish_js + "</script>\n<script>\n" + guide_js + "</script>",
    )
    (DIST / "gatos.html").write_text(single, encoding="utf-8")

    print(f"viewer/compare.js {len(engine):>7,} chars")
    print(f"app/assets.js   {len(assets):>9,} bytes")
    print(f"dist/gatos.html {len(single):>9,} bytes")

if __name__ == "__main__":
    build()
