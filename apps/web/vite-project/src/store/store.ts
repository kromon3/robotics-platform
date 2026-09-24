import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChangeEvent } from "react";

// Пустое поле — "", чтобы инпут не показывал 0. В число приводится при отправке (см. toNumericFormData).
export type NumField = number | "";

export type Dimensions = { L: NumField; W: NumField; H: NumField };

export type RackType = "stack" | "shelf" | "deep" | "flow" | "cantilever" | "mezzanine";
export type CargoType = "pallet" | "box" | "long";

export const RACK_TYPES: { value: RackType; label: string }[] = [
    { value: "stack", label: "Штабельный" },
    { value: "shelf", label: "Фронтально-полочный" },
    { value: "deep", label: "Глубинный" },
    { value: "flow", label: "Поточный" },
    { value: "cantilever", label: "Консольный" },
    { value: "mezzanine", label: "Мезонин" },
];

export const CARGO_TYPES: { value: CargoType; label: string }[] = [
    { value: "pallet", label: "Паллеты" },
    { value: "box", label: "Коробы / штучный" },
    { value: "long", label: "Длинномер" },
];

// Допустимые типы груза для стеллажа: консоль — только длинномер, мезонин — только коробы.
const CARGO_BY_RACK: Partial<Record<RackType, CargoType[]>> = {
    cantilever: ["long"],
    mezzanine: ["box"],
};

export function getCargoOptions(rackType: RackType | ""): typeof CARGO_TYPES {
    const allowed = rackType ? CARGO_BY_RACK[rackType] : undefined;
    return allowed ? CARGO_TYPES.filter((c) => allowed.includes(c.value)) : CARGO_TYPES;
}

// Значения из старых выгрузок / внешних форм -> наши ключи
const LEGACY_RACK: Record<string, RackType> = { block: "stack", frontal: "shelf" };
const LEGACY_CARGO: Record<string, CargoType> = { euro_pallet: "pallet", custom: "box" };

export const normalizeRackType = (v: string): RackType | "" =>
    LEGACY_RACK[v] ?? (RACK_TYPES.some((r) => r.value === v) ? (v as RackType) : "");

export const normalizeCargoType = (v: string): CargoType | "" =>
    LEGACY_CARGO[v] ?? (CARGO_TYPES.some((c) => c.value === v) ? (v as CargoType) : "");

// Параметры склада для подбора решения. Числовые поля — в единицах из подписей формы.
export interface ProjectFormData {
    rackType: RackType | "";
    cargoType: CargoType | "";
    width: NumField;
    length: NumField;
    aisleWidth: NumField;
    workHours: NumField;
    shelfCapacity: NumField;
    palletPlaces: NumField;
    pallet: Dimensions;
    palletMass: NumField;
    skuMass: NumField;
    sku: Dimensions;
    oversizeShare: NumField;
    receivePalletsDay: NumField;
    shipPalletsDay: NumField;
    pickLinesDay: NumField;
    pickPiecesDay: NumField;
    piecePickShare: NumField;
    skuActive: NumField;
    aClassShare: NumField;
}

// Имя поля в форме: плоское ("width") или вложенное ("pallet.L")
export type ProjectFieldName =
    | Exclude<keyof ProjectFormData, "pallet" | "sku">
    | `pallet.${keyof Dimensions}`
    | `sku.${keyof Dimensions}`;

interface ProjectState {
    formData: ProjectFormData;
    // Робот, выбранный на витрине для расчёта и схемы
    selectedProductId: string | null;
    handleChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    reset: () => void;
    fillExample: () => void;
    selectProduct: (id: string | null) => void;
}

const EMPTY_DIMENSIONS: Dimensions = { L: "", W: "", H: "" };

const DEFAULTS: ProjectFormData = {
    rackType: "",
    cargoType: "",
    width: "",
    length: "",
    aisleWidth: "",
    workHours: "",
    shelfCapacity: "",
    palletPlaces: "",
    pallet: { ...EMPTY_DIMENSIONS },
    palletMass: "",
    skuMass: "",
    sku: { ...EMPTY_DIMENSIONS },
    oversizeShare: "",
    receivePalletsDay: "",
    shipPalletsDay: "",
    pickLinesDay: "",
    pickPiecesDay: "",
    piecePickShare: "",
    skuActive: "",
    aClassShare: "",
};

