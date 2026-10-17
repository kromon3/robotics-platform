import { PRODUCT_STATUS_LABELS, type Product } from "../api/catalog.ts";
import type { VizRobot } from "../viz/robotSpecs";
import { formatNumber, type Better, type CompareRow } from "./compare";

// Строки сравнения решений: характеристики и происхождение данных.
// Одни и те же определения — в каталоге (сравнение без объекта) и на витрине подбора
// (там к ним добавляются экономика и оценка, см. components/CompareTable.tsx).
//
// Два режима:
//  - "declared" — каталог: только то, что заявил производитель (product.specs). Чего нет — «нет данных»,
//    никаких типовых значений: снабженец по ним запрашивает КП и не должен принять оценку за паспорт.
//  - "model" — витрина: значения модели робота (toVizRobot), с которыми идёт расчёт; оценки помечены.

export type ProductCompareItem = { product: Product; robot: VizRobot };
export type SpecMode = "declared" | "model";

export const SPEC_GROUP = "Характеристики";
export const DATA_GROUP = "Происхождение данных";

type Row = CompareRow<ProductCompareItem>;

const raw = (p: Product, key: string): unknown => (p.specs as Record<string, unknown> | null | undefined)?.[key];

/** Числовое поле ТТХ; 0 и пустое — «не заявлено» (так их заполняет каталог робототехников) */
export function specNumber(p: Product, key: string): number | null {
    const v = raw(p, key);
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "string" ? Number(v.replace(",", ".").replace(/\s/g, "")) : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
}

export function specText(p: Product, key: string): string | null {
    const v = raw(p, key);
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

// Поля, по которым видно, что производитель заявил ТТХ, а не только название и описание
const DECLARED_KEYS = [
    "payload_kg",
    "speed_mps",
    "speed_m_s",
    "length_mm",
    "width_mm",
    "runtime_h",
    "charge_h",
    "throughput_per_hour",
    "throughput_units_per_h",
    "lift_height_mm",
];
export const hasDeclaredSpecs = (p: Product) => DECLARED_KEYS.some((k) => specNumber(p, k) !== null);

const MODEL_SOURCE: Record<VizRobot["specsSource"], string> = {
    specs: "каталог ТТХ производителя",
    v0: "оценка по открытым источникам",
    "type-default": "типовые для класса",
};

/** Откуда характеристики: в каталоге — заявлены или нет, на витрине — чем заполнена модель робота */
export function specsSourceLabel(i: ProductCompareItem, mode: SpecMode): string {
    if (mode === "model") return MODEL_SOURCE[i.robot.specsSource];
    return hasDeclaredSpecs(i.product) ? "каталог ТТХ производителя" : "ТТХ не заявлены";
}

export const trustLabel = (verified: boolean) => (verified ? "Подтверждены" : "Требуют проверки");

// Excel хранит даты числом дней от 30.12.1899. В листе ТТХ часть дат выгрузилась числом («46292»),
// сид превращает его в 46292 год — такие значения разбираем как серийный номер Excel.
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const DAY = 86_400_000;
const fromExcelSerial = (n: number) => (n > 20_000 && n < 80_000 ? EXCEL_EPOCH + n * DAY : null);

/** Дата источника данных в мс: ISO, «46292» и «+046292-01-01T…» (серийный номер Excel); мусор → null */
export function parseSourceDate(date: string | null | undefined): number | null {
    if (!date) return null;
    const s = date.trim();
    if (/^\d{5}(\.\d+)?$/.test(s)) return fromExcelSerial(Math.floor(Number(s)));
    const t = Date.parse(s);
    if (!Number.isFinite(t)) return null;
    const year = new Date(t).getUTCFullYear();
    if (year > 2100) return fromExcelSerial(year);
    return t;
}

/** 2026-09-20 / ISO → 20.09.2026; мусор → null */
export function formatSourceDate(date: string | null | undefined): string | null {
    const t = parseSourceDate(date);
    return t === null ? null : new Date(t).toLocaleDateString("ru-RU", { timeZone: "UTC" });
}

/** Для показа — домен источника; кривой адрес (пробелы, кодировка) показываем просто «ссылка» */
function sourceHost(url: string | null): string | null {
    if (!url) return null;
    try {
        const host = new URL(url).hostname.replace(/^www\./, "");
        return /^[a-z0-9.-]+$/i.test(host) && host.length <= 40 && !host.includes("%") ? host : "ссылка";
    } catch {
        return "ссылка";
    }
}

export function formatPrice(price: string | null): string {
    return price
        ? new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(price))
        : "Цена по запросу";
}

