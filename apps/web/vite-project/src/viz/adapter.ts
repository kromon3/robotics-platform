// Адаптер: параметры формы + робот из каталога -> три result для визуализации (baseline / buy / raas).
// Структура result — контракт warehouse-viz (src/viz/contract/schema.js).
// Экономика — src/viz/economics.ts, формулы по документу экономистов (проверены тестом economics.test.ts).

import type { NumericFormData } from "../store/store";
import type { EconNumeric } from "../store/econStore";
import type { VizRobot } from "./robotSpecs";
import { rackSize } from "./core/catalog";
import { minAisle } from "./core/rules";
import { rackModuleCapacity } from "./core/layout";
import { rackById } from "./rackCatalog";
import {
    DEFAULT_NORMS,
    SOURCE_LABEL,
    ZONE_LABEL,
    budgetZone,
    computeScenario,
    paybackZone,
    peakDemandPerHour,
    roiZone,
    type CostItem,
    type Norms,
    type RobotInput,
    type ScenarioEconomics,
    type SiteInput,
} from "./economics";

export type ScenarioKind = "baseline" | "buy" | "raas";

// Предел того, что SVG-схема и имитация тянут без тормозов. Экономика считается по полным числам,
// на схеме — репрезентативный фрагмент с пропорционально уменьшенной нагрузкой.
export const VIZ_LIMITS = { width: 200, length: 120, robots: 24 } as const;

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

/**
 * Данные двух фаз визарда -> входные данные экономической модели.
 * Фаза 1 (/projects) — геометрия, груз и грузопоток, фаза 2 (/projects/economics) — календарь,
 * персонал, инфраструктура и бюджет. Грузопоток спрашивается один раз, в первой фазе:
 * вторая его не переопределяет, иначе два экрана молча спорили бы за один и тот же показатель.
 * Если вторая фаза не заполнена, берутся дефолты датасета «Склад» (§2 документа экономистов).
 */
export function toSiteInput(p: NumericFormData, e?: EconNumeric): SiteInput {
    const isPallet = p.cargoType === "pallet";

    // Паллетный склад считаем по приёмке/отгрузке, коробочный — по строкам отбора (строка = операция)
    const inboundPerDay = isPallet ? p.receivePalletsDay : p.pickLinesDay / 2;
    const outboundPerDay = isPallet ? p.shipPalletsDay : p.pickLinesDay / 2;

    if (e && e.workMode) {
        // Замещаемая группа: операторы погрузчиков для паллет, отборщики для штучного отбора
        const staffCount = isPallet ? e.staffForklift : e.staffPickers || e.staffForklift;
        const salary = isPallet ? e.salaryForklift : e.salaryPicker || e.salaryForklift;
        return {
            inboundPerDay,
            outboundPerDay,
            shiftsPerDay: e.shiftsPerDay || 1,
            shiftHours: e.shiftHours || 8,
            workingDaysPerYear: e.workingDaysPerYear || 365,
            peakFactor: e.peakFactor || 1.5,
            staffCount,
            staffSalaryMonth: salary,
            budget: e.budget,
        };
    }

    const shifts = p.workHours > 12 ? 2 : 1;
    return {
        inboundPerDay,
        outboundPerDay,
        shiftsPerDay: shifts,
        shiftHours: shifts > 0 ? p.workHours / shifts : p.workHours,
        workingDaysPerYear: 365,
        peakFactor: 1.5,
        staffCount: 25,
        staffSalaryMonth: 120_000,
        budget: 80_000_000,
    };
}

/**
 * Нормативы с учётом второй фазы: взносы, выработка, горизонт вводит пользователь.
 * p нужен для стеллажей: мест хранения столько, сколько задано в параметрах объекта.
 */
