#!/usr/bin/env python3
"""Рисует пиксель-арт для игры прямо в коде и кладёт PNG в public/assets/.

Запуск: python3 tools/pixel_art.py  (нужен Pillow). Палитра — из docs/ART.md.
Спрайты зданий 64x64 на прозрачном фоне, поселенцы (мужчина и женщина) 32x32, тайлы земли 32x32 (по 4 варианта).
Свет всегда падает сверху слева: светлые грани слева сверху, тени справа снизу.
"""
import math
import random
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets'


def hx(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def shade(c, t):
    """t>0 светлее и теплее, t<0 темнее и холоднее."""
    return lerp(c, (255, 250, 225), min(1, t) * 0.55) if t >= 0 else lerp(c, (24, 28, 60), min(1, -t) * 0.62)


OUTLINE = hx('#2A2F3A')
SNOW, SNOW_D, SNOW_DD = hx('#E8F1F8'), hx('#C3D6E6'), hx('#9DB4CC')
EARTH, EARTH_D, EARTH_L = hx('#7A5C3E'), hx('#5E4530'), hx('#8F6E4C')
MOSS, MOSS_D, MOSS_L = hx('#6E8B4E'), hx('#58733C'), hx('#8DA866')
WOOD, WOOD_D, WOOD_L = hx('#A0703F'), hx('#7B5230'), hx('#C08A52')
METAL, METAL_D, METAL_L = hx('#6B7785'), hx('#4F5967'), hx('#8E9AA8')
RUST = hx('#B5562E')
GLOW, GLOW_L, GLOW_D = hx('#FFD447'), hx('#FFF1A8'), hx('#FF9A3C')
FIRE_R = hx('#E8602C')
WATER, WATER_D, WATER_L = hx('#4FA3C7'), hx('#3A82A3'), hx('#9AD3EA')
STONE, STONE_D, STONE_L = hx('#9AA0A8'), hx('#6F757E'), hx('#B8BEC6')
GREEN, RED, STRAW = hx('#6FAE5A'), hx('#D4543A'), hx('#C9A24B')
SKIN, COAT, SCARF = hx('#F2C9A0'), hx('#C9533A'), hx('#F0D060')

BAYER = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
LEVELS = (-0.85, -0.45, 0.0, 0.3, 0.55)


def quant(l, x, y):
    v = l + (BAYER[y % 4][x % 4] - 7.5) / 16 * 0.35
    return LEVELS[min(4, max(0, int((v + 1) / 2 * 5)))]


class Canvas:
    def __init__(self, w, h, wrap=False):
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.w, self.h, self.wrap = w, h, wrap

    def px(self, x, y, c):
        if self.wrap:
            x, y = x % self.w, y % self.h
        if 0 <= x < self.w and 0 <= y < self.h:
            self.im.putpixel((x, y), c)

    def get(self, x, y):
        if self.wrap:
            x, y = x % self.w, y % self.h
        return self.im.getpixel((x, y)) if 0 <= x < self.w and 0 <= y < self.h else (0, 0, 0, 0)

    def solid(self, x, y):
        return self.get(x, y)[3] >= 200

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)

    def line(self, x0, y0, x1, y1, c, w=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
            for dx in range(w):
                self.px(x + dx, y, c)

    def lit_ellipse(self, cx, cy, rx, ry, base, ambient=0.0):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                nx, ny = (x - cx) / rx, (y - cy) / ry
                if nx * nx + ny * ny <= 1:
                    l = -(0.55 * nx + 0.8 * ny) - 0.25 * (nx * nx + ny * ny) + ambient + 0.15
                    self.px(x, y, shade(base, quant(l, x, y)))

    def lit_rect(self, x0, y0, x1, y1, base, mode='cyl'):
        w, h = x1 - x0 + 1, y1 - y0 + 1
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if mode == 'cyl':
                    l = -((x - x0) / max(1, w - 1) * 2 - 1) * 0.85 + 0.1
                else:
                    l = 0.2 - (y - y0) / max(1, h - 1) * 0.5 - (x - x0) / max(1, w - 1) * 0.3
                self.px(x, y, shade(base, quant(l, x, y)))

    def speckle(self, x0, y0, x1, y1, col, density, seed):
        r = random.Random(seed)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if self.solid(x, y) and r.random() < density:
                    self.px(x, y, col)

    def outline(self):
        src = self.im.copy()
        for y in range(self.h):
            for x in range(self.w):
                if src.getpixel((x, y))[3] >= 200:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and src.getpixel((nx, ny))[3] >= 200:
                        self.im.putpixel((x, y), OUTLINE)
                        break

    def soft(self, cx, cy, rx, ry, col, alpha, only_empty=True):
        for y in range(self.h):
            for x in range(self.w):
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if d <= 1 and not (only_empty and self.get(x, y)[3] > 0):
                    self.px(x, y, col[:3] + (round(alpha * (1 - d * 0.5)),))

    def shadow(self, cx, cy, rx, ry):
        self.soft(cx, cy, rx, ry, (20, 30, 60), 70)

    def steam(self, puffs):
        for x, y, r in puffs:
            for yy in range(y - r, y + r + 1):
                for xx in range(x - r, x + r + 1):
                    d = (xx - x) ** 2 + (yy - y) ** 2
                    if d <= r * r and self.get(xx, yy)[3] < 200:
                        self.px(xx, yy, (255, 255, 255, 190 - round(d / (r * r) * 90)))

    def save(self, rel):
        path = OUT / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        self.im.save(path)


# ---------- тайлы 32x32: по 4 варианта снега и земли ----------
# Варианты 0 и 1 обычные и частые, 2 и 3 с особенностями (следы, лёд, лужа) и редкие, см. pick() в world.ts.
# Все детали лежат целиком внутри плитки, поэтому соседние варианты стыкуются без швов.

TILE_VARIANTS = 4


def spot(r, rx, ry):
    return r.randint(rx + 1, 30 - rx), r.randint(ry + 1, 30 - ry)


def tile_cold(idx):
    c, r = Canvas(32, 32), random.Random(100 + idx)
    c.rect(0, 0, 31, 31, SNOW)
    for _ in range((9, 6, 12, 7)[idx]):  # сугробы: тень снизу справа, светлый край сверху слева
        rx, ry = r.randint(3, 7), r.randint(2, 3)
        cx, cy = spot(r, rx + 1, ry + 1)
        for y in range(cy - ry - 1, cy + ry + 2):
            for x in range(cx - rx - 1, cx + rx + 2):
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if d <= 1:
                    c.px(x, y, SNOW_D if (y - cy) / ry > 0.15 or (x - cx) / rx > 0.55 else SNOW)
                elif d <= 1.35 and (y - cy) / ry < -0.3 and (x - cx) / rx < 0.1:
                    c.px(x, y, (255, 255, 255, 255))
    for _ in range(30):
        c.px(r.randrange(32), r.randrange(32), SNOW_D if r.random() < .7 else SNOW_DD)
    if idx == 2:  # следы (редкий вариант)
        x, y = 5, 8
        for i in range(5):
            for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
                c.px(x + dx, y + dy, SNOW_DD)
            c.px(x, y + 1, SNOW_D)
            x, y = x + 5, y + (3 if i % 2 == 0 else -3) + 1
    elif idx == 3:  # ледяная корка (редкий вариант)
        cx, cy = 16, 18
        for y in range(10, 27):
            for x in range(5, 28):
                d = ((x - cx) / 11) ** 2 + ((y - cy) / 7) ** 2
                if d <= 1:
                    c.px(x, y, hx('#BFE0F0') if d > 0.25 else hx('#D6EEF8'))
        for i in range(5):
            c.px(11 + i, 15 - i // 3, (255, 255, 255, 255))
        c.px(20, 21, hx('#8FC3DE')); c.px(21, 21, hx('#8FC3DE'))
    for _ in range(5):  # искорки
        x, y = r.randint(1, 30), r.randint(1, 30)
        c.px(x, y, (255, 255, 255, 255))
        if r.random() < .5:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                c.px(x + dx, y + dy, SNOW_D)
    c.save('tiles/ground_cold%s.png' % ('' if idx == 0 else '_%d' % idx))


def tile_warm(idx):
    c, r = Canvas(32, 32), random.Random(200 + idx)
    for y in range(32):
        for x in range(32):
            v = r.random()
            c.px(x, y, EARTH_D if v < 0.16 else EARTH_L if v < 0.3 else EARTH)
    for _ in range((7, 12, 3, 5)[idx]):  # пятна мха
        rx, ry = r.randint(2, 5), r.randint(2, 4)
        cx, cy = spot(r, rx, ry)
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 and r.random() < .85:
                    t = r.random()
                    c.px(x, y, MOSS_L if t < .2 else MOSS_D if t > .65 else MOSS)
    if idx == 3:  # лужа талой воды
        cx, cy = 16, 17
        for y in range(8, 27):
            for x in range(5, 28):
                d = ((x - cx) / 11) ** 2 + ((y - cy) / 8) ** 2
                if d <= 1.25:
                    c.px(x, y, EARTH_D)
                if d <= 1:
                    c.px(x, y, WATER_D if d > 0.55 else WATER)
        for i in range(6):
            c.px(11 + i, 14, WATER_L)
        c.px(18, 19, WATER_L); c.px(19, 19, WATER_L); c.px(14, 21, WATER_L)
    for _ in range((10, 14, 6, 8)[idx]):  # пучки травы
        x, y = r.randint(2, 29), r.randint(3, 30)
        if idx == 3 and 4 < x < 28 and 7 < y < 27:
            continue
        for dy, col in ((0, MOSS_D), (-1, MOSS), (-2, MOSS_L)):
            c.px(x, y + dy, col)
        c.px(x - 1, y - 1, MOSS); c.px(x + 1, y - 2, MOSS_L)
    for _ in range((4, 2, 10, 3)[idx]):  # камушки
        x, y = r.randint(1, 29), r.randint(1, 29)
        c.px(x, y, STONE_L); c.px(x + 1, y, STONE); c.px(x, y + 1, STONE); c.px(x + 1, y + 1, STONE_D)
    for _ in range(3):  # трещинки
        x, y = r.randint(1, 26), r.randint(1, 30)
        for i in range(4):
            c.px(x + i, y + (i % 2), EARTH_D)
    c.save('tiles/ground_warm%s.png' % ('' if idx == 0 else '_%d' % idx))


# ---------- здания 64x64 ----------

def reactor():
    c = Canvas(64, 64)
    c.lit_rect(4, 34, 9, 54, METAL_D); c.lit_rect(54, 34, 59, 54, METAL_D)          # боковые трубы
    c.lit_rect(3, 31, 10, 34, METAL); c.lit_rect(53, 31, 60, 34, METAL)
    c.lit_rect(5, 28, 8, 31, GLOW_D); c.lit_rect(55, 28, 58, 31, GLOW_D)            # светящиеся вентили
    c.lit_ellipse(32, 38, 23, 20, METAL)                                           # купол
    c.lit_rect(26, 12, 38, 22, METAL_D); c.lit_rect(24, 9, 40, 13, METAL)           # труба наверху
    c.rect(26, 9, 38, 9, GLOW_D)
    for x in (18, 32, 46):                                                         # вертикальные швы + заклёпки
        for y in range(16, 54):
            if c.solid(x, y):
                c.px(x, y, METAL_D)
                if y % 4 == 0:
                    c.px(x + 1, y, METAL_L)
    for x in range(10, 55):                                                        # горизонтальный шов
        if c.solid(x, 31):
            c.px(x, 31, METAL_D)
            if x % 4 == 0:
                c.px(x, 32, METAL_L)
    c.lit_rect(6, 48, 57, 57, METAL_D, mode='flat')                                # плита основания
    c.rect(6, 48, 57, 48, METAL_L)
    for x in range(9, 56, 7):
        c.px(x, 53, METAL_L); c.px(x + 1, 53, METAL)
    c.speckle(6, 20, 57, 57, RUST, 0.015, 3)
    c.lit_ellipse(32, 40, 10, 9, METAL_D)                                          # окно ядра: рама
    for y in range(31, 50):
        for x in range(22, 43):
            d = math.hypot(x - 32, y - 40) / 8
            if d <= 1:
                c.px(x, y, GLOW_L if d < .3 else GLOW if d < .62 else GLOW_D if d < .88 else FIRE_R)
    c.line(24, 40, 40, 40, METAL_D); c.line(32, 32, 32, 48, METAL_D)               # крестовина
    c.px(28, 36, (255, 255, 255, 255)); c.px(29, 35, (255, 255, 255, 255))
    for x in range(14, 36):                                                        # снежная шапка на куполе
        for y in range(16, 30):
            nx, ny = (x - 32) / 23, (y - 38) / 20
            if nx * nx + ny * ny <= 1 and ny < -0.72 and nx < 0.35:
                c.px(x, y, SNOW if ny < -0.82 else SNOW_D)
    c.outline()
    c.soft(32, 58, 26, 6, hx('#FF9A3C'), 70)                                       # тёплый отсвет на земле
    c.shadow(34, 60, 27, 4)
    c.steam([(31, 6, 3), (34, 2, 3), (30, 0, 2)])
    c.save('buildings/reactor.png')


def hut():
    c = Canvas(64, 64)
    c.lit_rect(12, 34, 52, 57, WOOD, mode='flat')                                  # стены
    for x in range(12, 53, 5):                                                     # доски
        c.rect(x + 4, 34, x + 4, 57, WOOD_D)
        c.rect(x, 36, x, 56, WOOD_L)
    c.speckle(12, 34, 52, 57, WOOD_D, 0.06, 5)
    c.rect(10, 55, 54, 58, STONE); c.rect(10, 55, 54, 55, STONE_L); c.rect(10, 58, 54, 58, STONE_D)  # цоколь
    for x in range(12, 54, 6):
        c.px(x, 57, STONE_D)
    for y in range(8, 36):                                                         # крыша: черепица
        hw = round((y - 8) / 27 * 28) + 3
        for x in range(32 - hw, 32 + hw + 1):
            row = (y - 8) // 3
            col = RUST if (row % 2 == 0) else shade(RUST, -0.25)
            if (x + row * 3) % 6 == 0:
                col = shade(RUST, -0.55)
            c.px(x, y, shade(col, 0.3 if x < 32 - hw * 0.3 else -0.2 if x > 32 + hw * 0.4 else 0))
    for y in range(8, 24):                                                         # снег на крыше
        hw = round((y - 8) / 27 * 28) + 1
        wave = 14 + (3 if (y * 7) % 5 < 2 else 0)
        for x in range(32 - hw + 2, 32 + hw - 1):
            if y < wave + abs(x - 32) // 6:
                c.px(x, y, SNOW if y < wave - 2 else SNOW_D)
    c.rect(4, 34, 59, 36, WOOD_D); c.rect(4, 34, 59, 34, WOOD)                       # свес крыши
    for x in range(6, 58, 6):                                                      # сосульки
        c.px(x, 37, SNOW_D); c.px(x, 38, WATER_L)
    c.lit_rect(42, 10, 50, 28, STONE_D, mode='cyl'); c.lit_rect(40, 7, 52, 11, STONE)   # труба
    c.rect(41, 7, 51, 7, SNOW)
    for y in range(12, 28, 4):
        c.rect(42, y, 50, y, STONE_D)
    c.lit_rect(27, 42, 38, 57, WOOD_D)                                             # дверь
    for x in (30, 34):
        c.rect(x, 43, x, 56, shade(WOOD_D, -0.5))
    c.rect(27, 41, 38, 41, WOOD); c.px(36, 50, GLOW); c.px(36, 51, GLOW_D)
    c.rect(26, 57, 39, 58, STONE_L)                                                # порог
    for x0 in (15, 43):                                                            # окна с тёплым светом
        c.rect(x0 - 1, 41, x0 + 8, 51, WOOD_D)
        for y in range(42, 51):
            for x in range(x0, x0 + 8):
                c.px(x, y, GLOW_L if (x < x0 + 3 and y < 45) else GLOW if y < 47 else GLOW_D)
        c.line(x0 + 4, 42, x0 + 4, 50, WOOD_D); c.line(x0, 46, x0 + 7, 46, WOOD_D)
        c.rect(x0 - 2, 52, x0 + 9, 52, WOOD_L)
    c.outline()
    c.soft(10, 59, 6, 2, SNOW, 230); c.soft(54, 60, 5, 2, SNOW, 230)               # сугробики у стен
    c.shadow(36, 61, 28, 3)
    c.soft(46, 51, 12, 6, hx('#FFD447'), 35)                                       # свет из окон на землю
    c.steam([(46, 4, 3), (49, 0, 3)])
    c.save('buildings/hut.png')


def campfire():
    c = Canvas(64, 64)
    c.lit_ellipse(32, 50, 24, 8, SNOW_D)                                           # проталина
    c.lit_ellipse(32, 51, 20, 6, EARTH_D)
    for i in range(11):                                                            # кольцо камней
        a = i / 11 * math.tau
        x, y = 32 + math.cos(a) * 19, 51 + math.sin(a) * 6
        c.lit_ellipse(x, y, 4, 3.2, STONE if i % 2 else STONE_L)
        c.px(round(x - 1), round(y - 2), (255, 255, 255, 255))
    for (x0, y0, x1, y1) in ((16, 47, 46, 55), (18, 55, 48, 46)):                   # скрещённые брёвна
        c.line(x0, y0, x1, y1, WOOD_D, 5); c.line(x0, y0 - 1, x1, y1 - 1, WOOD, 3)
        c.line(x0, y0 - 2, x1, y1 - 2, WOOD_L, 1)
    for x, y in ((14, 47), (49, 46)):                                              # торцы брёвен
        c.lit_ellipse(x, y, 3, 3, WOOD_L); c.px(x, y, WOOD_D)
    def flame(cx, base, h, hw, col, sway):
        for y in range(base - h, base + 1):
            t = (base - y) / h
            w = hw * math.sin(math.pi * min(1, (1 - t) ** 0.65 + 0.001)) ** 0.9
            off = sway * (t ** 2)
            for x in range(round(cx + off - w), round(cx + off + w) + 1):
                c.px(x, y, col)
    flame(32, 50, 34, 11, FIRE_R, 2)
    flame(30, 50, 28, 8, GLOW_D, -1)
    flame(34, 50, 22, 6, GLOW, 1)
    flame(32, 50, 14, 3.5, GLOW_L, 0)
    flame(21, 50, 14, 4, FIRE_R, -2); flame(43, 50, 12, 4, FIRE_R, 2)
    c.outline()
    for x, y in ((24, 14), (40, 10), (34, 6), (28, 20)):                           # искры
        c.px(x, y, GLOW); c.px(x + 1, y + 1, GLOW_D)
    c.soft(32, 52, 28, 9, hx('#FF9A3C'), 60)
    c.save('buildings/campfire.png')


def gatherer():
    c = Canvas(64, 64)
    c.lit_rect(6, 24, 10, 57, WOOD_D); c.lit_rect(53, 24, 57, 57, WOOD_D)            # столбы
    for y in range(14, 30):                                                        # соломенная крыша
        for x in range(2, 62):
            base = STRAW if (x + y // 2) % 5 else shade(STRAW, -0.4)
            c.px(x, y, shade(base, 0.25 if y < 19 else -0.15 if y > 25 else 0))
    for x in range(2, 62, 4):
        c.px(x, 30, STRAW); c.px(x + 1, 31, shade(STRAW, -0.4))                     # неровный край соломы
    for y in range(8, 18):                                                         # снег
        for x in range(4, 60):
            if y < 11 + (x * 3 % 5) // 2:
                c.px(x, y, SNOW if y < 12 else SNOW_D)
    c.lit_rect(8, 46, 55, 57, WOOD, mode='flat')                                   # прилавок
    for x in range(10, 55, 7):
        c.rect(x, 48, x, 57, WOOD_D)
    c.rect(6, 45, 57, 46, WOOD_L); c.rect(6, 47, 57, 47, WOOD_D)
    for x in (14, 25, 38, 49):                                                     # сушёные травы и грибы
        c.line(x, 31, x, 37, WOOD_D)
        for dy in range(3):
            c.px(x - 1, 36 + dy, GREEN); c.px(x + 1, 37 + dy, MOSS_D); c.px(x, 38 + dy, MOSS)
    for x0, kind in ((11, 'apple'), (23, 'mush'), (35, 'carrot'), (46, 'berry')):  # корзинки с едой
        c.lit_ellipse(x0 + 4, 44, 6.5, 4, WOOD_L)
        for x in range(x0 - 1, x0 + 10, 2):
            c.px(x, 44, WOOD_D)
        if kind == 'apple':
            for ax, ay in ((x0 + 1, 39), (x0 + 5, 38), (x0 + 8, 40), (x0 + 3, 41)):
                c.lit_ellipse(ax, ay, 2.5, 2.5, RED)
        elif kind == 'mush':
            for ax, ay in ((x0 + 1, 40), (x0 + 6, 39), (x0 + 8, 41)):
                c.rect(ax, ay + 1, ax + 1, ay + 3, SNOW_D); c.lit_ellipse(ax + .5, ay, 3, 2, RED)
                c.px(ax, ay - 1, (255, 255, 255, 255))
        elif kind == 'carrot':
            for k in range(5):
                c.line(x0 + 2 + k * 2, 36, x0 + 3 + k, 43, GLOW_D, 2); c.px(x0 + 2 + k * 2, 35, GREEN)
        else:
            for ax, ay in ((x0 + 1, 41), (x0 + 4, 39), (x0 + 7, 41), (x0 + 5, 42), (x0 + 2, 39)):
                c.lit_ellipse(ax, ay, 2, 2, hx('#6B4FA0'))
    c.outline()
    c.soft(8, 59, 6, 2, SNOW, 230)
    c.shadow(32, 61, 28, 3)
    c.save('buildings/gatherer.png')


def woodcutter():
    c = Canvas(64, 64)
    for (x0, y0) in ((38, 44), (50, 44), (32, 33), (44, 33), (38, 22)):             # поленница: торцы
        pass
    for row, xs in ((50, (40, 51, 62)), (40, (45.5, 56.5)), (30, (51,))):
        for x in xs:
            c.lit_ellipse(x - 4, row + 3, 5.5, 5.5, WOOD_D)
            c.lit_ellipse(x - 4, row + 3, 4.2, 4.2, WOOD_L)
            c.lit_ellipse(x - 4, row + 3, 2.4, 2.4, WOOD)
            c.px(round(x - 4), row + 3, WOOD_D)
    c.rect(38, 24, 56, 27, SNOW); c.rect(40, 23, 54, 23, SNOW_D)
    c.lit_rect(8, 38, 34, 57, WOOD, mode='cyl')                                    # пень
    for x in range(9, 34, 3):
        c.line(x, 41, x, 56, WOOD_D)
    c.lit_ellipse(21, 38, 13.5, 6, WOOD_L)                                         # спил
    for rx, ry, col in ((11, 4.6, WOOD), (8, 3.3, WOOD_L), (5, 2.2, WOOD), (2, 1.2, WOOD_D)):
        for y in range(30, 46):
            for x in range(6, 36):
                d = ((x - 21) / rx) ** 2 + ((y - 38) / ry) ** 2
                if 0.55 < d <= 1:
                    c.px(x, y, col)
    c.line(21, 36, 12, 8, WOOD_D, 3); c.line(21, 36, 12, 8, WOOD, 1)               # топор
    c.rect(4, 4, 18, 8, METAL); c.rect(4, 4, 18, 5, METAL_L); c.rect(3, 6, 6, 12, METAL_L)
    c.rect(4, 9, 18, 9, METAL_D); c.px(3, 12, (255, 255, 255, 255))
    c.outline()
    r = random.Random(7)
    for _ in range(14):                                                            # щепки
        c.px(r.randint(4, 38), r.randint(57, 60), WOOD_L)
    c.soft(8, 59, 5, 2, SNOW, 230)
    c.shadow(32, 61, 28, 3)
    c.save('buildings/woodcutter.png')


def quarry():
    c = Canvas(64, 64)
    for (cx, cy, rx, ry, col) in ((20, 46, 17, 11, STONE), (42, 38, 15, 15, STONE_L), (30, 52, 13, 7, STONE_D),
                                  (52, 50, 10, 8, STONE)):
        c.lit_ellipse(cx, cy, rx, ry, col)
    c.line(36, 30, 42, 42, STONE_D, 1); c.line(42, 42, 38, 50, STONE_D, 1); c.line(12, 40, 18, 48, STONE_D, 1)
    for x, y in ((15, 44), (28, 49), (47, 44)):                                    # кристаллы в породе
        c.rect(x, y, x + 1, y + 2, WATER_L); c.px(x, y + 2, WATER)
    for y in range(24, 40):                                                        # снег на скале
        for x in range(28, 56):
            if c.solid(x, y) and ((x - 42) / 14) ** 2 + ((y - 38) / 15) ** 2 > 0.62 and y < 31 + (x * 5 % 4):
                c.px(x, y, SNOW if y < 30 else SNOW_D)
    for (x0, y0) in ((4, 46), (10, 52)):                                           # тёсаные блоки
        c.lit_rect(x0, y0, x0 + 12, y0 + 8, STONE_L, mode='flat')
        for x in range(x0 + 1, x0 + 14):
            c.px(x, y0 - 1, STONE_L); c.px(x, y0 - 2 + (x % 2), SNOW_D)
        c.rect(x0 + 12, y0, x0 + 12, y0 + 8, STONE_D)
    c.line(52, 55, 58, 22, WOOD_D, 3); c.line(52, 55, 58, 22, WOOD, 1)             # кирка
    c.rect(48, 18, 62, 21, METAL); c.rect(48, 18, 62, 18, METAL_L); c.rect(47, 20, 49, 24, METAL_L)
    c.rect(61, 20, 63, 24, METAL_D)
    c.outline()
    c.soft(8, 59, 6, 2, SNOW, 230)
    c.shadow(32, 61, 29, 3)
    c.save('buildings/quarry.png')


def purifier():
    c = Canvas(64, 64)
    c.lit_rect(16, 24, 42, 56, METAL, mode='cyl')                                  # бочка
    for y in (30, 40, 50):
        c.rect(16, y, 42, y + 1, METAL_D); c.rect(16, y - 1, 42, y - 1, METAL_L)
    c.speckle(16, 24, 42, 56, RUST, 0.015, 9)
    c.lit_ellipse(29, 24, 13.5, 3.5, METAL_L)                                      # крышка
    c.lit_ellipse(24, 38, 4, 4, METAL_D); c.lit_ellipse(24, 38, 3, 3, SNOW_D)       # манометр
    c.line(24, 38, 26, 36, RED)
    c.rect(22, 20, 36, 21, METAL_D)                                                # воронка
    for y in range(6, 20):
        hw = 12 - (y - 6) * 0.62
        for x in range(round(29 - hw), round(29 + hw) + 1):
            c.px(x, y, shade(METAL_L, 0.4 - (x - (29 - hw)) / max(1, 2 * hw) * 0.9))
    c.rect(16, 5, 42, 6, METAL_L); c.rect(16, 7, 42, 7, METAL_D)
    c.lit_rect(44, 34, 49, 38, METAL_D); c.lit_rect(48, 24, 62, 54, WATER_L, mode='cyl')   # фильтр-колонна
    for y in range(26, 54):
        for x in range(50, 61):
            band = (y - 26) // 9
            col = [WATER_L, hx('#3B3B44'), hx('#D8C58A'), WATER][min(3, band)]
            c.px(x, y, shade(col, 0.3 - (x - 50) / 11 * 0.7))
    c.rect(48, 22, 62, 24, METAL); c.rect(48, 54, 62, 56, METAL_D)
    c.lit_rect(8, 50, 14, 52, METAL_D)                                             # кран и струя
    c.rect(11, 52, 12, 58, WATER_L)
    c.lit_rect(2, 50, 20, 60, WOOD, mode='cyl')                                    # ведро
    for y in (52, 58):
        c.rect(2, y, 20, y, WOOD_D)
    c.lit_ellipse(11, 50, 9.5, 2.6, WATER); c.px(8, 50, WATER_L); c.px(9, 49, WATER_L)
    c.outline()
    c.steam([(27, 2, 2), (31, 0, 2)])
    c.soft(8, 62, 6, 2, SNOW, 230)
    c.shadow(32, 62, 29, 2)
    c.save('buildings/purifier.png')


# ---------- поселенцы 32x32: мужчина и женщина ----------

BOOT, MITTEN = hx('#3F2E2A'), hx('#5C7BB5')


def person(rel, hair, hat, coat, scarf, pants, female):
    c = Canvas(32, 32)
    hair_d = shade(hair, -0.35)
    if female:  # длинные волосы сзади
        c.lit_ellipse(15.5, 14, 9.5, 10, hair)
        c.lit_rect(6, 12, 10, 25, hair); c.lit_rect(21, 12, 25, 25, shade(hair, -0.2))
        c.px(8, 25, hair_d); c.px(23, 25, hair_d)
    # ноги и обувь
    if female:
        c.lit_rect(11, 26, 13, 29, hx('#3A3A4A'), mode='flat'); c.lit_rect(18, 26, 20, 29, hx('#3A3A4A'), mode='flat')
    else:
        c.lit_rect(10, 24, 21, 29, pants, mode='cyl'); c.line(15, 26, 15, 29, shade(pants, -0.6))
    c.lit_rect(9, 29, 14, 31, BOOT, mode='flat'); c.lit_rect(17, 29, 22, 31, BOOT, mode='flat')
    c.rect(9, 29, 14, 29, shade(BOOT, 0.5)); c.rect(17, 29, 22, 29, shade(BOOT, 0.5))
    # пальто: у женщины расходится книзу
    for y in range(17, 28 if female else 26):
        hw = 7.5 + ((y - 17) * 0.32 if female else 0)
        for x in range(round(15.5 - hw), round(15.5 + hw) + 1):
            l = -((x - 15.5) / hw) * 0.85 + 0.1 - (y - 17) * 0.02
            c.px(x, y, shade(coat, quant(l, x, y)))
    c.lit_rect(5, 18, 8, 25, shade(coat, -0.15)); c.lit_rect(23, 18, 26, 25, shade(coat, -0.35))   # рукава
    c.lit_ellipse(6.5, 26, 2.4, 2.4, MITTEN); c.lit_ellipse(24.5, 26, 2.4, 2.4, shade(MITTEN, -0.2))
    belt_y = 22 if female else 24
    c.rect(8, belt_y, 23, belt_y, hx('#5E3A28')); c.rect(15, belt_y, 16, belt_y, GLOW)
    for y in range(19, belt_y):
        c.px(15, y, SNOW_D); c.px(16, y, SNOW_D)                                    # пуговицы
    if not female:
        c.rect(10, 20, 12, 21, shade(coat, -0.4)); c.rect(10, 20, 12, 20, shade(coat, 0.2))   # карман
    if female:  # шарф с хвостом
        c.lit_rect(8, 16, 23, 18, scarf, mode='cyl'); c.lit_rect(19, 18, 22, 24, shade(scarf, -0.2))
        for x in range(8, 24, 3):
            c.px(x, 17, shade(scarf, -0.4))
    else:       # меховой воротник
        c.lit_rect(7, 16, 24, 18, SNOW_D, mode='cyl')
        for x in range(8, 24, 2):
            c.px(x, 18, SNOW); c.px(x + 1, 19, SNOW_D)
    # голова
    for y in range(3, 19):                                                           # лицо: ровный цвет, тень только снизу справа
        for x in range(7, 25):
            nx, ny = (x - 15.5) / 7.2, (y - 11) / 6.5
            if nx * nx + ny * ny <= 1:
                c.px(x, y, shade(SKIN, -0.18) if 0.6 * nx + 0.8 * ny > 0.62 else SKIN)
    c.rect(11, 11, 12, 12, OUTLINE); c.rect(19, 11, 20, 12, OUTLINE)
    c.px(11, 11, (255, 255, 255, 255)); c.px(19, 11, (255, 255, 255, 255))
    if female:
        c.px(10, 10, OUTLINE); c.px(21, 10, OUTLINE)                                 # ресницы
        c.rect(9, 13, 10, 14, hx('#EE8F86')); c.rect(21, 13, 22, 14, hx('#EE8F86'))
        c.rect(15, 15, 16, 15, hx('#C8404A'))
        c.rect(8, 7, 23, 9, hair)                                                    # чёлка
        for x in range(9, 23, 2):
            c.px(x, 9, hair_d)
        c.px(15, 8, shade(hair, 0.4)); c.px(16, 8, shade(hair, 0.4))
    else:
        c.rect(9, 13, 10, 13, hx('#E9998A')); c.rect(21, 13, 22, 13, hx('#E9998A'))
        c.rect(14, 15, 17, 15, hx('#B8604A'))
        c.rect(8, 8, 9, 13, hair); c.rect(22, 8, 23, 13, hair_d)                     # бакенбарды
        r = random.Random(4)
        for x in range(10, 22):                                                      # щетина
            for y in (14, 15, 16):
                if c.get(x, y) in (SKIN, shade(SKIN, -0.18)) and r.random() < 0.35:
                    c.px(x, y, shade(hair, -0.1))
    # шапка
    for y in range(2, 8):
        hw = 8 - (7 - y) // 3
        for x in range(round(15.5 - hw), round(15.5 + hw) + 1):
            c.px(x, y, shade(hat, 0.4 - (x - (15.5 - hw)) / (2 * hw) * 0.9))
    for x in range(7, 25):                                                           # отворот с вязкой
        c.px(x, 7, SNOW if x % 2 else SNOW_D); c.px(x, 8, SNOW_D if x % 2 else SNOW)
    if female:
        c.lit_ellipse(15.5, 1.5, 2.6, 2.6, RED)
    c.outline()
    c.shadow(16, 31, 11, 1.5)
    c.save(rel)


def settler_female():
    person('units/settler_female.png', hx('#A8532B'), hx('#F2E3C0'), COAT, SCARF, None, True)


def settler_male():
    person('units/settler_male.png', hx('#5A3A24'), hx('#3E5E8A'), hx('#4F7F6B'), None, hx('#6B5A48'), False)


if __name__ == '__main__':
    for i in range(TILE_VARIANTS):
        tile_cold(i)
        tile_warm(i)
    for f in (reactor, hut, campfire, gatherer, woodcutter, quarry, purifier, settler_male, settler_female):
        f()
    print('ok')
