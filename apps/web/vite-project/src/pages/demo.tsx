import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import axios from "axios";
import type { Product } from "../api/catalog.ts";
import { productPhotoUrl } from "../api/catalog.ts";
import { DEMO_CASES, applyParams, getDemoCase, outputPerHour, staffFor, type DemoCase, type DemoParams } from "../lib/demo-cases";
import { fetchWarehouseProducts, rankFit, splitOffers } from "../lib/selection";
import { toNumericFormData, useProjectStore } from "../store/store";
import { toEconNumeric, useEconStore } from "../store/econStore";
import { useDemoStore } from "../store/demoStore";
import { PAYBACK_ZONE_HINT, computeScenario, paybackZone, verdict, type Zone } from "../viz/economics";
import { buildScenarios, normsFor, toNorms, toRobotInput, toSiteInput } from "../viz/adapter";
import { DemoSchema } from "../components/DemoSchema.tsx";

// Демо за 40 секунд (по отзыву экспертов): готовый объект, 5 ползунков — и сразу видно,
// какой робот подходит, сколько их нужно, когда окупится и как это выглядит на складе.
// Подбор, экономика и схема — те же функции, что в полном расчёте: демо не «рисует» цифры.

const mln = (n: number) => `${(n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`;
const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
const num = (n: number) => Math.round(n).toLocaleString("ru-RU");

const ZONE_TEXT: Record<Zone, string> = {
    green: "text-green-700 dark:text-green-400",
    yellow: "text-amber-700 dark:text-amber-400",
    red: "text-red-700 dark:text-red-400",
};

type SliderSpec = { key: keyof DemoParams; label: string; format: (v: number) => string };

function slidersFor(c: DemoCase): SliderSpec[] {
    return [
        { key: "area", label: "Площадь склада", format: (v) => `${num(v)} м²` },
        { key: "volume", label: c.volumeLabel, format: num },
        { key: "salary", label: "Зарплата", format: (v) => `${rub(v)} / мес` },
        { key: "shifts", label: "Смен в сутки", format: (v) => (v === 3 ? "3 — круглосуточно" : String(v)) },
    ];
}

