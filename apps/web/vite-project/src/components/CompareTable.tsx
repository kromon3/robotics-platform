import { useState } from "react";
import { Link } from "react-router";
import type { Product } from "../api/catalog.ts";
import { paybackZone, type Norms, type ScenarioEconomics, type Zone } from "../viz/economics";
import type { VizRobot } from "../viz/robotSpecs";

// Сравнение решений (ТЗ 3.3.7). Сначала то, ради чего сравнивают — деньги и сроки,
// потом характеристики, потом происхождение данных. По умолчанию показываем только
// строки, в которых решения различаются: одинаковые значения сравнивать незачем.

export type CompareItem = { product: Product; robot: VizRobot; minAisle: number };

type Props = {
    items: CompareItem[];
    norms: Norms;
    /** Полный расчёт сценария «покупка» по каждому решению */
    economics: Map<string, ScenarioEconomics>;
    scores?: Map<string, number>;
    /** Решение, которое платформа рекомендует — его колонка подсвечена */
    recommendedId?: string;
    onRemove: (productId: string) => void;
    onClear: () => void;
    onChoose: (productId: string) => void;
};

type Group = "Экономика" | "Характеристики" | "Данные";

type Row = {
    group: Group;
    label: string;
    /** Значение для показа; null — производитель не заявил */
    value: (i: CompareItem, e?: ScenarioEconomics) => string | null;
    /** Числовое значение для подсветки лучшего */
    num?: (i: CompareItem, e?: ScenarioEconomics) => number | null;
    best?: "min" | "max";
    /** Подсветка зоной вместо «лучшего» — для срока окупаемости */
    zone?: (e?: ScenarioEconomics) => Zone | null;
};

const spec = (p: Product, key: string): number | null => {
    const v = (p.specs as Record<string, unknown>)?.[key];
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
};
const text = (p: Product, key: string): string | null => {
    const v = (p.specs as Record<string, unknown>)?.[key];
    return typeof v === "string" && v.trim() ? v : null;
};
const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");
const mln = (n: number) => `${(n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`;
// До метра показываем в миллиметрах: подъём стола 60 мм в метрах выглядит как 0,1 м
const mm = (n: number | null) => (n === null ? null : n < 1000 ? `${fmt(n)} мм` : `${(n / 1000).toFixed(1).replace(".", ",")} м`);

const SOURCE_LABEL: Record<VizRobot["specsSource"], string> = {
    specs: "каталог ТТХ",
    v0: "оценка по открытым источникам",
    "type-default": "типовые для класса",
};

const ZONE_STYLE: Record<Zone, string> = {
    green: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
    yellow: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
};

