import { describe, expect, it } from "vitest";
import { checkLift } from "./liftRules";
import { rackTier } from "./rackSpecs";
import type { VizRobot } from "./robotSpecs";

const robot = (over: Partial<VizRobot>): VizRobot => ({
    id: "x",
    name: "Тест",
    type: "FMR",
    w: 1,
    l: 1.5,
    speedMps: 1.5,
    payloadKg: 1500,
    throughputPerHour: 20,
    price: 1_000_000,
    specsSource: "specs",
    ...over,
});

describe("высота ярусов из листа «Стеллажи»", () => {
    it("фронтальный паллетный: секция 6 м, 3 яруса -> верхний 4 м", () => {
        expect(rackTier("shelf", "pallet")?.topTierMm).toBe(4000);
    });

    it("полочный под короба считается по своей секции 2,5 м", () => {
        expect(rackTier("shelf", "box")?.topTierMm).toBe(1875);
    });

    it("консольный: стойка 3 м, 3 яруса", () => {
        expect(rackTier("cantilever", "long")?.topTierMm).toBe(2000);
    });
});

describe("правило высоты подъёма", () => {
    it("исключает вилочный робот, который не достаёт до верхнего яруса", () => {
        const why = checkLift(robot({ liftHeightMm: 2000 }), "shelf", "pallet", 600);
        expect(why[0]).toContain("Поднимает груз на 2,0 м, верхний ярус — 4,0 м");
    });

    it("пропускает робота с достаточной высотой подъёма", () => {
        expect(checkLift(robot({ liftHeightMm: 7500 }), "shelf", "pallet", 600)).toEqual([]);
    });

    it("молчит, если производитель высоту подъёма не заявил", () => {
        expect(checkLift(robot({}), "shelf", "pallet", 600)).toEqual([]);
    });

    it("не применяется к подпаллетным AMR: они возят стеллаж, а не ставят груз на ярус", () => {
        expect(checkLift(robot({ type: "AMR", liftHeightMm: 60 }), "shelf", "pallet", 600)).toEqual([]);
    });

    it("не применяется к стационарным системам", () => {
        expect(checkLift(robot({ type: "ASRS", liftHeightMm: 500 }), "shelf", "pallet", 600)).toEqual([]);
    });
});

describe("правило остаточной грузоподъёмности", () => {
    it("исключает робота, который на высоте не держит массу груза", () => {
        const why = checkLift(robot({ liftHeightMm: 7500, liftResidualKg: 800 }), "shelf", "pallet", 1200);
        expect(why).toHaveLength(1);
        expect(why[0]).toBe("На максимальной высоте поднимает 800 кг, ваш груз 1200 кг");
    });

    it("пропускает, если остаточной грузоподъёмности хватает", () => {
        expect(checkLift(robot({ liftHeightMm: 7500, liftResidualKg: 1500 }), "shelf", "pallet", 1200)).toEqual([]);
    });

    it("молчит, если остаточная грузоподъёмность не заявлена", () => {
        expect(checkLift(robot({ liftHeightMm: 7500 }), "shelf", "pallet", 1200)).toEqual([]);
    });
});
