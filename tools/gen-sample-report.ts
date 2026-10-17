// Пример выгруженного итогового отчёта для сдачи (ТЗ 8.2.7): docs/sample-report.xls.
// Собирает ту же книгу, что и кнопка «Скачать Excel», на данных демо-склада
// («Заполнить примером» на обоих экранах ввода) и решения Ronavi H1500.
//
// Запуск: npx jiti tools/gen-sample-report.ts   (из apps/web/vite-project)

import * as fs from "node:fs";
import * as path from "node:path";
import { EXAMPLE, toNumericFormData } from "../apps/web/vite-project/src/store/store";
import { ECON_EXAMPLE, toEconNumeric } from "../apps/web/vite-project/src/store/econStore";
import { MODEL_VERSION, normsFor, toNorms, toRobotInput, toSiteInput } from "../apps/web/vite-project/src/viz/adapter";
import { computeScenario } from "../apps/web/vite-project/src/viz/economics";
import type { VizRobot } from "../apps/web/vite-project/src/viz/robotSpecs";
import { buildReportWorkbook } from "../apps/web/vite-project/src/lib/report-export";

const params = toNumericFormData(EXAMPLE);
// Стеллажи из каталога поставщиков: ДВК СТЛ Э, 1 400 ₽ за место хранения
const econ = toEconNumeric({ ...ECON_EXAMPLE, rackSystemId: "RK-005" });

// ТТХ Ronavi H1500 из каталога робототехников (R-101): 1,5 м/с, 10 ч работы, 2 ч зарядки.
// Производительность — по модели маршрута, ворота в центре стены (значение формы по умолчанию)
const h1500: VizRobot = {
    id: "R-101", name: "Ronavi H1500", type: "AMR", w: 0.654, l: 1.044, speedMps: 1.5, payloadKg: 1500,
    throughputPerHour: 90, price: 2_700_000, specsSource: "specs", throughputSource: "type-default",
    runtimeH: 10, chargeH: 2,
};

const site = toSiteInput(params, econ);
const robot = toRobotInput(h1500, params, econ);
const norms = normsFor(toNorms(econ, undefined, params), robot);

const xml = buildReportWorkbook(site, robot, norms, {
    projectName: `Экспресс-оценка роботизации — демо-склад ${params.width} × ${params.length} м`,
    robotName: "Ronavi H1500, ООО «Ронави Роботикс»",
    objectType: "Склад",
    catalogVersion: 4,
    modelVersion: MODEL_VERSION,
    specsSource: "каталог робототехников, данные производителя",
});

const out = path.join(__dirname, "..", "docs", "sample-report.xls");
fs.writeFileSync(out, xml, "utf8");
console.log(`Записано ${(xml.length / 1024).toFixed(1)} КБ -> ${path.relative(process.cwd(), out)}`);
const buy = computeScenario("buy", site, robot, norms);
console.log(`Покупка: ${buy.units} роботов, CAPEX ${Math.round(buy.capex)} ₽, OPEX ${Math.round(buy.opex)} ₽/год, окупаемость ${buy.paybackYears} г.`);
