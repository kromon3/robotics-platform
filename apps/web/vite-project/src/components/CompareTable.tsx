import { Link } from "react-router";
import type { Product } from "../api/catalog.ts";
import { paybackZone, type Norms, type ScenarioEconomics, type Zone } from "../viz/economics";
import type { VizRobot } from "../viz/robotSpecs";
import { CompareView } from "./CompareView.tsx";
import { formatNumber, type CompareRow } from "../lib/compare";
import { DATA_GROUP, SPEC_GROUP, provenanceRows, specRows } from "../lib/product-compare";

// Сравнение решений на витрине подбора (ТЗ 3.3.7). Сначала то, ради чего сравнивают — деньги и сроки,
// потом характеристики, потом происхождение данных. По умолчанию показываем только
// строки, в которых решения различаются: одинаковые значения сравнивать незачем.
// Характеристики и происхождение данных — те же строки, что в сравнении каталога (lib/product-compare.ts).

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

const ECON_GROUP = "Экономика";
const GROUPS = [ECON_GROUP, SPEC_GROUP, DATA_GROUP];

const mln = (n: number) => `${formatNumber(n / 1e6, 1)} млн ₽`;

const ZONE_STYLE: Record<Zone, string> = {
    green: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
    yellow: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    red: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
};

export function CompareTable({ items, norms, economics, scores, recommendedId, onRemove, onClear, onChoose }: Props) {
    const econOf = (i: CompareItem) => economics.get(i.product.id);
    // Строка экономики: значение и число из расчёта сценария «покупка»
    const econ = (
        label: string,
        get: (e: ScenarioEconomics) => number,
        show: (n: number) => string,
        best: "min" | "max",
    ): CompareRow<CompareItem> => ({
        group: ECON_GROUP,
        label,
        value: (i) => {
            const e = econOf(i);
            return e ? show(get(e)) : null;
        },
        num: (i) => {
            const e = econOf(i);
            return e ? get(e) : null;
        },
        best,
    });

    const rows: CompareRow<CompareItem>[] = [
        ...(scores
            ? [
                  {
                      group: ECON_GROUP,
                      label: "Оценка подбора",
                      value: (i: CompareItem) => (scores.get(i.product.id) !== undefined ? `${scores.get(i.product.id)} / 100` : null),
                      num: (i: CompareItem) => scores.get(i.product.id) ?? null,
                      best: "max" as const,
                  },
              ]
            : []),
        {
            group: ECON_GROUP,
            label: "Срок окупаемости",
            value: (i) => {
                const e = econOf(i);
                return e?.paybackYears != null ? `${e.paybackYears} лет` : "не окупается";
            },
            num: (i) => econOf(i)?.paybackYears ?? null,
            best: "min",
            // Подсветка зоной вместо «лучшего»
            tone: (i) => {
                const zone = paybackZone(econOf(i)?.paybackYears ?? null);
                return zone ? ZONE_STYLE[zone] : null;
            },
        },
        econ("Годовой эффект", (e) => e.annualEffect, mln, "max"),
        econ("Разовые затраты", (e) => e.capex, mln, "min"),
        econ("OPEX в год", (e) => e.opex, mln, "min"),
        econ("Стоимость владения за горизонт", (e) => e.tco, mln, "min"),
        econ("Нужно роботов", (e) => e.units, (n) => `${n} шт`, "min"),
        // С учётом маршрута по складу, зарядки и коэффициента использования — по ней считается число роботов
        econ("Производительность в расчёте", (e) => e.effective, (n) => `${Math.round(n)} ед/ч`, "max"),

        ...specRows("model"),
        {
            group: SPEC_GROUP,
            label: "Нужен проход",
            value: (i) => (i.minAisle > 0 ? `≥ ${formatNumber(i.minAisle, 2)} м` : "не требуется"),
            num: (i) => i.minAisle || null,
            best: "min",
        },
        ...provenanceRows("model"),
    ];

    return (
        <CompareView
            title="Сравнение"
            items={items}
            rows={rows}
            groups={GROUPS}
            getId={(i) => i.product.id}
            getName={(i) => i.product.name}
            highlightId={recommendedId}
            defaultOnlyDiff
            onRemove={onRemove}
            onClear={onClear}
            clearLabel="Очистить"
            renderHeader={(i) => (
                <>
                    {i.product.id === recommendedId && (
                        <span className="mb-1 inline-block rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            рекомендуем
                        </span>
                    )}
                    <Link to={`/robots/${i.product.id}`} className="block text-sm font-semibold hover:underline">
                        {i.product.name}
                    </Link>
                </>
            )}
            renderFooter={(i) => (
                <button
                    type="button"
                    onClick={() => onChoose(i.product.id)}
                    className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                    Выбрать для расчёта
                </button>
            )}
            note={
                <p>
                    Зелёным со звёздочкой отмечено лучшее значение в строке по одному параметру, цветом зоны — срок окупаемости
                    (зелёная ≤ 2,5 года, жёлтая до 4, красная дальше). Экономика посчитана для вашей нагрузки на горизонте{" "}
                    {norms.horizonYears} лет и включает ФОТ персонала, который роботы не замещают.
                </p>
            }
        />
    );
}
