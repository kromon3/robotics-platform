import { useEffect, useMemo, useRef, useState } from "react";
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
import { routeExplanation, type RouteOptions, type RoutedRobotInput } from "../viz/adapter";
import { DOCK_LABEL, type DockLayout } from "../viz/routeModel";
import { downloadChartPng, slugify } from "../lib/chart-export";
import { DecisionSummary } from "./DecisionSummary.tsx";

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
// Колонка выгоднейшего сценария выделяется, чтобы вывод читался прямо из таблицы
const winnerHead = "rounded-t-lg bg-indigo-50 px-2 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100";
const winnerCell = "bg-indigo-50/60 px-2 dark:bg-indigo-950/30";
const winnerBadge = "ml-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white";
const title = "mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const btnChart =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition " +
    "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 " +
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

/** Значения, по которым отчёт посчитан прямо сейчас — с учётом ползунков «что если» */
export type ReportInputs = { site: SiteInput; robot: RobotInput; norms: Norms; changes: string[] };

/** Расположение ворот и время погрузки: хранятся в форме экономики, отчёт их показывает и меняет */
export type PlacementProps = {
    dock: DockLayout;
    handlingSec: number;
    /** Робот для варианта размещения — тем же toRobotInput, что и основной расчёт */
    robotFor: (opts: RouteOptions) => RoutedRobotInput;
    speedMps: number;
    size: { width: number; length: number };
    onChange: (patch: { dockLayout?: DockLayout; handlingSec?: number }) => void;
};

type Props = {
    site: SiteInput;
    robot: RobotInput;
    norms: Norms;
    meta?: ReportMeta;
    /** Чтобы выгрузка в Excel собиралась по тем же значениям, что показаны на экране */
    onInputsChange?: (inputs: ReportInputs) => void;
    /** Модель маршрута; нет — робот стационарный или не хватает габаритов, блок не показывается */
    placement?: PlacementProps;
};

const DOCKS: DockLayout[] = ["center", "corner"];

// Якорь подробного расчёта — на него ссылается итог наверху
const DETAILS_ID = "report-details";

/**
 * Экономический отчёт: показатели с зонами интерпретации (§11 модели), структура CAPEX,
 * окупаемость по годам, сравнение сценариев и анализ чувствительности (§12).
 * Блоки `hidden print:block` попадают только в PDF (ТЗ 3.7.3): титул, исходные данные,
 * нормативы, источники и ограничения — чтобы выгруженный отчёт читался без приложения.
 */
