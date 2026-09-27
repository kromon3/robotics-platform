import { useState } from "react";
import { useNavigate } from "react-router";
import { OBJECT_TYPES, type ObjectTypeKey } from "../lib/object-types";

// Точка входа в новый расчёт: выбор типа объекта (ТЗ 3.2.1).
// Склад ведёт в визард параметров, остальные — на экран «в разработке».

const DELAY_MS = 420; // столько длится анимация выбора до перехода

export function ProjectStart() {
    const navigate = useNavigate();
    const [chosen, setChosen] = useState<ObjectTypeKey | null>(null);

    const choose = (key: ObjectTypeKey, ready: boolean) => {
        if (chosen) return;
        setChosen(key);
        window.setTimeout(() => navigate(ready ? "/projects/warehouse" : `/projects/soon/${key}`), DELAY_MS);
    };

    return (
        <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center py-6">
            <div className="text-center">
                <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                    Новый расчёт
                </span>
                <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Какой объект роботизируем?</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    От типа объекта зависят входные параметры, доступные решения и модель процессов.
                    Экономика, источники данных и правила подбора — общие для всех типов.
                </p>
            </div>

            <div className="mt-10 grid w-full max-w-5xl gap-5 sm:grid-cols-3">
                {OBJECT_TYPES.map(({ key, name, tagline, bullets, ready, accent, Icon }) => {
                    const isChosen = chosen === key;
                    const dimmed = chosen !== null && !isChosen;

                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => choose(key, ready)}
                            aria-label={`Выбрать объект: ${name}`}
                            className={[
                                "group relative flex flex-col overflow-hidden rounded-2xl border bg-white p-6 text-left",
                                "transition-all duration-300 ease-out motion-reduce:transition-none",
                                "dark:bg-slate-900",
                                isChosen
                                    ? `scale-[1.03] ring-2 shadow-xl ${accent.ring} ${accent.glow}`
                                    : "border-slate-200 shadow-sm hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:hover:border-slate-700",
                                dimmed ? "scale-[0.97] opacity-40" : "",
                            ].join(" ")}
                        >
                            {/* Мягкое свечение под курсором — появляется на hover и при выборе */}
                            <span
                                aria-hidden
                                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl transition-opacity duration-300 ${accent.icon} ${
                                    isChosen ? "opacity-60" : "opacity-0 group-hover:opacity-40"
                                }`}
                            />

                            <span
                                className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 motion-reduce:transform-none ${accent.icon} ${
                                    isChosen ? "scale-110" : ""
                                }`}
                            >
                                <Icon className="h-7 w-7" />
                            </span>

                            <span className="mt-5 flex items-center gap-2">
                                <span className="text-lg font-semibold tracking-tight">{name}</span>
                                {!ready && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                        в разработке
                                    </span>
                                )}
                            </span>
                            <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">{tagline}</span>

                            <ul className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                                {bullets.map((b) => (
                                    <li key={b} className="flex gap-2">
                                        <span className={accent.text}>•</span>
                                        {b}
                                    </li>
                                ))}
                            </ul>

                            <span className={`mt-5 text-sm font-semibold ${accent.text}`}>
                                {ready ? "Начать расчёт →" : "Что уже готово →"}
                            </span>

                            {/* Полоса заполнения на время перехода — видно, что выбор принят */}
                            <span
                                aria-hidden
                                className={`absolute inset-x-0 bottom-0 h-1 origin-left bg-current transition-transform duration-500 ease-out motion-reduce:transition-none ${accent.text} ${
                                    isChosen ? "scale-x-100" : "scale-x-0"
                                }`}
                            />
                        </button>
                    );
                })}
            </div>

            <p className="mt-8 text-xs text-slate-400 dark:text-slate-500">
                Каталог решений и расчёт доступны без входа — авторизация нужна, чтобы сохранять расчёты.
            </p>
        </div>
    );
}
