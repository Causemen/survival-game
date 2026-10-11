#!/usr/bin/env python3
"""Рисует пиксель-арт для игры прямо в коде и кладёт PNG в public/assets/.

Запуск: python3 tools/pixel_art.py  (нужен Pillow). Палитра — из docs/ART.md.
Спрайты 32x32 на прозрачном фоне, тайлы 16x16 (бесшовные), поселенец 16x16.
"""
import random
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets'

def hx(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5)) + (255,)

OUTLINE = hx('#2A2F3A')
SNOW, SNOW_D, SNOW_DD = hx('#E8F1F8'), hx('#C3D6E6'), hx('#9DB4CC')
EARTH, EARTH_D, EARTH_L = hx('#7A5C3E'), hx('#5E4530'), hx('#8F6E4C')
MOSS, MOSS_D = hx('#6E8B4E'), hx('#58733C')
WOOD, WOOD_D, WOOD_L = hx('#A0703F'), hx('#7B5230'), hx('#C08A52')
METAL, METAL_D, METAL_L = hx('#6B7785'), hx('#4F5967'), hx('#8E9AA8')
RUST = hx('#B5562E')
GLOW, GLOW_L, GLOW_D = hx('#FFD447'), hx('#FFF1A8'), hx('#FF9A3C')
WATER, WATER_D = hx('#4FA3C7'), hx('#3A82A3')
STONE, STONE_D, STONE_L = hx('#9AA0A8'), hx('#6F757E'), hx('#B8BEC6')
GREEN, RED = hx('#6FAE5A'), hx('#D4543A')
SKIN, COAT, COAT_D, SCARF = hx('#F2C9A0'), hx('#C9533A'), hx('#9C3E2B'), hx('#F0D060')


class Canvas:
    def __init__(self, w, h):
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.w, self.h = w, h

    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.im.putpixel((x, y), c)

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(self.h):
            for x in range(self.w):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                    self.px(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            self.px(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)

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


def tile_cold():
    c, r = Canvas(16, 16), random.Random(1)
    for y in range(16):
        for x in range(16):
            v = r.random()
            c.px(x, y, SNOW_D if v < 0.07 else SNOW_DD if v < 0.09 else (255, 255, 255, 255) if v > 0.985 else SNOW)
    c.save('tiles/ground_cold.png')


def tile_warm():
    c, r = Canvas(16, 16), random.Random(2)
    for y in range(16):
        for x in range(16):
            v = r.random()
            c.px(x, y, EARTH_D if v < 0.12 else EARTH_L if v < 0.24 else EARTH)
    for _ in range(5):  # пятна мха; координаты по модулю, чтобы плитка стыковалась
        x, y = r.randrange(16), r.randrange(16)
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1) if r.random() < .5 else (-1, 0)):
            c.px((x + dx) % 16, (y + dy) % 16, MOSS if r.random() < .7 else MOSS_D)
    for _ in range(2):
        x, y = r.randrange(15), r.randrange(15)
        c.px(x, y, STONE_L)
        c.px(x + 1, y, STONE)
    c.save('tiles/ground_warm.png')


def reactor():
    c = Canvas(32, 32)
    c.rect(5, 24, 26, 28, METAL_D)                      # основание
    c.rect(5, 24, 26, 25, METAL)
    c.ellipse(15.5, 18, 11, 10, METAL)                  # купол
    c.ellipse(13.5, 15.5, 6.5, 5.5, METAL_L)            # блик слева сверху
    c.rect(6, 22, 25, 24, METAL)
    for x in (9, 15, 21):                               # заклёпки
        c.px(x, 10 + (x % 5), METAL_D)
    c.line(6, 19, 25, 19, METAL_D)                      # шов
    c.ellipse(15.5, 20, 4.5, 4, GLOW_D)                 # окно ядра
    c.ellipse(15.5, 20, 3, 2.6, GLOW)
    c.rect(14, 19, 15, 19, GLOW_L)
    for x0 in (3, 27):                                  # трубы со светящимися вентилями
        c.rect(x0, 18, x0 + 1, 27, METAL_D)
        c.px(x0, 17, GLOW_D)
        c.px(x0 + 1, 17, GLOW)
    for x, y in ((14, 4), (16, 3), (15, 2), (17, 1)):   # пар
        c.px(x, y, (255, 255, 255, 200))
    c.px(6, 8, SNOW); c.px(7, 8, SNOW); c.px(8, 9, SNOW)  # снег на куполе
    c.outline()
    c.save('buildings/reactor.png')