/** Числовая строка с одной единицей на всю строку */
const numRow = (
    label: string,
    get: (i: ProductCompareItem) => number | null,
    unit: string,
    best?: Better,
    digits = 1,
    prefix = "",
): Row => ({
    group: SPEC_GROUP,
    label,
    num: get,
    best,
    value: (i) => {
        const n = get(i);
        return n === null ? null : `${prefix}${formatNumber(n, digits)} ${unit}`;
    },
});

const fromSpecs = (key: string) => (i: ProductCompareItem) => specNumber(i.product, key);

/** Характеристики. Направление «лучше» задано только там, где оно очевидно. */
export function specRows(mode: SpecMode): Row[] {
    const model = mode === "model";
    const speed = (i: ProductCompareItem) =>
        model ? i.robot.speedMps : (specNumber(i.product, "speed_mps") ?? specNumber(i.product, "speed_m_s"));
    const throughput = (i: ProductCompareItem) =>
        model
            ? i.robot.throughputPerHour
            : (specNumber(i.product, "throughput_per_hour") ?? specNumber(i.product, "throughput_units_per_h"));

    return [
        {
            group: SPEC_GROUP,
            label: "Цена за единицу",
            value: (i) => (i.product.price ? `${formatNumber(Number(i.product.price), 0)} ₽` : "по запросу"),
            num: (i) => (i.product.price ? Number(i.product.price) || null : null),
            best: "min",
            hint: "цена из каталога, без доставки и внедрения",
        },
        {
            group: SPEC_GROUP,
            label: "Тип робота",
            value: (i) => (model ? i.robot.type : specText(i.product, "robot_type")),
        },
        {
            group: SPEC_GROUP,
            label: "Габариты (Д × Ш)",
            value: (i) => {
                if (model) return `${formatNumber(i.robot.l, 2)} × ${formatNumber(i.robot.w, 2)} м`;
                const l = specNumber(i.product, "length_mm");
                const w = specNumber(i.product, "width_mm");
                return l && w ? `${formatNumber(l, 0)} × ${formatNumber(w, 0)} мм` : null;
            },
        },
        numRow("Высота корпуса", fromSpecs("height_mm"), "мм", undefined, 0),
        numRow("Масса робота", fromSpecs("mass_kg"), "кг", undefined, 0),
        numRow("Грузоподъёмность", (i) => (model ? i.robot.payloadKg : specNumber(i.product, "payload_kg")), "кг", "max", 0),
        numRow("Скорость", speed, "м/с", "max", 2),
        {
            ...numRow("Производительность", throughput, "ед/ч", "max", 0),
            // На витрине типовая производительность подставлена в расчёт — помечаем, что это не паспорт
            value: (i) => {
                const n = throughput(i);
                if (n === null) return null;
                return `${formatNumber(n, 0)} ед/ч${model && i.robot.throughputSource !== "specs" ? " (типовая)" : ""}`;
            },
        },
        // Высоты — всегда в миллиметрах: 60 мм и 4,5 м в одной строке сравнивать неудобно
        numRow("Высота подъёма", fromSpecs("lift_height_mm"), "мм", "max", 0),
        numRow("Подъём стола", fromSpecs("table_lift_height_mm"), "мм", undefined, 0),
        numRow("Грузоподъёмность на высоте", fromSpecs("lift_residual_payload_kg"), "кг", "max", 0),
        numRow("Точность позиционирования", fromSpecs("positioning_mm"), "мм", "min", 1, "± "),
        numRow("Работа на заряде", fromSpecs("runtime_h"), "ч", "max", 1),
        numRow("Время зарядки", fromSpecs("charge_h"), "ч", "min", 1),
        numRow("Пробег на заряде", fromSpecs("range_km"), "км", "max", 1),
        numRow("Преодолеваемый уклон", fromSpecs("slope_pct"), "%", "max", 1),
        numRow("Длина вил", fromSpecs("fork_length_mm"), "мм", undefined, 0),
        {
            group: SPEC_GROUP,
            label: "Захват",
            value: (i) => (model ? (i.robot.gripper ?? specText(i.product, "gripper")) : specText(i.product, "gripper")),
        },
        { group: SPEC_GROUP, label: "Навигация", value: (i) => specText(i.product, "navigation") },
        { group: SPEC_GROUP, label: "Аккумулятор", value: (i) => specText(i.product, "battery") },
    ];
}

