#!/usr/bin/env python3
"""Готовит здания из Gemini для игры (см. docs/ART.md, раздел 9).

Вырезает пурпурный фон, обрезает поля, уменьшает до `side` px по длинной стороне и пишет
прозрачные PNG в public/assets/buildings/. Файлы из одной группы (кадры костра) режутся по общей
рамке и масштабируются одинаково, чтобы не «прыгали».

python3 tools/prep_buildings.py manifest.json, где manifest.json:
{"out": "public/assets/buildings", "side": 192, "light": false,
 "files": {"hut": "hut.jpg", "campfire": "c0.jpg", "campfire_1": "c1.jpg"},
 "groups": [["campfire", "campfire_1"]]}
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from prep_characters import key  # noqa: E402


def bbox(rgba: np.ndarray):
    ys, xs = np.where(rgba[..., 3] > 128)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def main():
    cfg = json.loads(Path(sys.argv[1]).read_text())
    base = Path(sys.argv[1]).parent
    out = Path(cfg["out"])
    out.mkdir(parents=True, exist_ok=True)
    keyed = {n: key(Image.open(base / f)) for n, f in cfg["files"].items()}
    groups = {n: g for g in cfg.get("groups", []) for n in g}
    for name, rgba in keyed.items():
        boxes = [bbox(keyed[n]) for n in groups.get(name, [name])]
        x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
        x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
        crop = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")
        k = cfg["side"] / max(x1 - x0, y1 - y0)
        crop = crop.resize((max(1, round(crop.width * k)), max(1, round(crop.height * k))), Image.BOX)
        crop.save(out / f"{name}.png")
        print(name, crop.size)


if __name__ == "__main__":
    main()
