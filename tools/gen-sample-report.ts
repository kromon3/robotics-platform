// Пример выгруженного итогового отчёта для сдачи (ТЗ 8.2.7): docs/sample-report.xls.
// Собирает ту же книгу, что и кнопка «Скачать Excel», на данных демо-склада
// («Заполнить примером» на обоих экранах ввода) и решения Ronavi H1500.
//
// Запуск: npx jiti tools/gen-sample-report.ts   (из apps/web/vite-project)

import * as fs from "node:fs";
import * as path from "node:path";
import { EXAMPLE, toNumericFormData } from "../apps/web/vite-project/src/store/store";
import { ECON_EXAMPLE, toEconNumeric } from "../apps/web/vite-project/src/store/econStore";
import { MODEL_VERSION, toNorms, toSiteInput } from "../apps/web/vite-project/src/viz/adapter";
import { buildReportWorkbook } from "../apps/web/vite-project/src/lib/report-export";

const params = toNumericFormData(EXAMPLE);
// Стеллажи из каталога поставщиков: ДВК СТЛ Э, 1 400 ₽ за место хранения
const econ = toEconNumeric({ ...ECON_EXAMPLE, rackSystemId: "RK-005" });

const site = toSiteInput(params, econ);
const norms = toNorms(econ, undefined, params);
const robot = { name: "Ronavi H1500", price: 2_700_000, throughputPerHour: 90 };

const xml = buildReportWorkbook(site, robot, norms, {
    projectName: "Экспресс-оценка роботизации — демо-склад 40 × 24 м",
    robotName: "Ronavi H1500, ООО «Ронави Роботикс»",
    objectType: "Склад",
    catalogVersion: 4,
    modelVersion: MODEL_VERSION,
    specsSource: "каталог робототехников, данные производителя",
});

const out = path.join(__dirname, "..", "docs", "sample-report.xls");
fs.writeFileSync(out, xml, "utf8");
console.log(`Записано ${(xml.length / 1024).toFixed(1)} КБ -> ${path.relative(process.cwd(), out)}`);
