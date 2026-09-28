import { useEffect, useState } from "react";
import { Link } from "react-router";
import axios from "axios";
import { isAuthenticated, projectsApi, type ProjectSummary } from "./api/projects.ts";
import { paybackZone, roiZone, type Zone } from "./viz/economics";

// Сводка по аккаунту: каталог доступен всем, проекты и расчёты — только после входа.

const API_URL = import.meta.env.VITE_API_URL;

const ZONE_TEXT: Record<Zone, string> = {
    green: "text-green-600 dark:text-green-400",
    yellow: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
};

type Card = {
    id: string;
    name: string;
    /** null — данные ещё грузятся, "—" — нечего показать */
    value: string | null;
    hint: string;
    /** Подсветка значения по зоне интерпретации (как на карточке расчёта) */
    zone?: Zone | null;
    to?: string;
};

const nf = new Intl.NumberFormat("ru-RU");

/** Среднее по значениям, которые реально посчитаны; null — если таких нет */
function average(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function App() {
    const authed = isAuthenticated();

    const [total, setTotal] = useState<number | null>(null);
    const [catalogFailed, setCatalogFailed] = useState(false);
    const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
    const [projectsFailed, setProjectsFailed] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        axios
            .get<{ total: number }>(`${API_URL}/catalog/products/total`, { signal: controller.signal })
            .then((response) => setTotal(response.data.total))
            .catch((error) => {
                if (axios.isCancel(error)) return;
                setCatalogFailed(true);
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!authed) return;
        let alive = true;
        projectsApi
            .list()
            .then((r) => alive && setProjects(r.items))
            .catch(() => alive && setProjectsFailed(true));
        return () => {
            alive = false;
        };
    }, [authed]);

    // Расчёт считается завершённым, когда посчитана экономика
    const withEconomics = projects?.filter((p) => p.roiPercent !== null) ?? [];
    const avgRoi = average(withEconomics.map((p) => p.roiPercent as number));
    const avgPayback = average(
        (projects ?? []).filter((p) => p.paybackYears !== null).map((p) => Number(p.paybackYears)),
    );

    // Гостю и при ошибке — прочерк, иначе скелетон висел бы бесконечно
    const projectsValue = (fn: () => string) => {
        if (!authed) return "—";
        if (projectsFailed) return "—";
        return projects === null ? null : fn();
    };

    const cards: Card[] = [
        {
            id: "projects",
            name: "Проектов",
            value: projectsValue(() => nf.format(projects!.length)),
            hint: authed
                ? projectsFailed
                    ? "не удалось загрузить"
                    : "сохранено в аккаунте"
                : "войдите, чтобы сохранять",
            to: "/calculations",
        },
        {
            id: "catalog",
            name: "Роботов в каталоге",
            value: catalogFailed ? "—" : total === null ? null : nf.format(total),
            hint: catalogFailed ? "API каталога недоступен" : "данные организатора и ТТХ производителей",
            to: "/robots",
        },
        {
            id: "calculations",
            name: "Расчётов",
            value: projectsValue(() => nf.format(withEconomics.length)),
            hint: authed
                ? projectsFailed
                    ? "не удалось загрузить"
                    : "с посчитанной экономикой"
                : "доступны после входа",
            to: "/calculations",
        },
        {
            id: "roi",
            name: "Средний ROI",
            value: projectsValue(() => (avgRoi === null ? "—" : `${Math.round(avgRoi)}%`)),
            hint:
                !authed || projectsFailed
                    ? "по сохранённым расчётам"
                    : avgPayback === null
                      ? "по сохранённым расчётам"
                      : `средняя окупаемость ${avgPayback.toFixed(1)} г.`,
            zone: avgRoi === null ? null : roiZone(Math.round(avgRoi)),
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold tracking-tight">Сводка</h2>
                <Link
                    to="/projects"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                    Новый расчёт
                </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => {
                    const body = (
                        <>
                            <div className="text-sm text-slate-500 dark:text-slate-400">{card.name}</div>
                            {card.value === null ? (
                                <div className="mt-2 h-9 w-20 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
                            ) : (
                                <div
                                    className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${
                                        card.zone ? ZONE_TEXT[card.zone] : ""
                                    }`}
                                >
                                    {card.value}
                                </div>
                            )}
                            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{card.hint}</div>
                        </>
                    );

                    const className =
                        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

                    return card.to ? (
                        <Link
                            key={card.id}
                            to={card.to}
                            className={`${className} block transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:hover:border-slate-700`}
                        >
                            {body}
                        </Link>
                    ) : (
                        <div key={card.id} className={className}>
                            {body}
                        </div>
                    );
                })}
            </div>

            {/* Последние расчёты — чтобы с главной можно было вернуться к работе */}
            {authed && projects !== null && projects.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold">Последние расчёты</h3>
                        <Link to="/calculations" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                            Все расчёты →
                        </Link>
                    </div>
                    <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                        {projects.slice(0, 5).map((p) => {
                            const payback = p.paybackYears === null ? null : Number(p.paybackYears);
                            const zone = paybackZone(payback);
                            return (
                                <li key={p.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
                                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {p.product?.name ?? "решение не выбрано"}
                                    </span>
                                    <span className={`tabular-nums text-xs ${zone ? ZONE_TEXT[zone] : "text-slate-400"}`}>
                                        {payback === null ? "—" : `${payback.toFixed(1)} г.`}
                                    </span>
                                    <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
                                        {p.roiPercent === null ? "—" : `ROI ${p.roiPercent}%`}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {authed && projects !== null && projects.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Сохранённых расчётов пока нет — пройдите визард и нажмите «Сохранить расчёт».
                    </p>
                </div>
            )}

            {!authed && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Каталог и расчёт доступны без входа. Войдите, чтобы сохранять проекты и видеть сводку по ним.
                    </p>
                    <Link to="/login" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        Войти →
                    </Link>
                </div>
            )}
        </div>
    );
}

export default App;
