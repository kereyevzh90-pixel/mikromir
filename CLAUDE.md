# Микромир — игра про бактерий

Браузерная симуляция микромира: один файл `index.html` (~6000 строк, HTML + CSS + один `<script>`), canvas 2D, без зависимостей и сборки. Открывается двойным кликом. Язык кода, комментариев, UI и общения — русский.

## Главные правила

1. **Реализм без «ИИ».** У бактерий нет разума — только рефлексы, химия и физика. Тяга рождается из жгутиков, поведение — из CheY/энергии/градиентов. Ни у одного природного вида не добавлять того, чего нет в реальной биологии; если признак есть лишь у некоторых видов (T6SS — Vibrio, споры — Bacillus, реснички — простейшие) — только им.
2. **Исключение — своя клетка игрока (`Custom`, L-форма).** Для частей редактора (`ED_PARTS`) допускаются игровые условности (бур, копьё, яд, паразит, нож). Это явно помечено в коде комментарием «игровая условность».
3. **Один файл.** Не выносить код в модули, не подключать библиотеки. Новый код — рядом с родственным разделом (разделы помечены `// ───── Название ─────`).
4. **Стиль кода:** плотный, много кода в одной строке, комментарии по-русски объясняют биологию, а не синтаксис. Числовые константы — прямо в коде с пояснением. Соблюдать этот стиль.
5. **Всё новое должно уметь сохраняться**: если добавляешь поле клетки/объект мира — добавь его в `saveWorld`/`loadWorld` (v:1), при необходимости в `saveCell`/`cellFromTemplate` и в `divide()` (наследование).

## Карта файла (index.html)

