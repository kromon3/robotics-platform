import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import axios from "axios";
import {
    PRODUCT_STATUS_LABELS,
    PRODUCT_TYPE_LABELS,
    type ProductDetail,
    type ProductStatus,
} from "../api/catalog.ts";

const API_URL = import.meta.env.VITE_API_URL;

const statusStyles: Record<ProductStatus, string> = {
    operation: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    piloting: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    rnd: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
};

const chipClass =
    "rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300";
const sectionClass =
    "rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900";
const sectionTitleClass = "mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

function formatPrice(price: string | null) {
    if (!price) return "Цена по запросу";
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(
        Number(price),
    );
}

export function RobotDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [robot, setRobot] = useState<ProductDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<"not_found" | string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get<ProductDetail>(`${API_URL}/catalog/products/${id}`, {
                    signal: controller.signal,
                });
                setRobot(response.data);
            } catch (err) {
                if (axios.isCancel(err)) return;
                if (axios.isAxiosError(err) && err.response?.status === 404) setError("not_found");
                else setError(err instanceof Error ? err.message : "Что-то пошло не так");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        fetchData();
        return () => controller.abort();
    }, [id]);

    // «Назад» ведёт в каталог с теми же фильтрами, если пришли оттуда; иначе — просто в каталог
    const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/robots"));

    if (loading) {
        return (
            <div className="mx-auto max-w-5xl animate-pulse space-y-4">
                <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-9 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
        );
    }

    if (error === "not_found" || !robot) {
        return (
            <div className="mx-auto max-w-5xl py-16 text-center">
                <h2 className="text-xl font-semibold">Решение не найдено</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {error === "not_found" ? "Возможно, оно удалено из каталога." : error}
                </p>
                <Link to="/robots" className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline">
                    ← В каталог
                </Link>
            </div>
        );
    }

    const industries = robot.productIndustries.map((x) => x.industry.name);
    const scenarios = robot.productScenarios.map((x) => x.scenario.name);
    const specs = Object.entries(robot.specs ?? {});
    const potential = robot.marketPotential ?? 0;

    return (
        <div className="mx-auto max-w-5xl">
            <button
                type="button"
                onClick={goBack}
                className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
                ← Каталог
            </button>

            {/* Шапка */}
            <div className="mb-6">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[robot.status]}`}>
                        {PRODUCT_STATUS_LABELS[robot.status]}
                    </span>
                    <span className={chipClass}>{PRODUCT_TYPE_LABELS[robot.type]}</span>
                    {robot.category && <span className={chipClass}>{robot.category}</span>}
                    {robot.subtype && <span className={chipClass}>{robot.subtype}</span>}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{robot.name}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {robot.company.website ? (
                        <a
                            href={robot.company.website}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-slate-700 hover:underline dark:text-slate-200"
                        >
                            {robot.company.name}
                        </a>
                    ) : (
                        <span className="font-medium text-slate-700 dark:text-slate-200">{robot.company.name}</span>
                    )}
                    {robot.company.region && <> · {robot.company.region}</>}
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                {/* Основная колонка */}
                <div className="space-y-6">
                    <section className={sectionClass}>
                        <h2 className={sectionTitleClass}>Описание</h2>
                        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                            {robot.description ?? "Описание не указано."}
                        </p>
                    </section>

                    {(industries.length > 0 || scenarios.length > 0) && (
                        <section className={sectionClass}>
                            <h2 className={sectionTitleClass}>Применение</h2>
                            {industries.length > 0 && (
                                <div className="mb-3">
                                    <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">Отрасли</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {industries.map((name) => (
                                            <span key={name} className={chipClass}>{name}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {scenarios.length > 0 && (
                                <div>
                                    <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">Сценарии</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {scenarios.map((name) => (
                                            <span key={name} className={chipClass}>{name}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    <section className={sectionClass}>
                        <h2 className={sectionTitleClass}>Технические характеристики</h2>
                        {specs.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                ТТХ уточняются. Данные будут добавлены после верификации по открытым источникам.
                            </p>
                        ) : (
                            <dl className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                                {specs.map(([key, value]) => (
                                    <div key={key} className="flex justify-between gap-4 py-2">
                                        <dt className="text-slate-500 dark:text-slate-400">{key}</dt>
                                        <dd className="text-right font-medium">{String(value)}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </section>

                    <section className={sectionClass}>
                        <h2 className={sectionTitleClass}>Кейсы внедрения</h2>
                        {robot.cases.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">Кейсов пока нет.</p>
                        ) : (
                            <ul className="space-y-3">
                                {robot.cases.map((c) => (
                                    <li
                                        key={c.id}
                                        className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                                    >
                                        {c.customer && (
                                            <p className="mb-1 font-medium text-slate-900 dark:text-slate-100">{c.customer}</p>
                                        )}
                                        <p>{c.description}</p>
                                        {c.resultMetrics && (
                                            <p className="mt-2 text-xs text-green-700 dark:text-green-400">{c.resultMetrics}</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>

                {/* Сайдбар */}
                <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
                    <div className={sectionClass}>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Стоимость</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight">{formatPrice(robot.price)}</p>

                        <dl className="mt-4 space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                                <dt className="text-slate-500 dark:text-slate-400">УГТ</dt>
                                <dd className="font-medium">{robot.ugt ?? "—"} / 9</dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-slate-500 dark:text-slate-400">Рыночный потенциал</dt>
                                <dd className="font-medium tracking-wider text-amber-500" title={`${potential} из 5`}>
                                    {"★".repeat(potential)}
                                    <span className="text-slate-300 dark:text-slate-700">{"★".repeat(5 - potential)}</span>
                                </dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt className="text-slate-500 dark:text-slate-400">Данные</dt>
                                <dd>
                                    {robot.verified ? (
                                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                            Подтверждены
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                            Требуют проверки
                                        </span>
                                    )}
                                </dd>
                            </div>
                            {robot.sourceUrl && (
                                <div className="flex items-center justify-between">
                                    <dt className="text-slate-500 dark:text-slate-400">Источник</dt>
                                    <dd>
                                        <a
                                            href={robot.sourceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-indigo-600 hover:underline dark:text-indigo-400"
                                        >
                                            открыть
                                        </a>
                                    </dd>
                                </div>
                            )}
                        </dl>

                        <button
                            type="button"
                            disabled
                            title="Появится вместе с визардом расчёта"
                            className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Добавить в расчёт
                        </button>
                    </div>

                    <p className="px-1 text-xs text-slate-400 dark:text-slate-500">
                        Каталог v{robot.catalogVersion} · данные организатора
                    </p>
                </aside>
            </div>
        </div>
    );
}