const ROWS: Row[] = [
    // Экономика — то, ради чего сравнение и затевается
    {
        group: "Экономика",
        label: "Срок окупаемости",
        value: (_i, e) => (e?.paybackYears != null ? `${e.paybackYears} лет` : "не окупается"),
        num: (_i, e) => e?.paybackYears ?? null,
        best: "min",
        zone: (e) => paybackZone(e?.paybackYears ?? null),
    },
    { group: "Экономика", label: "Годовой эффект", value: (_i, e) => (e ? mln(e.annualEffect) : null), num: (_i, e) => e?.annualEffect ?? null, best: "max" },
    { group: "Экономика", label: "Разовые затраты", value: (_i, e) => (e ? mln(e.capex) : null), num: (_i, e) => e?.capex ?? null, best: "min" },
    { group: "Экономика", label: "OPEX в год", value: (_i, e) => (e ? mln(e.opex) : null), num: (_i, e) => e?.opex ?? null, best: "min" },
    { group: "Экономика", label: "Стоимость владения за горизонт", value: (_i, e) => (e ? mln(e.tco) : null), num: (_i, e) => e?.tco ?? null, best: "min" },
    { group: "Экономика", label: "Нужно роботов", value: (_i, e) => (e ? `${e.units} шт` : null), num: (_i, e) => e?.units ?? null, best: "min" },
    { group: "Экономика", label: "Цена за единицу", value: (i) => (i.robot.price ? `${fmt(i.robot.price)} ₽` : null), num: (i) => i.robot.price || null, best: "min" },

    { group: "Характеристики", label: "Тип", value: (i) => i.robot.type },
    { group: "Характеристики", label: "Габариты (Д × Ш)", value: (i) => `${i.robot.l} × ${i.robot.w} м` },
    { group: "Характеристики", label: "Грузоподъёмность", value: (i) => `${fmt(i.robot.payloadKg)} кг`, num: (i) => i.robot.payloadKg, best: "max" },
    { group: "Характеристики", label: "Скорость", value: (i) => `${i.robot.speedMps} м/с`, num: (i) => i.robot.speedMps, best: "max" },
    {
        group: "Характеристики",
        label: "Производительность",
        value: (i) => `${i.robot.throughputPerHour} ед/ч${i.robot.throughputSource === "specs" ? "" : " (типовая)"}`,
        num: (i) => i.robot.throughputPerHour,
        best: "max",
    },
    { group: "Характеристики", label: "Высота подъёма", value: (i) => mm(i.robot.liftHeightMm ?? null), num: (i) => i.robot.liftHeightMm ?? null, best: "max" },
    { group: "Характеристики", label: "Грузоподъёмность на высоте", value: (i) => (i.robot.liftResidualKg ? `${fmt(i.robot.liftResidualKg)} кг` : null), num: (i) => i.robot.liftResidualKg ?? null, best: "max" },
    { group: "Характеристики", label: "Точность позиционирования", value: (i) => (spec(i.product, "positioning_mm") ? `± ${spec(i.product, "positioning_mm")} мм` : null), num: (i) => spec(i.product, "positioning_mm"), best: "min" },
    { group: "Характеристики", label: "Работа на заряде", value: (i) => (spec(i.product, "runtime_h") ? `${spec(i.product, "runtime_h")} ч` : null), num: (i) => spec(i.product, "runtime_h"), best: "max" },
    { group: "Характеристики", label: "Время зарядки", value: (i) => (spec(i.product, "charge_h") ? `${spec(i.product, "charge_h")} ч` : null), num: (i) => spec(i.product, "charge_h"), best: "min" },
    { group: "Характеристики", label: "Захват", value: (i) => i.robot.gripper ?? text(i.product, "gripper") },
    { group: "Характеристики", label: "Навигация", value: (i) => text(i.product, "navigation") },
    { group: "Характеристики", label: "Батарея", value: (i) => text(i.product, "battery") },
    { group: "Характеристики", label: "Нужен проход", value: (i) => (i.minAisle > 0 ? `≥ ${i.minAisle} м` : "не требуется"), num: (i) => i.minAisle || null, best: "min" },

    { group: "Данные", label: "Производитель", value: (i) => i.product.company?.name ?? text(i.product, "manufacturer") },
    { group: "Данные", label: "Статус", value: (i) => text(i.product, "availability") ?? (i.product.status === "operation" ? "В эксплуатации" : null) },
    { group: "Данные", label: "Источник ТТХ", value: (i) => `${SOURCE_LABEL[i.robot.specsSource]}${i.product.verified ? ", подтверждён" : ""}` },
    { group: "Данные", label: "Оговорка к цене и ТТХ", value: (i) => i.robot.note ?? null },
];

const th = "sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-400";

