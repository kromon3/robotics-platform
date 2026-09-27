import { Link } from "react-router";
import type { Product } from "../api/catalog.ts";
import { robotsRequired, type Norms, type SiteInput } from "../viz/economics";
import type { VizRobot } from "../viz/robotSpecs";

// Сравнение решений (ТЗ 3.3.7): ТТХ рядом плюс то, что из них следует для объекта —
// сколько роботов нужно и во сколько встанет парк. Лучшее значение в строке подсвечивается,
// но выбор остаётся за пользователем: «лучше» здесь — только по одному параметру.

export type CompareItem = { product: Product; robot: VizRobot; minAisle: number };

type Props = {
    items: CompareItem[];
    site: SiteInput;
    norms: Norms;
    onRemove: (productId: string) => void;
    onClear: () => void;
    onChoose: (productId: string) => void;
    /** Оценка подбора по product.id — показывается отдельной строкой */
    scores?: Map<string, number>;
};

type Row = {
    label: string;
    /** Значение для показа; null — производитель не заявил */
    value: (i: CompareItem) => string | null;
    /** Числовое значение для подсветки лучшего; direction задаёт, что лучше */
    num?: (i: CompareItem) => number | null;
    best?: "min" | "max";
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
const fmt = (n: number) => n.toLocaleString("ru-RU");
// До метра показываем в миллиметрах: подъём стола 60 мм в метрах выглядит как 0,1 м
const mm = (n: number | null) => (n === null ? null : n < 1000 ? `${fmt(n)} мм` : `${(n / 1000).toFixed(1).replace(".", ",")} м`);

const SOURCE_LABEL: Record<VizRobot["specsSource"], string> = {
    specs: "каталог ТТХ",
    v0: "оценка по открытым источникам",
    "type-default": "типовые для класса",
};

const ROWS: Row[] = [
    { label: "Цена за единицу", value: (i) => (i.robot.price ? `${fmt(i.robot.price)} ₽` : null), num: (i) => i.robot.price || null, best: "min" },
    { label: "Тип", value: (i) => i.robot.type },
    { label: "Габариты (Д × Ш)", value: (i) => `${i.robot.l} × ${i.robot.w} м` },
    { label: "Грузоподъёмность", value: (i) => `${fmt(i.robot.payloadKg)} кг`, num: (i) => i.robot.payloadKg, best: "max" },
    { label: "Скорость", value: (i) => `${i.robot.speedMps} м/с`, num: (i) => i.robot.speedMps, best: "max" },
    { label: "Производительность", value: (i) => `${i.robot.throughputPerHour} ед/ч (${i.robot.throughputSource === "specs" ? "паспортная" : "типовая для класса"})`, num: (i) => i.robot.throughputPerHour, best: "max" },
    { label: "Высота подъёма", value: (i) => mm(i.robot.liftHeightMm ?? null), num: (i) => i.robot.liftHeightMm ?? null, best: "max" },
    { label: "Грузоподъёмность на высоте", value: (i) => (i.robot.liftResidualKg ? `${fmt(i.robot.liftResidualKg)} кг` : null), num: (i) => i.robot.liftResidualKg ?? null, best: "max" },
    { label: "Точность позиционирования", value: (i) => (spec(i.product, "positioning_mm") ? `± ${spec(i.product, "positioning_mm")} мм` : null), num: (i) => spec(i.product, "positioning_mm"), best: "min" },
    { label: "Работа на заряде", value: (i) => (spec(i.product, "runtime_h") ? `${spec(i.product, "runtime_h")} ч` : null), num: (i) => spec(i.product, "runtime_h"), best: "max" },
    { label: "Время зарядки", value: (i) => (spec(i.product, "charge_h") ? `${spec(i.product, "charge_h")} ч` : null), num: (i) => spec(i.product, "charge_h"), best: "min" },
    { label: "Захват", value: (i) => i.robot.gripper ?? text(i.product, "gripper") },
    { label: "Навигация", value: (i) => text(i.product, "navigation") },
    { label: "Батарея", value: (i) => text(i.product, "battery") },
    { label: "Нужен проход", value: (i) => (i.minAisle > 0 ? `≥ ${i.minAisle} м` : "не требуется"), num: (i) => i.minAisle || null, best: "min" },
    { label: "Производитель", value: (i) => i.product.company?.name ?? text(i.product, "manufacturer") },
    { label: "Статус", value: (i) => text(i.product, "availability") ?? (i.product.status === "operation" ? "В эксплуатации" : null) },
    { label: "Источник ТТХ", value: (i) => `${SOURCE_LABEL[i.robot.specsSource]}${i.product.verified ? ", подтверждён производителем" : ""}` },
    { label: "Оговорка к цене и ТТХ", value: (i) => i.robot.note ?? null },
];

const th = "sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-400";
const td = "px-3 py-2 text-sm tabular-nums";

export function CompareTable({ items, site, norms, onRemove, onClear, onChoose, scores }: Props) {
    // Следствие для объекта: сколько таких роботов закроет пиковую потребность и сколько это стоит
    const need = new Map(
        items.map((i) => {
            const units = robotsRequired(site, { name: i.robot.name, price: i.robot.price, throughputPerHour: i.robot.throughputPerHour }, norms);
            return [i.product.id, { units, fleet: units * i.robot.price }];
        }),
    );

    const rows: Row[] = [
        ...(scores
            ? [{
                  label: 'Оценка подбора',
                  value: (i: CompareItem) => (scores.get(i.product.id) !== undefined ? scores.get(i.product.id) + ' / 100' : null),
                  num: (i: CompareItem) => scores.get(i.product.id) ?? null,
                  best: 'max' as const,
              }]
            : []),
        ...ROWS,
        { label: "Требуется роботов", value: (i) => `${need.get(i.product.id)!.units} шт`, num: (i) => need.get(i.product.id)!.units, best: "min" },
        { label: "Стоимость парка", value: (i) => `${fmt(need.get(i.product.id)!.fleet)} ₽`, num: (i) => need.get(i.product.id)!.fleet || null, best: "min" },
    ];

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Сравнение — {items.length}
                </h3>
                <button type="button" onClick={onClear} className="text-sm font-medium text-slate-500 hover:underline dark:text-slate-400">
                    Очистить
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                            <th className={th} />
                            {items.map((i) => (
                                <th key={i.product.id} className="px-3 py-2 text-left align-top">
                                    <Link to={`/robots/${i.product.id}`} className="text-sm font-semibold hover:underline">
                                        {i.product.name}
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => onRemove(i.product.id)}
                                        aria-label={`Убрать ${i.product.name} из сравнения`}
                                        className="ml-2 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                                    >
                                        ×
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rows.map((row) => {
                            const nums = row.num ? items.map(row.num) : [];
                            const valid = nums.filter((n): n is number => n !== null);
                            // Подсвечиваем лучшее только если есть с чем сравнивать и значения различаются
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
                                        const v = row.value(i);
                                        const isBest = best !== null && nums[n] === best;
                                        return (
                                            <td key={i.product.id} className={td}>
                                                {v === null ? (
                                                    <span className="text-slate-400 dark:text-slate-600" title="Производитель не заявил">
                                                        —
                                                    </span>
                                                ) : (
                                                    <span className={isBest ? "rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-800 dark:bg-green-950/60 dark:text-green-300" : ""}>
                                                        {v}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        <tr>
                            <td className={th} />
                            {items.map((i) => (
                                <td key={i.product.id} className="px-3 py-3">
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
                Зелёным отмечено лучшее значение в строке по одному параметру — это не итоговая рекомендация.
                «Требуется роботов» и «стоимость парка» считаются для вашей нагрузки: {Math.round(site.inboundPerDay + site.outboundPerDay)} операций
                в сутки, коэффициент использования {norms.utilization}, резерв {Math.round(norms.capacityReserve * 100)}%. Полный CAPEX
                добавляет к парку зарядные станции, ПО, интеграцию, пусконаладку и резерв — он считается на следующем шаге.
            </p>
        </section>
    );
}
