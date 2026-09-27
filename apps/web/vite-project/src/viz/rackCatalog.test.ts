import { describe, expect, it } from "vitest";
import { RACK_SYSTEMS, pricedRacksFor, rackById } from "./rackCatalog";
import { DEFAULT_NORMS, capexItems, rackCost, type Norms, type RobotInput, type SiteInput } from "./economics";

// Каталог стеллажей — лист «Стеллажи» от робототехников: 22 системы с ценами поставщиков.

const SITE: SiteInput = {
    inboundPerDay: 1000, outboundPerDay: 1000, shiftsPerDay: 2, shiftHours: 11,
    workingDaysPerYear: 365, peakFactor: 1.5, staffCount: 25, staffSalaryMonth: 120_000, budget: 80_000_000,
};
const ROBOT: RobotInput = { name: "Тест", price: 3_000_000, throughputPerHour: 90 };

describe("каталог стеллажей", () => {
    it("разобраны все 22 системы", () => {
        expect(RACK_SYSTEMS).toHaveLength(22);
    });

    it("у каждой системы есть бренд, модель и ссылка на источник", () => {
        for (const r of RACK_SYSTEMS) {
            expect(r.brand).not.toBe("");
            expect(r.model).not.toBe("");
            expect(r.sourceUrl).toMatch(/^https?:\/\//);
        }
    });

    it("цена секции пересчитана в цену места хранения", () => {
        // Экомет СПФ: 55 625 ₽ за секцию на 3 паллеты -> 18 542 ₽ за место
        const ekomet = rackById("RK-003")!;
        expect(ekomet.priceUnit).toBe("section");
        expect(ekomet.pricePerPlace).toBe(18_542);
    });

    it("цена за паллетоместо берётся как есть", () => {
        const prostor = rackById("RK-007")!;
        expect(prostor.priceUnit).toBe("place");
        expect(prostor.pricePerPlace).toBe(1_200);
    });

    it("позиции «по проекту» удельной цены не имеют и в выбор не попадают", () => {
        const project = RACK_SYSTEMS.filter((r) => r.priceUnit === "project");
        expect(project.length).toBeGreaterThan(0);
        for (const r of project) expect(r.pricePerPlace ?? r.pricePerM2).toBeNull();
        expect(pricedRacksFor("flow")).toHaveLength(0); // поточные — обе позиции по проекту
    });

    it("для фронтально-полочных предлагаются только системы с ценой", () => {
        const list = pricedRacksFor("shelf");
        expect(list.length).toBeGreaterThan(0);
        for (const r of list) expect(r.rackType).toBe("shelf");
    });
});

describe("стеллажи в CAPEX", () => {
    it("по умолчанию статья нулевая: роботизация на существующих стеллажах", () => {
        const item = capexItems(SITE, ROBOT, DEFAULT_NORMS).find((i) => i.key === "racks")!;
        expect(item.value).toBe(0);
        expect(item.method).toContain("не входят");
    });

    it("считается как мест хранения × цена места, с источником «КП поставщика»", () => {
        const rack = rackById("RK-003")!;
        const norms: Norms = {
            ...DEFAULT_NORMS,
            rackPricePerPlace: rack.pricePerPlace!,
            rackPlaces: 200,
            rackLabel: `${rack.brand} ${rack.model}`,
        };
        expect(rackCost(norms)).toBe(200 * 18_542);
        const item = capexItems(SITE, ROBOT, norms).find((i) => i.key === "racks")!;
        expect(item.source).toBe("quote");
        expect(item.method).toContain("Экомет СПФ 27113-60-3000");
    });

    it("мезонины считаются по площади", () => {
        const norms: Norms = { ...DEFAULT_NORMS, rackPricePerM2: 14_000, rackAreaM2: 960, rackLabel: "Мезонин-стеллаж" };
        expect(rackCost(norms)).toBe(13_440_000);
        expect(capexItems(SITE, ROBOT, norms).find((i) => i.key === "racks")!.method).toContain("м²");
    });

    it("попадает в резерв проекта: резерв считается от суммы статей выше", () => {
        const norms: Norms = { ...DEFAULT_NORMS, rackPricePerPlace: 10_000, rackPlaces: 100 };
        const items = capexItems(SITE, ROBOT, norms);
        const beforeReserve = items.filter((i) => i.key !== "reserve").reduce((a, i) => a + i.value, 0);
        const reserve = items.find((i) => i.key === "reserve")!.value;
        expect(reserve).toBeCloseTo(beforeReserve * norms.capexReserve, 0);
    });
});
