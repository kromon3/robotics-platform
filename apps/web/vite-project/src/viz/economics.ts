// Экономическая модель по документу экономистов «Экономическая_модель_хакатон_2026_v2»
// (разделы 3–9, дефолты CAPEX — из §16.3 «Итоговая методика формирования CAPEX»).
//
// Принцип §16.2: НИ ОДНА ставка не зашита в формулу — каждая статья CAPEX/OPEX это объект
// { метод расчёта, значение, источник }. Пользователь меняет любую (what-if), а в отчёте
// видно, что это: цена из КП, датасет или модельное допущение.
//
// Все суммы — рубли, объёмы операций — «единиц в час» (паллет/ч для паллетного склада).

export type SourceKind = "dataset" | "quote" | "assumption";

export const SOURCE_LABEL: Record<SourceKind, string> = {
    dataset: "датасет",
    quote: "КП поставщика",
    assumption: "модельное допущение",
};

/** Ставки и коэффициенты модели. Дефолты — §2 и §16.3 документа. */
export type Norms = {
    // §3 — количество роботов
    utilization: number; // коэффициент использования, §3.2 (0,70)
    capacityReserve: number; // резерв мощности, §3.3 (10%)
    // §4 — базовый сценарий
    workerOutputPerHour: number; // выработка оператора, паллет/ч, §4.2 (15)
    payrollTax: number; // начисления на ФОТ, §4.1 (1,302)
    // §5 / §16.3 — CAPEX
    chargerPrice: number; // цена одной зарядной станции, ₽ (из КП; в демо 1 000 000)
    chargersPerRobot: number; // станций на робота (1)
    // База для процентных статей CAPEX. В тексте §5.5/§16 — «роботы + зарядная инфраструктура»,
    // но в арифметике §16.3 ПО/интеграция/ПНР посчитаны только от роботов. Вопрос к экономистам;
    // переключатель позволяет воспроизвести обе версии.
    percentBase: "equipment" | "equipment+chargers";
    softwareShare: number; // ПО, доля стоимости оборудования (10%)
    integrationShare: number; // интеграция (10%)
    commissioningShare: number; // пусконаладка (7,5%)
    trainingPeople: number; // обучение: человек
    trainingPricePerPerson: number; // ₽/чел (в демо 300 000 / 3 = 100 000)
    floorArea: number; // подготовка пола: м² (500)
    floorPricePerM2: number; // ₽/м² (2 500)
    sparePartsShare: number; // ЗИП (2%)
    capexReserve: number; // резерв проекта (10%), §5.3
    // §6 — OPEX
    serviceShare: number; // сервис, доля стоимости оборудования в год
    licensesPerYear: number; // лицензии, ₽/год (1 200 000)
    robotPowerKw: number; // средняя мощность робота, кВт (2)
    energyPrice: number; // тариф, ₽/кВт·ч (8)
    communicationPerYear: number; // связь, ₽/год (180 000)
    consumablesPerYear: number; // расходники, ₽/год (300 000)
    repairShare: number; // ремонт, доля стоимости оборудования в год (2%)
    operationStaff: number; // персонал эксплуатации, чел. (2)
    operationSalaryMonth: number; // его зарплата, ₽/мес (120 000)
    // §8 — RaaS
    raasSetup: number; // разовый платёж, ₽ (0, §8.1)
    raasMonthlyPerRobot: number; // тариф за робота, ₽/мес (250 000, §8.2)
    // §9
    horizonYears: number; // горизонт, лет (5)
};