export function toNorms(e?: EconNumeric, base: Norms = DEFAULT_NORMS, p?: NumericFormData): Norms {
    if (!e || !e.workMode) return base;
    const rack = e.rackSystemId ? rackById(e.rackSystemId) : undefined;
    return {
        ...base,
        // Стеллажи считаем только если пользователь выбрал систему из каталога поставщиков
        ...(rack
            ? {
                  rackPricePerPlace: rack.pricePerPlace ?? 0,
                  rackPlaces: rack.pricePerPlace ? (p?.palletPlaces ?? 0) : 0,
                  rackPricePerM2: rack.pricePerM2 ?? 0,
                  rackAreaM2: rack.pricePerM2 ? e.activeAreaM2 : 0,
                  rackLabel: `${rack.brand} ${rack.model}`,
              }
            : {}),
        payrollTax: e.payrollTaxPct ? 1 + e.payrollTaxPct / 100 : base.payrollTax,
        workerOutputPerHour: e.pickerLinesPerHour || base.workerOutputPerHour,
        horizonYears: e.horizonYears || base.horizonYears,
        floorArea: e.activeAreaM2 || base.floorArea,
        operationSalaryMonth: e.salaryForklift || base.operationSalaryMonth,
    };
}

const toRobotInput = (robot: VizRobot): RobotInput => ({
    name: robot.name,
    price: robot.price,
    throughputPerHour: robot.throughputPerHour,
});

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

// ── result для визуализации ─────────────────────────────────────────────

export const MODEL_VERSION = "Экономическая модель v2 (экономисты), CAPEX §16.3";
export const DATA_VERSION = "каталог организатора v4 + ТТХ робототехников";

const meta = (name: string, kind: ScenarioKind) => ({
    scenarioName: name,
    kind,
    modelVersion: MODEL_VERSION,
    dataVersion: DATA_VERSION,
    calculatedAt: new Date().toISOString(),
});

function inputsOf(p: NumericFormData, s: SiteInput) {
    return [
        { group: "Склад", label: "Ширина", value: p.width, unit: "м" },
        { group: "Склад", label: "Длина", value: p.length, unit: "м" },
        { group: "Склад", label: "Ширина прохода", value: p.aisleWidth, unit: "м" },
        { group: "Режим работы", label: "Смен в сутки", value: s.shiftsPerDay, unit: "" },
        { group: "Режим работы", label: "Длительность смены", value: +s.shiftHours.toFixed(1), unit: "ч" },
        { group: "Режим работы", label: "Пиковый коэффициент", value: s.peakFactor, unit: "" },
        { group: "Операции", label: "Приёмка", value: Math.round(s.inboundPerDay), unit: "ед/сут" },
        { group: "Операции", label: "Отгрузка", value: Math.round(s.outboundPerDay), unit: "ед/сут" },
        { group: "Операции", label: "Пиковая потребность", value: Math.round(peakDemandPerHour(s)), unit: "ед/ч" },
        { group: "Хранение", label: "Мест на секцию", value: p.shelfCapacity, unit: "ед." },
        { group: "Хранение", label: "Паллетомест", value: p.palletPlaces, unit: "шт" },
        { group: "Персонал", label: "Операторов", value: s.staffCount, unit: "чел." },
        { group: "Персонал", label: "Зарплата оператора", value: s.staffSalaryMonth, unit: "₽/мес" },
    ];
}

/** Статьи затрат -> «Формулы и допущения»: пользователь видит, из чего сложилась сумма (п. 3.5.8 ТЗ) */
const itemsAssumption = (title: string, items: CostItem[]): { title: string; text: string } => ({
    title,
    text: items
        .filter((i) => i.value > 0)
        .map((i) => `${i.label} — ${fmt(i.value)} ₽ (${i.method}, ${SOURCE_LABEL[i.source]})`)
        .join("; ") || "нет затрат по этой группе",
});