| Строки | Что |
|---|---|
| 1–218 | CSS: `#hud`, `#menu`/`.sub` (левые панели), `.overlay` (экраны), `#editor.modal`, `#survHud`, `#survBars`, `#radar`, `#labCell` |
| 220–476 | HTML: стартовый экран, выбор клетки `#cellPick`, пауза, аккаунт, gameOver, HUD выживания, редактор, меню лаборатории (Инструмент / Среда / Песочница), подпанели `#setPanel`, `#lifePanel` → `catBact/catPred/catProt/catCreator/catMine/catVirus`, `#foodPanel` |
| 479–564 | Холст, камера-размеры (`W,H` мир = 6× экрана; `SW,SH` экран), фон воды, взвесь течения |
| 566–640 | `Phage` (`kind` 'T4'/'lambda'): ощупывание, рецепторы (`receptorT4`/`receptorLam`), CRISPR, суперинфекция; λ — лизогения (`b.prophage`, индукция по SOS в `EColi.update`) |
| 642–688 | `GENES`, `randomGenome`, `mutateGenome`, `genomeUpkeep` |
| 690–930 | Среда: `Colicin`, `UvLamp`, `Lamp`/`lightAt`/день-ночь, конъюгация `pili`, `Drug` (amp/tet), `Rock`+`collideRocks`, течение `flowAt`, звук `snd()` (Web Audio синтез), температура `tempK/heatDamage`, кислород `o2/anaerobic()` |
| 929–1246 | Еда: `FOOD_KINDS`, класс `Food` (многокомпонентное облако `comp`, сетка густоты 32×32 `dep`+`mask`, offscreen-картинка, `take/add/localAt/concAt/denseAt`), `concentrationAt`, `acidAt`, `toxinAt`, `bacteriaSmellAt`, `spawnFood`, `Source`, частицы всасывания |
| 1248–1338 | Камера (`cam`, `toWorld/toScreen/applyCam/clampCam`), зум колесом, панорама, перетаскивание клетки в лабе, клавиши управления `keys`/`keyMap` |
| 1340–1630 | Меню и инструменты (`setTool`), песочница, график численности `POP/popHist`, **`saveWorld`/`loadWorld`**, `CREATOR_CELLS`, `labTemplates`/`addLabTemplate`/`cellFromTemplate`, панель `#labCell`, конструктор `#labBuild`, пауза выживания |
| 1631–1978 | Клик по холсту (спавн/удаление), инспектор: `hoveredBacterium`, `stateOf`, `drawInspector`/`drawInspectorPanel` (+ трупы, простейшие, хищник) |
| 1980–2033 | Эффекты: `zzz`, `harpoons` (вспышки атак; `harpoons.push` перехвачен для звука), `splashes` |
| 2035–2205 | `Corpse`: лизис через 6–16 с → лизат-облако, оболочка разлагается ~8 мин, осколки |
| 2207–2385 | `Flagellum`: Verlet-нить, мотор ±, сплетение в пучок, `force()` |
| 2387–3774 | **`EColi`** — базовый класс всех бактерий: `divide()`, `update()` (рецепторы → спячка → CheY → подруливание → яд/антибиотики/УФ/жара/колицин → питание → рост → фаг → T6SS → буксир/цепочка → охрана носителей → зов → охотники на личинок → паразит → быстрый яд → плотоядность/бур → давка → охота → нож → реснички → копьё → жало → конъюгация → гликоген → ацетат → голод → энергия → биоплёнка → жгутики → интеграция), `draw()` с маркерами генов |
| 3776–3858 | `Vibrio` (1 полярный жгутик, flick, T6SS 'vib') |
| 3860–4153 | Простейшие: `Amoeba` (ложноножка, обволакивание), `Paramecium` (реснички, рот, вакуоли) — не наследуют EColi |
| 4155–4370 | `Bdello` — хищник (hunt → attached → inside → hatch), не наследует EColi |
| 4372–4520 | `Bacillus` (грам+, эндоспора), `Myxo extends Bacillus` (скольжение, ферменты стаей) |
| 4522–4603 | `spawnAnabaena`, `Cyano` (фотосинтез, twitching, фототаксис) |
| 4605–4839 | **`Custom`** (L-форма игрока): метаболы `metaOutline` (маршевые квадраты), `fitBody`, `flagAt`, `bladeAt`, отрисовка частей |
| 4841–4882 | `Larva` (свободные личинки паразита), `creditKill` |
| 4884–5020 | `Anabaena extends Cyano`, `Spirillum`, `Streptococcus`, `spawnStrepto` |
| далее | `Pseudomonas` (полярный жгутик, T6SS 'pse', пиоцианин, `chromR`), `Caulobacter extends Vibrio` (бродяжка `swarmT`/`noGrow` → стебелёк `stalk`, асимметричное деление), `Lactobacillus` (`ferment`, `acidTol`, lac конститутивна), `Staphylococcus`/`Deinococcus extends Streptococcus` (палитра `pal`, гроздья/тетрады, `uvRes`, `growMul`), `Thermus` (термофил: `tOpt/tMin/tMax`), `spawnStaph`, `Nitrosomonas` (хемолитоавтотроф: свой цикл питания аммиаком), `Azotobacter extends Bacillus` (азотфиксация, циста), `Serratia` (сапрофит, пигмент от температуры), `Clostridium extends Bacillus` (строгий анаэроб), `Leptospira` (спирохета: своя тяга без жгутиков, реверс `dir`), `Fischeri extends Vibrio` (люминесценция по кворуму `lum`), `Rhodospirillum extends Spirillum` (аноксигенный фотосинтез), `Streptomyces extends Bacillus` (гифы, выделяет Drug 'tet'), `Bacteroides`, `Cutibacterium`, `Legionella` (в простейших/фагоцитах `legioInside`), `Sulfurimonas`, `SMutans`, `Vampirovibrio` (эпибиотический бур), `Phagocyte extends Amoeba` (нейтрофил/макрофаг), `Didinium`, `Rotifer`, `Dicty extends Amoeba` + `FruitingBody` (флаг `fbody`) |
| перед столкновениями | **Среды**: `ENVS` (26 пресетов-данных), `newCell(kind,x,y)` (фабрика по имени, группы, угрозы), `applyEnv`, `envFill`, `labSetEnv`; выживание берёт среду из `#survEnv`, угрозы — `env.threats` |
| 5023–5093 | Столкновения: `capsuleAxis`, `closestSegSeg`, `resolveCollisions` (давка `press`, `mouthPass`, `phaseT`, `chainId`) |
| 5095–5210 | Мир: `bacteria[]`, **`step()`** (один тик 1/60 с), `setSpeed`, **`loop()`** (отрисовка с отсечением `vis`, `fxLow`) |
| перед бесконечной водой | **Организм**: `ORGANS`, `campaignInit/Stage/Step`, `surv.camp` (режимы infect/pandemic/immerse: control/evo), хозяин hp/fever/imm, среды blood/lung; правки ДНК в редакторе (`edGene`, лимит на орган) |
| 5211–5573 | Режимы: `mode` (null/'lab'/'surv'/'dying'/'over'), `showStart`, `startLab`, `startSurvival`, `survivalStep` (волны по времени), `drawRadar`, `SURV_TIPS`, аккаунт (`account`, `ACC_BASE`, `ACC_UNLOCK`), `GOALS`/`survGoals`, `EVENTS`/`survEvents`, бесконечная вода (`survShift`, чанки `CH=1100`, `survChunkFill`, `survWorld`), `endSurvival` |
| 5574–5941 | Редактор: **`ED_PARTS`** (части с ценой add/rem), `edHas/edAvail/edSpent`, `saveCell`, холст `#edCanvas` (капли/жгутики/ножи таскаются), `edRender`, **`edApply`** (→ `divide()` в выживании) |
| перед пандемией | **Онлайн** (`net`): два транспорта — LAN (`netStartHost`/`netJoin`, TCP `NETPORT=43100`, только Electron) и интернет (`netJoinWs` → WebSocket к `server.js`, комната `net.room`; работает и в браузере). Хозяин/сервер считает мир и шлёт снимки (`netSnapshot(cl)`: LAN — всем всё 15 Гц; сервер — каждому окружение 1.6 экрана 10 Гц, формы `bl/fa/bd/pt` кастомных клеток один раз на клиента через `cl.sent`), гость шлёт ввод 20 Гц и сам крутит жгутики (`netClientAnim`). Чужая клетка = `Custom` из шаблона игрока (`netSpawnPlayer`, `c.remote={keys,mouse}`, `c.owner=cl.id`) — внутри `EColi.update` ввод берётся из `IN`/`MS` (не `keys`/`mouse`!). Координаты в снимке абсолютные (`+surv.off`). Серверная комната: `netServerInit(envId)` (конечный мир, без игрока-человека) + `netServerStep()` вместо `survivalStep` (угрозы, подкорм, возрождение через 5 с). `netServerUrl()`/`NET_SERVER_DEFAULT` — адрес сервера. |
| 5943 | `showStart(); requestAnimationFrame(loop);` |

