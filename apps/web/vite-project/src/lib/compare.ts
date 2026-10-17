// Общая логика сравнения решений: и для каталога «Роботы», и для витрины подбора.
// Здесь только данные — без React: что считается различием, какое значение лучшее,
// как ограничивается выбор. Отрисовка — в components/CompareView.tsx.

/** Сколько решений можно сравнивать одновременно: больше трёх колонок таблица не держит на ноутбуке */
export const COMPARE_LIMIT = 3;
/** Меньше двух сравнивать нечего */
export const COMPARE_MIN = 2;

/** Как показываем значение, которого нет: производитель не заявил или поле не заполнено */
export const NO_DATA = "нет данных";

export type Better = "min" | "max";

export type CompareRow<T> = {
    group: string;
    label: string;
    /** Значение для показа; null — нет данных */
    value: (item: T) => string | null;
    /** Числовое значение для выбора лучшего; единица одна на всю строку */
    num?: (item: T) => number | null;
    /** Направление «лучше», только там, где оно очевидно */
    best?: Better;
    /** Подсказка к строке: что значит лучшее, откуда данные */
    hint?: string;
    /** Ссылка вместо текста (например, источник данных) */
    href?: (item: T) => string | null;
    /** Свой цвет ячейки вместо «лучшего» — например, зона срока окупаемости */
    tone?: (item: T) => string | null;
};

export type AnalyzedRow<T> = {
    row: CompareRow<T>;
    /** Значения в строке расходятся (отсутствие данных — тоже отличие) */
    differs: boolean;
    /** Индексы колонок с лучшим значением; пусто, если лучшего нет */
    best: Set<number>;
};

/** Значения строки расходятся. «Нет данных» против числа — тоже различие: его надо видеть. */
export function rowDiffers<T>(row: CompareRow<T>, items: T[]): boolean {
    if (items.length < 2) return false;
    return new Set(items.map((i) => row.value(i) ?? NO_DATA)).size > 1;
}

/**
 * Колонки с лучшим значением строки. Лучшее отмечаем, только если направление задано,
 * данные есть хотя бы у двух решений и они различаются: «лучше неизвестного» не бывает.
 * При равенстве лучших отмечаются все.
 */
export function bestIndices<T>(row: CompareRow<T>, items: T[]): Set<number> {
    if (!row.best || !row.num) return new Set();
    const nums = items.map((i) => {
        const n = row.num!(i);
        return n !== null && Number.isFinite(n) ? n : null;
    });
    const valid = nums.filter((n): n is number => n !== null);
    if (valid.length < 2 || new Set(valid).size < 2) return new Set();
    const target = row.best === "min" ? Math.min(...valid) : Math.max(...valid);
    return new Set(nums.flatMap((n, idx) => (n === target ? [idx] : [])));
}

export function analyzeRows<T>(rows: CompareRow<T>[], items: T[]): AnalyzedRow<T>[] {
    return rows.map((row) => ({ row, differs: rowDiffers(row, items), best: bestIndices(row, items) }));
}

/** Строки, у которых ни у одного решения нет данных, сравнивать бессмысленно — убираем всегда */
export function hasAnyValue<T>(row: CompareRow<T>, items: T[]): boolean {
    return items.some((i) => row.value(i) !== null);
}

export type ToggleStatus = "added" | "removed" | "limit";

/** Отметить / снять решение в сравнении. При полном наборе новое не добавляется — статус "limit". */
export function toggleCompareId(ids: string[], id: string, limit = COMPARE_LIMIT): { ids: string[]; status: ToggleStatus } {
    if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), status: "removed" };
    if (ids.length >= limit) return { ids, status: "limit" };
    return { ids: [...ids, id], status: "added" };
}

/** ?ids=a,b,c → ["a","b","c"]: без пустых, без повторов, не больше лимита */
export function parseCompareIds(raw: string | null | undefined, limit = COMPARE_LIMIT): string[] {
    if (!raw) return [];
    const ids = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return [...new Set(ids)].slice(0, limit);
}

export const serializeCompareIds = (ids: string[]) => ids.join(",");

/** Число по-русски: 1 500, 1,5. Единица — забота строки, чтобы в одной строке она была одна. */
export const formatNumber = (n: number, digits = 1) => n.toLocaleString("ru-RU", { maximumFractionDigits: digits });