// Демо-склад для показа: средний распределительный склад с коробочным отбором.
// Значения согласованы с тестовым стендом визуализации (DEFAULT_PARAMS в warehouse-viz).
export const EXAMPLE: ProjectFormData = {
    rackType: "shelf",
    cargoType: "box",
    width: 40,
    length: 24,
    aisleWidth: 2,
    workHours: 16,
    shelfCapacity: 12,
    palletPlaces: 200,
    pallet: { L: 1200, W: 800, H: 1500 },
    palletMass: 600,
    skuMass: 5,
    sku: { L: 400, W: 300, H: 300 },
    oversizeShare: 0,
    receivePalletsDay: 120,
    shipPalletsDay: 120,
    pickLinesDay: 4800,
    pickPiecesDay: 7200,
    piecePickShare: 60,
    skuActive: 800,
    aClassShare: 20,
};

// Без этих полей подбор и схема не строятся. Объём операций зависит от типа груза:
// паллеты — приёмка и отгрузка, коробы/длинномер — строки отбора.
export const REQUIRED_FIELDS: { name: ProjectFieldName; label: string }[] = [
    { name: "rackType", label: "Тип стеллажей" },
    { name: "cargoType", label: "Тип груза" },
    { name: "width", label: "Ширина склада" },
    { name: "length", label: "Длина склада" },
    { name: "aisleWidth", label: "Ширина прохода" },
    { name: "workHours", label: "Рабочие часы" },
    { name: "shelfCapacity", label: "Мест на секцию стеллажа" },
    { name: "palletPlaces", label: "Паллетоместа" },
];

// Допустимые диапазоны. Защищают и пользователя (ввёл мм вместо м), и визуализацию (склад 40 км не нарисовать).
export const FIELD_LIMITS: Partial<Record<ProjectFieldName, { min: number; max: number; label: string; unit: string }>> = {
    width: { min: 5, max: 1000, label: "Ширина склада", unit: "м" },
    length: { min: 5, max: 1000, label: "Длина склада", unit: "м" },
    aisleWidth: { min: 0.5, max: 10, label: "Ширина прохода", unit: "м" },
    workHours: { min: 1, max: 24, label: "Рабочие часы", unit: "ч" },
    shelfCapacity: { min: 1, max: 200, label: "Мест на секцию", unit: "ед." },
    palletPlaces: { min: 1, max: 200_000, label: "Паллетоместа", unit: "шт" },
    "pallet.L": { min: 300, max: 3000, label: "Длина паллеты", unit: "мм" },
    "pallet.W": { min: 300, max: 3000, label: "Ширина паллеты", unit: "мм" },
    "pallet.H": { min: 100, max: 3000, label: "Высота паллеты", unit: "мм" },
    palletMass: { min: 1, max: 5000, label: "Масса паллеты", unit: "кг" },
    skuMass: { min: 0.01, max: 500, label: "Масса SKU", unit: "кг" },
    "sku.L": { min: 10, max: 2000, label: "Длина SKU", unit: "мм" },
    "sku.W": { min: 10, max: 2000, label: "Ширина SKU", unit: "мм" },
    "sku.H": { min: 10, max: 2000, label: "Высота SKU", unit: "мм" },
    oversizeShare: { min: 0, max: 100, label: "Доля негабарита", unit: "%" },
    receivePalletsDay: { min: 0, max: 100_000, label: "Приёмка", unit: "поддонов/сутки" },
    shipPalletsDay: { min: 0, max: 100_000, label: "Отгрузка", unit: "поддонов/сутки" },
    pickLinesDay: { min: 0, max: 1_000_000, label: "Строк отбора", unit: "в сутки" },
    pickPiecesDay: { min: 0, max: 5_000_000, label: "Штук отбора", unit: "в сутки" },
    piecePickShare: { min: 0, max: 100, label: "Доля штучного отбора", unit: "%" },
    skuActive: { min: 0, max: 1_000_000, label: "Активных SKU", unit: "шт" },
    aClassShare: { min: 0, max: 100, label: "Доля A-класса", unit: "%" },
};

/** Заполненные поля вне диапазона: «Ширина склада: 40000 м, допустимо 5–1000 м» */
export function getInvalidFields(data: ProjectFormData): { name: ProjectFieldName; message: string }[] {
    const out: { name: ProjectFieldName; message: string }[] = [];
    for (const [name, lim] of Object.entries(FIELD_LIMITS) as [ProjectFieldName, NonNullable<(typeof FIELD_LIMITS)[ProjectFieldName]>][]) {
        const v = getFieldValue(data, name);
        if (v === "" || typeof v !== "number") continue;
        if (v < lim.min || v > lim.max)
            out.push({ name, message: `${lim.label}: ${v} ${lim.unit}, допустимо ${lim.min}–${lim.max} ${lim.unit}` });
    }
    return out;
}