## Ключевые структуры

- **Все живые — в одном массиве `bacteria`**, включая хищника и простейших. Отличаются флагами: `predator` (Bdello), `protist` (+`amoeba`), `gramPos`, `myxo`, `photo`, `anab`, `spir`, `strepto`, `custom`, `instanceof Vibrio`. Порядок проверки в `saveWorld`/`samplePop` важен (strepto раньше gramPos и т.п.).
- Классы без `EColi` (`Bdello`, `Paramecium`, `Amoeba`) обязаны иметь поля-заглушки: `flagella=[]`, `computeBundle()`, `leak()`, `health`, `nutrient`, `dead`, `fade`, `length/width/angle`, `mass`.
- Видовые флаги-поведения (вместо проверок `gramPos`): `sporeAble`, `aerobe`, `noLac`, `tMax`, `tOpt`, `tMin`, `noGrow`, `ferment`, `acidTol`, `chromR`, `uvRes`, `growMul`. Температура: `tempK(opt)`/`tempGrowK(tMin, opt)` — в коде клетки всегда передавать `this.tOpt`/`this.tMin`. Новый вид — ставить нужные флаги, а не расширять условия по `gramPos`.
- Еда: клетка ест по `Food.feedAt` (местная густота, но не ниже 0.6·`meanDep` — диффузия кормит стоящую клетку); `take` списывает из `comp` всё съеденное. Дорожка `dep` за плывущей клеткой — только визуал/локальный бонус.
- Клетка: `nutrient` (запас 0..1), `health` (мембрана), `energy` (моторы), `scale` (деление при `divScale`, по умолчанию 1.5), `genes` (0..1), `el {N,P,Fe}`, `dormant`, `appetite`, `cheY`.
- Координаты мира не бесконечны (`W×H`); в выживании мир «сдвигается» (`survShift`), а `surv.off` хранит абсолютное смещение. Любой новый массив объектов с координатами надо добавить в `survShift` и в чистку `survWorld`.
- `controlled` — клетка под управлением, `pinned` — закреплённая в инспекторе, `surv.player` — игрок (в лабе временно = редактируемая клетка при `edFree`).
- Еда сред: `blood/mucin/sebum/cellulose/sulfide` (`need` — только с diet[kind]; `chem` — не еда, `sulfideAt` яд). Иммунные молекулы = `DRUGS` lys/def/cpl/lf/ab (эффекты в блоке «Иммунитет хозяина» EColi.update; `opson`). Фаги после впрыска — `ghost` на клетке.
- Зуб: `env.look.enamel` + `enamelHp` (сетка "i,j", `enamelStep`); язык: `env.look.papillae` (`papillaAt`, `collidePapillae`, `insidePillar`). `boundsOf(LK)` — трубка или top/bottom.
- Глобалы среды: `temp, light, dayCycle, aerated, o2, flowLevel, salt, envAcid, env`. Новая среда = запись в `ENVS`; новый вид должен быть добавлен в `newCell` и в `life` подходящих сред.
- Единицы: 60 тиков = 1 с; ~21 px = 1 мкм (для «мм пути»).

## Управление (не менять без обновления подсказок)

