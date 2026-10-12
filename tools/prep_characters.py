#!/usr/bin/env python3
"""Готовит листы кадров из Gemini для игры (см. docs/ART.md, раздел 9).

Для каждого листа: вырезает пурпурный фон и тень, находит кадры (по пустым колонкам между ними),
приводит их к одному масштабу и кладёт ногами на общую линию земли, собирая ровный лист
с прозрачным фоном: public/assets/units/<имя>_<действие>.png.

Пример: python3 tools/prep_characters.py manifest.json  (формат manifest.json см. ниже)
{"out": "public/assets/units", "frame": [128, 96], "figure": 84, "characters": {
  "scientist_m": {"idle": {"file": "idle.jpg", "frames": 2}, "walk": {"file": "walk.jpg", "frames": 10, "gap": 10}}}}
Необязательно для листа: "upright" (рост кадров в долях от прямой стойки, для согнутых поз) и
"groups" (какие найденные куски склеить в кадр, если рядом с фигурой лежит отдельный предмет).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def key(img: Image.Image) -> np.ndarray:
    """RGBA: фон и тень (пурпур: красный ~ синему, зелёный намного меньше) становятся прозрачными."""
    a = np.asarray(img.convert("RGB")).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magenta = (np.abs(r - b) < 70) & (g < 0.55 * np.minimum(r, b)) & (np.minimum(r, b) > 60)
    # мягкий край: чем ближе к пурпуру, тем прозрачнее
    score = np.clip((np.minimum(r, b) - g) / np.maximum(np.minimum(r, b), 1), 0, 1)
    alpha = np.where(magenta, 0, np.where(score > 0.35, (1 - (score - 0.35) / 0.2).clip(0, 1) * 255, 255))
    out = np.dstack([a.clip(0, 255), alpha]).astype(np.uint8)
    out[..., :3][out[..., 3] == 0] = 0
    return out


def segments(alpha: np.ndarray, gap: int = 10, speck: int = 4) -> list[tuple[int, int]]:
    cols = (alpha > 128).sum(axis=0) >= speck
    segs, start, empty = [], None, 0
    for x, on in enumerate(cols):
        if on:
            if start is None:
                start = x
            empty = 0
            end = x
        elif start is not None:
            empty += 1
            if empty >= gap:
                segs.append((start, end + 1))
                start = None
    if start is not None:
        segs.append((start, end + 1))
    return segs


def prep(path: str, frames: int | None, gap: int = 10, groups: list[list[int]] | None = None):
    rgba = key(Image.open(path))
    segs = segments(rgba[..., 3], gap)
    if groups:  # ручная склейка найденных кусков в кадры, если рядом с фигурой лежит отдельный предмет
        segs = [(segs[g[0]][0], segs[g[-1]][1]) for g in groups]
    if frames and len(segs) != frames:
        print(f"  ! {path}: найдено кадров {len(segs)}, ожидалось {frames}: {segs}", file=sys.stderr)
    out = []
    for x0, x1 in segs:
        part = rgba[:, x0:x1].copy()
        ys = np.where((part[..., 3] > 128).sum(axis=1) >= 2)[0]
        part = part[ys[0] : ys[-1] + 1]
        out.append(Image.fromarray(part, "RGBA"))
    return out


def main():
    cfg = json.loads(Path(sys.argv[1]).read_text())
    base = Path(sys.argv[1]).parent
    fw, fh = cfg["frame"]
    figure = cfg["figure"]
    outdir = Path(cfg["out"])
    outdir.mkdir(parents=True, exist_ok=True)
    manifest = {"characters": []}
    for name, anims in cfg["characters"].items():
        entry = {"name": name, "anims": {}}
        scale = None
        for anim in ("idle", "walk", "work", "cold"):
            if anim not in anims:
                continue
            spec = anims[anim]
            frames = prep(str(base / spec["file"]), spec.get("frames"), spec.get("gap", 10), spec.get("groups"))
            # масштаб: рост самого высокого кадра листа (прямо стоящая фигура) = figure px
            tallest = max(f.height for f in frames)
            k = figure / (tallest / spec.get("upright", 1.0))
            sheet = Image.new("RGBA", (fw * len(frames), fh))
            for i, f in enumerate(frames):
                w, h = max(1, round(f.width * k)), max(1, round(f.height * k))
                g = f.resize((w, h), Image.BOX if k < 1 else Image.NEAREST)
                a = np.asarray(g)[..., 3]
                cx = np.average(np.arange(w), weights=(a[: max(1, int(h * 0.6))] > 128).sum(axis=0) + 1e-6)
                x = round(fw / 2 - cx)
                x = max(0, min(fw - w, x))
                sheet.paste(g, (i * fw + x, fh - 2 - h), g)
            fname = f"{name}_{anim}.png"
            sheet.save(outdir / fname)
            entry["anims"][anim] = {"file": f"units/{fname}", "frames": len(frames)}
            print(name, anim, len(frames), "кадров, масштаб", round(k, 3))
        manifest["characters"].append(entry)
    (outdir / "characters.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
