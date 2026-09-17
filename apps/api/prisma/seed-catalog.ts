import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '../generated/prisma/client';

// Строка выгрузки организатора (catalog_export_v4). Выгрузка денормализована:
// один продукт повторяется с разными «Отрасль»/«Сценарий», поэтому 223 строки = 187 продуктов.
type CatalogRow = {
  id: string;
  Название: string;
  тип: string;
  статус: string;
  компания: string;
  описание: string;
  Тип: string;
  Подтип: string;
  Сценарий: string;
  Кейсы: string;
  УГТ: number | string;
  'Рын Потенциал': number | string;
  Регион: string;
  Отрасль: string;
  'Цена изделия': string;
};

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const orNull = (v: unknown) => clean(v) || null;
const toInt = (v: unknown) => {
  const n = parseInt(clean(v), 10);
  return Number.isNaN(n) ? null : n;
};
// "2 700 000,00" -> 2700000
const toPrice = (v: unknown) => {
  const n = Number(clean(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};
// Список сценариев через запятую, но запятые есть и внутри названий —
// режем только перед заглавной буквой.
const splitScenarios = (v: unknown) =>
  clean(v)
    .split(/,\s+(?=[А-ЯЁA-Z])/)
    .map(clean)
    .filter(Boolean);
// ООО "Ронави Роботикс" -> ООО. \b с кириллицей в JS не работает, поэтому lookahead на пробел.
const companyType = (name: string) => name.match(/^(ООО|АО|ПАО|ЗАО|ИП|ФГУП|НПО|ГК)(?=\s|$)/)?.[1] ?? null;

export async function seedCatalog(prisma: PrismaClient) {
  const file = path.join(__dirname, 'data', 'catalog_export_v4.json');
  const rows: CatalogRow[] = JSON.parse(fs.readFileSync(file, 'utf8'));

  // 1. Справочники. createMany + skipDuplicates — повторный запуск ничего не дублирует.
  const companies = new Map<string, CatalogRow>();
  for (const r of rows) {
    const name = clean(r.компания);
    if (name && !companies.has(name)) companies.set(name, r);
  }
  await prisma.company.createMany({
    data: [...companies.entries()].map(([name, r]) => ({
      name,
      region: orNull(r.Регион),
      companyType: companyType(name),
    })),
    skipDuplicates: true,
  });

  await prisma.industry.createMany({
    data: [...new Set(rows.map((r) => clean(r.Отрасль)).filter(Boolean))].map((name) => ({ name })),
    skipDuplicates: true,
  });

  await prisma.scenario.createMany({
    data: [...new Set(rows.flatMap((r) => splitScenarios(r.Сценарий)))].map((name) => ({ name })),
    skipDuplicates: true,
  });

  // createMany не возвращает id — вычитываем справочники обратно.
  const companyId = new Map((await prisma.company.findMany()).map((c) => [c.name, c.id]));
  const industryId = new Map((await prisma.industry.findMany()).map((i) => [i.name, i.id]));
  const scenarioId = new Map((await prisma.scenario.findMany()).map((s) => [s.name, s.id]));

  // 2. Продукты: один на уникальный id, берём первую встреченную строку.
  //    id организатора сохраняем как первичный ключ — связь с каталогом и идемпотентность.
  const products = new Map<string, CatalogRow>();
  for (const r of rows) if (!products.has(r.id)) products.set(r.id, r);

  await prisma.product.createMany({
    data: [...products.values()].map((r) => ({
      id: r.id,
      name: clean(r.Название),
      type: clean(r.тип),
      status: clean(r.статус),
      subtype: orNull(r.Подтип),
      category: orNull(r.Тип),
      description: orNull(r.описание),
      price: toPrice(r['Цена изделия']),
      ugt: toInt(r.УГТ),
      marketPotential: toInt(r['Рын Потенциал']),
      companyId: companyId.get(clean(r.компания))!,
    })),
    skipDuplicates: true,
  });

  // 3. Связки — по ВСЕМ строкам: повторы id как раз и дают вторую отрасль / сценарий.
  await prisma.productIndustry.createMany({
    data: rows
      .filter((r) => industryId.has(clean(r.Отрасль)))
      .map((r) => ({ productId: r.id, industryId: industryId.get(clean(r.Отрасль))! })),
    skipDuplicates: true,
  });

  await prisma.productScenario.createMany({
    data: rows.flatMap((r) =>
      splitScenarios(r.Сценарий).map((s) => ({ productId: r.id, scenarioId: scenarioId.get(s)! })),
    ),
    skipDuplicates: true,
  });

  // 4. Кейсы: у case нет уникального ключа, поэтому заливаем только в пустую таблицу.
  //    Один кейс на уникальный текст «Кейсы» продукта (у некоторых продуктов их несколько).
  if ((await prisma.case.count()) === 0) {
    const seen = new Set<string>();
    const cases: { productId: string; description: string }[] = [];
    for (const r of rows) {
      const text = clean(r.Кейсы);
      const key = `${r.id}|${text}`;
      if (!text || seen.has(key)) continue;
      seen.add(key);
      cases.push({ productId: r.id, description: text });
    }
    await prisma.case.createMany({ data: cases });
  }

  const [c, p, i, s, cs, pi, ps] = await Promise.all([
    prisma.company.count(),
    prisma.product.count(),
    prisma.industry.count(),
    prisma.scenario.count(),
    prisma.case.count(),
    prisma.productIndustry.count(),
    prisma.productScenario.count(),
  ]);
  console.log(
    `   catalog: ${p} products, ${c} companies, ${i} industries, ${s} scenarios, ${cs} cases, ` +
      `${pi} product-industry, ${ps} product-scenario links`,
  );
}
