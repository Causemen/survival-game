# Графика «Реактора»: арт-направление и промпты для Gemini

## 1. Стиль
- **Вид:** сверху под углом ~3/4 (как в Stardew Valley или RimWorld). Сетка карты квадратная, поэтому здание «стоит» на клетке и может немного выходить вверх за её край. Изометрию можно сделать позже, но она требует переделки сетки и кликов.
- **Манера:** мягкая стилизованная «уютная» графика: чистые формы, плавные градиенты, лёгкая обводка тёмным цветом, без фотореализма, без мусора и крови. Постапокалипсис читается через снег, заплатки, ржавчину и самодельность, а не через мрачность.
- **Свет:** всё освещено тёплым светом реактора из центра карты; холодные части мира голубые, тёплые — янтарные. Свет падает **сверху слева**, тень вниз вправо (одинаково для всех картинок).
- **Читаемость:** на телефоне клетка всего 16–32 px, поэтому силуэт здания должен узнаваться с первого взгляда, без мелких деталей и текста.

## 2. Палитра
| Роль | Цвет |
|---|---|
| Снег, свет | `#E8F1F8` |
| Снег, тень | `#9DB4CC` |
| Холодная ночь, фон UI | `#0B0F14`, `#16202C` |
| Тёплая земля, оттаявшая | `#7A5C3E` |
| Мох/трава у реактора | `#6E8B4E` |
| Свечение реактора | `#FFD447` → `#FF9A3C` |
| Дерево построек | `#A0703F` |
| Металл, ржавчина | `#6B7785`, `#B5562E` |
| Акцент UI (кнопки) | `#2D6A4F` |
| Вода | `#4FA3C7` |

## 3. Размеры и файлы
- Картинки лежат в `public/assets/`, имена файлов строго как в таблице ниже (список в коде: `src/render/assets.ts`).
- Генерируйте **квадрат 1:1** (Gemini обычно отдаёт 1024×1024). Игра сама уменьшает картинку до 256 px, так что ужимать вручную не нужно.
- **Спрайты** (здания, люди): объект по центру, **на однотонном ярко-пурпурном фоне `#FF00FF`**, без тени на фоне и без рамки. Игра сама вырезает этот фон и обрезает пустые поля. Если у вас уже есть PNG с прозрачностью, он тоже подойдёт.
- **Тайлы земли:** вид строго сверху, заполняют весь квадрат, **бесшовные** (края стыкуются), без объектов.
- Пока файла нет, игра рисует клетку как раньше (цветом/эмодзи). Картинки можно добавлять по одной.

| Файл | Что это | Размер в игре |
|---|---|---|
| `tiles/ground_cold.png` | снежная земля (холод) | 1 клетка |
| `tiles/ground_warm.png` | оттаявшая земля с мхом (тепло); игра плавно смешивает её со снегом по температуре | 1 клетка |
| `buildings/reactor.png` | реактор, центр поселения | ~1,3 клетки |
| `buildings/hut.png` | хижина | 1 клетка |
| `buildings/campfire.png` | костёр | 1 клетка |
| `buildings/gatherer.png` | собиратель (еда) | 1 клетка |
| `buildings/woodcutter.png` | лесоруб | 1 клетка |
| `buildings/quarry.png` | каменоломня | 1 клетка |
| `buildings/purifier.png` | фильтр воды | 1 клетка |
| `units/settler_male.png`, `units/settler_female.png` | поселенцы: мужчина и женщина (по очереди; если нет, берётся `units/settler.png`) | ~0,5 клетки |

## 4. Промпты для Gemini
Пишите промпт целиком: **общий стиль + описание объекта**. На английском Gemini держит стиль стабильнее. Если результат выбивается из серии, приложите к запросу уже удачную картинку и добавьте «match the style of the attached image».

