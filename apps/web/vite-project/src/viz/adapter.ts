// Адаптер: параметры формы + робот из каталога -> три result для визуализации (baseline / buy / raas).
// Структура result — контракт warehouse-viz (src/viz/contract/schema.js).
//
// ЭКОНОМИКА ЗДЕСЬ — ЗАГЛУШКА v0 (перенос тестового стенда в рубли). Заменяется формулами экономистов
// из docs/team/TZ_ECONOMISTS.md; при замене меняются только функции economics() и kpis, структура result та же.

import type { NumericFormData } from "../store/store";
import type { VizRobot } from "./robotSpecs";
import { rackSize } from "./core/catalog";
import { minAisle } from "./core/rules";
import { rackModuleCapacity } from "./core/layout";

export type ScenarioKind = "baseline" | "buy" | "raas";

// Нормативы v0 — см. docs/team/norms_v0.json. Всё помечено «допущение».
export const NORMS_V0 = {
    workerSalaryMonth: 70_000, // ₽/мес, складской работник
    payrollTaxMultiplier: 1.302, // взносы 30% + травматизм
    workerOrdersPerHour: 12, // производительность человека, заказов/ч
    kLoad: 0.8, // коэффициент загрузки робота
    residualStaffShare: 0.25, // персонал, остающийся при роботизации
    integrationShare: 0.15, // интеграция/ПНР/обучение, доля от стоимости роботов
    infrastructurePerRobot: 150_000, // ₽ зарядки, разметка, сеть
    rackCost: 45_000, // ₽ за секцию стеллажа (если стеллажи докупаются)
    softwareLicense: 600_000, // ₽ ПО флота, разово
    maintenanceShareYear: 0.08, // сервис, доля CAPEX в год
    raasMonthlyShare: 0.03, // RaaS: доля цены робота в месяц
    raasSetupShare: 0.05, // RaaS: разовый платёж
    horizonYears: 5,
} as const;

type CargoUnit = { l: number; w: number; h: number; massKg: number };

function buildCargo(p: NumericFormData) {
    const share = p.oversizeShare / 100;
    // Форма хранит мм, контракт ждёт метры
    if (p.cargoType === "pallet")
        return { type: "pallet" as const, oversizeShare: share, unit: { l: p.pallet.L / 1000, w: p.pallet.W / 1000, h: p.pallet.H / 1000, massKg: p.palletMass } };
    if (p.cargoType === "long")
        return { type: "long" as const, oversizeShare: share, unit: { l: 6, w: 0.6, h: 0.4, massKg: Math.max(p.skuMass, 150) } };
    return { type: "box" as const, oversizeShare: share, unit: { l: p.sku.L / 1000, w: p.sku.W / 1000, h: p.sku.H / 1000, massKg: p.skuMass } };
}

// FORMULA v0: заказов в сутки — для паллет среднее приёмки и отгрузки, для коробов строки отбора
const ordersPerDay = (p: NumericFormData) =>
    p.cargoType === "pallet" ? (p.receivePalletsDay + p.shipPalletsDay) / 2 : p.pickLinesDay;
// FORMULA v0: мест хранения — паллетоместа, для коробов ×6
const storagePlaces = (p: NumericFormData) => p.palletPlaces * (p.cargoType === "box" ? 6 : 1);

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

