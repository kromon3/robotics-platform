import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PrismaClient } from '../generated/prisma/client';

// Экспорт каталога: одна строка = продукт × (сценарий, отрасль, кейс),
// поэтому один и тот же product id может встречаться несколько раз.
const CATALOG_FILE = path.join(__dirname, 'data', 'catalog_export_v4.json');
// Версия каталога совпадает с версией экспорта (п. 3.1.5 — фиксируется в проекте).
const CATALOG_VERSION = 4;

type RawRow = {
  id: string;
  Название: string;
  тип: string; // brs | bas | software
  статус: string; // operation | piloting | rnd
  компания: string;
  описание: string;
  Тип: string; // категория ("Мобильные роботы", ...), может быть пустой
  Подтип: string;
  Сценарий: string;
  Кейсы: string;
  УГТ: number | string;
  'Рын Потенциал': number | string;
  Регион: string;
  Отрасль: string;
  'Цена изделия': string; // "2 700 000,00"
};

type ProductAgg = {
  id: string;
  name: string;
  type: string;
  status: string;
  company: string;
  region: string | null;
  description: string | null;
  category: string | null;
  subtype: string | null;
  price: string | null;
  ugt: number | null;
  marketPotential: number | null;
  scenarios: Set<string>;
  industries: Set<string>;
  cases: Set<string>;
};

const clean = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s.length ? s : null;
};

const toInt = (v: unknown): number | null => {
  const s = clean(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
};

// "2 700 000,00" -> "2700000.00" (Prisma принимает Decimal строкой)
const toDecimal = (v: unknown): string | null => {
  const s = clean(v);
  if (s === null) return null;
  const normalized = s.replace(/[\s ]/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(normalized) ? normalized : null;
};

// В ячейке "Сценарий" бывает перечисление через запятую. Режем только перед фрагментом
// с заглавной буквы: "Мониторинг ЛЭП, Таксация лесов" -> 2 сценария,
// а "Внутритрубная диагностика, очистка и ремонт труб" остаётся одним.
const splitScenarios = (v: unknown): string[] => {
  const s = clean(v);
  if (s === null) return [];
  return s
    .split(/,\s*(?=[А-ЯЁA-Z])/u)
    .map((x) => x.trim())
    .filter(Boolean);
};

function loadRows(): RawRow[] {
  const raw = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8')) as Record<string, RawRow>;
  return Object.values(raw);
}

function aggregate(rows: RawRow[]): ProductAgg[] {
  const byId = new Map<string, ProductAgg>();

  for (const row of rows) {
    let p = byId.get(row.id);
    if (!p) {
      p = {
        id: row.id,
        name: clean(row['Название']) ?? row.id,
        type: clean(row['тип']) ?? 'brs',
        status: clean(row['статус']) ?? 'rnd',
        company: clean(row['компания']) ?? 'Неизвестная компания',
        region: clean(row['Регион']),
        description: clean(row['описание']),
        category: clean(row['Тип']),
        subtype: clean(row['Подтип']),
        price: toDecimal(row['Цена изделия']),
        ugt: toInt(row['УГТ']),
        marketPotential: toInt(row['Рын Потенциал']),
        scenarios: new Set(),
        industries: new Set(),
        cases: new Set(),
      };
      byId.set(row.id, p);
    }

    // В дублях скалярные поля совпадают; если в первой строке было пусто — добираем из следующих.
    p.price ??= toDecimal(row['Цена изделия']);
    p.category ??= clean(row['Тип']);
    p.subtype ??= clean(row['Подтип']);
    p.marketPotential ??= toInt(row['Рын Потенциал']);

    splitScenarios(row['Сценарий']).forEach((s) => p.scenarios.add(s));
    const industry = clean(row['Отрасль']);
    if (industry) p.industries.add(industry);
    const caseText = clean(row['Кейсы']);
    if (caseText) p.cases.add(caseText);
  }

  return [...byId.values()];
}

export async function seedCatalog(prisma: PrismaClient) {
  const rows = loadRows();
  const products = aggregate(rows);

  // --- справочники: компании, отрасли, сценарии ---
  const companyRegion = new Map<string, string | null>();
  const industryNames = new Set<string>();
  const scenarioNames = new Set<string>();
  for (const p of products) {
    if (!companyRegion.has(p.company)) companyRegion.set(p.company, p.region);
    p.industries.forEach((i) => industryNames.add(i));
    p.scenarios.forEach((s) => scenarioNames.add(s));
  }

  const companyIds = new Map<string, string>();
  for (const [name, region] of companyRegion) {
    const c = await prisma.company.upsert({
      where: { name },
      update: { region },
      create: { name, region },
    });
    companyIds.set(name, c.id);
  }

  const industryIds = new Map<string, string>();
  for (const name of industryNames) {
    const i = await prisma.industry.upsert({ where: { name }, update: {}, create: { name } });
    industryIds.set(name, i.id);
  }

  const scenarioIds = new Map<string, string>();
  for (const name of scenarioNames) {
    const s = await prisma.scenario.upsert({ where: { name }, update: {}, create: { name } });
    scenarioIds.set(name, s.id);
  }

  // --- продукты + связи ---
  let casesTotal = 0;
  for (const p of products) {
    const data = {
      name: p.name,
      type: p.type,
      subtype: p.subtype,
      category: p.category,
      description: p.description,
      price: p.price,
      ugt: p.ugt,
      marketPotential: p.marketPotential,
      status: p.status,
      companyId: companyIds.get(p.company)!,
      catalogVersion: CATALOG_VERSION,
    };
    const industries = [...p.industries].map((n) => ({ industryId: industryIds.get(n)! }));
    const scenarios = [...p.scenarios].map((n) => ({ scenarioId: scenarioIds.get(n)! }));
    const cases = [...p.cases].map((description) => ({ description }));
    casesTotal += cases.length;

    // id берём из экспорта, чтобы ссылки на продукты были стабильны между пересидами.
    // Связи и кейсы пересоздаём целиком — так сид остаётся идемпотентным без уникальных ключей на Case.
    await prisma.product.upsert({
      where: { id: p.id },
      update: {
        ...data,
        productIndustries: { deleteMany: {}, create: industries },
        productScenarios: { deleteMany: {}, create: scenarios },
        cases: { deleteMany: {}, create: cases },
      },
      create: {
        id: p.id,
        ...data,
        productIndustries: { create: industries },
        productScenarios: { create: scenarios },
        cases: { create: cases },
      },
    });
  }

  console.log('✅ Каталог засеян');
  console.log(`   строк в экспорте: ${rows.length}`);
  console.log(`   компаний: ${companyIds.size}, отраслей: ${industryIds.size}, сценариев: ${scenarioIds.size}`);
  console.log(`   продуктов: ${products.length}, кейсов: ${casesTotal}`);
}