function assumptionsOf(e: ScenarioEconomics, n: Norms, robot: VizRobot, extra: { title: string; text: string }[]) {
    const zone = paybackZone(e.paybackYears);
    const bZone = budgetZone(e.budgetShare);
    const rZone = roiZone(e.roi);
    return [
        {
            title: "Количество роботов",
            text: `Пиковая потребность ${e.peakDemand.toFixed(1)} ед/ч ÷ (производительность ${robot.throughputPerHour} ед/ч × коэффициент использования ${n.utilization}) × (1 + резерв ${n.capacityReserve * 100}%) = ${e.units}, округление вверх.`,
        },
        {
            title: "Замещение персонала",
            text: `Эффективная производительность робота ${e.effective.toFixed(1)} ед/ч ÷ выработка оператора ${n.workerOutputPerHour} ед/ч = ${(e.effective / n.workerOutputPerHour).toFixed(2)} чел. на робота; всего замещается ${e.replacedWorkers.toFixed(1)} чел. Экономия ФОТ = ${fmt(e.baselineOpex)} ₽/год (с начислениями ${n.payrollTax}).`,
        },
        ...extra,
        {
            title: "Итоговые показатели",
            text: `Годовой эффект = экономия ФОТ − OPEX сценария = ${fmt(e.annualEffect)} ₽/год. Окупаемость = CAPEX ÷ эффект${e.paybackYears !== null ? ` = ${e.paybackYears} года` : " — не определена (нет разовых затрат)"}. ROI за ${n.horizonYears} лет = (эффект × ${n.horizonYears} − CAPEX) ÷ CAPEX${e.roi !== null ? ` = ${e.roi}%` : ""}. TCO = CAPEX + OPEX × ${n.horizonYears} = ${fmt(e.tco)} ₽.`,
        },
        {
            title: "Интерпретация (зоны)",
            text: [
                zone && `срок окупаемости ${ZONE_LABEL[zone]} (зелёная ≤ 2,5 года, жёлтая 2,5–4, красная > 4)`,
                rZone && `ROI ${ZONE_LABEL[rZone]} (зелёная ≥ 50%, жёлтая 0–50%, красная < 0)`,
                bZone && `CAPEX ${fmt(e.capex)} ₽ — ${(e.budgetShare! * 100).toFixed(0)}% бюджета, ${ZONE_LABEL[bZone]} (зелёная ≤ 100%, жёлтая 100–120%, красная > 120%)`,
            ].filter(Boolean).join("; "),
        },
        {
            title: "Статус данных",
            text: `Экономическая модель — документ экономистов v2; ставки ПО, интеграции, ПНР, ЗИП, пола и сервиса — модельные допущения, заменяются данными КП. ТТХ робота: ${robot.specsSource === "specs" ? "каталог робототехников" : robot.specsSource === "v0" ? "оценка по открытым источникам" : "типовые для класса"}. Предварительная оценка, требует верификации при обследовании объекта.`,
        },
    ];
}

const kpiSet = (e: ScenarioEconomics, n: Norms) => [
    { id: "capex", label: "CAPEX", value: Math.round(e.capex), unit: "₽" },
    { id: "opex", label: "OPEX / год", value: Math.round(e.opex), unit: "₽" },
    { id: "effect", label: "Годовой эффект", value: Math.round(e.annualEffect), unit: "₽" },
    { id: "payback", label: "Срок окупаемости", value: e.paybackYears ?? "—", unit: e.paybackYears === null ? "" : "лет" },
    { id: "roi", label: `ROI за ${n.horizonYears} лет`, value: e.roi ?? "—", unit: e.roi === null ? "" : "%" },
    { id: "tco", label: `TCO за ${n.horizonYears} лет`, value: Math.round(e.tco), unit: "₽" },
    { id: "units", label: "Роботов", value: e.units, unit: "шт" },
    ...(e.budgetShare !== null ? [{ id: "budget", label: "CAPEX / бюджет", value: Math.round(e.budgetShare * 100), unit: "%" }] : []),
];

