import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '../generated/prisma/client';

// ТТХ роботов от робототехников (лист «Экспорт» из «Каталог роботов и стеллажей»).
// Матчится с каталогом организатора по названию; чего в каталоге нет — добавляется как новый продукт.
// Фото лежат в prisma/data/photos/<catalogId>.<ext> и отдаются API как /catalog/photos/<файл>.

type SpecRow = {
  catalogId: string; // R-101…
  name: string;
  manufacturer: string | null;
  priceRub: number | null;
  photo: string | null;
  sourceUrl: string | null;
  sourceDate: string | null;
  verified: boolean;
  specs: Record<string, unknown>;
};

// Кириллические омоглифы -> латиница: «АК-2000» и «AK-2000» должны совпасть
const HOMO: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
};
// «Ronavi H1500 (грузоподъемность до 1 500 кг)» -> «ronavi h1500»
const norm = (s: string | null) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const key = (s: string | null) =>
  norm(s)
    .split('')
    .map((ch) => HOMO[ch] ?? ch)
    .join('');
const payloadOf = (s: string | null) => {
  const m = String(s ?? '').match(/до\s*([\d\s]+)\s*кг/i);
  return m ? Number(m[1].replace(/\s/g, '')) : null;
};

// Тип робота из каталога ТТХ -> подтип продукта, если у продукта его нет
const SUBTYPE_BY_TYPE: Record<string, string> = {
  AMR: 'AMR', FMR: 'FMR', CTU: 'CTU', AGV: 'AGV', UGV: 'UGV',
  MM: 'Мобильный манипулятор', SR: 'Сортировочная тележка',
  DOG: 'Робособака', HUM: 'Гуманоид', ASRS: 'Стационарная система',
};

// Сценарии, в которых участвует складской робот. Сортировочные тележки и шаттлы —
// ещё и в сортировке грузов; названия те же, что в каталоге организатора.
const WAREHOUSE_SCENARIOS = ['Внутрискладская логистика', 'Внутрипроизводственная логистика'];
const SORTING_TYPES = ['SR', 'CTU', 'ASRS'];

async function linkWarehouseScenarios(prisma: PrismaClient, productId: string, robotType: string) {
  const names = [...WAREHOUSE_SCENARIOS, ...(SORTING_TYPES.includes(robotType) ? ['Сортировка грузов'] : [])];
  for (const name of names) {
    const scenario = await prisma.scenario.findFirst({ where: { name } });
    if (!scenario) continue;
    await prisma.productScenario.createMany({
      data: [{ productId, scenarioId: scenario.id }],
      skipDuplicates: true,
    });
  }
  const industry = await prisma.industry.findFirst({ where: { name: 'Транспорт и логистика' } });
  if (industry)
    await prisma.productIndustry.createMany({
      data: [{ productId, industryId: industry.id }],
      skipDuplicates: true,
    });
}

export async function seedRobotSpecs(prisma: PrismaClient) {
  const file = path.join(__dirname, 'data', 'robot-specs.json');
  if (!fs.existsSync(file)) {
    console.log('   specs: robot-specs.json не найден, пропускаем');
    return;
  }
  const rows: SpecRow[] = JSON.parse(fs.readFileSync(file, 'utf8'));

  const products = await prisma.product.findMany({
    select: { id: true, name: true, companyId: true, type: true, status: true, subtype: true, category: true },
  });

  const byNorm = new Map<string, typeof products>();
  for (const p of products) {
    const k = norm(p.name);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k)!.push(p);
  }

  const used = new Set<string>();
  const find = (row: SpecRow) => {
    const k = norm(row.name);
    const sk = key(row.name);
    let hit = byNorm.get(k);
    if (!hit) {
      const short = k.split(' ').slice(1).join(' ');
      hit = short ? byNorm.get(short) : undefined;
    }
    if (!hit) {
      const cand = products.filter((p) => {
        const pk = key(p.name);
        if (!pk || used.has(p.id)) return false;
        return pk === sk || sk.endsWith(pk) || pk.endsWith(sk);
      });
      if (cand.length) hit = cand;
    }
    if (!hit) {
      const cand = products.filter((p) => {
        const pk = key(p.name);
        if (!pk || pk.length < 4 || used.has(p.id)) return false;
        return pk.includes(sk) || sk.includes(pk);
      });
      if (cand.length) hit = cand;
    }
    if (hit && hit.length > 1) {
      const want = (row.specs.payload_kg as number) ?? null;
      const exact = hit.filter((p) => payloadOf(p.name) === want);
      if (exact.length) hit = exact;
    }
    if (hit && hit.length > 1) {
      const free = hit.filter((p) => !used.has(p.id));
      if (free.length) hit = free;
    }
    return hit?.[0];
  };

  // Компания для новых продуктов: по производителю из ТТХ, иначе «Не указан»
  const companyId = async (name: string | null) => {
    const clean = (name ?? 'Не указан').trim() || 'Не указан';
    const existing = await prisma.company.findFirst({ where: { name: { contains: clean.split(' ')[0], mode: 'insensitive' } } });
    if (existing) return existing.id;
    const created = await prisma.company.upsert({
      where: { name: clean },
      update: {},
      create: { name: clean, region: null, companyType: null },
    });
    return created.id;
  };

  let updated = 0;
  let created = 0;

  for (const row of rows) {
    const specs = { ...row.specs, catalog_id: row.catalogId, photo: row.photo };
    const data = {
      specs,
      sourceUrl: row.sourceUrl,
      sourceDate: row.sourceDate ? new Date(row.sourceDate) : null,
      verified: row.verified,
      ...(row.priceRub ? { price: row.priceRub } : {}),
    };

    const product = find(row);
    if (product) {
      used.add(product.id);
      await prisma.product.update({
        where: { id: product.id },
        data: {
          ...data,
          // подтип проставляем, только если его нет — данные организатора не перетираем
          ...(product.subtype ? {} : { subtype: SUBTYPE_BY_TYPE[String(row.specs.robot_type)] ?? null }),
        },
      });
      updated++;
    } else {
      const existing = await prisma.product.findFirst({ where: { specs: { path: ['catalog_id'], equals: row.catalogId } } });
      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data });
        updated++;
        continue;
      }
      const product = await prisma.product.create({
        data: {
          name: row.name,
          type: 'brs',
          status: 'operation',
          subtype: SUBTYPE_BY_TYPE[String(row.specs.robot_type)] ?? null,
          category: 'Мобильные роботы',
          description: null,
          companyId: await companyId(row.manufacturer),
          ...data,
        },
      });
      // Без сценария решение не попадёт в подбор: витрина берёт кандидатов по складским сценариям
      await linkWarehouseScenarios(prisma, product.id, String(row.specs.robot_type));
      created++;
    }
  }

  const withSpecs = await prisma.product.count({ where: { NOT: { specs: { equals: {} } } } });
  console.log(`   specs: обновлено ${updated}, добавлено ${created}; продуктов с ТТХ: ${withSpecs}`);
}
