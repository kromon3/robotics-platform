import { describe, expect, it } from "vitest";
import { DEFAULT_NORMS, type SiteInput } from "./economics";
import { WEIGHTS, hasMeaningfulWeakness, rankOffers, strengths, topReasons, weakest, type RankInput } from "./ranking";
import type { VizRobot } from "./robotSpecs";

const SITE: SiteInput = {
    inboundPerDay: 1000, outboundPerDay: 1000, shiftsPerDay: 2, shiftHours: 11,
    workingDaysPerYear: 365, peakFactor: 1.5, staffCount: 25, staffSalaryMonth: 120_000, budget: 80_000_000,
};

const robot = (over: Partial<VizRobot>): VizRobot => ({
    id: "r", name: "Робот", type: "AMR", w: 1, l: 1.2, speedMps: 1.5,
    payloadKg: 1500, throughputPerHour: 90, price: 3_000_000, specsSource: "specs",
    throughputSource: "type-default", ...over,
});

const offer = (id: string, over: Partial<RankInput> = {}, robotOver: Partial<VizRobot> = {}): RankInput => ({
    id, robot: robot({ id, ...robotOver }), minAisle: 1.5, status: "operation", ugt: 9, verified: true, ...over,
});

const CARGO_KG = 600;
const AISLE = 2.6;

describe("ранжирование подобранных решений", () => {
    it("сумма весов — 100 баллов", () => {
        expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    });

    it("идеальное решение набирает 100", () => {
        const [best] = rankOffers([offer("a", {}, { payloadKg: 2000 })], SITE, DEFAULT_NORMS, 600, AISLE);
        expect(best.score).toBe(100);
    });

    it("при равных ТТХ выше то, у которого дешевле парк", () => {
        const ranked = rankOffers(
            [offer("дорогой", {}, { price: 5_000_000 }), offer("дешёвый", {}, { price: 2_000_000 })],
            SITE, DEFAULT_NORMS, CARGO_KG, AISLE,
        );
        expect(ranked[0].item.id).toBe("дешёвый");
        expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    });

    it("НИОКР проигрывает эксплуатации при прочих равных", () => {
        const ranked = rankOffers(
            [offer("ниокр", { status: "rnd", ugt: 4 }), offer("серийный", { status: "operation", ugt: 9 })],
            SITE, DEFAULT_NORMS, CARGO_KG, AISLE,
        );
        expect(ranked[0].item.id).toBe("серийный");
        const readiness = (id: string) => ranked.find((r) => r.item.id === id)!.parts.find((p) => p.key === "readiness")!.points;
        expect(readiness("серийный")).toBeGreaterThan(readiness("ниокр"));
    });

    it("типовые ТТХ без подтверждения дают меньше баллов достоверности", () => {
        const ranked = rankOffers(
            [offer("паспорт"), offer("типовые", { verified: false }, { specsSource: "type-default" })],
            SITE, DEFAULT_NORMS, CARGO_KG, AISLE,
        );
        const trust = (id: string) => ranked.find((r) => r.item.id === id)!.parts.find((p) => p.key === "dataTrust")!.points;
        expect(trust("паспорт")).toBe(WEIGHTS.dataTrust);
        expect(trust("типовые")).toBeLessThan(WEIGHTS.dataTrust / 2);
    });

    it("стационарной системе проход не нужен — фактор прохода закрыт полностью", () => {
        const [r] = rankOffers([offer("asrs", { minAisle: 0 }, { type: "ASRS" })], SITE, DEFAULT_NORMS, CARGO_KG, AISLE);
        const aisle = r.parts.find((p) => p.key === "aisle")!;
        expect(aisle.points).toBe(WEIGHTS.aisle);
        expect(aisle.note).toContain("стационарная система");
    });

    it("робот впритык по проходу теряет баллы", () => {
        const ranked = rankOffers(
            [offer("узкий", { minAisle: 1.0 }), offer("впритык", { minAisle: 2.5 })],
            SITE, DEFAULT_NORMS, CARGO_KG, AISLE,
        );
        const aisle = (id: string) => ranked.find((r) => r.item.id === id)!.parts.find((p) => p.key === "aisle")!.points;
        expect(aisle("узкий")).toBeGreaterThan(aisle("впритык"));
    });

    it("баллы по фактору не превышают его вес, а сумма равна оценке", () => {
        const ranked = rankOffers(
            [offer("a"), offer("b", { status: "piloting", ugt: 6 }, { price: 4_000_000, payloadKg: 800 })],
            SITE, DEFAULT_NORMS, CARGO_KG, AISLE,
        );
        for (const r of ranked) {
            for (const p of r.parts) {
                expect(p.points).toBeLessThanOrEqual(p.weight);
                expect(p.points).toBeGreaterThanOrEqual(0);
            }
            expect(Math.round(r.parts.reduce((a, p) => a + p.points, 0))).toBe(r.score);
        }
    });

    it("объяснение называет сильные и слабую стороны", () => {
        const [r] = rankOffers([offer("a", { status: "rnd", ugt: 3 })], SITE, DEFAULT_NORMS, CARGO_KG, AISLE);
        expect(topReasons(r.parts)).toHaveLength(2);
        expect(weakest(r.parts).key).toBe("readiness");
    });

    it("экономика весит половину оценки: окупаемость 25 и TCO 15", () => {
        expect(WEIGHTS.payback + WEIGHTS.tco).toBe(40);
        expect(WEIGHTS.payback).toBeGreaterThan(WEIGHTS.payload);
    });

    it("решение, которое не окупается, теряет все баллы за срок окупаемости", () => {
        // Дорогой и медленный: нужно 43 робота, их эксплуатация дороже замещаемого ФОТ
        const ranked = rankOffers(
            [offer("неокупаемый", {}, { price: 20_000_000, throughputPerHour: 5 }), offer("обычный")],
            SITE, DEFAULT_NORMS, CARGO_KG, AISLE,
        );
        const bad = ranked.find((r) => r.item.id === "неокупаемый")!;
        expect(bad.economics.paybackYears).toBeNull();
        const payback = bad.parts.find((p) => p.key === "payback")!;
        expect(payback.points).toBe(0);
        expect(payback.note).toContain("не окупается");
        expect(ranked[0].item.id).toBe("обычный");
    });

    it("плохая окупаемость почти обнуляет баллы, даже если решение формально окупается", () => {
        const ranked = rankOffers(
            [offer("дорогой", {}, { price: 40_000_000 }), offer("обычный")],
            SITE, DEFAULT_NORMS, CARGO_KG, AISLE,
        );
        const dear = ranked.find((r) => r.item.id === "дорогой")!;
        expect(dear.economics.paybackYears!).toBeGreaterThan(20);
        expect(dear.parts.find((p) => p.key === "payback")!.points).toBeLessThan(2);
    });

    it("рекомендованным становится решение с лучшей окупаемостью", () => {
        const ranked = rankOffers(
            [offer("медленный", {}, { price: 3_000_000, throughputPerHour: 40 }), offer("быстрый", {}, { price: 3_000_000, throughputPerHour: 120 })],
            SITE, DEFAULT_NORMS, CARGO_KG, AISLE,
        );
        expect(ranked[0].item.id).toBe("быстрый");
        expect(ranked[0].economics.paybackYears!).toBeLessThan(ranked[1].economics.paybackYears!);
    });

    it("вместе с оценкой отдаётся полный расчёт сценария — его показывает карточка", () => {
        const [top] = rankOffers([offer("a")], SITE, DEFAULT_NORMS, CARGO_KG, AISLE);
        expect(top.economics.units).toBeGreaterThan(0);
        expect(top.economics.capex).toBeGreaterThan(0);
        expect(top.economics.capexItems.length).toBeGreaterThan(5);
    });

    it("пустой список решений не ломает расчёт", () => {
        expect(rankOffers([], SITE, DEFAULT_NORMS, CARGO_KG, AISLE)).toEqual([]);
    });
});