function buildResult(
    p: NumericFormData,
    robot: VizRobot,
    kind: "buy" | "raas",
    norms: Norms,
    econ?: EconNumeric,
    horizonMin = 20,
) {
    const site = toSiteInput(p, econ);
    const e = computeScenario(kind, site, toRobotInput(robot), norms);
    const cargo = buildCargo(p);
    const isStat = robot.type === "ASRS";
    const aisle = isStat ? p.aisleWidth : Math.max(p.aisleWidth, minAisle(robot, cargo));

    // Габариты секции и её вместимость — из выбранной системы каталога стеллажей,
    // иначе типовые из RACK_SIZES. Так схема рисуется по реальным размерам поставщика.
    const rackSys = econ?.rackSystemId ? rackById(econ.rackSystemId) : undefined;
    const size = rackSize(p.rackType, p.cargoType);
    const rack = {
        type: p.rackType as string,
        w: rackSys?.sizeM.w ?? size.w,
        l: rackSys?.sizeM.l ?? size.l,
        // Вместимость секции пользователь задаёт сам; из каталога берём её только если поле пустое
        capacityPerRack: p.shelfCapacity || rackSys?.placesPerSection || 8,
    };
    const storagePlaces = p.palletPlaces * (p.cargoType === "box" ? 6 : 1);
    const racks = isStat ? 0 : Math.max(1, Math.ceil(storagePlaces / rackModuleCapacity(rack, cargo.unit as CargoUnit)));

    // Фрагмент для схемы: экономика считается по полным числам, рисуем столько, сколько тянет SVG
    const drawW = Math.min(p.width, VIZ_LIMITS.width);
    const drawL = Math.min(p.length, VIZ_LIMITS.length);
    const drawUnits = Math.max(1, Math.min(e.units, VIZ_LIMITS.robots));
    const drawShare = e.units > 0 ? drawUnits / e.units : 1;
    const drawRacks = Math.max(1, Math.round(racks * drawShare));
    const fragment = drawW < p.width || drawL < p.length || drawUnits < e.units;

    const tasksPerRobot = Math.max(1, Math.ceil((e.peakDemand / Math.max(1, e.units)) * (horizonMin / 60)));
    const raas = kind === "raas";

    const extra = raas
        ? [itemsAssumption("Платежи RaaS", e.opexItems), itemsAssumption("Разовые затраты RaaS", e.capexItems)]
        : [itemsAssumption("CAPEX по статьям", e.capexItems), itemsAssumption("OPEX по статьям", e.opexItems)];

    const assumptions = [
        ...assumptionsOf(e, norms, robot, extra),
        ...(aisle > p.aisleWidth ? [{ title: "Проход", text: `Ширина прохода увеличена с ${p.aisleWidth} до ${aisle} м: этого требует разворот ${robot.type} с грузом.` }] : []),
        ...(rackSys
            ? [{
                  title: "Стеллажи",
                  text: `Секция ${rackSys.brand} ${rackSys.model}: ${rack.w} × ${rack.l} м, ${rackSys.tiers ?? "—"} яруса, ${rack.capacityPerRack} мест, нагрузка на ярус ${rackSys.tierLoadKg ?? "—"} кг, доступ ${rackSys.access ?? "—"}. Источник: ${rackSys.sourceUrl ?? "прайс поставщика"}.`,
              }]
            : []),
        ...(fragment ? [{ title: "Схема", text: `На схеме показан фрагмент ${drawW} × ${drawL} м и ${drawUnits} из ${e.units} роботов (${drawRacks} из ${racks} стеллажей); имитация проверяет пропорциональную часть нагрузки. Экономика рассчитана на весь объект.` }] : []),
    ];

    return {
        version: 1,
        meta: meta(raas ? "Роботы как услуга (RaaS)" : "Покупка роботов", kind),
        warehouse: { width: drawW, length: drawL, aisleWidth: aisle },
        cargo,
        rack,
        robot: isStat ? null : { id: robot.id, name: robot.name, type: robot.type, w: robot.w, l: robot.l, forkLen: robot.forkLen, speedMps: robot.speedMps, payloadKg: robot.payloadKg, throughputPerHour: robot.throughputPerHour },
        counts: { robots: isStat ? 0 : drawUnits, racks: drawRacks, chargers: Math.ceil(drawUnits * norms.chargersPerRobot), robotsPerCell: 1 },
        stationary: isStat
            ? Array.from({ length: drawUnits }, (_, i) => ({ id: `st${i + 1}`, name: robot.name, w: robot.w, l: robot.l, throughputPerHour: robot.throughputPerHour, speedMps: robot.speedMps }))
            : [],
        simulation: { horizonMin, tasksPerRobot, requiredOrdersPerHour: +(e.peakDemand * drawShare).toFixed(1), initialFillPct: 35, chargeEveryOrders: [5, 10], chargeSec: [15, 40] },
        kpis: kpiSet(e, norms),
        charts: [
            {
                id: "cost",
                title: raas ? "Структура разовых затрат" : "Структура CAPEX",
                type: "pie",
                unit: "₽",
                data: (raas ? e.opexItems : e.capexItems).filter((i) => i.value > 0).map((i) => ({ name: i.label, value: Math.round(i.value) })),
            },
            {
                id: "cash",
                title: "Накопленный денежный поток",
                type: "line",
                unit: "₽",
                data: Array.from({ length: norms.horizonYears + 3 }, (_, y) => ({ name: `Год ${y}`, value: Math.round(-e.capex + e.annualEffect * y) })),
            },
            {
                id: "cap",
                title: "Нагрузка и мощность парка, ед/ч",
                type: "bar",
                unit: "ед/ч",
                data: [
                    { name: "Пиковая потребность", value: Math.round(e.peakDemand) },
                    { name: "Мощность парка", value: Math.round(e.units * e.effective) },
                ],
            },
        ],
        inputs: inputsOf(p, site),
        assumptions,
    };
}

