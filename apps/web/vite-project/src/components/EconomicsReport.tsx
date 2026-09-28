import { useMemo, useRef, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    SOURCE_LABEL,
    budgetZone,
    computeScenario,
    paybackZone,
    roiZone,
    verdict,
    type Norms,
    type RobotInput,
    type SiteInput,
    type Zone,
} from "../viz/economics";
import type { ReportMeta } from "../lib/report-export";
import { downloadChartPng, slugify } from "../lib/chart-export";

const ZONE_STYLE: Record<Zone, string> = {
    green: "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
    yellow: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    red: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
};
const ZONE_TEXT: Record<Zone, string> = { green: "зелёная зона", yellow: "жёлтая зона", red: "красная зона" };

const money = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
// recharts передаёт ValueType — приводим к числу для форматтеров тултипов
const moneyTip = (v: unknown) => money(Number(v) || 0);
const short = (n: number) =>
    Math.abs(n) >= 1e6
        ? `${(n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн`
        : Math.abs(n) >= 1e3
          ? `${Math.round(n / 1e3)} тыс`
          : String(Math.round(n));

const card = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900";
const title = "mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const btnChart =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition " +
    "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 " +
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

type Props = { site: SiteInput; robot: RobotInput; norms: Norms; meta?: ReportMeta };

/**
 * Экономический отчёт: показатели с зонами интерпретации (§11 модели), структура CAPEX,
 * окупаемость по годам, сравнение сценариев и анализ чувствительности (§12).
 * Блоки `hidden print:block` попадают только в PDF (ТЗ 3.7.3): титул, исходные данные,
 * нормативы, источники и ограничения — чтобы выгруженный отчёт читался без приложения.
 */
