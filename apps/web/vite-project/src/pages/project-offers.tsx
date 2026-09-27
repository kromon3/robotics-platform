import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import axios from "axios";
import { RobotCard } from "../components/RobotCard.tsx";
import type { Product, ProductsResponse } from "../api/catalog.ts";
import { CARGO_TYPES, RACK_TYPES, getInvalidFields, getMissingFields, toNumericFormData, useProjectStore } from "../store/store";
import { toVizRobot, type VizRobot } from "../viz/robotSpecs";
import { checkCompat, minAisle } from "../viz/core/rules";
import { checkLift } from "../viz/liftRules";
import { m, rackTier } from "../viz/rackSpecs";
import { CompareTable } from "../components/CompareTable.tsx";
import { ScoreBadge, ScoreBreakdown } from "../components/ScoreBreakdown.tsx";
import { rankOffers } from "../viz/ranking";
import { DEFAULT_NORMS } from "../viz/economics";
import { toSiteInput } from "../viz/adapter";

// Сколько решений можно сравнивать одновременно: больше трёх колонок таблица не держит на ноутбуке
const COMPARE_LIMIT = 3;

const API_URL = import.meta.env.VITE_API_URL;

// Кандидаты — складские сценарии каталога организатора. Дальше их фильтруют правила совместимости.
const WAREHOUSE_SCENARIOS = ["Внутрискладская логистика", "Сортировка грузов", "Внутрипроизводственная логистика"];

