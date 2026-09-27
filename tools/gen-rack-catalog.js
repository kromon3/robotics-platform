// Генерация src/viz/rackCatalog.ts из листа «Стеллажи» каталога робототехников.
// Данные в репозитории лежат как CSV (apps/api/prisma/data/racks-sheet.csv) — источник,
// а в приложение попадает разобранный и нормализованный TypeScript, чтобы не парсить CSV в рантайме.
//
// Запуск: node tools/gen-rack-catalog.js

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'apps', 'api', 'prisma', 'data', 'racks-sheet.csv');
const OUT = path.join(__dirname, '..', 'apps', 'web', 'vite-project', 'src', 'viz', 'rackCatalog.ts');

// «Тип системы» из листа -> тип стеллажа в форме объекта
const TYPE_MAP = [
  [/штабельн/i, 'stack'],
  [/полочн/i, 'shelf'],
  [/фронтальн/i, 'shelf'],
  [/глубинн/i, 'deep'],
  [/поточн/i, 'flow'],
  [/консольн/i, 'cantilever'],
  [/мезонин/i, 'mezzanine'],
];

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/** «2–3 паллеты» -> 3; «6 (2×3)» -> 6; «3 консоли × 1–2 места» -> 5; «по площади» -> null */
function places(s) {
  // Пояснение в скобках не считаем: «6 (2×3)» -> «6», «12–24 паллеты (канал)» -> «12–24 паллеты»
  s = String(s ?? '').replace(/\([^)]*\)/g, ' ');
  if (!s.trim() || /по площади|высок|средн|низк/i.test(s)) return null;
  const factors = s
    .split(/[×x]/)
    .map((part) => {
      const nums = (part.match(/\d+/g) || []).map(Number);
      if (!nums.length) return null;
      return nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
    })
    .filter((n) => n !== null);
  if (!factors.length) return null;
  return Math.round(factors.reduce((a, b) => a * b, 1));
}

const firstInt = (s) => { const m = String(s ?? '').match(/\d+/); return m ? Number(m[0]) : null; };

/** «9500 (ориентир)» -> 9500; «по проекту» -> null */
const price = (s) => { const m = String(s ?? '').replace(/\s/g, '').match(/^\d+/); return m ? Number(m[0]) : null; };

/** «от, за секцию» -> section; «за паллетоместо» -> place; «за м²» -> m2; «за проект» -> project */
function unit(s) {
  if (/паллетоместо/i.test(s)) return 'place';
  if (/м²/i.test(s)) return 'm2';
  if (/проект/i.test(s)) return 'project';
  if (/секци|стеллаж|шт\./i.test(s)) return 'section';
  return 'project';
}

/**
 * «2700×1100×6000» -> {w: 2.7, l: 1.1, h: 6}   (Д×Г×В, Д — вдоль прохода, Г — глубина)
 * «глубина 4–8 паллет × 1100 × 6000» -> глубина считается по паллете 1,2 м
 */
function dims(s) {
  // \w в JS не покрывает кириллицу — перечисляем буквы явно
  const deep = s.match(/глубин[а-яё]*\s*(?:канала\s*)?(?:до\s*)?(\d+)\s*[–-]\s*(\d+)\s*паллет/i);
  const nums = (s.match(/\d+/g) || []).map(Number).filter((n) => n >= 100);
  if (deep) {
    const depthM = (((Number(deep[1]) + Number(deep[2])) / 2) * 1200) / 1000;
    const rest = nums.filter((n) => n >= 100);
    return { w: rest[0] ? rest[0] / 1000 : null, l: +depthM.toFixed(1), h: rest[1] ? rest[1] / 1000 : null };
  }
  if (nums.length >= 3) return { w: nums[0] / 1000, l: nums[1] / 1000, h: nums[2] / 1000 };
  if (nums.length === 1) return { w: null, l: null, h: nums[0] / 1000 }; // «2500 (высота этажа)»
  return { w: null, l: null, h: null };
}