export const DEFAULT_NORMS: Norms = {
    utilization: 0.7,
    capacityReserve: 0.1,
    workerOutputPerHour: 15,
    payrollTax: 1.302,
    chargerPrice: 1_000_000,
    chargersPerRobot: 1,
    percentBase: "equipment+chargers",
    softwareShare: 0.1,
    integrationShare: 0.1,
    commissioningShare: 0.075,
    trainingPeople: 3,
    trainingPricePerPerson: 100_000,
    floorArea: 500,
    floorPricePerM2: 2_500,
    sparePartsShare: 0.02,
    capexReserve: 0.1,
    serviceShare: 0.08,
    licensesPerYear: 1_200_000,
    robotPowerKw: 2,
    energyPrice: 8,
    communicationPerYear: 180_000,
    consumablesPerYear: 300_000,
    repairShare: 0.02,
    operationStaff: 2,
    operationSalaryMonth: 120_000,
    raasSetup: 0,
    raasMonthlyPerRobot: 250_000,
    horizonYears: 5,
};

/** Что модель знает об объекте. Собирается из формы визарда. */
export type SiteInput = {
    inboundPerDay: number; // приёмка, поддонов/сут
    outboundPerDay: number; // отгрузка, поддонов/сут
    shiftsPerDay: number;
    shiftHours: number;
    workingDaysPerYear: number;
    peakFactor: number; // пиковый коэффициент (1,5)
    staffCount: number; // операторов погрузчиков
    staffSalaryMonth: number; // ₽/мес
    budget: number; // бюджет роботизации, ₽
};

export type RobotInput = {
    name: string;
    price: number; // ₽ за единицу
    throughputPerHour: number; // паспортная производительность, ед/ч
};

export type CostItem = {
    key: string;
    label: string;
    value: number; // ₽
    method: string; // как посчитано — показывается пользователю
    source: SourceKind;
};

const ceil = Math.ceil;
const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");
const pct = (n: number) => `${+(n * 100).toFixed(1)}%`;

// ── §3. Количество роботов ──────────────────────────────────────────────

/** §3.1 Пиковая часовая потребность = суточный объём / (смены × длительность) × пиковый коэффициент */
export function peakDemandPerHour(s: SiteInput): number {
    const daily = s.inboundPerDay + s.outboundPerDay;
    const hours = s.shiftsPerDay * s.shiftHours;
    return hours > 0 ? (daily / hours) * s.peakFactor : 0;
}

/** §3.2 Эффективная производительность = паспортная × коэффициент использования */
export const effectiveThroughput = (r: RobotInput, n: Norms) => r.throughputPerHour * n.utilization;

/** §3.3 Количество роботов = ceil(потребность / эффективная × (1 + резерв)) */
export function robotsRequired(s: SiteInput, r: RobotInput, n: Norms): number {
    const eff = effectiveThroughput(r, n);
    if (eff <= 0) return 0;
    return Math.max(1, ceil((peakDemandPerHour(s) / eff) * (1 + n.capacityReserve)));
}

// ── §4. Базовый сценарий (без роботов) ──────────────────────────────────

/** §4.1 Годовые затраты на персонал = численность × зарплата × 12 × начисления */
export const baselineLaborCost = (s: SiteInput, n: Norms) =>
    s.staffCount * s.staffSalaryMonth * 12 * n.payrollTax;

/** §4.2 Замещение = эффективная производительность робота / выработка сотрудника */
export const workersPerRobot = (r: RobotInput, n: Norms) =>
    n.workerOutputPerHour > 0 ? effectiveThroughput(r, n) / n.workerOutputPerHour : 0;

/** §4.3 Экономия ФОТ = замещённые сотрудники × зарплата × 12 × начисления (не больше, чем есть людей) */
export function laborSaving(s: SiteInput, r: RobotInput, n: Norms) {
    const replaced = Math.min(robotsRequired(s, r, n) * workersPerRobot(r, n), s.staffCount);
    return { replaced, saving: replaced * s.staffSalaryMonth * 12 * n.payrollTax };
}

// ── §5 / §16.3. CAPEX покупки ───────────────────────────────────────────

