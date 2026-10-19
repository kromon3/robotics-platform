import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import axios from "axios";
import { RobotCard } from "../components/RobotCard.tsx";
import { CARGO_TYPES, RACK_TYPES, getInvalidFields, getMissingFields, toNumericFormData, useProjectStore } from "../store/store";
import { m, rackTier } from "../viz/rackSpecs";
import { CompareTable } from "../components/CompareTable.tsx";
import { CompareBar } from "../components/CompareBar.tsx";
import { COMPARE_LIMIT, formatNumber, toggleCompareId } from "../lib/compare";
import { RecommendedSolution } from "../components/RecommendedSolution.tsx";
import { toEconNumeric, useEconStore } from "../store/econStore";
import { fetchWarehouseProducts, rankFit, splitOffers, type Offer } from "../lib/selection";
import { DEFAULT_NORMS } from "../viz/economics";
import { toNorms } from "../viz/adapter";
import { limitsSummary, splitByLimits, toLimits, type LimitBreach } from "../viz/investmentLimits";
import type { Product } from "../api/catalog.ts";
import { toast } from "sonner";


export function ProjectOffers() {
    const navigate = useNavigate();
    const formData = useProjectStore((s) => s.formData);
    const selectProduct = useProjectStore((s) => s.selectProduct);
    const [items, setItems] = useState<Product[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showExcluded, setShowExcluded] = useState(false);
    const [showBeyond, setShowBeyond] = useState(false);
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const econ = useEconStore((s) => s.econ);
    const hasEcon = Boolean(econ.workMode);
    const compareRef = useRef<HTMLDivElement>(null);
    const othersRef = useRef<HTMLElement>(null);

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

    // Правила совместимости робот ↔ стеллаж ↔ груз + грузоподъёмность, проход и высота подъёма (ТЗ п. 3.4.2)
    const { fit, excluded } = useMemo(
        () => (items ? splitOffers(items, p) : { fit: [] as Offer[], excluded: [] as Offer[] }),
        [items, p],
    );

    // Ранжирование подходящих решений с раскладкой по факторам (ТЗ 3.4.5).
    // Ворота и время погрузки — те же, что в отчёте: число роботов совпадает на всех экранах
    const ranked = useMemo(
        () =>
            rankFit(fit, p, hasEcon ? toEconNumeric(econ) : undefined, {
                dock: econ.dockLayout,
                handlingSec: econ.handlingSec || undefined,
            }),
        [fit, p, econ, hasEcon],
    );

    // Инвестиционный коридор заказчика: бюджет и норма доходности (ТЗ 3.4.5, 3.5.7).
    // Берём из сырой формы, а не из toEconNumeric: там пустое поле превращается в 0,
    // и «не ограничиваю ROI» стало бы требованием «ROI не ниже 0%»
    const limits = useMemo(
        () =>
            hasEcon
                ? toLimits({ budget: econ.budget, targetPaybackYears: econ.targetPaybackYears, minRoiPct: econ.minRoiPct })
                : toLimits({}),
        [econ.budget, econ.targetPaybackYears, econ.minRoiPct, hasEcon],
    );
    // Ограничения ничего не удаляют: решения вне коридора уходят в отдельный список с объяснением
    const { within, beyond } = useMemo(() => splitByLimits(ranked, limits), [ranked, limits]);

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

    // Коридор пуст — рекомендуем ближайшее к нему решение и прямо говорим, чего не хватило:
    // пустой экран вместо ответа хуже, чем ответ с оговоркой
    const noneWithin = within.length === 0 && beyond.length > 0;
    const best = within[0] ?? beyond[0]?.ranked ?? null;
    const bestBreaches: LimitBreach[] = noneWithin ? (beyond[0]?.breaches ?? []) : [];
    const rest = within.length > 0 ? within.slice(1) : [];
    // Первое решение показано как рекомендация — в списке «вне коридора» его не повторяем
    const beyondRest = noneWithin ? beyond.slice(1) : beyond;
    const limitsNote = limitsSummary(limits);

    // Сравнение «это решение против рекомендованного»: ставим обе колонки и прокручиваем к таблице
    const compareWithBest = (id: string) => {
        if (!best) return;
        setCompareIds([best.item.id, id]);
        window.setTimeout(() => compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    };

    // Тот же лимит и та же логика, что в каталоге (lib/compare.ts); о лимите — сообщением, а не молча
    const toggleCompare = (id: string) => {
        const { ids, status } = toggleCompareId(compareIds, id);
        if (status === "limit") toast.warning(`Сравнить можно не больше ${COMPARE_LIMIT} решений. Уберите одно из выбранных.`);
        setCompareIds(ids);
    };

    const compareItems = compareIds
        .map((id) => fit.find((o) => o.product.id === id))
        .filter((o): o is Offer => Boolean(o));

    return (
        <div className={`flex flex-col gap-6 ${compareIds.length > 0 ? "pb-24" : ""}`}>
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
                    norms={hasEcon ? toNorms(toEconNumeric(econ), DEFAULT_NORMS, p) : DEFAULT_NORMS}
                    economics={new Map(ranked.map((r) => [r.item.id, r.economics]))}
                    scores={new Map(ranked.map((r) => [r.item.id, r.score]))}
                    recommendedId={best?.item.id}
                    onRemove={toggleCompare}
                    onClear={() => setCompareIds([])}
                    onChoose={choose}
                />
                </div>
            )}

            {/* Плашка внизу экрана: без неё таблица сравнения отрисовывается выше списка и её не видно */}
            <CompareBar
                selected={compareIds.map((id) => ({ id, name: fit.find((o) => o.product.id === id)?.product.name ?? "Решение" }))}
                compareLabel="Показать сравнение"
                onCompare={() => compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                onClear={() => setCompareIds([])}
                onRemove={toggleCompare}
            />

            {items && noneWithin && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Ни одно решение не укладывается в ваши ограничения
                    </p>
                    <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
                        Задано: {limitsNote}. Ниже — ближайшее к вашим условиям решение; чего не хватает:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-200">
                        {bestBreaches.map((b) => (
                            <li key={b.key}>— {b.label}: {b.note}</li>
                        ))}
                    </ul>
                    <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                        Поднимите бюджет или смягчите норму доходности в экономической форме — либо пересмотрите
                        параметры объекта: число роботов и разовые вложения зависят от объёма и площади.
                    </p>
                </div>
            )}

            {items && best && (
                <RecommendedSolution
                    product={best.item.offer.product}
                    robot={best.item.offer.robot}
                    score={best.score}
                    parts={best.parts}
                    economics={best.economics}
                    preliminary={!hasEcon}
                    onChoose={() => choose(best.item.offer.product.id)}
                    onCompare={() => othersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                />
            )}

            {items && (
                <>
                    <section ref={othersRef} className="scroll-mt-4">
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {best ? "Другие подходящие решения" : "Подходят"} — {rest.length} · по убыванию оценки
                            {limitsNote && !noneWithin && (
                                <span className="ml-2 font-normal normal-case text-slate-400">
                                    в пределах: {limitsNote}
                                </span>
                            )}
                        </h3>
                        {fit.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Для такого сочетания стеллажа, груза и прохода подходящих решений в каталоге нет. Попробуйте изменить параметры.
                            </p>
                        ) : rest.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                {noneWithin
                                    ? "Остальные решения — ниже, в списке вне ваших ограничений."
                                    : "В ваши ограничения уложилось только рекомендованное решение. Остальные — ниже, с объяснением, чего им не хватило."}
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {rest.map(({ item: { offer }, score, parts }, i) => {
                                    const { product, robot, minAisle: aisle } = offer;
                                    const inCompare = compareIds.includes(product.id);
                                    return (
                                        <RobotCard
                                            key={product.id}
                                            item={product}
                                            variant="showcase"
                                            robot={robot}
                                            score={{ score, rank: i + 2, parts }}
                                            extraSpec={aisle > 0 ? { label: "Нужен проход", value: `≥ ${formatNumber(aisle, 2)} м` } : undefined}
                                            compare={{
                                                checked: inCompare,
                                                full: compareIds.length >= COMPARE_LIMIT,
                                                onToggle: () => toggleCompare(product.id),
                                            }}
                                            actions={
                                                <>
                                                    {/* Самый частый сценарий сравнения — «это против рекомендованного», делаем его одной кнопкой */}
                                                    {/* Кнопка остаётся и у отмеченных (неактивной) — высота действий одна во всём ряду */}
                                                    {best && (
                                                        <button
                                                            type="button"
                                                            onClick={() => compareWithBest(product.id)}
                                                            disabled={inCompare}
                                                            className="w-full rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-default disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40 dark:disabled:border-slate-800 dark:disabled:text-slate-500"
                                                        >
                                                            {inCompare ? "В сравнении" : "Сравнить с рекомендованным"}
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => choose(product.id)}
                                                        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                                                    >
                                                        Выбрать для расчёта
                                                    </button>
                                                </>
                                            }
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {beyondRest.length > 0 && (
                        <section>
                            <button
                                type="button"
                                onClick={() => setShowBeyond((v) => !v)}
                                className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                            >
                                {showBeyond ? "▾" : "▸"} Подходят технически, но вне ваших ограничений — {beyondRest.length}
                            </button>
                            {/* Подпись видна и в свёрнутом виде: иначе непонятно, по каким условиям их отложили */}
                            {limitsNote && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Условия: {limitsNote}</p>}
                            {showBeyond && (
                                <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                                    {beyondRest.map(({ ranked: r, breaches }) => (
                                        <li key={r.item.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <Link to={`/robots/${r.item.id}`} className="font-medium hover:underline">
                                                    {r.item.offer.product.name}
                                                </Link>
                                                <span className="ml-2 text-xs text-slate-400">оценка {r.score} из 100</span>
                                            </div>
                                            <ul className="text-sm text-amber-700 dark:text-amber-400 sm:max-w-md sm:text-right">
                                                {breaches.map((b) => (
                                                    <li key={b.key}>
                                                        {b.label}: {b.note}
                                                    </li>
                                                ))}
                                            </ul>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}

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