W — к курсору, A/D — поворот, S — стоп/отцепиться, Shift — форсаж, G — есть/атака (переключатель), Q — яйца паразита, F — быстрый яд, H — вцепиться/отпустить, R — зов родни, Z — спать, E — редактор, Tab — полная панель, Esc — мышь/пауза, пробел — пауза, Enter — взять клетку (лаба). При изменении править: подсказку на стартовом экране (~строка 232), `SURV_TIPS`, текст в `drawInspector`, `hint` в `ED_PARTS`.

## Язык (RU/EN)

Исходный язык кода и всех строк — русский. Английский — наложение на лету: второй `<script>` перед основным (`LANG`, `I18N` из `<script type="application/json" id="i18nEN">`, `tr()`, MutationObserver на `body`, обёртки `fillText/strokeText/measureText/alert/prompt/confirm`). Словарь — точное совпадение всей фразы, иначе регулярка по всем фразам (длинные раньше, границы — не кириллица). **Новая русская строка в UI → добавить пару в словарь `#i18nEN`** (иначе на английском останется русский). Переключатель на стартовом экране (`setLang` → reload), ключ `bioLang`. Проверка: `localStorage.setItem('bioLang','en')` + скриншот.

## Программа (Electron) и сервер

`server.js` — отдельная программа без зависимостей: HTTP (раздаёт index.html, `/api/rooms`, `/api/register|login|me|acc|logout`, `/api/google/code`), Google OAuth (`/auth/google` → код 6 цифр), свой WebSocket (`/ws?room=&token=`). Каждая комната = отдельный экземпляр игры (`loadGame()`: тот же harness-приём — вырезать `<script>`, заглушки DOM, `startLab()`), тик 60 Гц. Профили в `data/users.json` (scrypt), токены в `data/tokens.json`. Игра при входе идёт на сервер (`profApi`, `profLoginSrv`, `profEnter`, `accMerge` — прогресс только растёт, `accPush` — debounce 2 с), при недоступности — локально. **Вырезать код игры надо от `lastIndexOf('<script>')`** (первый `<script>` — словарь языка). Тест: `node server.js` + harness с глобальным `WebSocket`/`fetch` Node ≥22 (не подменять `URL`!).

`main.js` + `package.json` (`npm start`), `Запустить игру.bat` (ставит Electron при первом запуске). В renderer включён `nodeIntegration` ради `require('net')`. Тест из Claude Code: снять переменную `ELECTRON_RUN_AS_NODE` (`env -u`), запускать `node_modules/electron/dist/electron.exe ./файл.js` из папки игры. Кнопка ☰ меню показывается только в лабе (`loop()`).

## Как проверять

Нет тестового фреймворка. Проверка — либо открыть `index.html` в браузере, либо headless-harness в Node: вырезать `<script>`, подменить `document`/`canvas` заглушками, **заменить `showStart();` на `startLab();`** (иначе `mode=null` и симуляция стоит), вызвать `step()` N раз и проверить состояние. Прошлые harness-скрипты (`uv.js`, `surv.js`, `perf.js` и др.) — одноразовые, в репозитории не хранятся; при необходимости писать новый в scratchpad. После правок обязательно прогонять сценарий выживания (`startSurvival` + `survivalStep`) и `saveWorld → loadWorld`.

## Производительность

Узкие места: `concentrationAt` (O(клеток × облаков), вызывается по 3 раза на клетку), жгутики (16 точек × 4 итерации), `resolveCollisions` O(n²). Уже есть: `leakers` (кэш течей на тик), отсечение по кадру `vis()`, `fxLow` (>45 клеток или зум <0.5 — без теней и крупинок), лимиты `phages ≤1500`, `corpses ≤80`, спавн в чанках при `bacteria ≤60`, `foods ≤70`. Не добавлять внутрь `update()` перебор всех клеток на каждый тик — использовать счётчики-периоды (`% 20 === 0`), как в существующем коде.

## localStorage

`bioWorld` (мир лабы), `bioSurv` (сохранение выживания), `bioMyCells` (шаблоны своих клеток), `bioAccount` (прогресс гостя), `bioProfiles` (`{cur, users:{почта:{pw,acc}}}` — профили по почте+паролю; `prof`, `profLogin/profSwitch`, `account.name` = «Гость123» у гостя). Google-вход и синхронизация между устройствами — заглушка до появления сервера мультиплеера. Формат мира `v:1`, клетки `cell:1` — при несовместимых изменениях поднимать версию и держать загрузку старой.

## Дальние цели пользователя

Порядок: игра → техника → мультиплеер (последним; аккаунт уже задуман под него). Пользователь добавляет свои клетки в `CREATOR_CELLS` — просить `.json` из редактора. Подробный журнал сделанного и план — в памяти проекта (`bio-game-plan`, `bio-game-traits`).
