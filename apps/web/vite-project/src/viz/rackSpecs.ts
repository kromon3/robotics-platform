// Высота ярусов стеллажных систем — из листа «Стеллажи» каталога робототехников
// (22 позиции, 13 брендов, цены и габариты по открытым источникам поставщиков).
// Нужна, чтобы проверять, дотянется ли робот до верхнего яруса (ТЗ 3.4.2).
//
// topTierMm — высота установки груза на верхнем ярусе: нижний ярус стоит на полу,
// поэтому верхний = высота секции × (ярусов − 1) / ярусов.

import type { CargoType, RackType } from "../store/store";

export type RackTier = {
    /** Высота верхнего яруса, мм */
    topTierMm: number;
    tiers: number;
    /** Высота секции целиком, мм */
    sectionHeightMm: number;
    /** Конкретная модель из листа — показываем пользователю как основание */
    source: string;
};

const tier = (sectionHeightMm: number, tiers: number, source: string): RackTier => ({
    sectionHeightMm,
    tiers,
    topTierMm: Math.round((sectionHeightMm * (tiers - 1)) / tiers),
    source,
});

// Представительная модель для каждого типа хранения. Для полочного хранения коробов
// габариты другие, поэтому таблица разделена по типу груза.
const TIERS: Record<RackType, Partial<Record<CargoType, RackTier>> & { default: RackTier }> = {
    stack: {
        default: tier(6000, 4, "Промверс, штабелируемый поддон 1200×800×1500, 4 яруса"),
    },
    shelf: {
        box: tier(2500, 4, "ДВК СТЛ Э, секция 2000×600×2500, 4 яруса"),
        default: tier(6000, 3, "Экомет СПФ 27113-60-3000, секция 2700×1100×6000, 3 яруса"),
    },
    deep: {
        default: tier(6000, 3, "Prostor DriveIn, высота 6000, 3 яруса"),
    },
    flow: {
        default: tier(6000, 3, "Гравитационные стеллажи ГРОССВЕКТОР/Prostor, 6000, 3 яруса"),
    },
    cantilever: {
        default: tier(3000, 3, "ASK Logistic K3, стойка 3000, 3 консоли"),
    },
    mezzanine: {
        default: tier(5000, 2, "Мезонин-стеллаж, этаж 2500 мм, 2 этажа"),
    },
};

export function rackTier(rackType: RackType | "", cargoType: CargoType | ""): RackTier | null {
    if (!rackType) return null;
    const row = TIERS[rackType];
    return (cargoType && row[cargoType]) || row.default;
}

export const m = (mm: number) => (mm / 1000).toFixed(1).replace(".", ",");