**Общий стиль для спрайтов** (вставляйте в начало):
> Cozy stylized 2D game asset for a top-down survival strategy game, 3/4 top-down view, soft painterly shading, clean shapes, thin dark outline, light from the top-left, warm amber glow accents, post-nuclear winter setting but friendly and hopeful mood, no text, no people unless asked, single object centered, fills most of the frame, isolated on a perfectly flat solid magenta background (#FF00FF), no shadow on the background, no border, square image.

**Общий стиль для тайлов:**
> Seamless tileable square ground texture for a 2D top-down game, viewed straight from above, soft painterly stylized look, low detail so it reads well at small size, even lighting, no objects, no shadows from objects, edges must tile seamlessly.

### Тайлы
- `ground_cold.png`: *[стиль тайлов]* + `Fresh packed snow with subtle blue shadows and a few tiny ice sparkles. Colors around #E8F1F8 and #9DB4CC.`
- `ground_warm.png`: *[стиль тайлов]* + `Thawed brown earth with patches of short green moss and a few small pebbles, slightly damp. Colors around #7A5C3E and #6E8B4E.`

### Здания
- `reactor.png`: *[стиль спрайтов]* + `A small rounded old research reactor dome patched with metal plates and rivets, glowing warm yellow-orange vents and pipes, a little steam rising, snow on top melting at the edges. The heart of a survivor settlement.`
- `hut.png`: *[стиль спрайтов]* + `A small cozy survivor hut built from wooden planks and scrap metal sheets, snow on the roof, a warm lit window, a tiny chimney with smoke.`
- `campfire.png`: *[стиль спрайтов]* + `A campfire in a ring of stones with bright warm flames and a few logs beside it, a small patch of melted snow around it.`
- `gatherer.png`: *[стиль спрайтов]* + `A forager's stall: a small wooden lean-to with baskets of mushrooms, roots and berries, and a few hanging dried herbs.`
- `woodcutter.png`: *[стиль спрайтов]* + `A woodcutter's spot: a chopping block with an axe stuck in it, a neat stack of split logs and a couple of tree stumps, light snow.`
- `quarry.png`: *[стиль спрайтов]* + `A small stone quarry: a pile of grey rocks and cut stone blocks, a pickaxe and a wooden wheelbarrow, light snow.`
- `purifier.png`: *[стиль спрайтов]* + `A homemade water purifier: a metal barrel with a funnel, pipes and a charcoal filter, a bucket of clean blue water, a little steam.`

### Люди
- `settler_male.png`: *[стиль спрайтов, но без «no people»]* + `A cute chibi male survivor standing, facing the viewer, short brown hair with sideburns and light stubble, blue knitted hat, green padded winter jacket with a fur collar, brown trousers, mittens and boots, friendly look, full body.`
- `settler_female.png`: *[стиль спрайтов, но без «no people»]* + `A cute chibi female survivor standing, facing the viewer, long auburn hair with bangs, cream knitted hat with a red pompom, red winter coat, yellow scarf, mittens and boots, rosy cheeks, friendly look, full body.`

## 5. Что понадобится дальше (по эпохам из PLAN.md)
Генерировать по мере появления в игре, в той же серии:
- Медицина: лазарет, аптечка/травы.
- Сельское хозяйство: теплица у реактора, грядки, загон для животных, погреб.
- Инженерия: мастерская, печь для плавки, кирпичный дом, паровая машина.
- Энергетика: турбина, столб ЛЭП/провода, фонарь, реактор 2–5 уровней (тот же реактор, всё больше и ярче).
- Интерфейс: иконки ресурсов (тепло, еда, вода, дерево, камень, металл, знания) — те же правила, что у спрайтов.
- Погода: снегопад и метель лучше делать эффектами в коде, а не картинками.

## 6. Как добавить картинку
1. Сгенерировать в Gemini по промпту, скачать PNG.
2. Переименовать как в таблице и положить в нужную папку `public/assets/…` (можно загрузить через сайт GitHub: Add file → Upload files).
3. Проверить через `npm run dev` или после деплоя. Если фон вырезался плохо, перегенерировать с более чистым пурпурным фоном.

## 7. Пиксель-арт вариант (рисуется кодом, стиль Winter Story)
`python3 tools/pixel_art.py` (нужен Pillow) пересоздаёт все картинки первой эпохи. Стиль и палитра (37 цветов) взяты у набора [Winter Story](https://opengameart.org/content/winter-story) (CC0, автор Brosnya, просит указать авторство): здания, поселенцы и тайлы по 16×16, реактор 24×24, жирный тёмный контур, три тона заливки без дизеринга, свет сверху слева, голубоватые тени снега. Здания и люди заданы «картами символов» прямо в скрипте, поэтому любой пиксель легко поправить. Земля: по 4 варианта плитки (`ground_cold.png`, `ground_cold_1.png` … `_3`; игра берёт любые найденные, первые два чаще).

Файлы лежат в `public/assets/`, поэтому любую картинку можно заменить на сгенерированную в Gemini. Маленькие картинки (до 64 px) игра увеличивает без размытия и в целое число раз, большие сглаживает.

## 8. Анимации и эффекты (`src/render/scene.ts`)
Картинок для них нужно немного, остальное считается кодом:
- **Жители:** кадры в `units/settler_<male|female>_<действие>_<номер>.png`: `idle` (стоит, моргает), `walk` (идёт), `work` (стучит руками), `cold` (обнимает себя). По 2 кадра, холст 16×16 без обрезки. Игра сама выбирает действие: идёт к новому месту, работает у здания, мёрзнет при тепле ниже 35, иначе стоит и иногда переминается. Нет кадров? Берётся обычная картинка жителя.
- **Костёр:** второй кадр `buildings/campfire_1.png` для мерцания.
- **Декор карты:** `decor/{tree_a,tree_b,bush,rocks,tuft,stump}.png`: ёлки растут за границей тепла реактора, кусты и камни по всей карте; расставляются по координатам клетки, поэтому не меняются между перерисовками.
- **Эффекты кодом:** тёплое свечение реактора и костров, дым и пар, снегопад (в метель сильнее), смена дня и ночи по игровому часу.
Всё это можно пересоздать `python3 tools/pixel_art.py`.

## 9. Крупные персонажи (листы кадров)
Стиль референсов: детальный пиксель-арт, фигура ~40 px, 30+ приглушённых цветов, тёмный контур, снаряжение (противогаз, рюкзак, топор, очки, халат), мягкая грязь и потёртости.

**Как подключить.** Для каждого персонажа и действия нужен один горизонтальный лист: кадры одинакового размера в ряд, одинаковый холст (ноги стоят на одной линии), однотонный фон (ярко-пурпурный `#FF00FF` или любой, угол картинки считается фоном) либо прозрачный PNG. Файлы кладите в `public/assets/units/` и впишите в `public/assets/units/characters.json`:
```json
{ "characters": [
  { "name": "scavenger", "anims": {
    "idle": { "file": "units/scavenger_idle.png", "frames": 2 },
    "walk": { "file": "units/scavenger_walk.png", "frames": 6 },
    "work": { "file": "units/scavenger_work.png", "frames": 4 }
  } }
] }
```
Действия: `idle`, `walk`, `work`, `cold`. Нужны хотя бы `idle` или `walk`; недостающие действия заменяются стойкой. Персонажи раздаются жителям по кругу, смотрят вправо (влево игра отражает сама). Если файла нет, игра рисует маленьких жителей как раньше.

**Промпт (на английском, с референсом).** Приложите к запросу одну из картинок-референсов и напишите:
> Pixel art character sprite sheet for a 2D top-down survival game, in the exact style of the attached image: detailed pixel art, about 40 px tall character, thick dark outline, muted desaturated palette with dirt and wear, light from the top-left. Character: *[описание]*. Side view facing right, full body. Sheet: *[N]* frames of the *[walk cycle / idle breathing / chopping]* in one horizontal row, all frames exactly the same size on the same baseline, evenly spaced. Perfectly flat solid magenta background (#FF00FF), no shadow, no text, no border.

Описания:
- `scientist`: redhead woman in a white lab coat with goggles on her forehead and a ponytail, notebook in hand.
- `gasmask_scientist`: man in a lab coat with a gas mask hanging at the chin, gloves, a satchel.
- `medic`: person with a large medical backpack with a red cross, a respirator, a warm hooded jacket.
- `scavenger`: person in a gas mask, a cap, a worn jacket and a backpack, an axe on the shoulder.

Если Gemini выдаёт кадры разного размера, проще попросить по одному кадру и склеить; если нужна помощь, пришлите кадры в тред.

**Листы разной раскладки (так приходят из Gemini).** Кадры в листе Gemini стоят неровно и в разном масштабе, поэтому их готовит `python3 tools/prep_characters.py manifest.json`: вырезает пурпурный фон и тень, находит кадры по пустым промежуткам, приводит к одному росту, ставит ногами на общую линию земли и пишет ровные листы 128×96 и `characters.json` в `public/assets/units/`. Формат `manifest.json` описан в начале скрипта (`upright` для согнутых поз, `groups`, если рядом с фигурой лежит отдельный предмет). Тень под персонажем рисует игра.

**Здания из Gemini.** `python3 tools/prep_buildings.py manifest.json` вырезает пурпурный фон, обрезает поля, уменьшает до 192 px и пишет прозрачные PNG в `public/assets/buildings/` (формат манифеста в начале скрипта; кадры костра идут одной группой и режутся по общей рамке). Размеры зданий в клетках заданы в `src/render/world.ts` (`BUILDING_SIZE`, `REACTOR_SIZE`). Декор (`public/assets/decor/`) готовится тем же скриптом; размеры декора в клетках — `DECOR_SIZE` в том же файле.

**Плитки земли из Gemini.** `python3 tools/prep_tiles.py manifest.json` делает края плиток бесшовными (смещение на пол-плитки и плавное смешивание), подгоняет цвет рамки плитки со льдом под снег, при необходимости поворачивает плитку на 180° для нового варианта и пишет PNG 256×256 в `public/assets/tiles/` (формат манифеста в начале скрипта). Вес варианта при выборе клетки задан в `TILE_WEIGHTS` в `src/render/world.ts`: по номеру файла, 0 и 1 обычные, 2 (следы) реже, 3 (лёд) редкий. Пока есть 4 варианта снега и 2 варианта тёплой земли.
