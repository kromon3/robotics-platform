import { describe, expect, it } from "vitest";
import type { ScenarioEconomics } from "./economics";
import {
    NO_LIMITS,
    checkLimits,
    hasLimits,
    limitsSummary,
    splitByLimits,
    toLimits,
    worstGap,
} from "./investmentLimits";

/** Деньги в сообщениях форматируются как в модуле: в ru-RU разряды разделяет неразрывный пробел */
const money = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

/** Минимальный сценарий: модулю ограничений нужны только capex, paybackYears и roi */
const econ = (capex: number, paybackYears: number | null, roi: number | null) =>
    ({ capex, paybackYears, roi }) as ScenarioEconomics;

describe("инвестиционные ограничения", () => {
    describe("разбор полей формы", () => {
        it("пустые поля означают «не ограничиваю»", () => {
            expect(toLimits({ budget: "", targetPaybackYears: "", minRoiPct: "" })).toEqual(NO_LIMITS);
            expect(hasLimits(NO_LIMITS)).toBe(false);
        });

        it("нулевой бюджет и нулевой срок — тоже не ограничение, а незаполненное поле", () => {
            expect(toLimits({ budget: 0, targetPaybackYears: 0 })).toEqual(NO_LIMITS);
        });

        it("ROI 0% — настоящее требование, а не пустое поле", () => {
            // Отличается от бюджета и срока: «окупаемость не дольше 0 лет» смысла не имеет,
            // а «ROI не ниже 0%» означает «лишь бы не в убыток»
            expect(toLimits({ minRoiPct: 0 }).minRoiPct).toBe(0);
            expect(hasLimits(toLimits({ minRoiPct: 0 }))).toBe(true);
        });

        it("подпись перечисляет заданные условия", () => {
            expect(limitsSummary(toLimits({ budget: 50_000_000, targetPaybackYears: 3 }))).toBe(
                `бюджет до ${money(50_000_000)}, окупаемость до 3 лет`,
            );
            expect(limitsSummary(NO_LIMITS)).toBeNull();
        });
    });

    describe("проверка решения", () => {
        const limits = toLimits({ budget: 50_000_000, targetPaybackYears: 3, minRoiPct: 40 });

        it("решение внутри коридора не нарушает ничего", () => {
            expect(checkLimits(econ(40_000_000, 2.5, 80), limits)).toEqual([]);
        });

        it("превышение бюджета названо с обеими цифрами и разницей", () => {
            const [b] = checkLimits(econ(92_000_000, 2.5, 80), limits);
            expect(b.key).toBe("budget");
            expect(b.note).toContain(money(92_000_000));
            expect(b.note).toContain(money(50_000_000));
            expect(b.note).toContain(money(42_000_000));
            expect(b.gap).toBeCloseTo(0.84);
        });

        it("срок дольше требуемого — нарушение", () => {
            const [b] = checkLimits(econ(40_000_000, 4.5, 80), limits);
            expect(b.key).toBe("payback");
            expect(b.note).toContain("4.5");
            expect(b.gap).toBeCloseTo(0.5);
        });

        it("не окупается — промах бесконечный, чтобы такое решение стояло последним", () => {
            const breaches = checkLimits(econ(40_000_000, null, null), limits);
            expect(breaches.map((b) => b.key)).toEqual(["payback", "roi"]);
            expect(worstGap(breaches)).toBe(Number.POSITIVE_INFINITY);
        });

        it("ROI ниже нормы — нарушение, нормируется на 100 п.п.", () => {
            const [b] = checkLimits(econ(40_000_000, 2.5, 10), limits);
            expect(b.key).toBe("roi");
            expect(b.note).toContain("10%");
            expect(b.note).toContain("40%");
            expect(b.gap).toBeCloseTo(0.3);
        });

        it("нарушений может быть несколько сразу", () => {
            expect(checkLimits(econ(92_000_000, 4.5, 10), limits).map((b) => b.key)).toEqual([
                "budget",
                "payback",
                "roi",
            ]);
        });

        it("без ограничений не нарушает даже неокупаемое решение", () => {
            expect(checkLimits(econ(999_000_000, null, null), NO_LIMITS)).toEqual([]);
        });
    });

    describe("деление списка", () => {
        const ranked = [
            { id: "дорогой", economics: econ(92_000_000, 1.2, 150) },
            { id: "в коридоре", economics: econ(40_000_000, 2.4, 90) },
            { id: "медленный", economics: econ(30_000_000, 6, 20) },
            { id: "не окупается", economics: econ(20_000_000, null, null) },
        ];
        const limits = toLimits({ budget: 50_000_000, targetPaybackYears: 3 });

        it("порядок внутри коридора сохраняется — ограничения не меняют качество решения", () => {
            const { within } = splitByLimits(ranked, limits);
            expect(within.map((r) => r.id)).toEqual(["в коридоре"]);
        });

        it("вне коридора сортируются от ближайших к самым далёким", () => {
            const { beyond } = splitByLimits(ranked, limits);
            // дорогой промахнулся на 84%, медленный вдвое по сроку, последний не окупается вовсе
            expect(beyond.map((b) => b.ranked.id)).toEqual(["дорогой", "медленный", "не окупается"]);
        });

        it("ничего не теряется: within + beyond = исходный список", () => {
            const { within, beyond } = splitByLimits(ranked, limits);
            expect(within.length + beyond.length).toBe(ranked.length);
        });

        it("без ограничений список не делится вообще", () => {
            const { within, beyond } = splitByLimits(ranked, NO_LIMITS);
            expect(within).toEqual(ranked);
            expect(beyond).toEqual([]);
        });

        it("если не прошёл никто — коридор пуст, а решения остаются в beyond", () => {
            const { within, beyond } = splitByLimits(ranked, toLimits({ budget: 1_000_000 }));
            expect(within).toEqual([]);
            expect(beyond).toHaveLength(4);
            // Ближайшее — самое дешёвое: оно меньше всех промахнулось по бюджету
            expect(beyond[0].ranked.id).toBe("не окупается");
        });
    });
});
