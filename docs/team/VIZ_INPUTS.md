# Визуализация `warehouse-viz`: какие данные она ест

Разбор `src/experiment/mockCalc.js` и `src/contract/schema.js`. Три уровня: что вводит пользователь → что берётся из каталога робота → что получает визуализация.

## Уровень 1 — что вводит пользователь (форма тестового стенда)

Все поля числовые, кроме двух селектов. `→ наш key` — соответствие полю из `INPUTS_WAREHOUSE.md`; `—` значит у нас такого поля нет, надо добавить.

### Селекты

| key | Поле | Варианты | → наш key |
|---|---|---|---|
| `rackType` | Тип стеллажей | `stack` штабельный · `shelf` фронтально-полочный · `deep` глубинный · `flow` поточный · `cantilever` консольный · `mezzanine` мезонин | `rack_type` (`block`→`stack`, `frontal`/`shelf`→`shelf`) |
| `cargoType` | Тип груза | `pallet` паллеты · `box` коробы/штучный · `long` длинномер — **список зависит от стеллажа** (консоль — только длинномер, мезонин — только коробы) | `cargo_type` (`euro_pallet`→`pallet`, `custom`→`box`) |

### Склад

| key | Поле | Ед. | Default | Зачем | → наш key |
|---|---|---|---|---|---|
| `width` | Ширина склада | м | 40 | размер холста, сколько ячеек влезет | — (у нас `area_total_m2`; **нужны обе стороны**) |
| `length` | Длина склада | м | 24 | то же | — |
| `aisleWidth` | Ширина прохода | м | 2 | геометрия ячейки; если меньше минимума для робота — расчёт увеличивает и пишет допущение | `aisle_rack_width_mm` / 1000 |
| `workHours` | Рабочих часов в сутки | ч | 16 | потребность в час = заказов/сутки ÷ часы | `shifts_per_day × shift_hours` |

### Хранение и грузы

| key | Поле | Ед. | Default | Зачем | → наш key |
|---|---|---|---|---|---|
| `shelfCapacity` | Мест на секцию стеллажа | ед. | 12 | число стеллажей = места ÷ вместимость | — |
| `palletPlaces` | Кол-во паллетомест | шт | 200 | объём хранения (для коробов ×6) | `pallet_places` |
| `palletMass` | Масса паллеты | кг | 600 | проверка грузоподъёмности робота | `pallet_weight_kg` |
| `palletL/W/H` | Габариты паллеты | м | 1.2 / 0.8 / 1.5 | рисуется в размер, вместимость секции | `pallet_dims_mm` / 1000 |
| `skuMass` | Масса штучной единицы | кг | 5 | лёгкие роботы (SR, собака, гуманоид) — до 10 кг | `sku_weight_kg` |
| `skuL/W/H` | Габариты SKU | м | 0.4 / 0.3 / 0.3 | то же для коробов | `sku_dims_mm` / 1000 |
| `oversizeShare` | Доля негабарита | % | 0 | > 5% → предупреждение «нужны CTU/FMR» | `nonstandard_share` |

### Операции

| key | Поле | Ед. | Default | Зачем | → наш key |
|---|---|---|---|---|---|
| `receivePalletsDay` | Приёмка | поддонов/сутки | 120 | для паллет: заказов/сутки = (приёмка + отгрузка) / 2 | `inbound_pallets_per_day` |
| `shipPalletsDay` | Отгрузка | поддонов/сутки | 120 | | `outbound_pallets_per_day` |
| `pickLinesDay` | Отбор | строк/сутки | 4800 | для коробов: заказов/сутки = строки | `pick_lines_per_day` |
| `pickPiecesDay` | Отбор | шт/сутки | 7200 | только справочно | `pick_units_per_day` |
| `piecePickShare` | Доля мелкоштучного | % | 60 | справочно | `piece_pick_share` |
| `skuActive` | Активных SKU | шт | 800 | справочно | `sku_count` |
| `aClassShare` | Доля A-класса | % | 20 | справочно | `sku_a_class_share` |

### Экономика (в mock — заглушки, заменяются формулами экономистов)

| key | Поле | Ед. | Default | → наш key |
|---|---|---|---|---|
| `staffCostYear` | Стоимость сотрудника | $/год | 21600 | `salary_picker_month × 12 × (1 + payroll_tax_rate)` |
| `manualPerWorker` | Производительность сотрудника | заказов/ч | 12 | `picker_lines_per_hour` |
| `utilizationPct` | Коэффициент загрузки робота | % | 80 | `k_load` из `norms` |
| `residualStaffPct` | Персонал, остающийся при роботизации | % | 25 | — (норматив) |
| `raasRatePct` | Аренда RaaS | % стоимости/год | 24 | `raas_monthly_share × 12` из `norms` |
| `horizonYears` | Горизонт расчёта | лет | 5 | `horizon_years` из `norms` |

### Симуляция