/** Происхождение данных: кто заявил, насколько проверено, когда и где посмотреть */
export function provenanceRows(mode: SpecMode): Row[] {
    return [
        { group: DATA_GROUP, label: "Производитель", value: (i) => i.product.company?.name ?? specText(i.product, "manufacturer") },
        {
            group: DATA_GROUP,
            label: "Страна / регион",
            value: (i) => [specText(i.product, "country"), i.product.company?.region].filter(Boolean).join(", ") || null,
        },
        { group: DATA_GROUP, label: "Статус", value: (i) => PRODUCT_STATUS_LABELS[i.product.status] ?? null },
        { group: DATA_GROUP, label: "Доступность", value: (i) => specText(i.product, "availability") },
        {
            group: DATA_GROUP,
            label: "Готовность технологии (УГТ)",
            value: (i) => (i.product.ugt ? `${i.product.ugt} из 9` : null),
            num: (i) => i.product.ugt ?? null,
            best: "max",
        },
        { group: DATA_GROUP, label: "Источник ТТХ", value: (i) => specsSourceLabel(i, mode) },
        { group: DATA_GROUP, label: "Достоверность", value: (i) => trustLabel(i.product.verified) },
        {
            group: DATA_GROUP,
            label: "Дата данных",
            value: (i) => formatSourceDate(i.product.sourceDate),
            num: (i) => parseSourceDate(i.product.sourceDate),
            best: "max",
            hint: "свежее — лучше",
        },
        {
            group: DATA_GROUP,
            label: "Ссылка на источник",
            value: (i) => sourceHost(i.product.sourceUrl),
            href: (i) => i.product.sourceUrl,
        },
        { group: DATA_GROUP, label: "Оговорка к цене и ТТХ", value: (i) => specText(i.product, "note") },
        { group: DATA_GROUP, label: "Версия каталога", value: (i) => (i.product.catalogVersion ? `v${i.product.catalogVersion}` : null) },
    ];
}

export const productRows = (mode: SpecMode): Row[] => [...specRows(mode), ...provenanceRows(mode)];

// Ключевые характеристики на карточке: четыре строки, чтобы карточки в ряду были одной высоты
const CARD_SPECS: Record<SpecMode, { label: string; short?: string }[]> = {
    declared: [
        { label: "Грузоподъёмность" },
        { label: "Скорость" },
        { label: "Габариты (Д × Ш)", short: "Габариты" },
        { label: "Работа на заряде", short: "На заряде" },
    ],
    model: [
        { label: "Тип робота", short: "Тип" },
        { label: "Габариты (Д × Ш)", short: "Габариты" },
        { label: "Грузоподъёмность" },
        { label: "Производительность" },
    ],
};

export function cardSpecs(i: ProductCompareItem, mode: SpecMode): { label: string; value: string | null }[] {
    const rows = specRows(mode);
    return CARD_SPECS[mode].map(({ label, short }) => {
        const row = rows.find((r) => r.label === label)!;
        return { label: short ?? label, value: row.value(i) };
    });
}