export function capexItems(s: SiteInput, r: RobotInput, n: Norms): CostItem[] {
    const units = robotsRequired(s, r, n);
    const equipment = units * r.price;
    const chargers = units * n.chargersPerRobot * n.chargerPrice;
    const base = n.percentBase === "equipment" ? equipment : equipment + chargers;
    const baseLabel = n.percentBase === "equipment" ? "от стоимости роботов" : "от роботов и зарядной инфраструктуры";

    const items: CostItem[] = [
        { key: "equipment", label: "Роботы", value: equipment, method: `${units} × ${fmt(r.price)} ₽`, source: "quote" },
        { key: "chargers", label: "Зарядные станции", value: chargers, method: `${units * n.chargersPerRobot} × ${fmt(n.chargerPrice)} ₽`, source: "quote" },
        { key: "software", label: "ПО", value: base * n.softwareShare, method: `${pct(n.softwareShare)} ${baseLabel}`, source: "assumption" },
        { key: "integration", label: "Интеграция", value: base * n.integrationShare, method: `${pct(n.integrationShare)} ${baseLabel}`, source: "assumption" },
        { key: "commissioning", label: "Пусконаладка", value: base * n.commissioningShare, method: `${pct(n.commissioningShare)} ${baseLabel}`, source: "assumption" },
        { key: "training", label: "Обучение", value: n.trainingPeople * n.trainingPricePerPerson, method: `${n.trainingPeople} чел. × ${fmt(n.trainingPricePerPerson)} ₽`, source: "assumption" },
        { key: "floor", label: "Подготовка пола", value: n.floorArea * n.floorPricePerM2, method: `${fmt(n.floorArea)} м² × ${fmt(n.floorPricePerM2)} ₽/м²`, source: "assumption" },
        // ЗИП в §16.3 посчитан от роботов + зарядок независимо от остальных статей
        { key: "spare", label: "ЗИП", value: (equipment + chargers) * n.sparePartsShare, method: `${pct(n.sparePartsShare)} от роботов и зарядной инфраструктуры`, source: "assumption" },
    ];
    // §5.3 резерв считается от суммы всех статей выше
    const beforeReserve = items.reduce((a, i) => a + i.value, 0);
    items.push({ key: "reserve", label: "Резерв проекта", value: beforeReserve * n.capexReserve, method: `${pct(n.capexReserve)} от CAPEX до резерва`, source: "assumption" });
    return items;
}

// ── §6. OPEX покупки ────────────────────────────────────────────────────

export function opexItems(s: SiteInput, r: RobotInput, n: Norms): CostItem[] {
    const units = robotsRequired(s, r, n);
    const equipment = units * r.price;
    const hoursPerYear = s.shiftsPerDay * s.shiftHours * s.workingDaysPerYear;
    const staffCost = n.operationStaff * n.operationSalaryMonth * 12 * n.payrollTax;

    return [
        { key: "service", label: "Сервис", value: equipment * n.serviceShare, method: `${pct(n.serviceShare)} от стоимости оборудования`, source: "assumption" },
        { key: "licenses", label: "Лицензии", value: n.licensesPerYear, method: "ежегодные лицензионные платежи", source: "assumption" },
        { key: "energy", label: "Электроэнергия", value: units * n.robotPowerKw * hoursPerYear * n.energyPrice, method: `${units} × ${n.robotPowerKw} кВт × ${fmt(hoursPerYear)} ч × ${n.energyPrice} ₽/кВт·ч`, source: "assumption" },
        { key: "communication", label: "Связь", value: n.communicationPerYear, method: "абонентская плата за год", source: "assumption" },
        { key: "consumables", label: "Расходные материалы", value: n.consumablesPerYear, method: "годовые затраты на расходники", source: "assumption" },
        { key: "repair", label: "Ремонт", value: equipment * n.repairShare, method: `${pct(n.repairShare)} от стоимости оборудования`, source: "assumption" },
        { key: "opsStaff", label: "Персонал эксплуатации", value: staffCost, method: `${n.operationStaff} чел. × ${fmt(n.operationSalaryMonth)} ₽ × 12 × ${n.payrollTax}`, source: "assumption" },
    ];
}

// ── §8. RaaS ────────────────────────────────────────────────────────────

