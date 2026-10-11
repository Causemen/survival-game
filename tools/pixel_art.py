#!/usr/bin/env python3
"""Рисует пиксель-арт для игры прямо в коде и кладёт PNG в public/assets/.

Стиль и палитра взяты у набора Winter Story (CC0, Brosnya): 16x16, жирный тёмный контур,
три тона заливки без дизеринга, свет сверху слева, холодные голубые тени снега.
Запуск: python3 tools/pixel_art.py  (нужен Pillow). Здания и люди рисуются «картой символов»
14x14 внутри холста 16x16; контур добавляется автоматически. Реактор 24x24, тайлы земли 16x16.
"""
import random
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets'


def hx(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


OUTLINE = hx('#18051a')
# Палитра Winter Story (см. wintercode-32x.png в архиве набора).
PAL = {
    'W': '#f2ffff', 'w': '#c3dfe0', 'c': '#8acfdb', 'b': '#72a6c2', 'B': '#31376b',
    'T': '#649e91', 't': '#458282', 'L': '#a7d694',
    'k': '#5c3c2e', 'n': '#91745c', 'N': '#c7a379', 'y': '#e0c892', 'Y': '#ebe5ab', 'j': '#2b171b',
    'g': '#a0b6b8', 'G': '#8d9da1', 'S': '#5f6470', 'D': '#3b3947', 'd': '#24212b',
    'r': '#b35054', 'R': '#a1234d', 'p': '#bd726f', 'm': '#944e87',
    's': '#cfaa80', 'q': '#c28d6b', 'O': '#18051a',
}
COL = {k: hx(v) for k, v in PAL.items()}


class Canvas:
    def __init__(self, w, h):
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.w, self.h = w, h

    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.im.putpixel((x, y), COL[c] if isinstance(c, str) else c)

    def get(self, x, y):
        return self.im.getpixel((x, y)) if 0 <= x < self.w and 0 <= y < self.h else (0, 0, 0, 0)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)

    def blit(self, rows, ox, oy):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != '.':
                    self.px(ox + x, oy + y, ch)

    def outline(self):
        src = self.im.copy()
        for y in range(self.h):
            for x in range(self.w):
                if src.getpixel((x, y))[3]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and src.getpixel((nx, ny))[3]:
                        self.im.putpixel((x, y), OUTLINE)
                        break

    def save(self, rel):
        path = OUT / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        self.im.save(path)


def sprite(rel, rows, size=16):
    """rows — 14 строк по 14 символов; рисуем со сдвигом 1, потом обводим."""
    for r in rows:
        assert len(r) == 14, (rel, r, len(r))
    assert len(rows) == 14, (rel, len(rows))
    c = Canvas(size, size)
    c.blit(rows, 1, 1)
    c.outline()
    c.save(rel)


# ---------- тайлы 16x16 ----------

def tile_cold(idx):
    r = random.Random(300 + idx)
    c = Canvas(16, 16)
    c.rect(0, 0, 15, 15, 'W')
    for _ in range((5, 4, 3, 4)[idx]):          # голубоватые тени сугробов
        x, y, n = r.randint(0, 11), r.randint(1, 14), r.randint(3, 5)
        for i in range(n):
            c.px(x + i, y, 'w')
        c.px(x + 1, y + 1, 'w')
    for _ in range(3):                           # ледяные искорки
        c.px(r.randint(0, 15), r.randint(0, 15), 'c')
    if idx == 2:                                 # следы
        for x, y in ((3, 4), (4, 4), (3, 5), (8, 8), (9, 8), (9, 9), (12, 12), (13, 12), (12, 13)):
            c.px(x, y, 'b')
    if idx == 3:                                 # замёрзшая трава
        for x, y in ((9, 10), (10, 9), (11, 10), (10, 10), (10, 11)):
            c.px(x, y, 'T')
        c.px(10, 9, 't'); c.px(9, 10, 't'); c.px(11, 11, 'c')
    c.save('tiles/ground_cold%s.png' % ('' if idx == 0 else '_%d' % idx))