function economics(p: NumericFormData, robot: VizRobot, kind: ScenarioKind) {
    const N = NORMS_V0;
    const cargo = buildCargo(p);
    const isStat = robot.type === "ASRS";
    const opsHour = p.workHours > 0 ? ordersPerDay(p) / p.workHours : 0;

    // FORMULA: количество роботов
    const units = Math.max(1, Math.ceil(opsHour / (robot.throughputPerHour * N.kLoad)));
    const rack = { type: p.rackType as string, ...rackSize(p.rackType, p.cargoType), capacityPerRack: p.shelfCapacity };
    const racks = isStat ? 0 : Math.max(1, Math.ceil(storagePlaces(p) / rackModuleCapacity(rack, cargo.unit as CargoUnit)));
    const chargers = isStat ? 0 : Math.ceil(units / 2);

    // Baseline: сколько людей делает ту же работу
    const workers = Math.max(1, Math.ceil(opsHour / N.workerOrdersPerHour));
    const workerCostYear = N.workerSalaryMonth * 12 * N.payrollTaxMultiplier;
    const baseOpex = workers * workerCostYear;

    const equip = units * robot.price;
    const integration = equip * N.integrationShare;
    const infra = units * N.infrastructurePerRobot;
    const soft = N.softwareLicense;
    const staffRobot = Math.ceil(workers * N.residualStaffShare) * workerCostYear;

    const capex = kind === "raas" ? equip * N.raasSetupShare + infra + soft * 0.5 : equip + integration + infra + soft;
    const opex =
        kind === "raas"
            ? staffRobot + equip * N.raasMonthlyShare * 12
            : staffRobot + (equip + infra) * N.maintenanceShareYear;
    const effect = baseOpex - opex;

    return {
        cargo, rack, opsHour, isStat, units, racks, chargers, workers, workerCostYear, baseOpex,
        equip, integration, infra, soft, staffRobot, capex, opex, effect,
        payback: effect > 0 && capex > 0 ? +(capex / effect).toFixed(1) : null,
        roi: capex > 0 ? Math.round(((effect * N.horizonYears - capex) / capex) * 100) : null,
        tco: capex + opex * N.horizonYears,
    };
}

type Econ = ReturnType<typeof economics>;

const kpiSet = (e: Econ, unitsLabel: string) => [
    { id: "capex", label: "CAPEX", value: Math.round(e.capex), unit: "₽" },
    { id: "opex", label: "OPEX / год", value: Math.round(e.opex), unit: "₽" },
    { id: "effect", label: "Годовой эффект", value: Math.round(e.effect), unit: "₽" },
    { id: "payback", label: "Срок окупаемости", value: e.payback ?? "—", unit: e.payback === null ? "" : "лет" },
    { id: "roi", label: `ROI за ${NORMS_V0.horizonYears} лет`, value: e.roi ?? "—", unit: e.roi === null ? "" : "%" },
    { id: "tco", label: `TCO за ${NORMS_V0.horizonYears} лет`, value: Math.round(e.tco), unit: "₽" },
    { id: "units", label: unitsLabel, value: e.units, unit: "шт" },
];

const meta = (name: string, kind: ScenarioKind) => ({
    scenarioName: name,
    kind,
    modelVersion: "v0 (нормативы-допущения, до формул экономистов)",
    dataVersion: "каталог организатора v4",
    calculatedAt: new Date().toISOString(),
});

function inputsOf(p: NumericFormData) {
    return [
        { group: "Склад", label: "Ширина", value: p.width, unit: "м" },
        { group: "Склад", label: "Длина", value: p.length, unit: "м" },
        { group: "Склад", label: "Ширина прохода", value: p.aisleWidth, unit: "м" },
        { group: "Склад", label: "Рабочих часов в сутки", value: p.workHours, unit: "ч" },
        { group: "Хранение", label: "Мест на секцию", value: p.shelfCapacity, unit: "ед." },
        { group: "Хранение", label: "Паллетомест", value: p.palletPlaces, unit: "шт" },
        { group: "Операции", label: "Приёмка", value: p.receivePalletsDay, unit: "поддонов/сутки" },
        { group: "Операции", label: "Отгрузка", value: p.shipPalletsDay, unit: "поддонов/сутки" },
        { group: "Операции", label: "Отбор", value: p.pickLinesDay, unit: "строк/сутки" },
    ];
}

// Предел того, что SVG-схема и имитация тянут без тормозов. Экономика считается по полным числам,
// на схеме — репрезентативный фрагмент с пропорционально уменьшенной нагрузкой.
export const VIZ_LIMITS = { width: 200, length: 120, robots: 24 } as const;