export function getMissingFields(data: ProjectFormData): { name: ProjectFieldName; label: string }[] {
    const missing = REQUIRED_FIELDS.filter((f) => getFieldValue(data, f.name) === "");
    if (data.cargoType === "pallet") {
        if (data.palletMass === "") missing.push({ name: "palletMass", label: "Масса паллеты" });
        if (data.receivePalletsDay === "") missing.push({ name: "receivePalletsDay", label: "Приёмка" });
        if (data.shipPalletsDay === "") missing.push({ name: "shipPalletsDay", label: "Отгрузка" });
    } else if (data.cargoType) {
        if (data.skuMass === "") missing.push({ name: "skuMass", label: "Масса SKU" });
        if (data.pickLinesDay === "") missing.push({ name: "pickLinesDay", label: "Строк отбора" });
    }
    return missing;
}

export function getFieldValue(data: ProjectFormData, name: ProjectFieldName): string | number {
    if (name.startsWith("pallet.") || name.startsWith("sku.")) {
        const [parent, child] = name.split(".") as ["pallet" | "sku", keyof Dimensions];
        return data[parent][child];
    }
    return data[name as Exclude<keyof ProjectFormData, "pallet" | "sku">];
}

// Тот же объект, но все числовые поля гарантированно number (пустое -> 0) — для расчётов и API.
// ВНИМАНИЕ: единицы остаются как в форме — габариты в мм, доли в %.
// Контракт визуализации (warehouse-viz) ждёт метры и доли 0..1 — пересчёт делает адаптер toVizResult.
export type NumericFormData = {
    [K in keyof ProjectFormData]: ProjectFormData[K] extends Dimensions
        ? { L: number; W: number; H: number }
        : ProjectFormData[K] extends NumField
          ? number
          : ProjectFormData[K];
};

const num = (v: NumField): number => (v === "" ? 0 : v);

export function toNumericFormData(data: ProjectFormData): NumericFormData {
    return {
        ...data,
        width: num(data.width),
        length: num(data.length),
        aisleWidth: num(data.aisleWidth),
        workHours: num(data.workHours),
        shelfCapacity: num(data.shelfCapacity),
        palletPlaces: num(data.palletPlaces),
        pallet: { L: num(data.pallet.L), W: num(data.pallet.W), H: num(data.pallet.H) },
        palletMass: num(data.palletMass),
        skuMass: num(data.skuMass),
        sku: { L: num(data.sku.L), W: num(data.sku.W), H: num(data.sku.H) },
        oversizeShare: num(data.oversizeShare),
        receivePalletsDay: num(data.receivePalletsDay),
        shipPalletsDay: num(data.shipPalletsDay),
        pickLinesDay: num(data.pickLinesDay),
        pickPiecesDay: num(data.pickPiecesDay),
        piecePickShare: num(data.piecePickShare),
        skuActive: num(data.skuActive),
        aClassShare: num(data.aClassShare),
    };
}

// persist: форма переживает F5 и переход на другие страницы (localStorage, ключ project-form)
export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => ({
    formData: DEFAULTS,
    selectedProductId: null,

    handleChange: (event) => {
        const { name, value, type } = event.target;
        const parsed = type === "number" ? (value === "" ? "" : Number(value)) : value;

        set((state) => {
            // Вложенные поля: name="pallet.L" -> formData.pallet.L
            if (name.includes(".")) {
                const [parent, child] = name.split(".") as ["pallet" | "sku", keyof Dimensions];
                return {
                    formData: {
                        ...state.formData,
                        [parent]: { ...state.formData[parent], [child]: parsed },
                    },
                };
            }
            // При смене стеллажа сбрасываем груз, если он больше не допустим;
            // если вариант остался один — подставляем его сразу.
            if (name === "rackType") {
                const options = getCargoOptions(parsed as RackType | "");
                const cargoType = options.some((c) => c.value === state.formData.cargoType)
                    ? state.formData.cargoType
                    : options.length === 1
                      ? options[0].value
                      : "";
                return { formData: { ...state.formData, rackType: parsed as RackType | "", cargoType } };
            }
            return { formData: { ...state.formData, [name]: parsed } };
        });
    },

    reset: () => set({ formData: DEFAULTS, selectedProductId: null }),
    fillExample: () => set({ formData: EXAMPLE }),
    selectProduct: (id) => set({ selectedProductId: id }),
        }),
        { name: "project-form" },
    ),
);
