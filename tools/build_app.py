#!/usr/bin/env python3
"""Construye los artefactos del creador a partir de las fuentes.

Fuentes de verdad: viewer/index.html + viewer/compare.js (el motor) y
app/index.html + app/builder.js (el creador).

Salidas:
  app/assets.js   — SHELL_HTML + ENGINE_SRC + UPLOAD_SRC como cadenas JS (el creador las
                    necesita para generar vista previa y exportaciones sin
                    fetch, que no funciona en file://)
  dist/gatos.html — el creador completo en UN solo archivo (para compartir
                    o abrir con doble clic sin carpeta)

Sin dependencias más allá de Python 3. Correr tras tocar viewer/ o app/.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
VIEWER = ROOT / "viewer"
APP = ROOT / "app"
DIST = ROOT / "dist"

def js_str(s: str) -> str:
    # </ -> <\/ evita que un "</script>" dentro de la cadena cierre el <script>
    return json.dumps(s, ensure_ascii=False).replace("</", "<\\/")

def build():
    shell = (VIEWER / "index.html").read_text(encoding="utf-8")
    engine = (VIEWER / "compare.js").read_text(encoding="utf-8")
    upload = (VIEWER / "upload.js").read_text(encoding="utf-8")

    assets = (
        "/* Generado por tools/build_app.py — no editar a mano.\n"
        "   SHELL_HTML: viewer/index.html · ENGINE_SRC: viewer/compare.js · UPLOAD_SRC: viewer/upload.js */\n"
        f"const SHELL_HTML = {js_str(shell)};\n\n"
        f"const ENGINE_SRC = {js_str(engine)};\n"
        f"const UPLOAD_SRC = {js_str(upload)};\n"
    )
    (APP / "assets.js").write_text(assets, encoding="utf-8")

    DIST.mkdir(exist_ok=True)
    idx = (APP / "index.html").read_text(encoding="utf-8")
    builder_js = (APP / "builder.js").read_text(encoding="utf-8")
    s2_js = (APP / "s2.js").read_text(encoding="utf-8")
    zip_js = (APP / "zip.js").read_text(encoding="utf-8")
    capture_js = (APP / "capture.js").read_text(encoding="utf-8")
    publish_js = (APP / "publish.js").read_text(encoding="utf-8")
    tags = ('<script src="assets.js"></script>\n'
            '<script src="../viewer/upload.js"></script>\n'
            '<script src="s2.js"></script>\n'
            '<script src="zip.js"></script>\n'
            '<script src="builder.js"></script>\n'
            '<script src="capture.js"></script>\n'
            '<script src="publish.js"></script>')
    assert tags in idx, "no se encontraron las etiquetas <script> esperadas en app/index.html"
    single = idx.replace(
        tags,
        "<script>\n" + assets + "</script>\n<script>\n" + upload + "</script>\n<script>\n" + s2_js + "</script>\n<script>\n" + zip_js + "</script>\n<script>\n" + builder_js + "</script>\n<script>\n" + capture_js + "</script>\n<script>\n" + publish_js + "</script>",
    )
    (DIST / "gatos.html").write_text(single, encoding="utf-8")

    print(f"app/assets.js   {len(assets):>9,} bytes")
    print(f"dist/gatos.html {len(single):>9,} bytes")

if __name__ == "__main__":
    build()