function buildBaseline(p: NumericFormData, robot: VizRobot, norms: Norms, econ?: EconNumeric) {
    const site = toSiteInput(p, econ);
    const e = computeScenario("baseline", site, toRobotInput(robot), norms);
    return {
        version: 1,
        meta: meta("Без роботизации (текущий процесс)", "baseline"),
        kpis: [
            { id: "capex", label: "CAPEX", value: 0, unit: "₽" },
            { id: "opex", label: "OPEX / год", value: Math.round(e.opex), unit: "₽" },
            { id: "effect", label: "Годовой эффект", value: 0, unit: "₽" },
            { id: "tco", label: `TCO за ${norms.horizonYears} лет`, value: Math.round(e.tco), unit: "₽" },
            { id: "workers", label: "Сотрудников", value: site.staffCount, unit: "чел." },
        ],
        charts: [
            { id: "cost", title: "Структура затрат (ФОТ)", type: "pie", unit: "₽", data: [{ name: "Фонд оплаты труда", value: Math.round(e.opex) }] },
        ],
        inputs: inputsOf(p, site),
        assumptions: [
            {
                title: "Базовый сценарий",
                text: `Ручной процесс: ${site.staffCount} операторов × ${fmt(site.staffSalaryMonth)} ₽/мес × 12 × ${norms.payrollTax} (начисления) = ${fmt(e.opex)} ₽/год. Выработка оператора ${norms.workerOutputPerHour} ед/ч — модельное допущение, на реальном объекте вводится пользователем.`,
            },
            {
                title: "База сравнения",
                text: "Сравнение TCO выполняется по одинаковому набору функций: с роботизацией сопоставляется ФОТ только замещаемой группы, а не весь складской персонал (§9.5 модели).",
            },
        ],
    };
}

/** Три сценария для <ScenarioView scenarios={...} /> */
export function buildScenarios(
    p: NumericFormData,
    robot: VizRobot,
    econ?: EconNumeric,
    overrides?: Partial<Norms>,
) {
    const norms: Norms = { ...toNorms(econ, DEFAULT_NORMS, p), ...overrides };
    return [
        buildBaseline(p, robot, norms, econ),
        buildResult(p, robot, "buy", norms, econ),
        buildResult(p, robot, "raas", norms, econ),
    ];
}

export { DEFAULT_NORMS };
export type { Norms };