export function EconomicsReport({ site: baseSite, robot: baseRobot, norms: baseNorms, meta, onInputsChange, placement }: Props) {
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

    // useMemo, а не просто массив: ссылка уходит в зависимости эффекта ниже
    const whatIfChanges = useMemo(
        () =>
            [
                salary !== baseSite.staffSalaryMonth ? `зарплата ${money(baseSite.staffSalaryMonth)} → ${money(salary)}` : null,
                utilization !== baseNorms.utilization
                    ? `загрузка ${Math.round(baseNorms.utilization * 100)}% → ${Math.round(utilization * 100)}%`
                    : null,
                price !== baseRobot.price ? `цена робота ${money(baseRobot.price)} → ${money(price)}` : null,
            ].filter(Boolean) as string[],
        [salary, utilization, price, baseSite.staffSalaryMonth, baseNorms.utilization, baseRobot.price],
    );

    const resetWhatIf = () => {
        setSalary(baseSite.staffSalaryMonth);
        setUtilization(baseNorms.utilization);
        setPrice(baseRobot.price);
    };

    // Отдаём наверх текущие значения: по ним собирается Excel, чтобы выгрузка не расходилась с экраном
    useEffect(() => {
        onInputsChange?.({ site, robot, norms, changes: whatIfChanges });
    }, [onInputsChange, site, robot, norms, whatIfChanges]);

    // Контейнеры диаграмм — из них вынимается <svg> при выгрузке в PNG
    const capexChart = useRef<HTMLDivElement>(null);
    const opexChart = useRef<HTMLDivElement>(null);
    const cashflowChart = useRef<HTMLDivElement>(null);

    // Какая диаграмма сейчас сохраняется (для подписи на кнопке)
    const [savingChart, setSavingChart] = useState<string | null>(null);

    const buy = useMemo(() => computeScenario("buy", site, robot, norms), [site, robot, norms]);
    const raas = useMemo(() => computeScenario("raas", site, robot, norms), [site, robot, norms]);
    const base = useMemo(() => computeScenario("baseline", site, robot, norms), [site, robot, norms]);

    // Варианты размещения ворот: тот же расчёт, меняется только средний пробег робота.
    // Цена и загрузка — с учётом ползунков, чтобы таблица не расходилась с показателями ниже
    const placementRows = useMemo(() => {
        if (!placement) return [];
        return DOCKS.map((dock) => {
            const r = placement.robotFor({ dock, handlingSec: placement.handlingSec });
            const e = computeScenario("buy", site, { ...r, price }, norms);
            return { dock, route: r.route, perHour: r.throughputPerHour, units: e.units, capex: e.capex, payback: e.paybackYears };
        });
    }, [placement, site, norms, price]);
    const routed = robot as Partial<RoutedRobotInput>;

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

            {/* Итог для того, кто принимает решение: что выбрать и почему — первым */}
            <DecisionSummary
                base={base}
                buy={buy}
                raas={raas}
                conclusion={conclusion}
                site={site}
                norms={norms}
                detailsId={DETAILS_ID}
            />

            {whatIfChanges.length > 0 && (
                <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    Показатели пересчитаны для изменённых параметров: {whatIfChanges.join(" · ")}
                </p>
            )}

            {/* Сравнение сценариев */}
            <section id={DETAILS_ID} className={`${card} scroll-mt-4`}>
                <h3 className={title}>Сравнение сценариев</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                <th className="py-2 pr-4 font-medium">Показатель</th>
                                <th className="py-2 pr-4 font-medium">Без роботизации</th>
                                <th className={`py-2 pr-4 font-medium ${conclusion.winner === "buy" ? winnerHead : ""}`}>
                                    Покупка {conclusion.winner === "buy" && <span className={winnerBadge}>выгоднее</span>}
                                </th>
                                <th className={`py-2 font-medium ${conclusion.winner === "raas" ? winnerHead : ""}`}>
                                    RaaS {conclusion.winner === "raas" && <span className={winnerBadge}>выгоднее</span>}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {[
                                { k: "Разовые затраты", a: "—", b: money(buy.capex), c: money(raas.capex), hint: "что платим сразу" },
                                { k: "OPEX / год", a: money(base.opex), b: money(buy.opex), c: money(raas.opex), hint: "включая ФОТ оставшегося персонала" },
                                { k: "Годовой эффект", a: "—", b: money(buy.annualEffect), c: money(raas.annualEffect), hint: "насколько дешевле, чем сейчас" },
                                {
                                    k: `TCO за ${baseYears} лет`,
                                    a: money(base.tco),
                                    b: money(buy.tco),
                                    c: money(raas.tco),
                                    hint: "решающий показатель сравнения",
                                    diff: true,
                                },
                                {
                                    k: "Срок окупаемости",
                                    a: "—",
                                    b: buy.paybackYears !== null ? `${buy.paybackYears} лет` : "—",
                                    c: raas.paybackYears !== null ? `${raas.paybackYears} лет` : "нет разовых затрат",
                                },
                                { k: "Роботов", a: "—", b: `${buy.units} шт`, c: `${raas.units} шт` },
                            ].map(({ k, a, b, c, hint, diff }) => (
                                <tr key={k}>
                                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">
                                        {k}
                                        {hint && <span className="block text-[11px] text-slate-400 dark:text-slate-500">{hint}</span>}
                                    </td>
                                    <td className="py-2 pr-4 tabular-nums">{a}</td>
                                    <td className={`py-2 pr-4 font-medium tabular-nums ${conclusion.winner === "buy" ? winnerCell : ""}`}>
                                        {b}
                                        {diff && (
                                            <span className="block text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                                {base.tco - buy.tco >= 0 ? "экономия " : "дороже на "}
                                                {money(Math.abs(base.tco - buy.tco))}
                                            </span>
                                        )}
                                    </td>
                                    <td className={`py-2 tabular-nums ${conclusion.winner === "raas" ? winnerCell : ""}`}>
                                        {c}
                                        {diff && (
                                            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                                                {base.tco - raas.tco >= 0 ? "экономия " : "дороже на "}
                                                {money(Math.abs(base.tco - raas.tco))}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Заключение под таблицей (ТЗ 3.7.1). Полный вывод с причинами — в итоге наверху отчёта */}
                <p
                    className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                        conclusion.winner === "none"
                            ? ZONE_STYLE.red
                            : "border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100"
                    }`}
                >
                    Заключение: {conclusion.headline}
                </p>
            </section>


            {/* Ключевые показатели с зонами */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Срок окупаемости" value={buy.paybackYears !== null ? `${buy.paybackYears} лет` : "—"} zone={pZone} hint="зелёная ≤ 2,5 · жёлтая 2,5–4 · красная > 4" />
                <Metric label={`ROI за ${baseYears} лет`} value={buy.roi !== null ? `${buy.roi}%` : "—"} zone={rZone} hint="зелёная ≥ 50% · жёлтая 0–50% · красная < 0" />
                <Metric label="CAPEX / бюджет" value={buy.budgetShare !== null ? `${Math.round(buy.budgetShare * 100)}%` : "—"} zone={bZone} hint={`CAPEX ${money(buy.capex)} из ${money(site.budget)}`} />
                <Metric label="Годовой эффект" value={money(buy.annualEffect)} zone={buy.annualEffect > 0 ? "green" : "red"} hint={`замещается ${buy.replacedWorkers.toFixed(1)} чел.`} />
            </div>


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
                    Пересчитываются все показатели отчёта, включая итог наверху и схему затрат. На сохранённый расчёт не влияет.
                </p>

                {placement && (
                    <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Ворота приёмки и отгрузки</span>
                                <div className="mt-2 inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700" role="group">
                                    {DOCKS.map((d) => (
                                        <button
                                            key={d}
                                            type="button"
                                            aria-pressed={placement.dock === d}
                                            onClick={() => placement.onChange({ dockLayout: d })}
                                            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                                                placement.dock === d
                                                    ? "bg-indigo-600 text-white"
                                                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            {d === "center" ? "Центр стены" : "Угол"}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <Slider
                                label="Погрузка и выгрузка за цикл"
                                value={placement.handlingSec}
                                min={5}
                                max={60}
                                step={1}
                                format={(v) => `${v} с`}
                                onChange={(v) => placement.onChange({ handlingSec: v })}
                            />
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {routed.route && (
                                    <>
                                        Средний пробег <b className="tabular-nums text-slate-800 dark:text-slate-200">{routed.route.oneWayM.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} м</b>, цикл{" "}
                                        <b className="tabular-nums text-slate-800 dark:text-slate-200">{Math.round(routed.route.cycleSec)} с</b>, в расчёте{" "}
                                        <b className="tabular-nums text-slate-800 dark:text-slate-200">{robot.throughputPerHour.toLocaleString("ru-RU")} ед/ч</b> на робота
                                    </>
                                )}
                            </div>
                        </div>

                        <table className="mt-4 w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                                    <th className="py-1 font-medium">Вариант размещения</th>
                                    <th className="py-1 text-right font-medium">Пробег, м</th>
                                    <th className="py-1 text-right font-medium">Роботов</th>
                                    <th className="py-1 text-right font-medium">CAPEX</th>
                                    <th className="py-1 text-right font-medium">Окупаемость</th>
                                </tr>
                            </thead>
                            <tbody className="tabular-nums">
                                {placementRows.map((row) => (
                                    <tr
                                        key={row.dock}
                                        className={`border-t border-slate-100 dark:border-slate-800 ${row.dock === placement.dock ? "font-semibold" : ""}`}
                                    >
                                        <td className="py-1.5">
                                            Ворота {DOCK_LABEL[row.dock]}
                                            {row.dock === placement.dock && <span className="ml-1 text-xs font-normal text-indigo-600 dark:text-indigo-400">· текущий</span>}
                                        </td>
                                        <td className="py-1.5 text-right">{row.route ? row.route.oneWayM.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : "—"}</td>
                                        <td className="py-1.5 text-right">{row.units}</td>
                                        <td className="py-1.5 text-right">{short(row.capex)} ₽</td>
                                        <td className="py-1.5 text-right">{row.payback !== null ? `${row.payback.toLocaleString("ru-RU")} г.` : "не окупается"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {routed.route?.overridden ? (
                            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                                Пробег задан в форме экономики (поле «Маршрут отборщика на строку») — он перекрывает расчёт по габаритам,
                                поэтому расположение ворот на число роботов не влияет. Очистите поле, чтобы сравнить варианты.
                            </p>
                        ) : (
                            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                                Расположение ворот и время погрузки сохраняются в данных расчёта: витрина решений и схема пересчитываются вместе с отчётом.
                            </p>
                        )}
                        {routed.route && (
                            <details className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                <summary className="cursor-pointer select-none font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
                                    Как посчитан пробег и число роботов
                                </summary>
                                <p className="mt-1">{routeExplanation(robot as RoutedRobotInput, placement.size, placement.speedMps)}</p>
                            </details>
                        )}
                    </div>
                )}
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
                        ["Производительность в расчёте", `${robot.throughputPerHour} ед/ч`],
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
