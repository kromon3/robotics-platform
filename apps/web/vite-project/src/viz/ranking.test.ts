import { describe, expect, it } from "vitest";
import { DEFAULT_NORMS, type SiteInput } from "./economics";
import { WEIGHTS, rankOffers, topReasons, weakest, type RankInput } from "./ranking";
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

    it("пустой список решений не ломает расчёт", () => {
        expect(rankOffers([], SITE, DEFAULT_NORMS, CARGO_KG, AISLE)).toEqual([]);
    });
});
