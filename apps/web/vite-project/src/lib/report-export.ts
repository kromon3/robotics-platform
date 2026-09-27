// Выгрузка итогового отчёта (п. 3.7.3 ТЗ): Excel — таблицами, PDF — печатью страницы.
// Excel собирается как SpreadsheetML 2003 (XML): открывается Excel и LibreOffice,
// поддерживает несколько листов и не требует зависимостей в бандле.

import {
    SOURCE_LABEL,
    computeScenario,
    paybackZone,
    roiZone,
    budgetZone,
    ZONE_LABEL,
    type Norms,
    type RobotInput,
    type SiteInput,
} from "../viz/economics";

export type ReportMeta = {
    projectName: string;
    robotName: string;
    objectType: string;
    catalogVersion: number | string;
    modelVersion: string;
    specsSource: string;
};

type Cell = string | number | null;
type Sheet = { name: string; rows: Cell[][] };

const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const cellXml = (v: Cell) => {
    if (v === null || v === "") return "<Cell/>";
    if (typeof v === "number" && Number.isFinite(v))
        return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
    return `<Cell><Data ss:Type="String">${esc(String(v))}</Data></Cell>`;
};

/** Листы -> книга SpreadsheetML. Первая строка каждого листа — заголовки (жирные). */
function toWorkbook(sheets: Sheet[]): string {
    const body = sheets
        .map((sheet) => {
            const rows = sheet.rows
                .map((row, i) => {
                    const style = i === 0 ? ' ss:StyleID="head"' : "";
                    const cells = row.map((c) => (i === 0 ? cellXml(c).replace("<Cell", `<Cell${style}`) : cellXml(c)));
                    return `<Row>${cells.join("")}</Row>`;
                })
                .join("");
            // Имя листа: Excel не принимает : \ / ? * [ ] и длину > 31
            const name = esc(sheet.name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31));
            return `<Worksheet ss:Name="${name}"><Table>${rows}</Table></Worksheet>`;
        })
        .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="head"><Font ss:Bold="1"/><Interior ss:Color="#E8EAF6" ss:Pattern="Solid"/></Style>
 </Styles>
 ${body}