export function EconomicsReport({ site: baseSite, robot: baseRobot, norms: baseNorms, meta }: Props) {
    // What-if (ТЗ 3.5.3): три параметра, от которых сильнее всего зависит вывод.
    // Считаем в браузере теми же формулами, поэтому пересчёт мгновенный.
    const [salary, setSalary] = useState(baseSite.staffSalaryMonth);
    const [utilization, setUtilization] = useState(baseNorms.utilization);
    const [price, setPrice] = useState(baseRobot.price);

    // Сброс при смене исходных данных (другой робот, другой расчёт).
    // Через setState в рендере, а не useEffect: React перезапускает рендер сразу, без лишнего кадра.
    const [syncKey, setSyncKey] = useState(`${baseSite.staffSalaryMonth}|${baseNorms.utilization}|${baseRobot.price}`);
    const nextKey = `${baseSite.staffSalaryMonth}|${baseNorms.utilization}|${baseRobot.price}`;
    if (nextKey !== syncKey) {
        setSyncKey(nextKey);
        setSalary(baseSite.staffSalaryMonth);
        setUtilization(baseNorms.utilization);
        setPrice(baseRobot.price);
    }

    const site = useMemo<SiteInput>(() => ({ ...baseSite, staffSalaryMonth: salary }), [baseSite, salary]);
    const robot = useMemo<RobotInput>(() => ({ ...baseRobot, price }), [baseRobot, price]);
    const norms = useMemo<Norms>(() => ({ ...baseNorms, utilization }), [baseNorms, utilization]);

    const whatIfChanges = [
        salary !== baseSite.staffSalaryMonth ? `зарплата ${money(baseSite.staffSalaryMonth)} → ${money(salary)}` : null,
        utilization !== baseNorms.utilization
            ? `загрузка ${Math.round(baseNorms.utilization * 100)}% → ${Math.round(utilization * 100)}%`
            : null,
        price !== baseRobot.price ? `цена робота ${money(baseRobot.price)} → ${money(price)}` : null,
    ].filter(Boolean) as string[];

    const resetWhatIf = () => {
        setSalary(baseSite.staffSalaryMonth);
        setUtilization(baseNorms.utilization);
        setPrice(baseRobot.price);
    };

    // Контейнеры диаграмм — из них вынимается <svg> при выгрузке в PNG
    const capexChart = useRef<HTMLDivElement>(null);
    const opexChart = useRef<HTMLDivElement>(null);
    const cashflowChart = useRef<HTMLDivElement>(null);

    // Какая диаграмма сейчас сохраняется (для подписи на кнопке)
    const [savingChart, setSavingChart] = useState<string | null>(null);

    const buy = useMemo(() => computeScenario("buy", site, robot, norms), [site, robot, norms]);
    const raas = useMemo(() => computeScenario("raas", site, robot, norms), [site, robot, norms]);
    const base = useMemo(() => computeScenario("baseline", site, robot, norms), [site, robot, norms]);

    // §12: как срок окупаемости реагирует на ±20% ключевых параметров
    const sensitivity = useMemo(() => {
        const variants: { label: string; low: Norms; high: Norms; site?: { low: SiteInput; high: SiteInput }; robot?: { low: RobotInput; high: RobotInput } }[] = [
            {
                label: "Цена робота ±20%",
                low: norms, high: norms,
                robot: { low: { ...robot, price: robot.price * 0.8 }, high: { ...robot, price: robot.price * 1.2 } },
            },
            {
                label: "Производительность ±20%",
                low: norms, high: norms,
                robot: { low: { ...robot, throughputPerHour: robot.throughputPerHour * 1.2 }, high: { ...robot, throughputPerHour: robot.throughputPerHour * 0.8 } },
            },
            {
                label: "Коэффициент использования 0,85 / 0,5",
                low: { ...norms, utilization: 0.85 }, high: { ...norms, utilization: 0.5 },
            },
            {
                label: "Стоимость труда ±20%",
                low: norms, high: norms,
                site: { low: { ...site, staffSalaryMonth: site.staffSalaryMonth * 1.2 }, high: { ...site, staffSalaryMonth: site.staffSalaryMonth * 0.8 } },
            },
            {
                label: "Сервис и ремонт ±30%",
                low: { ...norms, serviceShare: norms.serviceShare * 0.7, repairShare: norms.repairShare * 0.7 },
                high: { ...norms, serviceShare: norms.serviceShare * 1.3, repairShare: norms.repairShare * 1.3 },
            },
        ];
        return variants
            .map((v) => {
                const lo = computeScenario("buy", v.site?.low ?? site, v.robot?.low ?? robot, v.low).paybackYears;
                const hi = computeScenario("buy", v.site?.high ?? site, v.robot?.high ?? robot, v.high).paybackYears;
                return { label: v.label, low: lo, high: hi };
            })
            .filter((x) => x.low !== null && x.high !== null)
            .map((x) => ({ label: x.label, low: x.low!, high: x.high!, spread: Math.abs(x.high! - x.low!) }))
            .sort((a, b) => b.spread - a.spread);
    }, [site, robot, norms]);

    const pZone = paybackZone(buy.paybackYears);
    const rZone = roiZone(buy.roi);
    const bZone = budgetZone(buy.budgetShare);
    const baseYears = norms.horizonYears;

    // Накопленный денежный поток: когда пересекает ноль — точка окупаемости
    const cashflow = Array.from({ length: baseYears + 2 }, (_, y) => ({
        name: `Год ${y}`,
        buy: Math.round(-buy.capex + buy.annualEffect * y),
        raas: Math.round(-raas.capex + raas.annualEffect * y),
    }));

    // Итоговый вывод по трём сценариям — считаем там же, где и сами сценарии
    const conclusion = useMemo(() => verdict(base, buy, raas, norms), [base, buy, raas, norms]);

    const capexData = buy.capexItems.filter((i) => i.value > 0).map((i) => ({ name: i.label, value: Math.round(i.value), method: i.method, source: i.source }));
    const opexData = buy.opexItems.filter((i) => i.value > 0).map((i) => ({ name: i.label, value: Math.round(i.value), method: i.method, source: i.source }));

    const baseName = slugify(meta?.projectName ?? "raschet");
    const charts = [
        { key: "capex", label: "Структура CAPEX", ref: capexChart },
        { key: "opex", label: "Структура OPEX", ref: opexChart },
        { key: "cashflow", label: "Денежный поток", ref: cashflowChart },
    ];

    const saveChart = async (chart: (typeof charts)[number]) => {
        setSavingChart(chart.key);
        const ok = await downloadChartPng(chart.ref.current, `${baseName}-${chart.key}`);
        setSavingChart(null);
        if (!ok) alert("Диаграмма ещё не отрисована — подождите пару секунд и повторите");
    };

    const saveAllCharts = async () => {
        setSavingChart("all");
        for (const chart of charts) {
            await downloadChartPng(chart.ref.current, `${baseName}-${chart.key}`);
        }
        setSavingChart(null);
    };

    return (
        <div className="flex flex-col gap-6 print:gap-4 print:text-slate-900">
            {/* Титул — только в печатной версии */}
            {meta && (
                <header className="hidden border-b border-slate-300 pb-3 print:block">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                        Платформа подбора роботизированных решений · экспресс-оценка
                    </div>
                    <h1 className="mt-1 text-xl font-semibold">{meta.projectName}</h1>
                    <div className="mt-1 text-xs text-slate-600">
                        Объект: {meta.objectType} · Решение: {meta.robotName} · Отчёт от{" "}
                        {new Date().toLocaleString("ru-RU")}
                    </div>
                    <div className="text-xs text-slate-600">
                        Каталог v{meta.catalogVersion} · {meta.modelVersion} · ТТХ: {meta.specsSource} · производительность{" "}
                        {meta.throughputSource === "specs" ? "заявлена производителем" : "типовая для класса"}
                    </div>
                    {meta.note && <div className="mt-1 text-xs text-slate-600">Оговорка поставщика данных: {meta.note}</div>}
                </header>
            )}

            {/* What-if: пересчёт на лету, в печать не попадает — вместо него строка об изменениях */}
            <section className={`${card} print:hidden`}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Что если…
                    </h3>
                    {whatIfChanges.length > 0 && (
                        <button
                            type="button"
                            onClick={resetWhatIf}
                            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                            Вернуть исходные
                        </button>
                    )}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Slider
                        label="Зарплата оператора"
                        value={salary}
                        min={Math.round(baseSite.staffSalaryMonth * 0.5)}
                        max={Math.round(baseSite.staffSalaryMonth * 2)}
                        step={5000}
                        format={(v) => `${money(v)} / мес`}
                        onChange={setSalary}
                    />
                    <Slider
                        label="Коэффициент загрузки робота"
                        value={utilization}
                        min={0.3}
                        max={1}
                        step={0.05}
                        format={(v) => `${Math.round(v * 100)}%`}
                        onChange={setUtilization}
                    />
                    <Slider
                        label="Цена решения"
                        value={price}
                        min={Math.round(baseRobot.price * 0.5)}
                        max={Math.round(baseRobot.price * 2)}
                        step={Math.max(50_000, Math.round(baseRobot.price * 0.01))}
                        format={money}
                        onChange={setPrice}
                    />
                </div>
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                    Пересчитываются все показатели ниже, включая заключение и схему затрат. На сохранённый расчёт не влияет.
                </p>
            </section>

            {whatIfChanges.length > 0 && (
                <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    Показатели пересчитаны для изменённых параметров: {whatIfChanges.join(" · ")}
                </p>
            )}

            {/* Ключевые показатели с зонами */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Срок окупаемости" value={buy.paybackYears !== null ? `${buy.paybackYears} лет` : "—"} zone={pZone} hint="зелёная ≤ 2,5 · жёлтая 2,5–4 · красная > 4" />
                <Metric label={`ROI за ${baseYears} лет`} value={buy.roi !== null ? `${buy.roi}%` : "—"} zone={rZone} hint="зелёная ≥ 50% · жёлтая 0–50% · красная < 0" />
                <Metric label="CAPEX / бюджет" value={buy.budgetShare !== null ? `${Math.round(buy.budgetShare * 100)}%` : "—"} zone={bZone} hint={`CAPEX ${money(buy.capex)} из ${money(site.budget)}`} />
                <Metric label="Годовой эффект" value={money(buy.annualEffect)} zone={buy.annualEffect > 0 ? "green" : "red"} hint={`замещается ${buy.replacedWorkers.toFixed(1)} чел.`} />
            </div>

            {/* Сравнение сценариев */}
            <section className={card}>
                <h3 className={title}>Сравнение сценариев</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                <th className="py-2 pr-4 font-medium">Показатель</th>
                                <th className="py-2 pr-4 font-medium">Без роботизации</th>
                                <th className="py-2 pr-4 font-medium">Покупка</th>
                                <th className="py-2 font-medium">RaaS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {[
                                ["Разовые затраты", "—", money(buy.capex), money(raas.capex)],
                                ["OPEX / год", money(base.opex), money(buy.opex), money(raas.opex)],
                                ["Годовой эффект", "—", money(buy.annualEffect), money(raas.annualEffect)],
                                [`TCO за ${baseYears} лет`, money(base.tco), money(buy.tco), money(raas.tco)],
                                ["Срок окупаемости", "—", buy.paybackYears !== null ? `${buy.paybackYears} лет` : "—", raas.paybackYears !== null ? `${raas.paybackYears} лет` : "нет разовых затрат"],
                                ["Роботов", "—", `${buy.units} шт`, `${raas.units} шт`],
                            ].map(([k, a, b, c]) => (
                                <tr key={k}>
                                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{k}</td>
                                    <td className="py-2 pr-4 tabular-nums">{a}</td>
                                    <td className="py-2 pr-4 font-medium tabular-nums">{b}</td>
                                    <td className="py-2 tabular-nums">{c}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Заключение под таблицей (ТЗ 3.7.1): что выбрать и почему */}
                <div
                    className={`mt-5 rounded-xl border p-4 ${
                        conclusion.winner === "none"
                            ? ZONE_STYLE.red
                            : "border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100"
                    }`}
                >
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Заключение</div>
                    <p className="mt-1 text-base font-semibold">{conclusion.headline}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                        {conclusion.reasons.map((reason) => (
                            <li key={reason} className="flex gap-2">
                                <span aria-hidden>•</span>
                                <span>{reason}</span>
                            </li>
                        ))}
                    </ul>
                    <ul className="mt-3 space-y-1 border-t border-current/20 pt-2 text-xs opacity-80">
                        {conclusion.caveats.map((caveat) => (
                            <li key={caveat} className="flex gap-2">
                                <span aria-hidden>!</span>
                                <span>{caveat}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* CAPEX по статьям */}
                <section className={card}>
                    <h3 className={title}>Структура CAPEX — {money(buy.capex)}</h3>
                    <div className="h-64" ref={capexChart}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={capexData} layout="vertical" margin={{ left: 8, right: 16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                                <XAxis type="number" tickFormatter={short} tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={moneyTip} labelFormatter={(l) => String(l)} />
                                <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        {capexData.map((i) => (
                            <li key={i.name}>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{i.name}</span> — {money(i.value)} · {i.method} · {SOURCE_LABEL[i.source]}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* OPEX по статьям */}
                <section className={card}>
                    <h3 className={title}>Структура OPEX — {money(buy.opex)} / год</h3>
                    <div className="h-64" ref={opexChart}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={opexData} layout="vertical" margin={{ left: 8, right: 16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                                <XAxis type="number" tickFormatter={short} tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={moneyTip} />
                                <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <ul className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        {opexData.map((i) => (
                            <li key={i.name}>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{i.name}</span> — {money(i.value)} · {i.method} · {SOURCE_LABEL[i.source]}
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

            {/* Накопленный денежный поток */}
            <section className={card}>
                <h3 className={title}>Накопленный денежный поток</h3>
                <div className="h-64" ref={cashflowChart}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cashflow}>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={short} width={70} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={moneyTip} />
                            <Bar dataKey="buy" name="Покупка" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                                {cashflow.map((d, i) => (
                                    <Cell key={i} fill={d.buy >= 0 ? "#16a34a" : "#4f46e5"} />
                                ))}
                            </Bar>
                            <Bar dataKey="raas" name="RaaS" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Зелёным — годы после выхода в плюс. Амортизация в денежный поток не включена (§7 модели).
                </p>
            </section>

            {/* Чувствительность */}
            <section className={card}>
                <h3 className={title}>Анализ чувствительности — срок окупаемости, лет</h3>
                <div className="space-y-2">
                    {sensitivity.map((s) => {
                        const max = Math.max(...sensitivity.map((x) => Math.max(x.low, x.high)), buy.paybackYears ?? 1);
                        const scale = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
                        return (
                            <div key={s.label} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                                <div>
                                    <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                                    <div className="relative h-4 rounded bg-slate-100 dark:bg-slate-800">
                                        <div className="absolute inset-y-0 rounded bg-indigo-200 dark:bg-indigo-900/60" style={{ left: scale(Math.min(s.low, s.high)), right: `calc(100% - ${scale(Math.max(s.low, s.high))})` }} />
                                        <div className="absolute inset-y-0 w-0.5 bg-slate-900 dark:bg-slate-100" style={{ left: scale(buy.paybackYears ?? 0) }} />
                                    </div>
                                </div>
                                <div className="tabular-nums text-xs text-slate-600 dark:text-slate-300">
                                    {Math.min(s.low, s.high).toFixed(2)} … {Math.max(s.low, s.high).toFixed(2)}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Вертикальная линия — базовый срок {buy.paybackYears ?? "—"} лет. Параметры отсортированы по влиянию: сверху то, что двигает результат сильнее.
                </p>
            </section>

            {/* Диаграммы в PNG (ТЗ 3.7.4) — для презентации и переписки */}
            <section className={`${card} print:hidden`}>
                <h3 className={title}>Скачать диаграммы</h3>
                <div className="flex flex-wrap gap-2">
                    {charts.map((chart) => (
                        <button
                            key={chart.key}
                            type="button"
                            onClick={() => saveChart(chart)}
                            disabled={savingChart !== null}
                            className={btnChart}
                        >
                            {savingChart === chart.key ? "Сохраняю…" : chart.label}
                            <span className="ml-1 text-xs opacity-60">PNG</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={saveAllCharts}
                        disabled={savingChart !== null}
                        className={`${btnChart} border-indigo-300 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300`}
                    >
                        {savingChart === "all" ? "Сохраняю…" : "Все диаграммы"}
                    </button>
                </div>
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                    Файлы сохраняются на белом фоне в двойном разрешении и учитывают текущие значения what-if.
                    Схема склада выгружается на вкладке «Схема и имитация».
                </p>
            </section>

            {/* Приложение к PDF: исходные данные, нормативы, источники, ограничения */}
            <section className="hidden print:block">
                <h3 className={title}>Исходные данные</h3>
                <SpecTable
                    rows={[
                        ["Приёмка", `${Math.round(site.inboundPerDay)} ед/сут`],
                        ["Отгрузка", `${Math.round(site.outboundPerDay)} ед/сут`],
                        ["Режим работы", `${site.shiftsPerDay} смен × ${site.shiftHours} ч, ${site.workingDaysPerYear} дн/год`],
                        ["Пиковый коэффициент", String(site.peakFactor)],
                        ["Замещаемый персонал", `${site.staffCount} чел. × ${money(site.staffSalaryMonth)}/мес`],
                        ["Бюджет роботизации", money(site.budget)],
                        ["Решение", `${robot.name}, ${money(robot.price)} за единицу`],
                        ["Паспортная производительность", `${robot.throughputPerHour} ед/ч`],
                        ["Расчётная потребность", `${Math.round(buy.peakDemand)} ед/ч в пик → ${buy.units} роботов`],
                    ]}
                />
            </section>

            <section className="hidden print:block">
                <h3 className={title}>Нормативы и допущения</h3>
                <SpecTable
                    rows={[
                        ["Коэффициент использования робота", String(norms.utilization)],
                        ["Резерв мощности", `${Math.round(norms.capacityReserve * 100)}%`],
                        ["Выработка оператора", `${norms.workerOutputPerHour} ед/ч`],
                        ["Начисления на ФОТ", String(norms.payrollTax)],
                        ["ПО / интеграция / ПНР / ЗИП", `${Math.round(norms.softwareShare * 100)}% / ${Math.round(norms.integrationShare * 100)}% / ${Math.round(norms.commissioningShare * 1000) / 10}% / ${Math.round(norms.sparePartsShare * 100)}% от стоимости оборудования`],
                        ["Резерв проекта", `${Math.round(norms.capexReserve * 100)}%`],
                        ["Сервис / ремонт в год", `${Math.round(norms.serviceShare * 1000) / 10}% / ${Math.round(norms.repairShare * 100)}% от стоимости оборудования`],
                        ["Электроэнергия", `${norms.robotPowerKw} кВт на робота, ${norms.energyPrice} ₽/кВт·ч`],
                        ["RaaS", `${money(norms.raasMonthlyPerRobot)} за робота в месяц`],
                        ["Горизонт расчёта", `${norms.horizonYears} лет`],
                    ]}
                />
                <p className="mt-2 text-xs text-slate-600">
                    Источник каждой статьи затрат указан в разделах «Структура CAPEX» и «Структура OPEX»: КП поставщика,
                    датасет или модельное допущение. Модельные допущения заменяются данными коммерческого предложения.
                </p>
            </section>

            <section className="hidden print:block">
                <h3 className={title}>Ограничения</h3>
                <p className="text-xs leading-relaxed text-slate-700">
                    Результат — <strong>предварительная оценка, требующая верификации при обследовании объекта</strong>.
                    Модель не учитывает налоговые эффекты, дисконтирование, инфляцию, остаточную стоимость оборудования и
                    лизинг. Косвенные эффекты (рост пропускной способности, снижение ошибок, высвобождение площадей) не
                    оцениваются. Схема размещения — типовая ячейка, тиражируемая по площади, а не проект планировки.
                    {meta && ` Источники данных: каталог организатора v${meta.catalogVersion}, ТТХ — ${meta.specsSource}, ${meta.modelVersion}.`}
                </p>
            </section>
        </div>
    );
}

/** Двухколоночная таблица «параметр — значение» для печатных разделов */
function SpecTable({ rows }: { rows: [string, string][] }) {
    return (
        <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-200">
                {rows.map(([k, v]) => (
                    <tr key={k}>
                        <td className="w-1/2 py-1 pr-4 text-slate-500">{k}</td>
                        <td className="py-1 tabular-nums text-slate-800">{v}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function Metric({ label, value, zone, hint }: { label: string; value: string; zone: Zone | null; hint: string }) {
    return (
        <div className={`rounded-2xl border p-4 ${zone ? ZONE_STYLE[zone] : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
            <div className="text-xs opacity-80">{label}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
            {zone && <div className="mt-1 text-xs font-medium">{ZONE_TEXT[zone]}</div>}
            <div className="mt-1 text-[11px] opacity-70">{hint}</div>
        </div>
    );
}


type SliderProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    format: (value: number) => string;
    onChange: (value: number) => void;
};

/** Ползунок what-if: подпись, текущее значение и границы диапазона */
function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
    return (
        <label className="block">
            <span className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
                <span className="text-sm font-semibold tabular-nums">{format(value)}</span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="mt-2 w-full accent-indigo-600"
            />
            <span className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
                <span>{format(min)}</span>
                <span>{format(max)}</span>
            </span>
        </label>
    );
}
