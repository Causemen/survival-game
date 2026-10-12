#!/usr/bin/env python3
"""Готовит плитки земли из Gemini для игры (см. docs/ART.md, раздел 9).

Для каждой плитки: при необходимости делает края бесшовными (смещает картинку на пол-плитки и смешивает
с оригиналом по плавной маске, так что видимый шов уходит в середину, где текстура однородна),
уменьшает до `size` px и пишет PNG в public/assets/tiles/. Опция "rot180" делает вариант плитки поворотом.

python3 tools/prep_tiles.py manifest.json, где manifest.json:
{"out": "public/assets/tiles", "size": 256, "tiles": {
  "ground_cold": {"file": "snow.jpg", "seamless": true},
  "ground_cold_1": {"file": "snow.jpg", "seamless": true, "rot180": true},
  "ground_cold_3": {"file": "puddle.jpg", "match": "snow.jpg"}}}
"match": подогнать средний цвет рамки под другую картинку.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def make_seamless(a: np.ndarray, band: float = 0.25) -> np.ndarray:
    h, w, _ = a.shape
    rolled = np.roll(a, (h // 2, w // 2), axis=(0, 1))

    def ramp(n: int) -> np.ndarray:
        d = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (n * band)
        d = np.clip(d, 0, 1)
        return d * d * (3 - 2 * d)

    m = (ramp(h)[:, None] * ramp(w)[None, :])[..., None]
    return a * m + rolled * (1 - m)


def match_border(a: np.ndarray, ref: np.ndarray, frac: float = 0.12) -> np.ndarray:
    """Подгоняет средний цвет рамки плитки под эталон: плитка с лужей не должна выделяться квадратом."""
    h, w, _ = a.shape
    k = int(min(h, w) * frac)
    border = np.concatenate([a[:k].reshape(-1, 3), a[-k:].reshape(-1, 3), a[:, :k].reshape(-1, 3), a[:, -k:].reshape(-1, 3)])
    return a + (ref.reshape(-1, 3).mean(axis=0) - border.mean(axis=0))


def seam(a: np.ndarray) -> float:
    return float(np.abs(a[:, 0] - a[:, -1]).mean() + np.abs(a[0] - a[-1]).mean()) / 2


def main():
    cfg = json.loads(Path(sys.argv[1]).read_text())
    base = Path(sys.argv[1]).parent
    out = Path(cfg["out"])
    out.mkdir(parents=True, exist_ok=True)
    for name, spec in cfg["tiles"].items():
        a = np.asarray(Image.open(base / spec["file"]).convert("RGB")).astype(float)
        before = seam(a)
        if spec.get("seamless"):
            a = make_seamless(a)
        if spec.get("match"):
            a = match_border(a, np.asarray(Image.open(base / spec["match"]).convert("RGB")).astype(float))
        if spec.get("rot180"):
            a = a[::-1, ::-1]
        img = Image.fromarray(a.clip(0, 255).astype(np.uint8)).resize((cfg["size"],) * 2, Image.BOX)
        img.save(out / f"{name}.png")
        print(name, "шов было %.1f, стало %.1f" % (before, seam(a)))


if __name__ == "__main__":
    main()
