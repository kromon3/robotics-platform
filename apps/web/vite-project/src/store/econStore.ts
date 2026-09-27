import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChangeEvent } from "react";

// Вторая фаза визарда: данные для экономического расчёта (блоки A–L из ТЗ команды).
// Вводятся после подбора робота — техническая совместимость от них не зависит.
//
// Блоки E (хранение и грузы) и F (операции) здесь НЕ дублируются: габариты, массы, паллетоместа,
// приёмка, отгрузка, отбор и структура SKU введены на первой фазе (/projects, ProjectFormData)
// и берутся оттуда. Во второй фазе спрашиваем только то, чего в первой нет: календарь, персонал,
// маршруты, инфраструктуру, бюджет и горизонт.

export type NumField = number | "";
export type WorkMode = "continuous" | "single_shift" | "seasonal";
export type FloorFlatness = "din18202" | "din15185" | "unknown";

export const WORK_MODES: { value: WorkMode; label: string }[] = [
    { value: "continuous", label: "Беспрерывный (24/7)" },
    { value: "single_shift", label: "Односменный" },
    { value: "seasonal", label: "Сезонный" },
];

export const FLOOR_FLATNESS: { value: FloorFlatness; label: string }[] = [
    { value: "din18202", label: "DIN 18202 (общестроительный допуск)" },
    { value: "din15185", label: "DIN 15185 (узкопроходные склады)" },
    { value: "unknown", label: "Не измерялось" },
];

/** Режим работы задаёт календарь: дни, смены, длительность, пиковый коэффициент (блок D ТЗ). */
export const WORK_MODE_PRESETS: Record<WorkMode, { workingDaysPerYear: number; shiftsPerDay: number; shiftHours: number; peakFactor: number }> = {
    continuous: { workingDaysPerYear: 365, shiftsPerDay: 2, shiftHours: 11, peakFactor: 1.5 },
    single_shift: { workingDaysPerYear: 247, shiftsPerDay: 1, shiftHours: 8, peakFactor: 1.3 },
    seasonal: { workingDaysPerYear: 300, shiftsPerDay: 2, shiftHours: 10, peakFactor: 1.8 },
};

export interface EconFormData {
    // A–C. Зона и здание
    activeAreaM2: NumField;
    floors: NumField;
    floorFlatness: FloorFlatness | "";
    /** id системы из листа «Стеллажи» (src/viz/rackCatalog.ts); пусто — стеллажи в проект не входят */
    rackSystemId: string;
    // D. Режим работы (значения подставляются пресетом, пользователь может поправить)
    workMode: WorkMode | "";
    workingDaysPerYear: NumField;
    shiftHours: NumField;
    shiftsPerDay: NumField;
    peakFactor: NumField;
    // E–F. Хранение, грузы и операции — из первой фазы (ProjectFormData), здесь не спрашиваем
    // G. Персонал
    staffTotal: NumField;
    staffPickers: NumField;
    staffForklift: NumField;
    staffPackers: NumField;
    salaryPicker: NumField;
    salaryForklift: NumField;
    payrollTaxPct: NumField;
    pickerLinesPerHour: NumField;
    timeLossFactor: NumField;
    // H. Маршруты
    routeLengthPerLine: NumField;
    conveyorLength: NumField;
    // I–L. Инфраструктура и горизонт
    powerAvailableKw: NumField;
    hasWms: boolean;
    hasErp: boolean;
    replacedEquipmentCost: NumField;
    budget: NumField;
    horizonYears: NumField;
}

export type EconFieldName = keyof EconFormData;

const EMPTY: EconFormData = {
    activeAreaM2: "", floors: "", floorFlatness: "", rackSystemId: "",
    workMode: "", workingDaysPerYear: "", shiftHours: "", shiftsPerDay: "", peakFactor: "",
    staffTotal: "", staffPickers: "", staffForklift: "", staffPackers: "", salaryPicker: "", salaryForklift: "",
    payrollTaxPct: 30.2, pickerLinesPerHour: "", timeLossFactor: "",
    routeLengthPerLine: "", conveyorLength: "",
    powerAvailableKw: "", hasWms: false, hasErp: false, replacedEquipmentCost: "",
    budget: "", horizonYears: 5,
};

/** Демо-склад из датасета «Склад» (§2 документа экономистов) */
export const ECON_EXAMPLE: EconFormData = {
    activeAreaM2: 960, floors: 1, floorFlatness: "din18202", rackSystemId: "",
    workMode: "continuous", workingDaysPerYear: 365, shiftHours: 11, shiftsPerDay: 2, peakFactor: 1.5,
    staffTotal: 40, staffPickers: 10, staffForklift: 25, staffPackers: 5,
    salaryPicker: 100_000, salaryForklift: 120_000, payrollTaxPct: 30.2,
    pickerLinesPerHour: 15, timeLossFactor: 0.12,
    routeLengthPerLine: 35, conveyorLength: 120,
    powerAvailableKw: 250, hasWms: true, hasErp: true, replacedEquipmentCost: 0,
    budget: 80_000_000, horizonYears: 5,
};

