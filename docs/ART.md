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
| `units/settler.png` | поселенец | ~0,45 клетки |

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
- `settler.png`: *[стиль спрайтов, но без «no people»]* + `A cute chibi survivor character standing, facing the viewer, wearing a warm patched winter coat, scarf and knitted hat, rosy cheeks, friendly look, full body.`

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

## 7. Пиксель-арт вариант (рисуется кодом)
`python3 tools/pixel_art.py` (нужен Pillow) пересоздаёт все 10 картинок первой эпохи в пикселях: здания 64×64, поселенец и тайлы 32×32. Палитра та же, что в разделе 2. Файлы кладутся в `public/assets/`, поэтому любую картинку можно заменить на сгенерированную в Gemini: игра увеличивает маленькие картинки (до 64 px) без размытия, а большие сглаживает.