function buildResult(p: NumericFormData, robot: VizRobot, kind: "buy" | "raas", horizonMin = 20) {
    const N = NORMS_V0;
    const e = economics(p, robot, kind);
    const aisle = e.isStat ? p.aisleWidth : Math.max(p.aisleWidth, minAisle(robot, e.cargo));
    const tasksPerRobot = Math.max(1, Math.ceil((e.opsHour / e.units) * (horizonMin / 60)));
    const raas = kind === "raas";

    // Фрагмент для схемы
    const drawW = Math.min(p.width, VIZ_LIMITS.width);
    const drawL = Math.min(p.length, VIZ_LIMITS.length);
    const drawUnits = Math.min(e.units, VIZ_LIMITS.robots);
    const drawShare = drawUnits / e.units; // доля парка на схеме
    const drawRacks = Math.max(1, Math.round(e.racks * drawShare));
    const fragment = drawW < p.width || drawL < p.length || drawUnits < e.units;

    const assumptions = [
        { title: "Количество роботов", text: `= потребность ${e.opsHour.toFixed(0)} заказов/ч ÷ (производительность робота ${robot.throughputPerHour} ед/ч × коэффициент загрузки ${N.kLoad}) = ${e.units}, округление вверх.` },
        { title: "Персонал без роботизации", text: `= ${e.opsHour.toFixed(0)} заказов/ч ÷ ${N.workerOrdersPerHour} заказов/ч на человека = ${e.workers} чел. × ${fmt(N.workerSalaryMonth)} ₽/мес × 12 × ${N.payrollTaxMultiplier} (взносы) = ${fmt(e.baseOpex)} ₽/год.` },
        { title: "CAPEX", text: raas
            ? `Разовый платёж RaaS ${N.raasSetupShare * 100}% стоимости роботов + инфраструктура ${fmt(e.infra)} ₽ + 50% ПО.`
            : `Роботы ${e.units} × ${fmt(robot.price)} = ${fmt(e.equip)} ₽ + интеграция ${N.integrationShare * 100}% + инфраструктура ${fmt(N.infrastructurePerRobot)} ₽/робот + ПО ${fmt(N.softwareLicense)} ₽.` },
        { title: "OPEX", text: raas
            ? `Остаточный персонал ${N.residualStaffShare * 100}% + аренда ${N.raasMonthlyShare * 100}% стоимости роботов в месяц.`
            : `Остаточный персонал ${N.residualStaffShare * 100}% + сервис и энергия ${N.maintenanceShareYear * 100}% от стоимости оборудования в год.` },
        { title: "Итоги", text: `Годовой эффект = OPEX без роботов − OPEX сценария. Окупаемость = CAPEX ÷ эффект. ROI = (эффект × ${N.horizonYears} − CAPEX) ÷ CAPEX. TCO = CAPEX + OPEX × ${N.horizonYears}.` },
        { title: "Статус модели", text: "Версия v0: нормативы — допущения разработчика, требуют подтверждения экономистами. ТТХ робота: " + (robot.specsSource === "specs" ? "из каталога." : robot.specsSource === "v0" ? "оценка по открытым источникам." : "типовые для класса.") },
        ...(aisle > p.aisleWidth ? [{ title: "Проход", text: `Ширина прохода увеличена с ${p.aisleWidth} до ${aisle} м: этого требует разворот ${robot.type} с грузом.` }] : []),
        ...(fragment ? [{ title: "Схема", text: `На схеме показан фрагмент ${drawW} × ${drawL} м и ${drawUnits} из ${e.units} роботов (${drawRacks} из ${e.racks} стеллажей); имитация проверяет пропорциональную часть нагрузки — ${(e.opsHour * drawShare).toFixed(0)} из ${e.opsHour.toFixed(0)} заказов/ч. Экономика рассчитана на весь объект.` }] : []),
    ];

    return {
        version: 1,
        meta: meta(raas ? "Роботы как услуга (RaaS)" : "Покупка роботов", kind),
        warehouse: { width: drawW, length: drawL, aisleWidth: aisle },
        cargo: e.cargo,
        rack: e.rack,
        robot: e.isStat ? null : { id: robot.id, name: robot.name, type: robot.type, w: robot.w, l: robot.l, forkLen: robot.forkLen, speedMps: robot.speedMps, payloadKg: robot.payloadKg, throughputPerHour: robot.throughputPerHour },
        counts: { robots: e.isStat ? 0 : drawUnits, racks: drawRacks, chargers: Math.ceil(drawUnits / 2), robotsPerCell: 1 },
        stationary: e.isStat
            ? Array.from({ length: drawUnits }, (_, i) => ({ id: `st${i + 1}`, name: robot.name, w: robot.w, l: robot.l, throughputPerHour: robot.throughputPerHour, speedMps: robot.speedMps }))
            : [],
        simulation: { horizonMin, tasksPerRobot, requiredOrdersPerHour: +(e.opsHour * drawShare).toFixed(1), initialFillPct: 35, chargeEveryOrders: [5, 10], chargeSec: [15, 40] },
        kpis: kpiSet(e, e.isStat ? "Стационарных систем" : "Роботов"),
        charts: [
            { id: "cost", title: raas ? "Структура CAPEX" : "Структура затрат", type: "pie", unit: "₽", data: (raas
                ? [{ name: "Платёж RaaS", value: e.equip * N.raasSetupShare }, { name: "Инфраструктура", value: e.infra }, { name: "ПО", value: e.soft * 0.5 }]
                : [{ name: "Роботы", value: e.equip }, { name: "Интеграция", value: e.integration }, { name: "Инфраструктура", value: e.infra }, { name: "ПО", value: e.soft }]).filter((d) => d.value > 0) },
            { id: "cash", title: "Накопленный денежный поток", type: "line", unit: "₽", data: Array.from({ length: N.horizonYears + 3 }, (_, y) => ({ name: `Год ${y}`, value: Math.round(-e.capex + e.effect * y) })) },
            { id: "cap", title: "Нагрузка и мощность парка, ед/ч", type: "bar", unit: "ед/ч", data: [{ name: "Требуется", value: Math.round(e.opsHour) }, { name: "Мощность парка", value: Math.round(e.units * robot.throughputPerHour * N.kLoad) }] },
        ],
        inputs: inputsOf(p),
        assumptions,
    };
}