describe("сильные стороны в карточке рекомендации", () => {
    // Два почти одинаковых робота: у «b» окупаемость чуть хуже, но остальное — на максимуме.
    // Окупаемость весит 25 и даже проигрывая даёт больше всех баллов — раньше она попадала
    // в «Почему это решение» с текстом «X г. против Y г. у лучшего решения»
    const ranked = rankOffers(
        [offer("a", {}, { price: 2_000_000, payloadKg: 2000 }), offer("b", {}, { price: 2_300_000, payloadKg: 2000 })],
        SITE, DEFAULT_NORMS, CARGO_KG, AISLE,
    );
    const b = ranked.find((r) => r.item.id === "b")!;

    it("окупаемость хуже лучшей не выдаётся за причину выбора", () => {
        const payback = b.parts.find((p) => p.key === "payback")!;
        expect(payback.value).toBeLessThan(0.995);
        expect(strengths(b.parts).map((p) => p.key)).not.toContain("payback");
    });

    it("слабая сторона никогда не попадает в сильные", () => {
        for (const r of ranked) {
            if (!hasMeaningfulWeakness(r.parts)) continue;
            expect(strengths(r.parts).map((p) => p.key)).not.toContain(weakest(r.parts).key);
        }
    });

    it("у решения без недостатков предупреждения нет", () => {
        const [best] = rankOffers([offer("a", {}, { payloadKg: 2000 })], SITE, DEFAULT_NORMS, 600, AISLE);
        expect(best.score).toBe(100);
        expect(hasMeaningfulWeakness(best.parts)).toBe(false);
    });

    it("TCO дороже лучшего не называется лучшим и не попадает в сильные", () => {
        const tco = b.parts.find((p) => p.key === "tco")!;
        expect(tco.note).not.toMatch(/лучший показатель/);
        expect(tco.note).toMatch(/дороже лучшего/);
        expect(strengths(b.parts).map((p) => p.key)).not.toContain("tco");
    });

    it("в сильные попадают факторы на максимуме, тяжёлые выше лёгких", () => {
        const top = strengths(b.parts, 3);
        expect(top.length).toBeGreaterThan(0);
        for (const p of top) expect(p.value).toBeGreaterThanOrEqual(0.995);
        for (let i = 1; i < top.length; i++) expect(top[i - 1].weight).toBeGreaterThanOrEqual(top[i].weight);
    });
});
