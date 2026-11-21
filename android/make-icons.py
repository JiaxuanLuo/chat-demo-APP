"""Generate the Android launcher icons (no external assets required)."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
RES = ROOT / "app" / "src" / "main" / "res"
SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
SCALE = 4  # draw large, then downsample for smooth edges
BASE = 512


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def gradient(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size))
    pixels = image.load()
    top = (107, 139, 255)
    bottom = (63, 91, 232)
    for y in range(size):
        t = y / max(1, size - 1)
        color = (lerp(top[0], bottom[0], t), lerp(top[1], bottom[1], t), lerp(top[2], bottom[2], t))
        for x in range(size):
            pixels[x, y] = color + (255,)
    return image


def draw_symbol(size: int, mask: Image.Image) -> Image.Image:
    canvas = gradient(size)
    draw = ImageDraw.Draw(canvas)
    unit = size / 512

    # soft highlight
    draw.ellipse(
        (60 * unit, -120 * unit, 460 * unit, 280 * unit),
        fill=(255, 255, 255, 26),
    )

    bubble = (118 * unit, 132 * unit, 394 * unit, 332 * unit)
    draw.rounded_rectangle(bubble, radius=70 * unit, fill=(255, 255, 255, 255))
    # tail
    draw.polygon(
        [
            (158 * unit, 300 * unit),
            (142 * unit, 372 * unit),
            (222 * unit, 326 * unit),
        ],
        fill=(255, 255, 255, 255),
    )

    dot = 22 * unit
    for x in (188, 256, 324):
        draw.ellipse(
            (x * unit - dot, 232 * unit - dot, x * unit + dot, 232 * unit + dot),
            fill=(77, 107, 254, 255),
        )

    # spark
    draw.rounded_rectangle(
        (352 * unit, 88 * unit, 366 * unit, 132 * unit), radius=7 * unit, fill=(255, 255, 255, 220)
    )
    draw.rounded_rectangle(
        (330 * unit, 110 * unit, 388 * unit, 124 * unit), radius=7 * unit, fill=(255, 255, 255, 220)
    )

    canvas.putalpha(mask)
    return canvas


def main() -> None:
    square = Image.new("L", (BASE, BASE), 0)
    ImageDraw.Draw(square).rounded_rectangle((0, 0, BASE - 1, BASE - 1), radius=112, fill=255)
    circle = Image.new("L", (BASE, BASE), 0)
    ImageDraw.Draw(circle).ellipse((0, 0, BASE - 1, BASE - 1), fill=255)

    icons = {
        "ic_launcher": draw_symbol(BASE, square),
        "ic_launcher_round": draw_symbol(BASE, circle),
    }
    for folder, size in SIZES.items():
        directory = RES / folder
        directory.mkdir(parents=True, exist_ok=True)
        for name, image in icons.items():
            image.resize((size, size), Image.LANCZOS).save(directory / f"{name}.png")
    icons["ic_launcher"].resize((512, 512), Image.LANCZOS).save(ROOT / "icon-512.png")
    print("icons written to", RES)


if __name__ == "__main__":
    main()