def hut():
    c = Canvas(32, 32)
    c.rect(7, 16, 25, 28, WOOD)                         # стены
    for x in range(8, 25, 4):
        c.rect(x, 16, x, 28, WOOD_D)
    c.rect(7, 16, 25, 17, WOOD_L)
    for i in range(10):                                 # крыша
        c.rect(5 + i, 15 - i, 27 - i, 15 - i, WOOD_D if i % 2 else RUST)
    c.rect(11, 10, 21, 10, SNOW_D)
    for i in range(5):                                  # снег на крыше
        c.rect(11 + i, 10 + i // 2 * 0, 21 - i, 10, SNOW)
    c.rect(9, 8, 22, 9, SNOW); c.rect(11, 6, 20, 7, SNOW); c.rect(13, 5, 18, 5, SNOW)
    c.rect(20, 3, 22, 8, METAL_D); c.rect(20, 3, 22, 3, METAL)  # труба
    c.px(21, 1, (255, 255, 255, 200)); c.px(22, 0, (255, 255, 255, 160))
    c.rect(13, 19, 18, 28, WOOD_D)                      # дверь
    c.px(17, 24, GLOW)
    c.rect(20, 19, 24, 22, GLOW); c.px(20, 19, GLOW_L)  # тёплое окно
    c.rect(22, 19, 22, 22, WOOD_D)
    c.outline()
    c.save('buildings/hut.png')


def campfire():
    c = Canvas(32, 32)
    for x, y in ((8, 25), (11, 27), (15, 28), (19, 27), (22, 25), (23, 22), (7, 22)):  # кольцо камней
        c.rect(x, y, x + 2, y + 1, STONE)
        c.px(x, y, STONE_L)
        c.px(x + 2, y + 1, STONE_D)
    c.rect(10, 25, 21, 26, SNOW_D)
    c.line(10, 24, 21, 27, WOOD_D); c.line(10, 27, 21, 24, WOOD)  # брёвна
    flame = [(15, 8, 16, 9), (14, 10, 17, 12), (12, 13, 19, 17), (11, 18, 20, 23)]
    for x0, y0, x1, y1 in flame:
        c.rect(x0, y0, x1, y1, GLOW_D)
    c.rect(14, 12, 17, 22, GLOW); c.rect(15, 16, 16, 22, GLOW_L)
    c.px(13, 17, GLOW); c.px(18, 17, GLOW)
    c.outline()
    c.save('buildings/campfire.png')


def gatherer():
    c = Canvas(32, 32)
    c.rect(6, 12, 7, 28, WOOD_D); c.rect(24, 12, 25, 28, WOOD_D)  # столбы
    for i in range(8):                                  # скошенная крыша
        c.rect(4, 9 + i // 2, 27, 10 + i // 2, WOOD if i < 2 else WOOD_L) if i < 2 else None
    c.rect(4, 8, 27, 11, WOOD); c.rect(4, 8, 27, 8, WOOD_L); c.rect(4, 11, 27, 11, WOOD_D)
    c.rect(5, 6, 26, 7, SNOW); c.rect(8, 5, 23, 5, SNOW)
    c.rect(8, 22, 23, 28, WOOD_D); c.rect(8, 22, 23, 23, WOOD)  # прилавок
    for x0, col in ((9, RED), (14, GREEN), (19, GLOW_D)):       # корзины с едой
        c.rect(x0, 19, x0 + 3, 21, col); c.px(x0 + 1, 19, GLOW_L)
        c.rect(x0 - 1, 22, x0 + 4, 22, WOOD_L)
    for x in (11, 16, 21):                              # сушёные травы
        c.rect(x, 12, x, 14, GREEN)
    c.outline()
    c.save('buildings/gatherer.png')


def woodcutter():
    c = Canvas(32, 32)
    c.ellipse(11, 22, 6, 4, WOOD_L); c.rect(5, 22, 17, 27, WOOD)  # колода
    c.ellipse(11, 21, 5, 2.5, WOOD_L); c.line(8, 21, 14, 21, WOOD_D)
    c.rect(5, 26, 17, 27, WOOD_D)
    c.line(9, 20, 6, 8, WOOD_D); c.line(10, 20, 7, 8, WOOD_D)     # топор
    c.rect(4, 6, 9, 10, METAL_L); c.rect(4, 9, 9, 10, METAL)
    for y0 in (17, 21, 25):                             # поленница
        for x0 in (19, 23):
            c.ellipse(x0 + 2, y0 + 1.5, 2.5, 2, WOOD_L)
            c.px(x0 + 2, y0 + 1, WOOD_D)
    c.rect(19, 14, 27, 15, SNOW)
    c.outline()
    c.save('buildings/woodcutter.png')


def quarry():
    c = Canvas(32, 32)
    for x0, y0, x1, y1, col in ((5, 18, 17, 28, STONE), (13, 12, 25, 28, STONE_L), (20, 20, 28, 28, STONE)):
        c.rect(x0, y0, x1, y1, col)
        c.rect(x0, y1 - 2, x1, y1, STONE_D)
    c.line(14, 14, 18, 22, STONE_D); c.line(7, 20, 10, 25, STONE_D)
    c.rect(14, 11, 21, 12, SNOW); c.rect(6, 17, 12, 17, SNOW)
    c.line(22, 19, 27, 10, WOOD_D); c.rect(25, 8, 29, 9, METAL_L); c.px(29, 10, METAL)  # кирка
    c.rect(2, 26, 6, 28, WOOD)                          # тачка
    c.outline()
    c.save('buildings/quarry.png')


def purifier():
    c = Canvas(32, 32)
    c.rect(9, 12, 22, 28, METAL); c.rect(9, 12, 12, 28, METAL_L); c.rect(20, 12, 22, 28, METAL_D)
    for y in (16, 22):
        c.rect(9, y, 22, y, METAL_D)
    c.rect(9, 12, 22, 13, METAL_L)
    c.rect(11, 6, 20, 7, METAL_L); c.line(12, 8, 14, 11, METAL); c.line(19, 8, 17, 11, METAL)  # воронка
    c.rect(24, 17, 28, 18, METAL_D); c.rect(28, 17, 28, 24, METAL_D)                           # труба
    c.rect(2, 22, 7, 28, WOOD); c.rect(3, 21, 6, 21, WATER); c.rect(2, 22, 7, 22, WATER_D)     # ведро
    c.rect(26, 25, 29, 28, WATER); c.rect(26, 25, 29, 25, WATER_D)
    c.px(14, 3, (255, 255, 255, 200)); c.px(16, 2, (255, 255, 255, 160))
    c.px(14, 20, WATER); c.px(15, 20, WATER)
    c.outline()
    c.save('buildings/purifier.png')


def settler():
    c = Canvas(16, 16)
    c.rect(5, 1, 10, 2, RED); c.rect(4, 3, 11, 3, RED); c.px(7, 0, GLOW)   # шапка с помпоном
    c.rect(5, 4, 10, 7, SKIN); c.px(6, 5, OUTLINE); c.px(9, 5, OUTLINE)    # лицо
    c.px(5, 6, hx('#E9998A')); c.px(10, 6, hx('#E9998A'))
    c.rect(4, 8, 11, 8, SCARF)                                             # шарф
    c.rect(3, 9, 12, 13, COAT); c.rect(3, 12, 12, 13, COAT_D)              # пальто
    c.rect(7, 9, 8, 13, COAT_D)
    c.rect(4, 14, 6, 14, OUTLINE); c.rect(9, 14, 11, 14, OUTLINE)          # ботинки
    c.outline()
    c.save('units/settler.png')


if __name__ == '__main__':
    for f in (tile_cold, tile_warm, reactor, hut, campfire, gatherer, woodcutter, quarry, purifier, settler):
        f()
    print('ok')