async function fetchWarehouseProducts(signal: AbortSignal): Promise<Product[]> {
    const pages = await Promise.all(
        WAREHOUSE_SCENARIOS.map((scenario) =>
            axios
                .get<ProductsResponse>(`${API_URL}/catalog/products`, { params: { scenario, limit: 100 }, signal })
                .then((r) => r.data.items),
        ),
    );
    const byId = new Map<string, Product>();
    for (const p of pages.flat()) byId.set(p.id, p);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

type Offer = { product: Product; robot: VizRobot; reasons: string[]; minAisle: number };

const SOURCE_LABEL: Record<VizRobot["specsSource"], string> = {
    specs: "ТТХ из каталога",
    v0: "ТТХ: оценка по открытым источникам",
    "type-default": "ТТХ: типовые для класса",
};

export function ProjectOffers() {
    const navigate = useNavigate();
    const formData = useProjectStore((s) => s.formData);
    const selectProduct = useProjectStore((s) => s.selectProduct);
    const [items, setItems] = useState<Product[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showExcluded, setShowExcluded] = useState(false);
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const compareRef = useRef<HTMLDivElement>(null);

    const ready = getMissingFields(formData).length === 0 && getInvalidFields(formData).length === 0;

    useEffect(() => {
        if (!ready) return;
        const controller = new AbortController();
        fetchWarehouseProducts(controller.signal)
            .then(setItems)
            .catch((err) => {
                if (axios.isCancel(err)) return;
                setError(err instanceof Error ? err.message : "Что-то пошло не так");
            });
        return () => controller.abort();
    }, [ready]);

    const p = useMemo(() => toNumericFormData(formData), [formData]);

    // Правила совместимости робот ↔ стеллаж ↔ груз (из warehouse-viz/rules.js) + грузоподъёмность + проход.
    // reasons пустой — подходит; иначе — объяснение, почему исключён (ТЗ п. 3.4.2).
    const { fit, excluded } = useMemo(() => {
        if (!items) return { fit: [] as Offer[], excluded: [] as Offer[] };
        const cargo =
            p.cargoType === "pallet"
                ? { type: "pallet", unit: { l: p.pallet.L / 1000, w: p.pallet.W / 1000, h: p.pallet.H / 1000, massKg: p.palletMass }, oversizeShare: p.oversizeShare / 100 }
                : p.cargoType === "long"
                  ? { type: "long", unit: { l: 6, w: 0.6, h: 0.4, massKg: Math.max(p.skuMass, 150) }, oversizeShare: p.oversizeShare / 100 }
                  : { type: "box", unit: { l: p.sku.L / 1000, w: p.sku.W / 1000, h: p.sku.H / 1000, massKg: p.skuMass }, oversizeShare: p.oversizeShare / 100 };

        const offers: Offer[] = items.map((product) => {
            const robot = toVizRobot(product);
            const reasons: string[] = product.type === "software"
                ? ["Программное обеспечение, а не робот — учитывается отдельно"]
                : checkCompat(robot, p.rackType, cargo);
            const aisle = robot.type === "ASRS" ? 0 : minAisle(robot, cargo);
            if (aisle > p.aisleWidth + 0.5)
                reasons.push(`Нужен проход не уже ${aisle} м, у вас ${p.aisleWidth} м`);
            // Паспортная высота подъёма против высоты верхнего яруса выбранного стеллажа
            if (product.type !== "software")
                reasons.push(...checkLift(robot, p.rackType, p.cargoType, cargo.unit.massKg));
            return { product, robot, reasons, minAisle: aisle };
        });
        return {
            fit: offers.filter((o) => o.reasons.length === 0),
            excluded: offers.filter((o) => o.reasons.length > 0),
        };
    }, [items, p]);

    // Ранжирование подходящих решений с раскладкой по факторам (ТЗ 3.4.5)
    const ranked = useMemo(() => {
        const cargoMass = p.cargoType === "pallet" ? p.palletMass : p.cargoType === "long" ? Math.max(p.skuMass, 150) : p.skuMass;
        return rankOffers(
            fit.map((o) => ({
                id: o.product.id,
                robot: o.robot,
                minAisle: o.minAisle,
                status: o.product.status,
                ugt: o.product.ugt,
                verified: o.product.verified,
                offer: o,
            })),
            toSiteInput(p),
            DEFAULT_NORMS,
            cargoMass,
            p.aisleWidth,
        );
    }, [fit, p]);

    if (!ready) return <Navigate to="/projects/warehouse" replace />;

    const rackLabel = RACK_TYPES.find((r) => r.value === p.rackType)?.label ?? "";
    const cargoLabel = CARGO_TYPES.find((c) => c.value === p.cargoType)?.label ?? "";
    const dailyOrders = p.cargoType === "pallet" ? Math.round((p.receivePalletsDay + p.shipPalletsDay) / 2) : p.pickLinesDay;
    const ordersPerHour = p.workHours > 0 ? Math.round(dailyOrders / p.workHours) : 0;
    const tier = rackTier(p.rackType, p.cargoType);
    const summary = [
        `${p.width} × ${p.length} м`,
        rackLabel,
        cargoLabel,
        `проход ${p.aisleWidth} м`,
        `${p.palletPlaces} паллетомест`,
        `${ordersPerHour} заказов/ч`,
        ...(tier ? [`верхний ярус ${m(tier.topTierMm)} м`] : []),
    ];

    const choose = (id: string) => {
        selectProduct(id);
        navigate("/projects/economics");
    };

    const toggleCompare = (id: string) =>
        setCompareIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= COMPARE_LIMIT ? prev : [...prev, id],
        );

    const compareItems = compareIds
        .map((id) => fit.find((o) => o.product.id === id))
        .filter((o): o is Offer => Boolean(o));

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Link to="/projects/warehouse" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                    ← Изменить параметры
                </Link>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Подходящие решения</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {summary.map((s) => (
                        <span key={s} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {s}
                        </span>
                    ))}
                </div>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Проверено: совместимость со стеллажом и грузом, грузоподъёмность, ширина прохода, высота подъёма до верхнего яруса и грузоподъёмность на высоте.
                    Подходящие решения отсортированы по оценке из 100 баллов — у каждой карточки видно, из чего она сложилась. Выберите робота — построим схему склада, имитацию и три сценария.
                </p>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    Не удалось загрузить решения: {error}
                </div>
            )}

            {items === null && !error && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
                    ))}
                </div>
            )}

            {compareItems.length > 1 && (
                <div ref={compareRef} className="scroll-mt-4">
                <CompareTable
                    items={compareItems}
                    site={toSiteInput(p)}
                    norms={DEFAULT_NORMS}
                    onRemove={toggleCompare}
                    onClear={() => setCompareIds([])}
                    onChoose={choose}
                    scores={new Map(ranked.map((r) => [r.item.id, r.score]))}
                />
                </div>
            )}

            {/* Плашка внизу экрана: без неё таблица сравнения отрисовывается выше списка и её не видно */}
            {compareIds.length > 0 && (
                <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 print:hidden">
                    <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                            К сравнению: {compareIds.length} из {COMPARE_LIMIT}
                        </span>
                        {compareItems.length > 1 ? (
                            <button
                                type="button"
                                onClick={() => compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                                className="rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                            >
                                Показать сравнение
                            </button>
                        ) : (
                            <span className="text-sm text-slate-400 dark:text-slate-500">отметьте ещё одно решение</span>
                        )}
                        <button
                            type="button"
                            onClick={() => setCompareIds([])}
                            aria-label="Очистить сравнение"
                            className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {items && (
                <>
                    <section>
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Подходят — {fit.length} · по убыванию оценки
                        </h3>
                        {fit.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Для такого сочетания стеллажа, груза и прохода подходящих решений в каталоге нет. Попробуйте изменить параметры.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {ranked.map(({ item: { offer }, score, parts }, i) => {
                                    const { product, robot, minAisle: aisle } = offer;
                                    return (
                                    // h-full: обёртка занимает всю ячейку грида, карточка (flex-1) растягивается,
                                    // блок ТТХ и кнопка встают на одну линию во всём ряду
                                    <div key={product.id} className="flex h-full flex-col gap-2">
                                        <RobotCard item={product} />
                                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                                            <div className="mb-2">
                                                <ScoreBadge score={score} rank={i + 1} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                                <span>{robot.type}</span>
                                                <span>{robot.w} × {robot.l} м</span>
                                                <span>до {robot.payloadKg.toLocaleString("ru-RU")} кг</span>
                                                <span title={robot.throughputSource === "specs" ? "заявлена производителем" : "типовое значение для класса"}>
                                                    {robot.throughputPerHour} ед/ч{robot.throughputSource === "specs" ? "" : " ≈"}
                                                </span>
                                                <span className="col-span-2">{aisle > 0 ? `проход ≥ ${aisle} м` : " "}</span>
                                            </div>
                                            <div className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">{SOURCE_LABEL[robot.specsSource]}</div>
                                            {robot.note && (
                                                <p className="mt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-400" title={robot.note}>
                                                    ⚠ {robot.note.length > 90 ? robot.note.slice(0, 90) + "…" : robot.note}
                                                </p>
                                            )}
                                            <ScoreBreakdown parts={parts} />
                                            <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                                <input
                                                    type="checkbox"
                                                    checked={compareIds.includes(product.id)}
                                                    onChange={() => toggleCompare(product.id)}
                                                    disabled={!compareIds.includes(product.id) && compareIds.length >= COMPARE_LIMIT}
                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 disabled:opacity-40 dark:border-slate-700"
                                                />
                                                Сравнить
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => choose(product.id)}
                                                className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                                            >
                                                Выбрать для расчёта
                                            </button>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {excluded.length > 0 && (
                        <section>
                            <button
                                type="button"
                                onClick={() => setShowExcluded((v) => !v)}
                                className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                            >
                                {showExcluded ? "▾" : "▸"} Исключены — {excluded.length}
                            </button>
                            {showExcluded && (
                                <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                                    {excluded.map(({ product, robot, reasons }) => (
                                        <li key={product.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <Link to={`/robots/${product.id}`} className="font-medium hover:underline">
                                                    {product.name}
                                                </Link>
                                                <span className="ml-2 text-xs text-slate-400">{robot.type}</span>
                                            </div>
                                            <ul className="text-sm text-red-700 dark:text-red-400 sm:max-w-md sm:text-right">
                                                {reasons.map((r) => (
                                                    <li key={r}>{r}</li>
                                                ))}
                                            </ul>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