function buildBaseline(p: NumericFormData, robot: VizRobot) {
    const N = NORMS_V0;
    const e = economics(p, robot, "buy");
    return {
        version: 1,
        meta: meta("Без роботизации (текущий процесс)", "baseline"),
        kpis: [
            { id: "capex", label: "CAPEX", value: 0, unit: "₽" },
            { id: "opex", label: "OPEX / год", value: Math.round(e.baseOpex), unit: "₽" },
            { id: "effect", label: "Годовой эффект", value: 0, unit: "₽" },
            { id: "tco", label: `TCO за ${N.horizonYears} лет`, value: Math.round(e.baseOpex * N.horizonYears), unit: "₽" },
            { id: "workers", label: "Сотрудников", value: e.workers, unit: "чел." },
        ],
        charts: [{ id: "cost", title: "Структура затрат (ФОТ)", type: "pie", unit: "₽", data: [{ name: "Фонд оплаты труда", value: Math.round(e.baseOpex) }] }],
        inputs: inputsOf(p),
        assumptions: [{ title: "Базовый сценарий", text: `Ручной процесс: ${e.workers} сотрудников × ${fmt(e.workerCostYear)} ₽/год с взносами; производительность ${N.workerOrdersPerHour} заказов/ч.` }],
    };
}

/** Три сценария для <ScenarioView scenarios={...} /> */
export function buildScenarios(p: NumericFormData, robot: VizRobot) {
    return [buildBaseline(p, robot), buildResult(p, robot, "buy"), buildResult(p, robot, "raas")];
}
