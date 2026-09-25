import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import axios from "axios";
import { RobotCard } from "../components/RobotCard.tsx";
import type { Product, ProductsResponse } from "../api/catalog.ts";
import { CARGO_TYPES, RACK_TYPES, getInvalidFields, getMissingFields, toNumericFormData, useProjectStore } from "../store/store";
import { toVizRobot, type VizRobot } from "../viz/robotSpecs";
import { checkCompat, minAisle } from "../viz/core/rules";

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
            return { product, robot, reasons, minAisle: aisle };
        });
        return {
            fit: offers.filter((o) => o.reasons.length === 0),
            excluded: offers.filter((o) => o.reasons.length > 0),
        };
    }, [items, p]);

    if (!ready) return <Navigate to="/projects" replace />;

    const rackLabel = RACK_TYPES.find((r) => r.value === p.rackType)?.label ?? "";
    const cargoLabel = CARGO_TYPES.find((c) => c.value === p.cargoType)?.label ?? "";
    const dailyOrders = p.cargoType === "pallet" ? Math.round((p.receivePalletsDay + p.shipPalletsDay) / 2) : p.pickLinesDay;
    const ordersPerHour = p.workHours > 0 ? Math.round(dailyOrders / p.workHours) : 0;
    const summary = [`${p.width} × ${p.length} м`, rackLabel, cargoLabel, `проход ${p.aisleWidth} м`, `${p.palletPlaces} паллетомест`, `${ordersPerHour} заказов/ч`];

    const choose = (id: string) => {
        selectProduct(id);
        navigate("/projects/economics");
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Link to="/projects" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
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
                    Проверено: совместимость со стеллажом и грузом, грузоподъёмность, ширина прохода. Выберите робота — построим схему склада, имитацию и три сценария.
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

            {items && (
                <>
                    <section>
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Подходят — {fit.length}
                        </h3>
                        {fit.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Для такого сочетания стеллажа, груза и прохода подходящих решений в каталоге нет. Попробуйте изменить параметры.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {fit.map(({ product, robot, minAisle: aisle }) => (
                                    // h-full: обёртка занимает всю ячейку грида, карточка (flex-1) растягивается,
                                    // блок ТТХ и кнопка встают на одну линию во всём ряду
                                    <div key={product.id} className="flex h-full flex-col gap-2">
                                        <RobotCard item={product} />
                                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                                <span>{robot.type}</span>
                                                <span>{robot.w} × {robot.l} м</span>
                                                <span>до {robot.payloadKg.toLocaleString("ru-RU")} кг</span>
                                                <span>{robot.throughputPerHour} ед/ч</span>
                                                <span className="col-span-2">{aisle > 0 ? `проход ≥ ${aisle} м` : " "}</span>
                                            </div>
                                            <div className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">{SOURCE_LABEL[robot.specsSource]}</div>
                                            <button
                                                type="button"
                                                onClick={() => choose(product.id)}
                                                className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                                            >
                                                Выбрать для расчёта
                                            </button>
                                        </div>
                                    </div>
                                ))}
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
