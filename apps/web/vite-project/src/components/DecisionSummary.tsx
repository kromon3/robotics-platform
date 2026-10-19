import type { Norms, ScenarioEconomics, SiteInput, Verdict, Zone } from "../viz/economics";
import { PAYBACK_ZONE_HINT, paybackZone } from "../viz/economics";
import { checkLimits, hasLimits, limitsSummary, type InvestmentLimits } from "../viz/investmentLimits";

// Итог для того, кто принимает решение: что выбрать, сколько это даёт и почему — в одном блоке
// наверху отчёта. Финансовому директору не нужно листать до таблиц, а детали остаются ниже.

type Props = {
    base: ScenarioEconomics;
    buy: ScenarioEconomics;
    raas: ScenarioEconomics;
    conclusion: Verdict;
    site: SiteInput;
    norms: Norms;
    /** id блока с подробным расчётом — для ссылки «Подробный расчёт» */
    detailsId: string;
    /** Бюджет и норма доходности заказчика; не заданы — строка соответствия не показывается */
    limits?: InvestmentLimits;
};

const mln = (n: number) => `${(n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн ₽`;

const ZONE_TEXT: Record<Zone, string> = {
    green: "text-green-700 dark:text-green-400",
    yellow: "text-amber-700 dark:text-amber-400",
    red: "text-red-700 dark:text-red-400",
};

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
    return (
        <div className="rounded-xl bg-white/80 p-4 dark:bg-slate-900/60 print:border print:border-slate-200">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
            <div className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${tone ?? ""}`}>{value}</div>
            {hint && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
        </div>
    );
}

export function DecisionSummary({ base, buy, raas, conclusion, site, norms, detailsId, limits }: Props) {
    const years = norms.horizonYears;
    const none = conclusion.winner === "none";
    // Для «не окупается» показываем покупку: по ней видно, сколько не хватает
    const win = conclusion.winner === "raas" ? raas : buy;
    const saving = base.tco - win.tco;

    const payback =
        conclusion.winner === "raas"
            ? { value: "без вложений", tone: ZONE_TEXT.green, hint: "оплата подпиской с первого месяца" }
            : win.paybackYears !== null
              ? {
                    value: `${win.paybackYears.toLocaleString("ru-RU")} г.`,
                    tone: ZONE_TEXT[paybackZone(win.paybackYears) ?? "red"],
                    hint: PAYBACK_ZONE_HINT[paybackZone(win.paybackYears) ?? "red"],
                }
              : { value: "не окупается", tone: ZONE_TEXT.red, hint: "годовой эффект не возвращает вложения" };

    const remaining = Math.max(0, site.staffCount - win.replacedWorkers);

    // Соответствие инвестиционным ограничениям считаем по тем же цифрам, что показаны выше,
    // поэтому ползунки «что если» двигают и его: видно, при какой зарплате решение выходит из нормы
    const showLimits = limits !== undefined && hasLimits(limits);
    const breaches = showLimits ? checkLimits(win, limits) : [];

    return (
        <section
            className={`rounded-2xl border-2 p-6 print:break-inside-avoid ${
                none
                    ? "border-red-300 bg-gradient-to-br from-red-50 to-white dark:border-red-900 dark:from-red-950/40 dark:to-slate-900"
                    : "border-indigo-300 bg-gradient-to-br from-indigo-50 to-white dark:border-indigo-800 dark:from-indigo-950/50 dark:to-slate-900"
            }`}
        >
            <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ${
                    none ? "bg-red-600" : "bg-indigo-600"
                }`}
            >
                {none ? "Вывод" : "Рекомендация"}
            </span>
            <h3 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{conclusion.headline}</h3>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Figure label="Окупаемость" {...payback} />
                <Figure
                    label={`Экономия за ${years} лет`}
                    value={saving >= 0 ? mln(saving) : `−${mln(-saving)}`}
                    tone={saving >= 0 ? ZONE_TEXT.green : ZONE_TEXT.red}
                    hint={`${mln(base.tco)} сейчас → ${mln(win.tco)} с роботами`}
                />
                <Figure
                    label="Разовые вложения"
                    value={win.capex > 0 ? mln(win.capex) : "0 ₽"}
                    hint={
                        win.capex > 0 && win.budgetShare !== null
                            ? `${Math.round(win.budgetShare * 100)}% бюджета · ${win.units} роботов`
                            : `${win.units} роботов`
                    }
                />
                <Figure
                    label="Персонал"
                    value={`${site.staffCount} → ≈${Math.round(remaining)} чел.`}
                    hint={`роботы заменяют ${win.replacedWorkers.toFixed(1)} чел., остальные остаются в расчёте`}
                />
            </div>

            {showLimits && (
                <div
                    className={`mt-4 rounded-xl border px-4 py-3 text-sm print:break-inside-avoid ${
                        breaches.length === 0
                            ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                            : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                    }`}
                >
                    <span className="font-semibold">
                        {breaches.length === 0 ? "Укладывается в ваши ограничения" : "Не укладывается в ваши ограничения"}
                    </span>
                    <span className="text-xs opacity-80"> · задано: {limitsSummary(limits)}</span>
                    {breaches.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                            {breaches.map((b) => (
                                <li key={b.key}>
                                    — {b.label}: {b.note}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <div className="mt-5 grid gap-4 text-sm lg:grid-cols-[2fr_1fr]">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Почему</div>
                    <ul className="mt-1.5 space-y-1 text-slate-700 dark:text-slate-300">
                        {conclusion.reasons.map((reason) => (
                            <li key={reason} className="flex gap-2">
                                <span className="text-indigo-500" aria-hidden>
                                    •
                                </span>
                                <span>{reason}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Что проверить
                    </div>
                    <ul className="mt-1.5 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        {conclusion.caveats.map((caveat) => (
                            <li key={caveat}>{caveat}</li>
                        ))}
                    </ul>
                </div>
            </div>

            <a
                href={`#${detailsId}`}
                className="mt-5 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400 print:hidden"
            >
                Подробный расчёт: сценарии, затраты, чувствительность ↓
            </a>
        </section>
    );
}