function DemoSlider({
    spec,
    value,
    range,
    onChange,
}: {
    spec: SliderSpec;
    value: number;
    range: { min: number; max: number; step: number };
    onChange: (v: number) => void;
}) {
    return (
        <label className="block">
            <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">{spec.label}</span>
                <span className="text-base font-semibold tabular-nums">{spec.format(value)}</span>
            </span>
            <input
                type="range"
                min={range.min}
                max={range.max}
                step={range.step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="mt-1 w-full accent-indigo-600"
            />
        </label>
    );
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
    return (
        <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-slate-900/60">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
            <div className={`text-xl font-bold tracking-tight tabular-nums ${tone ?? ""}`}>{value}</div>
            {hint && <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</div>}
        </div>
    );
}

export function Demo() {
    const [searchParams, setSearchParams] = useSearchParams();
    const demoCase = getDemoCase(searchParams.get("case"));
    const [items, setItems] = useState<Product[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Старый демо-режим блокирует поля форм — здесь он не нужен, данные двигает сам пользователь
    const stopLockedDemo = useDemoStore((s) => s.stop);
    useEffect(() => stopLockedDemo(), [stopLockedDemo]);

    useEffect(() => {
        const controller = new AbortController();
        fetchWarehouseProducts(controller.signal)
            .then(setItems)
            .catch((err) => {
                if (axios.isCancel(err)) return;
                setError(err instanceof Error ? err.message : "Не удалось загрузить каталог");
            });
        return () => controller.abort();
    }, []);

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-xl font-bold tracking-tight">Что даст роботизация складу</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    Выберите пример и подвигайте параметры — платформа сама подберёт робота из каталога и посчитает экономику.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3" role="tablist" aria-label="Примеры складов">
                {DEMO_CASES.map((c) => {
                    const active = c.id === demoCase.id;
                    return (
                        <button
                            key={c.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setSearchParams({ case: c.id }, { replace: true })}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                                active
                                    ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200 dark:border-indigo-700 dark:bg-indigo-950/50 dark:ring-indigo-900"
                                    : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                            }`}
                        >
                            <span className="text-xl" aria-hidden>
                                {c.icon}
                            </span>
                            <span>
                                <span className="block text-sm font-semibold">{c.title}</span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">{c.tagline}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    Не удалось загрузить каталог решений: {error}
                </div>
            )}

            {/* key — при смене примера ползунки возвращаются к его значениям */}
            {!error && <DemoWorkspace key={demoCase.id} demoCase={demoCase} items={items} />}
        </div>
    );
}

function DemoWorkspace({ demoCase, items }: { demoCase: DemoCase; items: Product[] | null }) {
    const navigate = useNavigate();
    const [values, setValues] = useState<DemoParams>(demoCase.defaults);
    // Подбор, экономика и схема пересчитываются по отложенному значению — ползунок не дёргается
    const deferred = useDeferredValue(values);
    const stale = deferred !== values;

    const { form, econ } = useMemo(() => applyParams(demoCase, deferred), [demoCase, deferred]);

    const model = useMemo(() => {
        if (!items) return null;
        const p = toNumericFormData(form);
        const e = toEconNumeric(econ);
        const routeOpts = { dock: econ.dockLayout || undefined, handlingSec: econ.handlingSec || undefined };
        const { fit } = splitOffers(items, p);
        const ranked = rankFit(fit, p, e, routeOpts);
        // Бюджетный коридор и норма доходности (viz/investmentLimits.ts) здесь намеренно не применяются:
        // на демо-экране их нечем задать, и отсев по невидимому условию выглядел бы как ошибка подбора.
        // Эти ограничения — часть полного расчёта, где пользователь сам вводит бюджет и требуемый срок
        const best = ranked[0];
        if (!best) return { kind: "empty" as const, fitCount: 0 };

        // Экономика выбранного решения — как на странице результата, чтобы цифры совпали с полным расчётом
        const robot = toRobotInput(best.item.robot, p, e, routeOpts);
        const site = toSiteInput(p, e);
        const norms = normsFor(toNorms(e, undefined, p), robot);
        const base = computeScenario("baseline", site, robot, norms);
        const buy = computeScenario("buy", site, robot, norms);
        const raas = computeScenario("raas", site, robot, norms);
        const conclusion = verdict(base, buy, raas, norms);

        // Схема — сценарий «покупка» из того же построителя, что в отчёте
        const schema = buildScenarios(p, best.item.robot, e, undefined, routeOpts)[1];

        return { kind: "ok" as const, fitCount: fit.length, best, site, norms, base, buy, raas, conclusion, schema };
    }, [items, form, econ]);

    const set = (key: keyof DemoParams) => (v: number) => setValues((prev) => ({ ...prev, [key]: v }));
    const changed = (Object.keys(values) as (keyof DemoParams)[]).some((k) => values[k] !== demoCase.defaults[k]);

    const openFullReport = () => {
        if (model?.kind !== "ok") return;
        // Формы расчёта хранят черновик пользователя — не затираем его молча
        const current = useProjectStore.getState().formData;
        const hasDraft = current.rackType !== "" || current.cargoType !== "" || current.width !== "";
        const sameAsDemo = JSON.stringify(current) === JSON.stringify(form);
        if (
            hasDraft &&
            !sameAsDemo &&
            !window.confirm("Подробный расчёт заменит данные, которые уже введены в форме расчёта. Продолжить?")
        )
            return;
        // Полный расчёт продолжает с тех же значений: формы заполнены, робот выбран
        useProjectStore.setState({ formData: form, selectedProductId: model.best.item.id });
        useEconStore.setState({ econ });
        navigate("/projects/result");
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Итог — полосой сверху: что подобрано и что это даёт */}
            <div className={`transition-opacity ${stale ? "opacity-70" : ""}`}>
                {!model && (
                    <div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
                )}
                {model?.kind === "empty" && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                        На этих параметрах в каталоге нет совместимых решений.
                    </div>
                )}
                {model?.kind === "ok" && <DemoResult model={model} onOpenReport={openFullReport} />}
            </div>

            {/* Ползунки и схема рядом: двигаешь параметр — сразу видишь склад */}
            <div className="grid gap-3 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
                <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Параметры склада
                        </h3>
                        {changed && (
                            <button
                                type="button"
                                onClick={() => setValues(demoCase.defaults)}
                                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                                Как в примере
                            </button>
                        )}
                    </div>
                    {slidersFor(demoCase).map((spec) => (
                        <DemoSlider
                            key={spec.key}
                            spec={spec}
                            value={values[spec.key]}
                            range={demoCase.ranges[spec.key]}
                            onChange={set(spec.key)}
                        />
                    ))}
                    {/* Персонал — следствие объёма, а не ползунок: так не собрать нереальное сочетание */}
                    <div className="flex items-baseline justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{demoCase.staffLabel}</span>
                        <span className="text-right">
                            <span className="block text-base font-semibold tabular-nums">{staffFor(demoCase, values)} чел.</span>
                            <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                                по выработке {outputPerHour(demoCase)} {demoCase.opUnit}/ч на человека
                            </span>
                        </span>
                    </div>
                </section>

                <section
                    className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-4 transition-opacity dark:border-slate-800 dark:bg-slate-900 ${
                        stale ? "opacity-70" : ""
                    }`}
                >
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Как это выглядит на складе
                        </h3>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                            {num(Number(form.width))} × {num(Number(form.length))} м · роботы едут по маршрутам, время ×10
                        </span>
                    </div>
                    {model?.kind === "ok" ? (
                        <DemoSchema raw={model.schema} />
                    ) : (
                        <div className="h-72 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                    )}
                </section>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-500">
                Остальное — типовые значения примера: стеллажи, габариты груза, бюджет. В подробном расчёте их можно задать для
                своего объекта.
            </p>

            {/* Что умеет платформа — коротко, для того, кто видит её впервые */}
            <ul className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                {[
                    "Подбор по ТТХ: проход, груз, высота стеллажа",
                    "Число роботов — по маршруту на складе",
                    "Оставшийся персонал учтён в затратах",
                    "Три сценария: без роботов · покупка · RaaS",
                ].map((chip) => (
                    <li key={chip} className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                        {chip}
                    </li>
                ))}
            </ul>
        </div>
    );
}

type Model = {
    fitCount: number;
    best: ReturnType<typeof rankFit>[number];
    site: ReturnType<typeof toSiteInput>;
    norms: ReturnType<typeof toNorms>;
    base: ReturnType<typeof computeScenario>;
    buy: ReturnType<typeof computeScenario>;
    raas: ReturnType<typeof computeScenario>;
    conclusion: ReturnType<typeof verdict>;
};

function DemoResult({ model, onOpenReport }: { model: Model; onOpenReport: () => void }) {
    const { best, site, norms, base, buy, raas, conclusion, fitCount } = model;
    const product = (best.item as { offer: { product: Product } }).offer.product;
    const photo = productPhotoUrl(product.specs);
    const none = conclusion.winner === "none";
    const win = conclusion.winner === "raas" ? raas : buy;
    const saving = base.tco - win.tco;
    const remaining = Math.max(0, site.staffCount - win.replacedWorkers);

    const payback =
        conclusion.winner === "raas"
            ? { value: "без вложений", tone: ZONE_TEXT.green, hint: "подписка RaaS" }
            : win.paybackYears !== null
              ? {
                    value: `${win.paybackYears.toLocaleString("ru-RU")} г.`,
                    tone: ZONE_TEXT[paybackZone(win.paybackYears) ?? "red"],
                    hint: PAYBACK_ZONE_HINT[paybackZone(win.paybackYears) ?? "red"],
                }
              : { value: "не окупается", tone: ZONE_TEXT.red, hint: "эффект не возвращает вложения" };

    return (
        <section
            className={`rounded-2xl border-2 px-4 py-3 ${
                none
                    ? "border-red-300 bg-gradient-to-br from-red-50 to-white dark:border-red-900 dark:from-red-950/40 dark:to-slate-900"
                    : "border-indigo-300 bg-gradient-to-br from-indigo-50 to-white dark:border-indigo-800 dark:from-indigo-950/50 dark:to-slate-900"
            }`}
        >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white dark:bg-slate-800">
                    {photo ? <img src={photo} alt="" className="h-full w-full object-contain p-1" /> : <span className="text-2xl">🤖</span>}
                </div>
                {/* key — при смене подобранного робота блок коротко мигает: видно, что подбор сработал */}
                <div key={best.item.id} className="min-w-0 flex-1 motion-safe:animate-[pulse_0.8s_ease-in-out_1]">
                    <p className={`text-lg font-bold leading-tight tracking-tight ${none ? "text-red-800 dark:text-red-300" : ""}`}>
                        {conclusion.headline}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        <Link to={`/robots/${product.id}`} className="font-medium text-slate-700 hover:underline dark:text-slate-200">
                            {product.name}
                        </Link>
                        {product.company?.name ? ` · ${product.company.name}` : ""} · подобрано из {fitCount} совместимых решений,
                        оценка {best.score} из 100
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={onOpenReport}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                    >
                        Подробный расчёт →
                    </button>
                    <Link
                        to="/projects"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        Свой склад
                    </Link>
                </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Figure label="Роботов" value={`${win.units} шт`} hint={win.capex > 0 ? `вложения ${mln(win.capex)}` : "без разовых вложений"} />
                <Figure label="Окупаемость" {...payback} />
                <Figure
                    label={`Экономия за ${norms.horizonYears} лет`}
                    value={saving >= 0 ? mln(saving) : `−${mln(-saving)}`}
                    tone={saving >= 0 ? ZONE_TEXT.green : ZONE_TEXT.red}
                    hint={`${mln(base.tco)} → ${mln(win.tco)}`}
                />
                <Figure label="Персонал" value={`${site.staffCount} → ≈${Math.round(remaining)}`} hint="оставшиеся — в затратах" />
            </div>
        </section>
    );
}