export const raasSetupItems = (n: Norms): CostItem[] => [
    { key: "setup", label: "Разовый платёж RaaS", value: n.raasSetup, method: "подключение и интеграция по договору", source: "assumption" },
];

export function raasOpexItems(s: SiteInput, r: RobotInput, n: Norms): CostItem[] {
    const units = robotsRequired(s, r, n);
    return [
        { key: "raas", label: "Платежи RaaS", value: units * n.raasMonthlyPerRobot * 12, method: `${units} × ${fmt(n.raasMonthlyPerRobot)} ₽/мес × 12`, source: "assumption" },
    ];
}

// ── §9. Итоговые показатели ─────────────────────────────────────────────

export type ScenarioEconomics = {
    kind: "baseline" | "buy" | "raas";
    units: number;
    capexItems: CostItem[];
    opexItems: CostItem[];
    capex: number;
    opex: number;
    baselineOpex: number;
    annualEffect: number;
    paybackYears: number | null;
    roi: number | null;
    tco: number;
    budgetShare: number | null; // CAPEX / бюджет
    replacedWorkers: number;
    peakDemand: number;
    effective: number;
};

const sum = (items: CostItem[]) => items.reduce((a, i) => a + i.value, 0);

export function computeScenario(
    kind: "baseline" | "buy" | "raas",
    s: SiteInput,
    r: RobotInput,
    n: Norms,
): ScenarioEconomics {
    const units = robotsRequired(s, r, n);
    const { replaced, saving } = laborSaving(s, r, n);
    // §9.5: база сравнения — ФОТ только замещаемой группы, не весь склад
    const baselineOpex = saving;

    if (kind === "baseline") {
        const full = baselineLaborCost(s, n);
        return {
            kind, units: 0, capexItems: [], opexItems: [
                { key: "labor", label: "ФОТ персонала", value: full, method: `${s.staffCount} чел. × ${fmt(s.staffSalaryMonth)} ₽ × 12 × ${n.payrollTax}`, source: "dataset" },
            ],
            capex: 0, opex: full, baselineOpex: full, annualEffect: 0,
            paybackYears: null, roi: null, tco: full * n.horizonYears, budgetShare: null,
            replacedWorkers: 0, peakDemand: peakDemandPerHour(s), effective: effectiveThroughput(r, n),
        };
    }

    const cItems = kind === "buy" ? capexItems(s, r, n) : raasSetupItems(n);
    const oItems = kind === "buy" ? opexItems(s, r, n) : raasOpexItems(s, r, n);
    const capex = sum(cItems);
    const opex = sum(oItems);
    const annualEffect = baselineOpex - opex; // §9.1
    return {
        kind, units, capexItems: cItems, opexItems: oItems, capex, opex, baselineOpex, annualEffect,
        paybackYears: annualEffect > 0 && capex > 0 ? +(capex / annualEffect).toFixed(2) : null, // §9.2
        roi: capex > 0 ? Math.round(((annualEffect * n.horizonYears - capex) / capex) * 100) : null, // §9.3
        tco: capex + opex * n.horizonYears, // §9.4
        budgetShare: s.budget > 0 ? capex / s.budget : null,
        replacedWorkers: replaced,
        peakDemand: peakDemandPerHour(s),
        effective: effectiveThroughput(r, n),
    };
}

// ── §11. Интерпретация: зелёная / жёлтая / красная зоны ─────────────────

export type Zone = "green" | "yellow" | "red";

export const paybackZone = (years: number | null): Zone | null =>
    years === null ? null : years <= 2.5 ? "green" : years <= 4 ? "yellow" : "red";
export const roiZone = (roi: number | null): Zone | null =>
    roi === null ? null : roi >= 50 ? "green" : roi >= 0 ? "yellow" : "red";
export const budgetZone = (share: number | null): Zone | null =>
    share === null ? null : share <= 1 ? "green" : share <= 1.2 ? "yellow" : "red";

export const ZONE_LABEL: Record<Zone, string> = {
    green: "в зелёной зоне",
    yellow: "требует проверки",
    red: "вне приемлемых границ",
};