| key | Поле | Ед. | Default |
|---|---|---|---|
| `horizonMin` | Длительность симуляции | мин | 20 |

## Уровень 2 — что нужно знать о роботе (из каталога + `specs`)

| Поле | Ед. | Откуда у нас | Примечание |
|---|---|---|---|
| `type` | `AMR / UGV / AGV / MM / SR / DOG / HUM / FMR / CTU / ASRS` | маппинг из `subtype` | AMR→AMR, FMR/штабелёр/погрузчик→FMR, тягач→AGV, манипулятор→MM, стационарные→ASRS |
| `w`, `l` | м | `specs.width_mm`, `specs.length_mm` | габариты корпуса |
| `forkLen` | м | `specs.fork_length_mm` | только FMR/CTU; иначе 0.8 × l |
| `speedMps` | м/с | `specs.speed_m_s` | |
| `payloadKg` | кг | `specs.payload_kg` | |
| `throughputPerHour` | ед/ч | `specs.throughput_units_per_h` | ключевое число: от него N роботов и вердикт имитации |
| `price` | ₽ | `price` | |

Все поля, кроме `price`, — из ТТХ робототехников (`ttx_warehouse_template.csv`). В шаблон надо **добавить `fork_length_mm`**.

## Уровень 3 — что получает визуализация (`result`) и как считается

Из уровней 1 и 2 `mockCalc` собирает один объект на сценарий. Формулы — заглушки (помечены `FORMULA`), их заменяют экономисты, **структура остаётся**.

| Поле result | Как получается |
|---|---|
| `warehouse` | `{ width, length, aisleWidth: max(aisleWidth, minAisle(robot, cargo)) }` |
| `cargo` | `{ type, unit: {l, w, h, massKg}, oversizeShare }` — по `cargoType` из габаритов паллеты / SKU |
| `rack` | `{ type, w, l, capacityPerRack }` — типовая секция по типу стеллажа и груза + `shelfCapacity` |
| `robot` | поля уровня 2 (для ASRS — `null`, а сами системы в `stationary[]`) |
| `counts.robots` | `ceil( заказов_в_час / (throughputPerHour × utilization) )`, где заказов_в_час = заказов/сутки ÷ `workHours` |
| `counts.racks` | `ceil( мест_хранения / вместимость_секции )`, мест = `palletPlaces` (для коробов ×6) |
| `counts.chargers` | `ceil(robots / 2)` |
| `simulation` | `horizonMin`, `tasksPerRobot = ceil(заказов_в_час / robots × horizonMin / 60)`, `requiredOrdersPerHour`, `initialFillPct: 35`, `chargeEveryOrders: [5,10]`, `chargeSec: [15,40]` |
| `kpis` | `capex, opex, effect, payback, roi, tco, units` — по id строится сравнительная таблица сценариев |
| `charts` | pie «структура затрат», line «накопленный денежный поток», bar «требуется vs мощность парка» |
| `assumptions` | `[{ title, text }]` — формулы словами, показываются пользователю |
| `inputs` | все введённые поля с подписями — блок «исходные данные» |
| `meta` | `{ scenarioName, kind: baseline/buy/raas, modelVersion, dataVersion, calculatedAt }` |

Три сценария = три `result`: `baseline` (только KPI, схема не строится), `buy`, `raas`.

## Что это значит для нашей страницы

**Минимальный набор, чтобы получить картинку и имитацию** (без экономики): `rackType`, `cargoType`, `width`, `length`, `aisleWidth`, `workHours`, `shelfCapacity`, `palletPlaces`, габариты и масса груза, объём операций (`pickLinesDay` или приёмка+отгрузка), выбранный робот. 12 полей.

**Расхождения с `INPUTS_WAREHOUSE.md`, которые надо решить:**
1. У нас площадь, у них ширина × длина → в форму добавить `warehouse_width_m` и `warehouse_length_m`, площадь считать автоматически.
2. `shelfCapacity` (мест на секцию) у нас нет → добавить в блок E с подсказкой «паллеты 4–6, коробы 10–20».
3. `workHours` = `shifts_per_day × shift_hours` — считать, не спрашивать.
4. Поля фазы 1 (пол, уклон, температура, IP, этажи) визуализация не использует — они только для подбора. Это нормально.
5. Экономические поля виза (`staffCostYear`, `residualStaffPct`…) — это не пользовательский ввод, а нормативы экономистов; в форме их не показывать, брать из `norms`.

**Разбивка по экранам визарда:**
- Шаг 2 «Объект» — селекты стеллаж/груз + блок «Склад» + блок «Хранение и грузы» (фаза 1 + E)
- Шаг 3 «Операции и персонал» — блок «Операции» + G (фаза 2)
- Шаг 4 «Подбор» — витрина роботов; выбранный → уровень 2
- Шаг 5 «Результат» — `<ScenarioView scenarios={[baseline, buy, raas]} />` из их `core`