def tile_warm(idx):
    r = random.Random(400 + idx)
    c = Canvas(16, 16)
    c.rect(0, 0, 15, 15, 'n')
    for _ in range((10, 8, 9, 7)[idx]):          # тёмные комки земли
        x, y = r.randint(0, 14), r.randint(0, 15)
        c.px(x, y, 'k'); c.px(x + 1, y, 'k') if r.random() < .5 else None
    for _ in range(6):                           # светлые крапинки
        c.px(r.randint(0, 15), r.randint(0, 15), 'N')
    for _ in range((3, 4, 1, 2)[idx]):           # пучки травы
        x, y = r.randint(1, 13), r.randint(2, 14)
        c.px(x, y, 't'); c.px(x + 1, y, 'T'); c.px(x + 1, y - 1, 'L'); c.px(x, y - 1, 'T')
    if idx == 2:                                 # камушки
        for x, y in ((3, 3), (11, 9), (6, 12)):
            c.px(x, y, 'g'); c.px(x + 1, y, 'G'); c.px(x, y + 1, 'S')
    if idx == 3:                                 # лужа
        for x, y, ch in ((6, 7, 'b'), (7, 7, 'c'), (8, 7, 'b'), (5, 8, 'b'), (6, 8, 'c'), (7, 8, 'W'), (8, 8, 'c'),
                         (9, 8, 'b'), (6, 9, 'b'), (7, 9, 'b'), (8, 9, 'b')):
            c.px(x, y, ch)
    c.save('tiles/ground_warm%s.png' % ('' if idx == 0 else '_%d' % idx))


TILE_VARIANTS = 4

# ---------- здания 16x16 (карты 14x14) ----------

HUT = [
    "......ww......",
    "....wWWWWw....",
    "...wWWWWWWb...",
    "..wWWWWWWWbb..",
    ".nNNNNNNNNNNn.",
    ".nnnnnnnnnnnn.",
    "..kNNNNNNNNk..",
    "..kNyyNNyyNk..",
    "..kNyyNNyyNk..",
    "..kNNNNNNNNk..",
    "..kNNkkkkNNk..",
    "..kNNkkkYNNk..",
    "..kNNkkkkNNk..",
    "..GGGGGGGGGG..",
]

CAMPFIRE = [
    ".......r......",
    "......rr......",
    "......rYr.....",
    ".....rrYYr....",
    ".....rYYYYr...",
    ".....rYyyYr...",
    "......ryyrr...",
    "..nnn.rrr.nnn.",
    ".nNnkkNnNkknNn",
    "GgnNNkNNNkNNnG",
    "gGSgGnnnnGgSGg",
    ".SDSgSDDSgSDS.",
    "..DSDSDDSDSD..",
    "....wwwwww....",
]

GATHERER = [
    "..WWWWWWWWWW..",
    ".WWwWWWWWWwbW.",
    "rrWWrrWWrrWWrr",
    "rrWWrrWWrrWWrr",
    ".k..........k.",
    ".k...T..p...k.",
    ".k...T..p...k.",
    ".k.rrr.LLL..k.",
    ".kNNNNNNNNNNk.",
    ".knnnnnnnnnnk.",
    ".kNnNnNnNnNnk.",
    ".knnnnnnnnnnk.",
    ".kk........kk.",
    "..wwwwwwwwww..",
]

WOODCUTTER = [
    "..............",
    "........GGg...",
    "........nGGg..",
    ".......n.GG...",
    "......n.......",
    ".....n........",
    ".NyyyyyyN.....",
    ".NyNNNNyN.....",
    ".nnnnnnnn.yNNy",
    ".nknnknkn.NnnN",
    ".nnnnnnnn.NnnN",
    ".kkkkkkkk.kkkk",
    "..............",
    "..wwwwwwwwww..",
]

QUARRY = [
    "..............",
    "....wWWWw.....",
    "..gwWWWWWwgg..",
    ".gGGgwwwwGGGg.",
    ".gGGGGGGGGSSg.",
    "gGGGGGGGSSSSSg",
    "gGGSGGGGSSSSDg",
    "GGSSSGGSSSDDDS",
    "GSSSSSSSSDDDDS",
    "SSSDSSSSDDDDdS",
    ".SSDDDDDDDddS.",
    "..SSSSSSSSSS..",
    "..............",
    "..wwwwwwwwww..",
]

