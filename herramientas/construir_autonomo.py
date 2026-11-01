#!/usr/bin/env python3
"""SimuLab · herramientas/construir_autonomo.py

Crea UN SOLO archivo HTML con todo dentro (estilos, scripts, Three.js, fuentes e imágenes de los personajes).
Sirve para previsualizar, subir a Moodle o publicar.

Uso:  python3 herramientas/construir_autonomo.py [salida.html]
Por defecto: dist/simulab-op-aux-almacenaje.html
"""
import base64
import io
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def data_uri(ruta: Path, tipo: str) -> str:
    return f"data:{tipo};base64," + base64.b64encode(ruta.read_bytes()).decode()


def imagen_webp(ruta: Path) -> str:
    """PNG → WebP (pesa menos). Si no hay Pillow, va el PNG tal cual."""
    try:
        from PIL import Image
        buf = io.BytesIO()
        Image.open(ruta).save(buf, "WEBP", quality=86, method=6)
        return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return data_uri(ruta, "image/png")


def sin_version(ruta: str) -> str:
    return ruta.split("?")[0]


def main():
    salida = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "dist" / "simulab-op-aux-almacenaje.html"
    html = (RAIZ / "index.html").read_text(encoding="utf-8")

    # Estilos (con las fuentes incrustadas)
    def css(m):
        ruta = RAIZ / sin_version(m.group(1))
        texto = ruta.read_text(encoding="utf-8")
        def fuente(f):
            return "url('" + data_uri((ruta.parent / f.group(1)).resolve(), "font/woff2") + "')"
        texto = re.sub(r"url\('([^']+\.woff2)'\)", fuente, texto)
        return "<style>\n" + texto + "\n</style>"
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)

    # Imágenes de los personajes → SimuLab.imagenes
    imagenes = {}
    for png in sorted((RAIZ / "assets" / "personajes").glob("*.png")):
        imagenes[f"assets/personajes/{png.name}"] = imagen_webp(png)
    previo = "<script>window.SimuLab={imagenes:" + json.dumps(imagenes) + "};</script>\n"

    # Scripts
    primero = [True]
    def js(m):
        texto = (RAIZ / sin_version(m.group(1))).read_text(encoding="utf-8").replace("</script", "<\\/script")
        pre = previo if primero[0] else ""
        primero[0] = False
        return pre + "<script>\n" + texto + "\n</script>"
    html = re.sub(r'<script src="([^"]+)"></script>', js, html)

    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(html, encoding="utf-8")
    print(f"✓ {salida.relative_to(RAIZ) if salida.is_relative_to(RAIZ) else salida}  ({salida.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
