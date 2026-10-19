import { Link } from "react-router";
import type { Product } from "../api/catalog.ts";
import { paybackZone, type ScenarioEconomics, type Zone } from "../viz/economics";
import type { VizRobot } from "../viz/robotSpecs";
import { hasMeaningfulWeakness, strengths, weakest, type ScorePart } from "../viz/ranking";

// Решение, которое платформа предлагает сама: лучшая итоговая оценка среди совместимых
// (экономика — половина баллов, остальное — готовность, запас по ТТХ и достоверность данных).
// Пользователь видит цифры и причину выбора сразу, а дальше может уйти к остальным решениям.

type Props = {
    product: Product;
    robot: VizRobot;
    score: number;
    parts: ScorePart[];
    economics: ScenarioEconomics;
    /** Экономика посчитана на типовых значениях: данные объекта ещё не введены */
    preliminary: boolean;
    onChoose: () => void;
    onCompare: () => void;
};

const money = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
const mln = (n: number) => `${(n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`;

const ZONE_TEXT: Record<Zone, string> = {
    green: "text-green-700 dark:text-green-400",
    yellow: "text-amber-700 dark:text-amber-400",
    red: "text-red-700 dark:text-red-400",
};

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
    return (
        <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/60">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
            <div className={`mt-0.5 text-xl font-semibold tracking-tight ${tone ?? ""}`}>{value}</div>
            {hint && <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{hint}</div>}
        </div>
    );
}

export function RecommendedSolution({ product, robot, score, parts, economics, preliminary, onChoose, onCompare }: Props) {
    const { units, capex, annualEffect, paybackYears, tco } = economics;
    const zone = paybackZone(paybackYears);
    const reasons = strengths(parts, 2);
    const weak = hasMeaningfulWeakness(parts) ? weakest(parts) : null;

    return (
        <section className="rounded-2xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-white p-5 dark:border-indigo-800 dark:from-indigo-950/50 dark:to-slate-900">
            <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    Рекомендуем
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    лучшая оценка среди совместимых решений · {score} из 100
                </span>
            </div>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link to={`/robots/${product.id}`} className="text-xl font-bold tracking-tight hover:underline">
                    {product.name}
                </Link>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                    {robot.type} · {product.company?.name ?? "производитель не указан"}
                </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Figure
                    label="Срок окупаемости"
                    value={paybackYears !== null ? `${paybackYears} лет` : "не окупается"}
                    tone={zone ? ZONE_TEXT[zone] : undefined}
                    hint={`TCO за горизонт — ${mln(tco)}`}
                />
                <Figure label="Нужно роботов" value={`${units} шт`} hint={`${money(robot.price)} за единицу`} />
                <Figure label="Разовые затраты" value={mln(capex)} hint="роботы, зарядки, ПО, интеграция, ПНР" />
                <Figure
                    label="Годовой эффект"
                    value={mln(annualEffect)}
                    hint={`замещается ${economics.replacedWorkers.toFixed(1)} чел.`}
                />
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Почему это решение
                    </div>
                    <ul className="mt-1 space-y-1 text-slate-700 dark:text-slate-300">
                        {reasons.map((r) => (
                            <li key={r.key} className="flex gap-2">
                                <span className="text-indigo-500">•</span>
                                <span>
                                    {r.label.toLowerCase()}: {r.note}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        На что обратить внимание
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">
                        {weak ? `${weak.label.toLowerCase()}: ${weak.note}` : "существенных недостатков среди подходящих решений нет"}
                    </p>
                </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={onChoose}
                    className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                    Рассчитать с этим решением →
                </button>
                <button
                    type="button"
                    onClick={onCompare}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    Посмотреть другие решения
                </button>
            </div>

            {preliminary && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Экономика предварительная: режим работы, персонал и бюджет ещё не введены, расчёт идёт на типовых
                    значениях демо-склада. После ввода данных на следующем шаге показатели пересчитаются.
                </p>
            )}
        </section>
    );
}
