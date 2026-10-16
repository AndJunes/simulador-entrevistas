"""Ilustraciones unDraw → paleta de la app.

- Recolorea el acento índigo (#6366F1 y sus sombras) al teal de marca, conservando luminosidad relativa.
- Exporta WebP de 960 px de ancho (calidad 82) y un manifiesto con width/height (evita CLS).
- Licencia unDraw: permite modificar; NO redistribuir en packs. Solo se copian las usadas (todas las del mapa de estados).

Uso:  python3 -I frontend/scripts/illustrations.py <carpeta_origen> frontend/src/assets/illustrations
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

WIDTH = 960
# Acento unDraw #6366F1 ≈ OKLCH(0.585 0.204 277). Destino: teal de marca ≈ OKLCH(0.55 0.09 200).
SRC_L, SRC_C = 0.585, 0.204
DST_L, DST_C, DST_H = 0.55, 0.09, 200.0


def _to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)


def _oklab(rgb):
    r, g, b = [_to_lin(rgb[..., i]) for i in range(3)]
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def _from_oklab(L, a, b):
    l, m, s = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, \
        (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return np.stack([_to_srgb(r), _to_srgb(g), _to_srgb(bb)], -1)


def recolor(img: Image.Image) -> Image.Image:
    """Rota el tono en OKLCH (conserva la luminosidad PERCIBIDA): solo píxeles del acento (tono 255–300°, croma >0.06).
    Los grises azulados de unDraw (#3f3d56, croma ~0.04) quedan intactos."""
    rgba = np.asarray(img.convert("RGBA")).astype(np.float64) / 255
    rgb, a = rgba[..., :3], rgba[..., 3:]
    L, A, B = _oklab(rgb)
    C = np.hypot(A, B)
    H = (np.degrees(np.arctan2(B, A)) + 360) % 360
    sel = (C > 0.06) & (H > 255) & (H < 300)
    nL = np.clip(L * (DST_L / SRC_L), 0, 1)
    nC = C * (DST_C / SRC_C)
    h = np.radians(DST_H)
    out = _from_oklab(nL, nC * np.cos(h), nC * np.sin(h))
    rgb2 = np.where(sel[..., None], out, rgb)
    return Image.fromarray((np.concatenate([rgb2, a], -1) * 255).round().astype(np.uint8), "RGBA")


def main(src: str, dst: str):
    src_p, dst_p = Path(src), Path(dst)
    dst_p.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for f in sorted(src_p.rglob("*.png")):
        img = Image.open(f)
        img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
        img = recolor(img)
        out = dst_p / f"{f.stem}.webp"
        img.save(out, "WEBP", quality=82, method=6)
        manifest[f.stem] = {"w": img.width, "h": img.height, "kb": round(out.stat().st_size / 1024)}
        print(f"{f.stem:28s} {img.width}x{img.height} {manifest[f.stem]['kb']} KB")
    (dst_p / "manifest.json").write_text(json.dumps(manifest, indent=1))


if __name__ == "__main__":
    main(*sys.argv[1:3])