</Workbook>`;
}

function download(filename: string, content: string, mime: string) {
    // Без BOM: кодировка объявлена в прологе XML, а BOM перед <?xml мешает строгим парсерам
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Отзываем ссылку не сразу: Safari успевает начать скачивание
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const slug = (s: string) =>
    s.replace(/[^\wа-яё\s-]/gi, "").trim().replace(/\s+/g, "-").slice(0, 60) || "otchet";

/** Книга отчёта как XML — отдельно от скачивания, чтобы её можно было собрать и вне браузера */
export function buildReportWorkbook(site: SiteInput, robot: RobotInput, norms: Norms, meta: ReportMeta): string {
    const base = computeScenario("baseline", site, robot, norms);
    const buy = computeScenario("buy", site, robot, norms);
    const raas = computeScenario("raas", site, robot, norms);
    const now = new Date();

    const pZone = paybackZone(buy.paybackYears);
    const rZone = roiZone(buy.roi);
    const bZone = budgetZone(buy.budgetShare);

    const summary: Sheet = {
        name: "Сводка",
        rows: [
            ["Показатель", "Значение"],
            ["Проект", meta.projectName],
            ["Тип объекта", meta.objectType],
            ["Решение", meta.robotName],
            ["Дата расчёта", now.toLocaleString("ru-RU")],
            ["Версия каталога", meta.catalogVersion],
            ["Версия модели", meta.modelVersion],
            ["Источник ТТХ робота", meta.specsSource],
            [],
            ["Пиковая потребность, ед/ч", +buy.peakDemand.toFixed(1)],
            ["Эффективная производительность робота, ед/ч", +buy.effective.toFixed(1)],
            ["Требуется роботов, шт", buy.units],
            ["Замещается персонала, чел.", +buy.replacedWorkers.toFixed(1)],
            [],
            ["CAPEX, ₽", Math.round(buy.capex)],
            ["OPEX, ₽/год", Math.round(buy.opex)],
            ["Годовой эффект, ₽/год", Math.round(buy.annualEffect)],
            ["Срок окупаемости, лет", buy.paybackYears ?? "—"],
            ["Зона по сроку окупаемости", pZone ? ZONE_LABEL[pZone] : "—"],
            [`ROI за ${norms.horizonYears} лет, %`, buy.roi ?? "—"],
            ["Зона по ROI", rZone ? ZONE_LABEL[rZone] : "—"],
            [`TCO за ${norms.horizonYears} лет, ₽`, Math.round(buy.tco)],
            ["CAPEX / бюджет, %", buy.budgetShare !== null ? Math.round(buy.budgetShare * 100) : "—"],
            ["Зона по бюджету", bZone ? ZONE_LABEL[bZone] : "—"],
            [],
            ["Дисклеймер", "Предварительная оценка. Результат требует верификации при обследовании объекта."],
        ],
    };

    const scenarios: Sheet = {
        name: "Сценарии",
        rows: [
            ["Показатель", "Без роботизации", "Покупка роботов", "RaaS"],
            ["Разовые затраты (CAPEX), ₽", 0, Math.round(buy.capex), Math.round(raas.capex)],
            ["OPEX, ₽/год", Math.round(base.opex), Math.round(buy.opex), Math.round(raas.opex)],
            ["Годовой эффект, ₽/год", 0, Math.round(buy.annualEffect), Math.round(raas.annualEffect)],
            [`TCO за ${norms.horizonYears} лет, ₽`, Math.round(base.tco), Math.round(buy.tco), Math.round(raas.tco)],
            ["Срок окупаемости, лет", "—", buy.paybackYears ?? "—", raas.paybackYears ?? "нет разовых затрат"],
            [`ROI за ${norms.horizonYears} лет, %`, "—", buy.roi ?? "—", raas.roi ?? "—"],
            ["Роботов, шт", "—", buy.units, raas.units],
        ],
    };

    const costSheet = (name: string, items: typeof buy.capexItems, unit: string): Sheet => ({
        name,
        rows: [
            ["Статья", `Сумма, ${unit}`, "Метод расчёта", "Источник"],
            ...items.map((i) => [i.label, Math.round(i.value), i.method, SOURCE_LABEL[i.source]] as Cell[]),
            ["ИТОГО", Math.round(items.reduce((a, i) => a + i.value, 0)), "", ""],
        ],
    });

    const inputs: Sheet = {
        name: "Исходные данные",
        rows: [
            ["Параметр", "Значение", "Единица"],
            ["Объём приёмки", Math.round(site.inboundPerDay), "ед/сут"],
            ["Объём отгрузки", Math.round(site.outboundPerDay), "ед/сут"],
            ["Смен в сутки", site.shiftsPerDay, "шт"],
            ["Продолжительность смены", site.shiftHours, "ч"],
            ["Рабочих дней в году", site.workingDaysPerYear, "дн"],
            ["Пиковый коэффициент", site.peakFactor, "—"],
            ["Численность замещаемого персонала", site.staffCount, "чел."],
            ["Зарплата", site.staffSalaryMonth, "₽/мес"],
            ["Бюджет роботизации", site.budget, "₽"],
            [],
            ["Цена решения", robot.price, "₽"],
            ["Паспортная производительность", robot.throughputPerHour, "ед/ч"],
        ],
    };

    const assumptions: Sheet = {
        name: "Нормативы",
        rows: [
            ["Коэффициент / ставка", "Значение", "Статус"],
            ["Коэффициент использования робота", norms.utilization, "модельное допущение"],
            ["Резерв мощности", norms.capacityReserve, "модельное допущение"],
            ["Выработка оператора, ед/ч", norms.workerOutputPerHour, "модельное допущение"],
            ["Начисления на ФОТ", norms.payrollTax, "датасет"],
            ["Цена зарядной станции, ₽", norms.chargerPrice, "КП поставщика"],
            ["ПО, доля оборудования", norms.softwareShare, "модельное допущение"],
            ["Интеграция, доля оборудования", norms.integrationShare, "модельное допущение"],
            ["Пусконаладка, доля оборудования", norms.commissioningShare, "модельное допущение"],
            ["ЗИП, доля оборудования", norms.sparePartsShare, "модельное допущение"],
            ["Резерв проекта", norms.capexReserve, "модельное допущение"],
            ["Подготовка пола, м²", norms.floorArea, "вводится пользователем"],
            ["Подготовка пола, ₽/м²", norms.floorPricePerM2, "модельное допущение"],
            ["Сервис, доля оборудования в год", norms.serviceShare, "модельное допущение"],
            ["Ремонт, доля оборудования в год", norms.repairShare, "модельное допущение"],
            ["Лицензии, ₽/год", norms.licensesPerYear, "модельное допущение"],
            ["Тариф электроэнергии, ₽/кВт·ч", norms.energyPrice, "модельное допущение"],
            ["Средняя мощность робота, кВт", norms.robotPowerKw, "модельное допущение"],
            ["RaaS, тариф ₽/робот/мес", norms.raasMonthlyPerRobot, "модельное допущение"],
            ["Горизонт расчёта, лет", norms.horizonYears, "ТЗ"],
            [],
            ["Ограничения модели", "Не учитываются налоговые эффекты, дисконтирование, инфляция, остаточная стоимость оборудования, лизинг и косвенные эффекты (рост пропускной способности, снижение ошибок, высвобождение площадей)."],
        ],
    };

    const xml = toWorkbook([
        summary,
        scenarios,
        costSheet("CAPEX", buy.capexItems, "₽"),
        costSheet("OPEX", buy.opexItems, "₽/год"),
        inputs,
        assumptions,
    ]);

    return xml;
}

/** Полный отчёт в Excel: сводка, сценарии, CAPEX, OPEX, исходные данные, допущения */
export function exportReportToExcel(site: SiteInput, robot: RobotInput, norms: Norms, meta: ReportMeta) {
    download(`${slug(meta.projectName)}-otchet.xls`, buildReportWorkbook(site, robot, norms, meta), "application/vnd.ms-excel");
}

/**
 * PDF — печатью страницы: в диалоге браузера выбирается «Сохранить как PDF».
 * На время печати снимаем тёмную тему, иначе половина отчёта уходит белым по тёмному
 * (браузеры печатают фоны по-разному) — возвращаем по afterprint.
 */
export function printReport() {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    if (!wasDark) {
        window.print();
        return;
    }

    root.classList.remove("dark");
    let restored = false;
    const restore = () => {
        if (restored) return;
        restored = true;
        root.classList.add("dark");
        window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    // Подстраховка: afterprint шлют не все браузеры
    setTimeout(restore, 30_000);
}
