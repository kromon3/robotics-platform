import { create } from "zustand";
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
    handleChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    reset: () => void;
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

export function getFieldValue(data: ProjectFormData, name: ProjectFieldName): string | number {
    if (name.startsWith("pallet.") || name.startsWith("sku.")) {
        const [parent, child] = name.split(".") as ["pallet" | "sku", keyof Dimensions];
        return data[parent][child];
    }
    return data[name as Exclude<keyof ProjectFormData, "pallet" | "sku">];
}

// Тот же объект, но все числовые поля гарантированно number (пустое -> 0) — для расчётов и API.
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

export const useProjectStore = create<ProjectState>((set) => ({
    formData: DEFAULTS,

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

    reset: () => set({ formData: DEFAULTS }),
}));