PURIFIER = [
    "...gggggggg...",
    "....gGGGGg....",
    ".....gGGg.....",
    "..GGGGGGGG....",
    "..gGGGGGGS....",
    "..gGbbbbGS....",
    "..gGbcbbGS....",
    "..gGbbbbGSSSG.",
    "..gGGGGGGS..GG",
    "..GGGGGGSS..Gb",
    "..GSSSSSSS.nnn",
    "..SSDDDDDS.nbn",
    "..DDDDDDDD.kkk",
    "..wwwwwwwwww..",
]

SETTLER_F = [
    "......pp......",
    "....rrrrrr....",
    "...rrrrrrrr...",
    "...WWWWWWWW...",
    "...nssssssn...",
    "...nsOssOsn...",
    "...nssssssn...",
    "...nYYYYYYn...",
    ".bbrrrrrrrrbb.",
    "..brrrrrrrrb..",
    "...rrrrrrrr...",
    "...rrrrrrrr...",
    "....kk..kk....",
    "....kk..kk....",
]

SETTLER_M = [
    "..............",
    "....bbbbbb....",
    "...bbbbbbbb...",
    "...WWWWWWWW...",
    "...kssssssk...",
    "...ksOssOsk...",
    "...kssqqssk...",
    "...WWWWWWWW...",
    ".bbTTTTTTTTbb.",
    "..bTTTTTTTTb..",
    "...TTTkkTTT...",
    "...TTTTTTTT...",
    "....kk..kk....",
    "....kk..kk....",
]


# ---------- реактор 24x24 ----------

def reactor():
    c = Canvas(24, 24)
    cx, cy = 11.5, 12.5
    for y in range(24):
        for x in range(24):
            nx, ny = (x - cx) / 9.8, (y - cy) / 8.6
            d = nx * nx + ny * ny
            if d <= 1 and y <= 19:                                  # купол
                l = -(0.55 * nx + 0.8 * ny)
                c.px(x, y, 'g' if l > 0.45 else 'G' if l > -0.25 else 'S')
    c.rect(2, 17, 21, 21, 'S'); c.rect(2, 17, 21, 17, 'G'); c.rect(2, 21, 21, 21, 'D')   # плита
    for x in range(4, 21, 4):
        c.px(x, 19, 'g')
    c.rect(9, 1, 14, 4, 'S'); c.rect(9, 1, 14, 1, 'G'); c.rect(10, 0, 13, 0, 'W')        # труба + снег
    for y in range(5, 8):
        for x in range(6, 12):
            if c.get(x, y)[3]:
                c.px(x, y, 'W' if y == 5 else 'w')
    core = ((9, 10, 'p'), (10, 9, 'y'), (11, 9, 'y'), (12, 9, 'y'), (13, 10, 'p'), (8, 11, 'p'), (9, 11, 'y'), (10, 11, 'Y'),
            (11, 11, 'Y'), (12, 11, 'Y'), (13, 11, 'y'), (14, 11, 'p'), (8, 12, 'p'), (9, 12, 'y'), (10, 12, 'Y'), (11, 12, 'Y'),
            (12, 12, 'Y'), (13, 12, 'y'), (14, 12, 'p'), (9, 13, 'p'), (10, 13, 'y'), (11, 13, 'y'), (12, 13, 'y'), (13, 13, 'p'),
            (10, 14, 'p'), (11, 14, 'p'), (12, 14, 'p'))
    for x, y, ch in core:                                           # светящееся ядро
        c.px(x, y, ch)
    for x in (4, 18):                                               # боковые вентили
        c.rect(x, 14, x + 1, 16, 'D'); c.px(x, 14, 'p'); c.px(x + 1, 14, 'y')
    c.outline()
    c.save('buildings/reactor.png')


if __name__ == '__main__':
    for i in range(TILE_VARIANTS):
        tile_cold(i)
        tile_warm(i)
    sprite('buildings/hut.png', HUT)
    sprite('buildings/campfire.png', CAMPFIRE)
    sprite('buildings/gatherer.png', GATHERER)
    sprite('buildings/woodcutter.png', WOODCUTTER)
    sprite('buildings/quarry.png', QUARRY)
    sprite('buildings/purifier.png', PURIFIER)
    sprite('units/settler_female.png', SETTLER_F)
    sprite('units/settler_male.png', SETTLER_M)
    reactor()
    print('ok')
