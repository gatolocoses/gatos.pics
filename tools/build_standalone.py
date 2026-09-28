#!/usr/bin/env python3
"""Build a single self-contained HTML from viewer/ + a .cmp package.

    python3 tools/build_standalone.py demo/demo.cmp demo/demo.html

The output runs from file:// with zero network: the package is injected as
window.GATOS_PACKAGE and the engine script is inlined.
"""
import json, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

def build(pkg_path, out_path):
    pkg = json.load(open(pkg_path))
    html = (ROOT / "viewer" / "index.html").read_text()
    engine = (ROOT / "viewer" / "compare.js").read_text()
    tag = '<script src="compare.js"></script>'
    assert tag in html, "engine script tag not found in viewer/index.html"
    injection = ("<script>window.GATOS_PACKAGE = "
                 + json.dumps(pkg, separators=(",", ":")).replace("<", "\\u003c")
                 + ";</script>\n<script>\n" + engine + "\n</script>")
    html = html.replace(tag, injection)
    pathlib.Path(out_path).write_text(html)
    mb = pathlib.Path(out_path).stat().st_size / 1e6
    print(f"{out_path}: self-contained, {mb:.1f} MB")

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "demo/demo.cmp"
    dst = sys.argv[2] if len(sys.argv) > 2 else "demo/demo.html"
    build(src, dst)