export const ECON_LIMITS: Partial<Record<EconFieldName, { min: number; max: number }>> = {
    activeAreaM2: { min: 10, max: 500_000 },
    floors: { min: 1, max: 20 },
    workingDaysPerYear: { min: 1, max: 365 },
    shiftHours: { min: 1, max: 24 },
    shiftsPerDay: { min: 1, max: 4 },
    peakFactor: { min: 1, max: 5 },
    staffTotal: { min: 0, max: 10_000 },
    staffPickers: { min: 0, max: 10_000 },
    staffForklift: { min: 0, max: 10_000 },
    staffPackers: { min: 0, max: 10_000 },
    salaryPicker: { min: 10_000, max: 1_000_000 },
    salaryForklift: { min: 10_000, max: 1_000_000 },
    payrollTaxPct: { min: 0, max: 100 },
    pickerLinesPerHour: { min: 1, max: 500 },
    timeLossFactor: { min: 0, max: 0.9 },
    routeLengthPerLine: { min: 0, max: 1000 },
    conveyorLength: { min: 0, max: 10_000 },
    powerAvailableKw: { min: 0, max: 100_000 },
    replacedEquipmentCost: { min: 0, max: 1_000_000_000 },
    budget: { min: 100_000, max: 10_000_000_000 },
    horizonYears: { min: 1, max: 15 },
};

// Без этих полей расчёт не собрать
const REQUIRED: { name: EconFieldName; label: string }[] = [
    { name: "workMode", label: "Режим работы" },
    { name: "workingDaysPerYear", label: "Рабочих дней в году" },
    { name: "shiftHours", label: "Продолжительность смены" },
    { name: "shiftsPerDay", label: "Смен в сутки" },
    { name: "peakFactor", label: "Пиковый коэффициент" },
    { name: "staffForklift", label: "Операторы погрузчиков" },
    { name: "salaryForklift", label: "Зарплата оператора погрузчика" },
    { name: "payrollTaxPct", label: "Страховые взносы" },
    { name: "pickerLinesPerHour", label: "Выработка оператора" },
    { name: "budget", label: "Бюджет роботизации" },
    { name: "horizonYears", label: "Горизонт расчёта" },
];

export const getEconMissing = (d: EconFormData) => REQUIRED.filter((f) => d[f.name] === "");

export function getEconInvalid(d: EconFormData): { name: EconFieldName; message: string }[] {
    const out: { name: EconFieldName; message: string }[] = [];
    for (const [name, lim] of Object.entries(ECON_LIMITS) as [EconFieldName, { min: number; max: number }][]) {
        const v = d[name];
        if (v === "" || typeof v !== "number") continue;
        if (v < lim.min || v > lim.max) out.push({ name, message: `${name}: ${v}, допустимо ${lim.min}–${lim.max}` });
    }
    return out;
}

/** Оставить только поля текущей формы: в расчётах, сохранённых до v2, лежат поля первой фазы */
export function sanitizeEcon(saved: Partial<EconFormData> | null | undefined): EconFormData {
    const out = { ...EMPTY };
    if (!saved) return out;
    for (const key of Object.keys(EMPTY) as (keyof EconFormData)[])
        if (key in saved) (out as Record<string, unknown>)[key] = saved[key];
    return out;
}

const num = (v: NumField): number => (v === "" ? 0 : v);

/** Значения для расчёта: пустые поля -> 0 */
export type EconNumeric = { [K in keyof EconFormData]: EconFormData[K] extends NumField ? number : EconFormData[K] };
export function toEconNumeric(d: EconFormData): EconNumeric {
    const out = { ...d } as Record<string, unknown>;
    for (const [k, v] of Object.entries(d)) if (typeof v === "number" || v === "") out[k] = num(v as NumField);
    return out as EconNumeric;
}

interface EconState {
    econ: EconFormData;
    handleChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    reset: () => void;
    /** overrides — значения, выведенные из первой фазы (например, площадь по габаритам объекта) */
    fillExample: (overrides?: Partial<EconFormData>) => void;
    /** Подставить значение, если пользователь его не вводил (вызывается из обработчиков, не из эффекта) */
    setDefaults: (values: Partial<EconFormData>) => void;
}

export const useEconStore = create<EconState>()(
    persist(
        (set) => ({
            econ: EMPTY,
            handleChange: (event) => {
                const target = event.target as HTMLInputElement;
                const { name, type, value } = target;
                const parsed =
                    type === "checkbox" ? target.checked : type === "number" ? (value === "" ? "" : Number(value)) : value;

                set((state) => {
                    // Смена режима работы подставляет календарь (блок D ТЗ)
                    if (name === "workMode" && parsed) {
                        const preset = WORK_MODE_PRESETS[parsed as WorkMode];
                        return { econ: { ...state.econ, workMode: parsed as WorkMode, ...preset } };
                    }
                    return { econ: { ...state.econ, [name]: parsed } };
                });
            },
            reset: () => set({ econ: EMPTY }),
            fillExample: (overrides) => set({ econ: { ...ECON_EXAMPLE, ...overrides } }),
            setDefaults: (values) =>
                set((state) => {
                    const patch: Partial<EconFormData> = {};
                    for (const [k, v] of Object.entries(values) as [keyof EconFormData, never][])
                        if (state.econ[k] === "") patch[k] = v;
                    return Object.keys(patch).length ? { econ: { ...state.econ, ...patch } } : state;
                }),
        }),
        {
            name: "project-econ",
            // v2: из формы убраны поля, дублирующие первую фазу — выкидываем их из сохранённого состояния
            version: 2,
            migrate: (persisted) => {
                const saved = (persisted as { econ?: Record<string, unknown> })?.econ ?? {};
                const econ = { ...EMPTY };
                for (const key of Object.keys(EMPTY) as (keyof EconFormData)[])
                    if (key in saved) (econ as Record<string, unknown>)[key] = saved[key];
                return { econ };
            },
        },
    ),
);
