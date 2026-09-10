"""
Chernobyl Monitor app icon.

A single backlit annunciator tile, amber lit, seated in a machined bezel.

Deliberate calls:
  * Wordless. Engraved legends turn to mush below 32px, so the legend is two
    lines of abstract word-shaped blocks rather than letterforms.
  * One big tile rather than a grid. At 16px this stays a solid amber block in
    a dark frame; a 2x2 grid of 5px cells does not survive.

Regenerate with:  python3 assets/make_icon.py
"""

from typing import Callable

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SS = 4                        # supersample factor
W = 1024
S = W * SS

SHELL    = (0x4A, 0x48, 0x3F)
BEZEL    = (0x22, 0x20, 0x1C)
SEAM     = (0x35, 0x34, 0x2E)
AMBER    = (0xF0, 0xA6, 0x3A)
ENGRAVE  = (0x1A, 0x18, 0x13)
SCREW    = (0x8B, 0x84, 0x6F)


def px(v: float) -> int:
    return int(round(v * SS))


def squircle(size: int, x0: int, x1: int, n: float = 5.0) -> np.ndarray:
    """Apple-style superellipse. PIL's rounded_rectangle goes lumpy at these
    radii even under supersampling."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    c, a = (x0 + x1) / 2.0, (x1 - x0) / 2.0
    return ((np.abs((xx - c) / a) ** n + np.abs((yy - c) / a) ** n) <= 1.0).astype(
        np.float32
    )


def blend(base: Image.Image, paint: Callable[[ImageDraw.ImageDraw], None]) -> Image.Image:
    """Draw translucent art on its own layer and composite it.

    ImageDraw writes pixels rather than blending them, so drawing a colour with
    alpha directly onto the base stores that alpha — and the squircle mask at
    the end then promotes it to fully opaque. Every soft highlight has to go
    through a real composite.
    """
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    paint(ImageDraw.Draw(layer))
    return Image.alpha_composite(base, layer)


def main() -> None:
    art = Image.new("RGBA", (S, S), SHELL + (255,))

    # painted-metal shading down the body
    a = np.array(art, dtype=np.float32)
    a[..., :3] = np.clip(
        a[..., :3] * np.linspace(1.18, 0.78, S, dtype=np.float32)[:, None, None], 0, 255
    )
    art = Image.fromarray(a.astype(np.uint8))

    z0, z1 = px(146), px(878)          # bezel
    t0, t1 = px(212), px(812)          # tile
    cell = t1 - t0

    # --- machined bezel ------------------------------------------------------
    ImageDraw.Draw(art).rounded_rectangle(
        [z0, z0, z1, z1], radius=px(16), fill=BEZEL + (255,)
    )
    art = blend(art, lambda d: (
        # recess: shadow along the top and left inner edges, light along the base
        d.rectangle([z0, z0, z1, z0 + px(10)], fill=(0, 0, 0, 170)),
        d.rectangle([z0, z0, z0 + px(10), z1], fill=(0, 0, 0, 120)),
        d.rectangle([z0 + px(8), z1 - px(7), z1 - px(8), z1], fill=(255, 250, 236, 26)),
    ))

    # --- bloom, spilling onto the bezel before the tile face goes down -------
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rectangle([t0, t0, t1, t1], fill=AMBER + (255,))
    glow = glow.filter(ImageFilter.GaussianBlur(px(38)))
    glow.putalpha(glow.getchannel("A").point(lambda v: int(v * 0.5)))
    art = Image.alpha_composite(art, glow)

    # --- the lit tile --------------------------------------------------------
    ImageDraw.Draw(art).rectangle([t0, t0, t1, t1], fill=AMBER + (255,))
    art = blend(art, lambda d: (
        d.rectangle([t0, t0, t1, t0 + px(26)], fill=(255, 252, 232, 90)),
        d.rectangle([t0, t1 - px(18), t1, t1], fill=(0, 0, 0, 48)),
    ))

    # --- engraved legend -----------------------------------------------------
    # Two centred lines broken into word-shaped blocks. Solid bars read as an
    # equals sign; blocks with word gaps read as a caption.
    d = ImageDraw.Draw(art)
    bar_h = px(38)
    word_gap = int(cell * 0.055)
    for i, words in enumerate(((0.30, 0.26), (0.22, 0.34))):
        total = int(cell * sum(words)) + word_gap * (len(words) - 1)
        bx = t0 + (cell - total) // 2
        by = t0 + int(cell * 0.33) + i * px(86)
        for frac in words:
            w = int(cell * frac)
            d.rectangle([bx, by, bx + w, by + bar_h], fill=ENGRAVE + (255,))
            bx += w + word_gap

    # --- fasteners in the bezel corners -------------------------------------
    for sx, sy in ((px(179), px(179)), (px(845), px(179)),
                   (px(179), px(845)), (px(845), px(845))):
        r = px(14)
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=SCREW + (255,))
        d.line([sx - r + px(4), sy, sx + r - px(4), sy], fill=SEAM + (255,), width=px(5))
        d.line([sx, sy - r + px(4), sx, sy + r - px(4)], fill=SEAM + (255,), width=px(5))

    # --- clip to the squircle, with a rim so it separates on a light desktop -
    mask = squircle(S, px(100), px(924))
    out = np.array(art, dtype=np.float32)
    out[..., 3] = mask * 255.0
    rim = mask - squircle(S, px(107), px(917))
    out[..., :3] *= 1 - rim[..., None] * 0.45

    img = Image.fromarray(out.astype(np.uint8)).resize((W, W), Image.LANCZOS)
    img.save("assets/icon.png")
    print(f"wrote assets/icon.png  {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
