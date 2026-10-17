import { describe, expect, it } from "vitest";
import { ROUTE_DEFAULTS, meanOneWay, routeCycle, type RouteParams } from "./routeModel";
import { normsFor, toNorms, toRobotInput, toSiteInput, buildScenarios } from "./adapter";
import { computeScenario, DEFAULT_NORMS, verdict } from "./economics";
import { rankOffers } from "./ranking";
import { EXAMPLE, toNumericFormData } from "../store/store";
import { ECON_EXAMPLE, toEconNumeric } from "../store/econStore";
import type { VizRobot } from "./robotSpecs";

// Склад 40 × 24 м, робот 1,5 м/с, как Ronavi H1500 — проверка формул на круглых числах
const BASE: RouteParams = { widthM: 40, lengthM: 24, dock: "center", speedMps: 1.5, hoursPerDay: 8 };

describe("модель маршрута: пробег", () => {
    it("ворота в центре стены: d = (W/4 + L/2) × обход", () => {
        expect(meanOneWay(40, 24, "center", 1)).toBe(22);
        expect(routeCycle(BASE).oneWayM).toBeCloseTo(22 * 1.2, 6);
    });

    it("ворота в углу: d = (W/2 + L/2) × обход — длиннее, чем из центра", () => {
        expect(meanOneWay(40, 24, "corner", 1)).toBe(32);
        expect(routeCycle({ ...BASE, dock: "corner" }).oneWayM).toBeCloseTo(32 * 1.2, 6);
    });

    it("пробег из формы перекрывает расчёт по габаритам и не умножается на обход", () => {
        const r = routeCycle({ ...BASE, dock: "corner", routeOverrideM: 35 });
        expect(r.oneWayM).toBe(35);
        expect(r.overridden).toBe(true);
    });

    it("нулевой пробег из формы игнорируется", () => {
        const r = routeCycle({ ...BASE, routeOverrideM: 0 });
        expect(r.overridden).toBe(false);
        expect(r.oneWayM).toBeCloseTo(26.4, 6);
    });
});

describe("модель маршрута: цикл и производительность", () => {
    it("T = 2d / (v × k_v) + погрузка; П = 3600 / T", () => {
        const r = routeCycle({ ...BASE, speedFactor: 1, detour: 1, handlingSec: 0 });
        expect(r.cycleSec).toBeCloseTo((2 * 22) / 1.5, 6);
        expect(r.perHour).toBeCloseTo(3600 / ((2 * 22) / 1.5), 6);
    });

    it("значения по умолчанию: k_v 0,8, обход 1,2, погрузка 20 с — цикл 64 с", () => {
        const r = routeCycle(BASE);
        expect(r.speedFactor).toBe(ROUTE_DEFAULTS.speedFactor);
        expect(r.handlingSec).toBe(20);
        expect(r.cycleSec).toBeCloseTo(64, 6);
        expect(r.perHour).toBeCloseTo(56.25, 6);
    });

    it("больше времени на погрузку — ниже производительность", () => {
        expect(routeCycle({ ...BASE, handlingSec: 40 }).perHour).toBeLessThan(routeCycle(BASE).perHour);
    });

    it("быстрее робот — выше производительность", () => {
        expect(routeCycle({ ...BASE, speedMps: 2 }).perHour).toBeGreaterThan(routeCycle(BASE).perHour);
    });
});

describe("модель маршрута: зарядка", () => {
    it("объект работает дольше автономности — A = runtime / (runtime + charge)", () => {
        const r = routeCycle({ ...BASE, runtimeH: 10, chargeH: 2, hoursPerDay: 22 });
        expect(r.availability).toBeCloseTo(10 / 12, 6);
        expect(r.perHour).toBeCloseTo(56.25 * (10 / 12), 6);
    });

    it("смена короче автономности — зарядка в простое, A = 1", () => {
        expect(routeCycle({ ...BASE, runtimeH: 10, chargeH: 2, hoursPerDay: 8 }).availability).toBe(1);
        expect(routeCycle({ ...BASE, runtimeH: 10, chargeH: 2, hoursPerDay: 10 }).availability).toBe(1);
    });

    it("нет данных об автономности — A = 1", () => {
        expect(routeCycle({ ...BASE, runtimeH: 10, hoursPerDay: 22 }).availability).toBe(1);
        expect(routeCycle({ ...BASE, chargeH: 2, hoursPerDay: 22 }).availability).toBe(1);
    });
});

describe("модель маршрута: неполные данные", () => {
    it("нет скорости — производительность 0 (берётся паспортная)", () => {
        expect(routeCycle({ ...BASE, speedMps: 0 }).perHour).toBe(0);
        expect(routeCycle({ ...BASE, speedMps: Number.NaN }).perHour).toBe(0);
    });

    it("нет габаритов — производительность 0", () => {
        expect(routeCycle({ ...BASE, widthM: 0 }).perHour).toBe(0);
        expect(routeCycle({ ...BASE, lengthM: -5 }).perHour).toBe(0);
    });

    it("нет габаритов, но пробег задан в форме — считается по нему", () => {
        expect(routeCycle({ ...BASE, widthM: 0, lengthM: 0, routeOverrideM: 30 }).perHour).toBeGreaterThan(0);
    });

    it("некорректные коэффициенты заменяются значениями по умолчанию", () => {
        const r = routeCycle({ ...BASE, speedFactor: 0, detour: -1, handlingSec: Number.NaN });
        expect(r.speedFactor).toBe(0.8);
        expect(r.detour).toBe(1.2);
        expect(r.handlingSec).toBe(20);
        expect(r.cycleSec).toBeCloseTo(64, 6);
    });
});

