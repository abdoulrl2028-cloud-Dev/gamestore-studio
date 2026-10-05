#!/usr/bin/env python3
"""Gera ícone, splash e favicon do GameStore Studio sem dependências externas."""

import struct
import zlib
from pathlib import Path


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, width: int, height: int, pixel) -> None:
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixel(x, y, width, height))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def rounded_rect(x: int, y: int, width: int, height: int, left: int, top: int, right: int, bottom: int, radius: int) -> bool:
    if x < left or x >= right or y < top or y >= bottom:
        return False
    centers = (
        (left + radius, top + radius),
        (right - radius - 1, top + radius),
        (left + radius, bottom - radius - 1),
        (right - radius - 1, bottom - radius - 1),
    )
    if left + radius <= x < right - radius or top + radius <= y < bottom - radius:
        return True
    for cx, cy in centers:
        if (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2:
            return True
    return False


def icon_pixel(x: int, y: int, width: int, height: int, transparent: bool, mono: bool):
    scale = width / 1024
    margin = int(180 * scale)
    radius = int(150 * scale)
    inside = rounded_rect(x, y, width, height, margin, margin, width - margin, height - margin, radius)
    if transparent and not inside:
        return (0, 0, 0, 0)
    if not inside:
        return (23, 19, 43, 255) if not mono else (0, 0, 0, 0)
    color = (255, 255, 255, 255) if mono else (245, 193, 108, 255)
    bar_left = int(390 * scale)
    bar_right = int(500 * scale)
    bar_top = int(340 * scale)
    bar_bottom = int(700 * scale)
    if bar_left <= x < bar_right and bar_top <= y < bar_bottom:
        return color
    # Triângulo simples à direita da barra, formando um controle de play.
    relative_y = y - int(512 * scale)
    half = abs(relative_y)
    if int(500 * scale) <= x <= int(700 * scale) and half <= int((700 * scale - x) * 0.85):
        return color
    return (76, 53, 197, 255) if not mono else (0, 0, 0, 0)


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "assets" / "images"

    def full(x, y, w, h):
        return icon_pixel(x, y, w, h, False, False)

    def foreground(x, y, w, h):
        return icon_pixel(x, y, w, h, True, False)

    def mono(x, y, w, h):
        return icon_pixel(x, y, w, h, True, True)

    write_png(root / "icon.png", 1024, 1024, full)
    write_png(root / "adaptive-icon.png", 1024, 1024, foreground)
    write_png(root / "splash-icon.png", 1024, 1024, foreground)
    write_png(root / "monochrome.png", 1024, 1024, mono)
    write_png(root / "favicon.png", 64, 64, full)
    print(root)


if __name__ == "__main__":
    main()
