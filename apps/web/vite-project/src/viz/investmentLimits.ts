// Инвестиционные ограничения заказчика: бюджетный коридор и норма доходности (ТЗ 3.4.5, 3.5.7).
//
// Подбор по ТТХ отвечает на вопрос «какой робот физически справится», а эти ограничения —
// на вопрос «какой из них нам по карману и окупается достаточно быстро». Поэтому они не входят
// в правила совместимости (src/viz/core/rules.ts): решение, не влезающее в бюджет, технически
// исправно, и прятать его нельзя — пользователь должен видеть, на сколько он промахнулся.
//
// Отсюда правило: ограничения НИЧЕГО не удаляют из выдачи. Они делят подходящие решения
// на тех, кто в коридор уложился, и тех, кто нет; рекомендация берётся из первой группы,
// вторая показывается следом с объяснением, чего именно не хватило. Если коридор не прошёл
// никто — показываем ближайшее решение и прямо говорим, что оно ограничений не удовлетворяет.

import type { ScenarioEconomics } from "./economics";

export type InvestmentLimits = {
    /** Потолок разовых вложений (CAPEX), ₽; null — не ограничено */
    budget: number | null;
    /** Норма доходности сроком: окупаемость не дольше, лет; null — не ограничено */
    targetPaybackYears: number | null;
    /** Норма доходности доходностью: ROI за горизонт не ниже, %; null — не ограничено */
    minRoiPct: number | null;
};

export const NO_LIMITS: InvestmentLimits = { budget: null, targetPaybackYears: null, minRoiPct: null };

export type LimitKey = "budget" | "payback" | "roi";

export type LimitBreach = {
    key: LimitKey;
    label: string;
    /**
     * Насколько решение промахнулось, в долях от требования: 0,2 — промах на 20%.
     * Нужен, чтобы отсортировать не прошедшие решения от ближайших к самым далёким,
     * а не по оценке: при пустом коридоре пользователю важно, что ближе всего к его условиям.
     */
    gap: number;
    /** Человеческое объяснение с обеими цифрами: что требовалось и что вышло */
    note: string;
};

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;

/** Ограничения из экономической формы; пустое поле означает «не ограничиваю» */
export function toLimits(input: {
    budget?: number | "" | null;
    targetPaybackYears?: number | "" | null;
    minRoiPct?: number | "" | null;
}): InvestmentLimits {
    const num = (v: number | "" | null | undefined) => (typeof v === "number" && v > 0 ? v : null);
    return {
        budget: num(input.budget),
        targetPaybackYears: num(input.targetPaybackYears),
        minRoiPct: typeof input.minRoiPct === "number" ? input.minRoiPct : null,
    };
}

export const hasLimits = (l: InvestmentLimits) =>
    l.budget !== null || l.targetPaybackYears !== null || l.minRoiPct !== null;

/** Короткая строка «что вы задали» для подписи под списком */
export function limitsSummary(l: InvestmentLimits): string | null {
    const parts: string[] = [];
    if (l.budget !== null) parts.push(`бюджет до ${fmtMoney(l.budget)}`);
    if (l.targetPaybackYears !== null) parts.push(`окупаемость до ${l.targetPaybackYears} лет`);
    if (l.minRoiPct !== null) parts.push(`ROI не ниже ${l.minRoiPct}%`);
    return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Чем решение не укладывается в коридор. Пустой массив — укладывается полностью.
 * Решение, которое не окупается вовсе, нарушает и срок, и доходность, если они заданы:
 * «бесконечная» окупаемость — это промах на любую величину, gap берём с запасом.
 */
export function checkLimits(e: ScenarioEconomics, l: InvestmentLimits): LimitBreach[] {
    const out: LimitBreach[] = [];

    if (l.budget !== null && e.capex > l.budget) {
        out.push({
            key: "budget",
            label: "Бюджет",
            gap: e.capex / l.budget - 1,
            note: `разовые вложения ${fmtMoney(e.capex)} при бюджете ${fmtMoney(l.budget)} — дороже на ${fmtMoney(e.capex - l.budget)}`,
        });
    }

    if (l.targetPaybackYears !== null) {
        if (e.paybackYears === null) {
            out.push({
                key: "payback",
                label: "Срок окупаемости",
                gap: Number.POSITIVE_INFINITY,
                note: `не окупается, а нужна окупаемость не дольше ${l.targetPaybackYears} лет`,
            });
        } else if (e.paybackYears > l.targetPaybackYears) {
            out.push({
                key: "payback",
                label: "Срок окупаемости",
                gap: e.paybackYears / l.targetPaybackYears - 1,
                note: `окупается за ${e.paybackYears} г. при требовании не дольше ${l.targetPaybackYears} лет`,
            });
        }
    }

    if (l.minRoiPct !== null) {
        if (e.roi === null) {
            out.push({
                key: "roi",
                label: "Доходность",
                gap: Number.POSITIVE_INFINITY,
                note: `доходность не считается: решение не окупается, а нужно ROI не ниже ${l.minRoiPct}%`,
            });
        } else if (e.roi < l.minRoiPct) {
            out.push({
                key: "roi",
                label: "Доходность",
                // Нормируем на 100 п.п., а не на требование: при нулевой норме делить не на что,
                // а отрицательный ROI иначе давал бы бессмысленно большой промах
                gap: (l.minRoiPct - e.roi) / 100,
                note: `ROI за горизонт ${Math.round(e.roi)}% при требовании не ниже ${l.minRoiPct}%`,
            });
        }
    }

    return out;
}

export type WithinLimits<T> = { ranked: T; breaches: LimitBreach[] };

/**
 * Делит отранжированные решения на уложившиеся в коридор и нет.
 * Порядок внутри within — прежний, по оценке: ограничения не меняют качество решения,
 * они только отсекают неприемлемое. Beyond сортируется по величине промаха, чтобы
 * «почти подошло» стояло выше «мимо втрое».
 */
export function splitByLimits<T extends { economics: ScenarioEconomics }>(
    ranked: T[],
    limits: InvestmentLimits,
): { within: T[]; beyond: WithinLimits<T>[] } {
    if (!hasLimits(limits)) return { within: ranked, beyond: [] };
    const within: T[] = [];
    const beyond: WithinLimits<T>[] = [];
    for (const r of ranked) {
        const breaches = checkLimits(r.economics, limits);
        if (breaches.length === 0) within.push(r);
        else beyond.push({ ranked: r, breaches });
    }
    beyond.sort((a, b) => worstGap(a.breaches) - worstGap(b.breaches));
    return { within, beyond };
}

/** Самый большой промах решения — по нему сортируются не прошедшие коридор */
export const worstGap = (breaches: LimitBreach[]) => Math.max(...breaches.map((b) => b.gap), 0);