// ── Сквозной расчёт на демо-складе ─────────────────────────────────────

const H1500: VizRobot = {
    id: "h1500", name: "Ronavi H1500", type: "AMR", w: 0.654, l: 1.044, speedMps: 1.5, payloadKg: 1500,
    throughputPerHour: 90, price: 2_700_000, specsSource: "specs", throughputSource: "type-default",
    runtimeH: 10, chargeH: 2,
};
const P = toNumericFormData(EXAMPLE);
const E = toEconNumeric({ ...ECON_EXAMPLE, activeAreaM2: Number(EXAMPLE.width) * Number(EXAMPLE.length) });
const SITE = toSiteInput(P, E);
const NORMS = toNorms(E, DEFAULT_NORMS, P);

const unitsFor = (dock: "center" | "corner") => {
    const r = toRobotInput(H1500, P, E, { dock });
    return { r, e: computeScenario("buy", SITE, r, normsFor(NORMS, r)) };
};

describe("демо-склад 48 × 30 м, Ronavi H1500", () => {
    it("без модели маршрута — 8 роботов по типовым 90 ед/ч, как раньше", () => {
        const r = toRobotInput(H1500, P, E, { enabled: false });
        expect(r.route).toBeNull();
        expect(computeScenario("buy", SITE, r, normsFor(NORMS, r)).units).toBe(8);
    });

    it("ворота в центре: пробег 32,4 м, цикл 74 с, 40,5 ед/ч → 14 роботов", () => {
        const { r, e } = unitsFor("center");
        expect(r.route?.oneWayM).toBeCloseTo(32.4, 6);
        expect(r.route?.cycleSec).toBeCloseTo(74, 6);
        expect(r.throughputPerHour).toBe(40.5);
        expect(normsFor(NORMS, r).utilization).toBe(0.85);
        expect(e.units).toBe(14);
    });

    it("ворота в углу: пробег 46,8 м, цикл 98 с → 18 роботов и CAPEX выше", () => {
        const corner = unitsFor("corner");
        const center = unitsFor("center");
        expect(corner.r.route?.oneWayM).toBeCloseTo(46.8, 6);
        expect(corner.r.route?.cycleSec).toBeCloseTo(98, 6);
        expect(corner.e.units).toBe(18);
        expect(corner.e.capex).toBeGreaterThan(center.e.capex);
    });

    it("демо окупается: ворота в центре — около 3 лет, в углу — дольше, но покупка всё равно выгоднее", () => {
        const verdictFor = (dock: "center" | "corner") => {
            const { r, e } = unitsFor(dock);
            const n = normsFor(NORMS, r);
            return { e, v: verdict(computeScenario("baseline", SITE, r, n), e, computeScenario("raas", SITE, r, n), n) };
        };
        const center = verdictFor("center");
        const corner = verdictFor("corner");
        expect(center.e.paybackYears).toBeGreaterThanOrEqual(2.5);
        expect(center.e.paybackYears).toBeLessThanOrEqual(3.5);
        expect(center.e.budgetShare).toBeLessThanOrEqual(1);
        expect(center.v.winner).toBe("buy");
        expect(corner.e.paybackYears).toBeGreaterThan(center.e.paybackYears! + 0.8);
        expect(corner.e.roi).toBeGreaterThan(0);
        expect(corner.v.winner).toBe("buy");
    });

    it("заявленная производителем производительность ограничивает маршрутную сверху", () => {
        const r = toRobotInput({ ...H1500, throughputPerHour: 30, throughputSource: "specs" }, P, E, { dock: "center" });
        expect(r.throughputPerHour).toBe(30);
        expect(r.throughputBasis).toBe("passport");
    });

    it("стационарная система считается по паспорту", () => {
        const r = toRobotInput({ ...H1500, type: "ASRS", throughputPerHour: 150 }, P, E);
        expect(r.route).toBeNull();
        expect(r.throughputPerHour).toBe(150);
    });

    it("заданный пользователем коэффициент использования не подменяется", () => {
        const r = toRobotInput(H1500, P, E);
        expect(normsFor({ ...NORMS, utilization: 0.6 }, r).utilization).toBe(0.6);
    });

    it("витрина, отчёт и схема дают одно и то же число роботов", () => {
        const routeOpts = { dock: "corner" as const };
        const report = computeScenario("buy", SITE, toRobotInput(H1500, P, E, routeOpts), normsFor(NORMS, toRobotInput(H1500, P, E, routeOpts)));
        const [ranked] = rankOffers(
            [{ id: "h1500", robot: H1500, minAisle: 1.5, status: "operation", ugt: 9, verified: true }],
            SITE, NORMS, 5, 2, { form: P, econ: E, routeOpts },
        );
        const scheme = buildScenarios(P, H1500, E, undefined, routeOpts)[1];
        const schemeUnits = scheme.kpis.find((k) => k.id === "units")?.value;
        expect(ranked.economics.units).toBe(report.units);
        expect(schemeUnits).toBe(report.units);
        expect(scheme.kpis.find((k) => k.id === "route")?.value).toBe(46.8);
        expect(scheme.assumptions.some((a) => a.title === "Маршрут и время цикла")).toBe(true);
    });
});
