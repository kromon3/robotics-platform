import { EXAMPLE, type ProjectFormData } from "../store/store";
import { ECON_EXAMPLE, WORK_MODE_PRESETS, type EconFormData } from "../store/econStore";

// Демо для того, кто принимает решение: готовый объект и 4 ползунка по параметрам,
// от которых сильнее всего зависит вывод. Остальные поля — правдоподобные значения примера.
//
// Персонал не ползунок, а следствие объёма: сотрудников = объём ÷ (выработка × длина смены).
// Иначе легко собрать нереальное сочетание — 20 000 строк в сутки на 36 сборщиков — и получить
// контринтуитивное «не окупается» там, где в жизни людей было бы втрое больше.
// Данные примеров — модельные допущения, а не реальные объекты; диапазоны ползунков подобраны так,
// чтобы любое сочетание оставалось реалистичным (без «ста роботов на маленьком складе»).

export type DemoCaseId = "ecom" | "pallet" | "small";

export type DemoParams = {
    /** Площадь склада, м² */
    area: number;
    /** Объём в сутки: строк отбора для коробов, поддонов (приёмка + отгрузка) для паллет */
    volume: number;
    /** Зарплата этого персонала, ₽/мес */
    salary: number;
    /** Смен в сутки */
    shifts: number;
};

type Range = { min: number; max: number; step: number };

export type DemoCase = {
    id: DemoCaseId;
    title: string;
    tagline: string;
    icon: string;
    form: ProjectFormData;
    econ: EconFormData;
    defaults: DemoParams;
    ranges: Record<keyof DemoParams, Range>;
    /** Подписи, зависящие от типа груза */
    volumeLabel: string;
    staffLabel: string;
    /** Единица операции для подписи выработки: «строк», «поддонов» */
    opUnit: string;
};

// Длительность смены по числу смен: одна — дневная, две — 11 ч, три — круглосуточно по 8 ч
const SHIFT_HOURS: Record<number, number> = { 1: 9, 2: 11, 3: 8 };

const SALARY: Range = { min: 45_000, max: 150_000, step: 5_000 };
const SHIFTS: Range = { min: 1, max: 3, step: 1 };

export const DEMO_CASES: DemoCase[] = [
    {
        id: "ecom",
        title: "Склад интернет-магазина",
        tagline: "Штучный отбор заказов из коробов, две смены",
        icon: "📦",
        form: {
            ...EXAMPLE,
            rackType: "shelf",
            cargoType: "box",
            width: 60,
            length: 40,
            aisleWidth: 2,
            workHours: 22,
            palletPlaces: 600,
            pickLinesDay: 9000,
            pickPiecesDay: 14_000,
        },
        econ: {
            ...ECON_EXAMPLE,
            activeAreaM2: 2400,
            shiftsPerDay: 2,
            shiftHours: 11,
            staffPickers: 36,
            staffForklift: 6,
            staffPackers: 10,
            staffTotal: 52,
            salaryPicker: 65_000,
            budget: 80_000_000,
        },
        defaults: { area: 2400, volume: 9000, salary: 65_000, shifts: 2 },
        ranges: {
            area: { min: 1000, max: 8000, step: 100 },
            volume: { min: 2000, max: 20_000, step: 500 },
            salary: SALARY,
            shifts: SHIFTS,
        },
        volumeLabel: "Строк отбора в сутки",
        staffLabel: "Сборщики заказов",
        opUnit: "строк",
    },
    {
        id: "pallet",
        title: "Паллетный распределительный центр",
        tagline: "Приёмка и отгрузка поддонов, погрузчики",
        icon: "🏭",
        form: {
            ...EXAMPLE,
            rackType: "shelf",
            cargoType: "pallet",
            width: 75,
            length: 40,
            aisleWidth: 3,
            workHours: 22,
            shelfCapacity: 6,
            palletPlaces: 2000,
            pallet: { L: 1200, W: 800, H: 1500 },
            palletMass: 600,
            receivePalletsDay: 2000,
            shipPalletsDay: 2000,
        },
        econ: {
            ...ECON_EXAMPLE,
            activeAreaM2: 3000,
            shiftsPerDay: 2,
            shiftHours: 11,
            staffPickers: 4,
            staffForklift: 18,
            staffPackers: 4,
            staffTotal: 26,
            salaryForklift: 95_000,
            budget: 120_000_000,
        },
        defaults: { area: 3000, volume: 4000, salary: 95_000, shifts: 2 },
        ranges: {
            area: { min: 1500, max: 12_000, step: 250 },
            volume: { min: 1000, max: 8000, step: 100 },
            salary: SALARY,
            shifts: SHIFTS,
        },
        volumeLabel: "Поддонов в сутки (приёмка + отгрузка)",
        staffLabel: "Водители погрузчиков",
        opUnit: "поддонов",
    },
    {
        id: "small",
        title: "Небольшой склад",
        tagline: "Одна смена, отбор из коробов",
        icon: "🏪",
        form: {
            ...EXAMPLE,
            rackType: "shelf",
            cargoType: "box",
            width: 30,
            length: 20,
            aisleWidth: 2,
            workHours: 9,
            palletPlaces: 150,
            pickLinesDay: 3500,
            pickPiecesDay: 5300,
        },
        econ: {
            ...ECON_EXAMPLE,
            activeAreaM2: 600,
            workMode: "single_shift",
            workingDaysPerYear: WORK_MODE_PRESETS.single_shift.workingDaysPerYear,
            peakFactor: WORK_MODE_PRESETS.single_shift.peakFactor,
            shiftsPerDay: 1,
            shiftHours: 9,
            staffPickers: 10,
            staffForklift: 2,
            staffPackers: 3,
            staffTotal: 15,
            salaryPicker: 60_000,
            budget: 25_000_000,
        },
        defaults: { area: 600, volume: 3500, salary: 60_000, shifts: 1 },
        ranges: {
            area: { min: 300, max: 1500, step: 50 },
            volume: { min: 500, max: 6000, step: 100 },
            salary: SALARY,
            shifts: SHIFTS,
        },
        volumeLabel: "Строк отбора в сутки",
        staffLabel: "Сборщики заказов",
        opUnit: "строк",
    },
];