const rows = parseCsv(fs.readFileSync(SRC, 'utf8'));
const racks = rows.map((r, i) => {
  const rackType = (TYPE_MAP.find(([re]) => re.test(r.system)) ?? [null, null])[1];
  const p = price(r.price);
  const u = unit(r.price_unit);
  const cap = places(r.capacity);
  const d = dims(r.section_dims_mm);
  const tiers = firstInt(r.tiers);

  // ₽ за место хранения: прямая цена за паллетоместо или цена секции, делённая на её вместимость
  const pricePerPlace = u === 'place' ? p : u === 'section' && p && cap ? Math.round(p / cap) : null;

  return {
    id: `RK-${String(i + 1).padStart(3, '0')}`,
    rackType,
    system: r.system,
    brand: r.brand,
    model: r.model,
    priceRub: p,
    priceUnit: u,
    priceNote: /от,/.test(r.price_unit) ? 'от' : /ориентир/i.test(r.price) ? 'ориентир' : null,
    pricePerPlace,
    pricePerM2: u === 'm2' ? p : null,
    placesPerSection: cap,
    tiers,
    tierLoadKg: firstInt(r.tier_load_kg),
    sectionLoadKg: firstInt(r.section_load_kg),
    sizeM: d,
    density: r.density || null,
    access: r.access || null,
    sourceUrl: r.source_url || null,
  };
});

const header = `// СГЕНЕРИРОВАНО: node tools/gen-rack-catalog.js — правки вносите в
// apps/api/prisma/data/racks-sheet.csv (лист «Стеллажи» каталога робототехников) и перегенерируйте.
//
// Цены и габариты — из открытых прайсов поставщиков, ссылка на источник у каждой позиции.
// pricePerPlace — ₽ за место хранения: либо прямая цена за паллетоместо, либо цена секции,
// делённая на вместимость секции. Позиции «по проекту» удельной цены не имеют.

import type { RackType } from "../store/store";

export type RackPriceUnit = "place" | "section" | "m2" | "project";

export type RackSystem = {
    id: string;
    /** Тип стеллажа в терминах формы объекта; null — систему не удалось отнести к типу */
    rackType: RackType | null;
    system: string;
    brand: string;
    model: string;
    priceRub: number | null;
    priceUnit: RackPriceUnit;
    /** «от» или «ориентир» — цена не финальная */
    priceNote: string | null;
    pricePerPlace: number | null;
    pricePerM2: number | null;
    placesPerSection: number | null;
    tiers: number | null;
    tierLoadKg: number | null;
    sectionLoadKg: number | null;
    /** Габариты секции в метрах: w — вдоль прохода, l — глубина, h — высота */
    sizeM: { w: number | null; l: number | null; h: number | null };
    density: string | null;
    access: string | null;
    sourceUrl: string | null;
};

export const RACK_SYSTEMS: RackSystem[] = `;

const footer = `;

/** Системы для выбранного типа стеллажа, у которых есть удельная цена — их можно посчитать в CAPEX */
export const pricedRacksFor = (rackType: RackType | ""): RackSystem[] =>
    rackType ? RACK_SYSTEMS.filter((r) => r.rackType === rackType && (r.pricePerPlace ?? r.pricePerM2)) : [];

export const rackById = (id: string): RackSystem | undefined => RACK_SYSTEMS.find((r) => r.id === id);

/** Подпись позиции для выпадающего списка и для состава затрат */
export const rackLabel = (r: RackSystem): string => {
    const price = r.pricePerPlace
        ? r.pricePerPlace.toLocaleString("ru-RU") + " ₽/место"
        : r.pricePerM2
          ? r.pricePerM2.toLocaleString("ru-RU") + " ₽/м²"
          : "цена по проекту";
    return r.brand + " " + r.model + " — " + price;
};
`;

fs.writeFileSync(OUT, header + JSON.stringify(racks, null, 4) + footer, 'utf8');
console.log(`Записано ${racks.length} систем -> ${path.relative(process.cwd(), OUT)}`);
console.log('с ценой за место:', racks.filter((r) => r.pricePerPlace).length, '| за м²:', racks.filter((r) => r.pricePerM2).length, '| по проекту:', racks.filter((r) => !r.pricePerPlace && !r.pricePerM2).length);