export function CompareTable({ items, norms, economics, scores, recommendedId, onRemove, onClear, onChoose }: Props) {
    const [onlyDiff, setOnlyDiff] = useState(true);

    const econOf = (i: CompareItem) => economics.get(i.product.id);
    const rows: Row[] = [
        ...(scores
            ? [{
                  group: "Экономика" as Group,
                  label: "Оценка подбора",
                  value: (i: CompareItem) => (scores.get(i.product.id) !== undefined ? `${scores.get(i.product.id)} / 100` : null),
                  num: (i: CompareItem) => scores.get(i.product.id) ?? null,
                  best: "max" as const,
              }]
            : []),
        ...ROWS,
    ];

    // Строка интересна, если решения в ней расходятся. Одинаковые прячем за переключателем.
    const differs = (row: Row) => new Set(items.map((i) => row.value(i, econOf(i)) ?? "—")).size > 1;
    const visible = onlyDiff ? rows.filter(differs) : rows;
    const hiddenCount = rows.length - visible.length;

    const groups: Group[] = ["Экономика", "Характеристики", "Данные"];

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Сравнение — {items.length}
                </h3>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <input
                            type="checkbox"
                            checked={onlyDiff}
                            onChange={(e) => setOnlyDiff(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 dark:border-slate-700"
                        />
                        Только различия{hiddenCount > 0 && onlyDiff ? ` (скрыто ${hiddenCount})` : ""}
                    </label>
                    <button type="button" onClick={onClear} className="text-sm font-medium text-slate-500 hover:underline dark:text-slate-400">
                        Очистить
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                            <th className={th} />
                            {items.map((i) => (
                                <th
                                    key={i.product.id}
                                    className={`px-3 py-2 text-left align-top ${
                                        i.product.id === recommendedId ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""
                                    }`}
                                >
                                    {i.product.id === recommendedId && (
                                        <span className="mb-1 inline-block rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                            рекомендуем
                                        </span>
                                    )}
                                    <div className="flex items-start gap-2">
                                        <Link to={`/robots/${i.product.id}`} className="text-sm font-semibold hover:underline">
                                            {i.product.name}
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => onRemove(i.product.id)}
                                            aria-label={`Убрать ${i.product.name} из сравнения`}
                                            className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    {groups.map((group) => {
                        const groupRows = visible.filter((r) => r.group === group);
                        if (groupRows.length === 0) return null;
                        return (
                            <tbody key={group} className="divide-y divide-slate-100 dark:divide-slate-800">
                                <tr>
                                    <td
                                        colSpan={items.length + 1}
                                        className="bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400"
                                    >
                                        {group}
                                    </td>
                                </tr>
                                {groupRows.map((row) => {
                                    const nums = row.num ? items.map((i) => row.num!(i, econOf(i))) : [];
                                    const valid = nums.filter((n): n is number => n !== null);
                                    const best =
                                        row.best && valid.length > 1 && new Set(valid).size > 1
                                            ? row.best === "min"
                                                ? Math.min(...valid)
                                                : Math.max(...valid)
                                            : null;

                                    return (
                                        <tr key={row.label}>
                                            <td className={th}>{row.label}</td>
                                            {items.map((i, n) => {
                                                const e = econOf(i);
                                                const v = row.value(i, e);
                                                const zone = row.zone?.(e) ?? null;
                                                const isBest = best !== null && nums[n] === best;
                                                const recommended = i.product.id === recommendedId;
                                                return (
                                                    <td
                                                        key={i.product.id}
                                                        className={`px-3 py-2 text-sm tabular-nums ${recommended ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""}`}
                                                    >
                                                        {v === null ? (
                                                            <span className="text-slate-400 dark:text-slate-600" title="Производитель не заявил">
                                                                —
                                                            </span>
                                                        ) : (
                                                            <span
                                                                className={
                                                                    zone
                                                                        ? `rounded px-1.5 py-0.5 font-medium ${ZONE_STYLE[zone]}`
                                                                        : isBest
                                                                          ? "rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-800 dark:bg-green-950/60 dark:text-green-300"
                                                                          : ""
                                                                }
                                                            >
                                                                {v}
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        );
                    })}

                    <tbody>
                        <tr>
                            <td className={th} />
                            {items.map((i) => (
                                <td key={i.product.id} className={`px-3 py-3 ${i.product.id === recommendedId ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""}`}>
                                    <button
                                        type="button"
                                        onClick={() => onChoose(i.product.id)}
                                        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                                    >
                                        Выбрать для расчёта
                                    </button>
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Зелёным отмечено лучшее значение в строке по одному параметру, цветом зоны — срок окупаемости
                (зелёная ≤ 2,5 года, жёлтая до 4, красная дальше). Экономика посчитана для вашей нагрузки на горизонте{" "}
                {norms.horizonYears} лет и включает ФОТ персонала, который роботы не замещают.
            </p>
        </section>
    );
}