export const getDemoCase = (id: string | null | undefined): DemoCase =>
    DEMO_CASES.find((c) => c.id === id) ?? DEMO_CASES[0];

const n = (v: number | "") => (v === "" ? 0 : v);

/** Выработка одного человека, операций в час — тот же норматив, что в экономической модели */
export const outputPerHour = (c: DemoCase) => n(c.econ.pickerLinesPerHour) || 20;

/**
 * Сколько людей нужно на этот объём: каждый работает одну смену, за смену делает выработку × длину смены.
 * Число смен на итог не влияет — оно делит тот же объём между сменами.
 */
export function staffFor(c: DemoCase, v: DemoParams): number {
    const shiftHours = SHIFT_HOURS[v.shifts] ?? 11;
    return Math.max(1, Math.ceil(v.volume / (outputPerHour(c) * shiftHours)));
}

/**
 * Значения ползунков → полные данные обеих форм. Площадь меняет габариты с сохранением пропорций
 * и вместе с ними число мест хранения; объём, персонал и зарплата ложатся в поля своего типа груза;
 * смены задают и режим работы, и рабочие часы объекта — чтобы формы не противоречили друг другу.
 */
export function applyParams(c: DemoCase, v: DemoParams): { form: ProjectFormData; econ: EconFormData } {
    const baseW = n(c.form.width);
    const baseL = n(c.form.length);
    const ratio = baseW / baseL;
    const width = Math.max(10, Math.round(Math.sqrt(v.area * ratio)));
    const length = Math.max(10, Math.round(v.area / width));
    const scale = (width * length) / (baseW * baseL);

    const shiftHours = SHIFT_HOURS[v.shifts] ?? 11;
    const workHours = Math.min(24, v.shifts * shiftHours);
    const isPallet = c.form.cargoType === "pallet";
    const mode = v.shifts === 1 ? "single_shift" : "continuous";

    const piecesPerLine = n(c.form.pickPiecesDay) / Math.max(1, n(c.form.pickLinesDay));
    const form: ProjectFormData = {
        ...c.form,
        width,
        length,
        workHours,
        palletPlaces: Math.max(1, Math.round(n(c.form.palletPlaces) * scale)),
        ...(isPallet
            ? { receivePalletsDay: Math.round(v.volume / 2), shipPalletsDay: Math.round(v.volume / 2) }
            : { pickLinesDay: v.volume, pickPiecesDay: Math.round(v.volume * piecesPerLine) }),
    };

    const staff = staffFor(c, v);
    const staffPickers = isPallet ? n(c.econ.staffPickers) : staff;
    const staffForklift = isPallet ? staff : n(c.econ.staffForklift);
    const staffPackers = n(c.econ.staffPackers);
    const econ: EconFormData = {
        ...c.econ,
        activeAreaM2: width * length,
        // Одна смена — пятидневка (247 дн/год), две и три — без выходных; число и длину смен задаёт ползунок
        workMode: mode,
        workingDaysPerYear: WORK_MODE_PRESETS[mode].workingDaysPerYear,
        peakFactor: WORK_MODE_PRESETS[mode].peakFactor,
        shiftsPerDay: v.shifts,
        shiftHours,
        staffPickers,
        staffForklift,
        staffPackers,
        // Всего — сумма групп, иначе формы разойдутся
        staffTotal: staffPickers + staffForklift + staffPackers,
        ...(isPallet ? { salaryForklift: v.salary } : { salaryPicker: v.salary }),
    };
    return { form, econ };
}
