import { describe, expect, it } from "vitest";
import {
    DEFAULT_NORMS,
    baselineLaborCost,
    budgetZone,
    capexItems,
    computeScenario,
    effectiveThroughput,
    laborSaving,
    opexItems,
    paybackZone,
    peakDemandPerHour,
    robotsRequired,
    roiZone,
    verdict,
    workersPerRobot,
    type Norms,
    type RobotInput,
    type SiteInput,
} from "./economics";

// Контрольный расчёт из документа экономистов «Экономическая_модель_хакатон_2026_v2».
// Входные данные — §2, ожидаемые значения — §3, §4, §6, §16.3.
const SITE: SiteInput = {
    inboundPerDay: 1000,
    outboundPerDay: 1000,
    shiftsPerDay: 2,
    shiftHours: 11,
    workingDaysPerYear: 365,
    peakFactor: 1.5,
    staffCount: 25,
    staffSalaryMonth: 120_000,
    budget: 80_000_000,
};
const ROBOT: RobotInput = { name: "AMR (контрольный пример)", price: 8_000_000, throughputPerHour: 90 };
// В арифметике §16.3 проценты ПО/интеграции/ПНР считаются от стоимости роботов без зарядок
const NORMS: Norms = { ...DEFAULT_NORMS, percentBase: "equipment" };

const total = (items: { value: number }[]) => items.reduce((a, i) => a + i.value, 0);

describe("§3. Количество роботов", () => {
    it("пиковая потребность — 136,36 паллет/ч", () => {
        expect(peakDemandPerHour(SITE)).toBeCloseTo(136.36, 1);
    });
    it("эффективная производительность — 63 паллет/ч", () => {
        expect(effectiveThroughput(ROBOT, NORMS)).toBeCloseTo(63, 5);
    });
    it("требуется 3 робота", () => {
        expect(robotsRequired(SITE, ROBOT, NORMS)).toBe(3);
    });
});

describe("§4. Базовый сценарий", () => {
    it("годовой ФОТ 25 операторов — 46 872 000 ₽", () => {
        expect(baselineLaborCost(SITE, NORMS)).toBeCloseTo(46_872_000, 0);
    });
    it("один робот замещает 4,2 человека", () => {
        expect(workersPerRobot(ROBOT, NORMS)).toBeCloseTo(4.2, 2);
    });
    it("замещается 12,6 человек, экономия ФОТ 23 623 488 ₽/год", () => {
        const { replaced, saving } = laborSaving(SITE, ROBOT, NORMS);
        expect(replaced).toBeCloseTo(12.6, 2);
        expect(saving).toBeCloseTo(23_623_488, 0);
    });
});

describe("§16.3. CAPEX по статьям", () => {
    const items = capexItems(SITE, ROBOT, NORMS);
    const byKey = (k: string) => items.find((i) => i.key === k)!.value;

    it.each([
        ["equipment", 24_000_000],
        ["chargers", 3_000_000],
        ["software", 2_400_000],
        ["integration", 2_400_000],
        ["commissioning", 1_800_000],
        ["training", 300_000],
        ["floor", 1_250_000],
        ["spare", 540_000],
        ["reserve", 3_569_000],
    ])("%s = %i ₽", (key, expected) => {
        expect(byKey(key as string)).toBeCloseTo(expected as number, 0);
    });

    it("CAPEX до резерва — 35 690 000 ₽, итого — 39 259 000 ₽", () => {
        const all = total(items);
        expect(all - byKey("reserve")).toBeCloseTo(35_690_000, 0);
        expect(all).toBeCloseTo(39_259_000, 0);
    });
});

describe("§6. OPEX покупки", () => {
    const items = opexItems(SITE, ROBOT, NORMS);
    const byKey = (k: string) => items.find((i) => i.key === k)!.value;

    it("электроэнергия — 385 440 ₽/год", () => {
        expect(byKey("energy")).toBeCloseTo(385_440, 0);
    });
    it("персонал эксплуатации — 3 749 760 ₽/год", () => {
        expect(byKey("opsStaff")).toBeCloseTo(3_749_760, 0);
    });
    it("итого OPEX — 8 215 200 ₽/год", () => {
        expect(total(items)).toBeCloseTo(8_215_200, 0);
    });
});

describe("§9. Итоговые показатели (покупка)", () => {
    const buy = computeScenario("buy", SITE, ROBOT, NORMS);

    it("годовой эффект — 15 408 288 ₽/год", () => {
        expect(buy.annualEffect).toBeCloseTo(15_408_288, 0);
    });
    // §10 документа приводит payback 2,36 и ROI 111,9% — они посчитаны от CAPEX 36,355 млн
    // (версия §5, до добавления зарядных станций). Для итогового CAPEX 39,259 млн из §16.3
    // те же формулы дают 2,55 года и 96%.
    it("срок окупаемости — 2,55 года при CAPEX 39,259 млн", () => {
        expect(buy.paybackYears).toBeCloseTo(2.55, 1);
    });
    it("ROI за 5 лет — 96%", () => {
        expect(buy.roi).toBeCloseTo(96, 0);
    });
    it("TCO за 5 лет — 80 335 000 ₽", () => {
        expect(buy.tco).toBeCloseTo(80_335_000, 0);
    });
    it("CAPEX / бюджет — 49%", () => {
        expect(buy.budgetShare! * 100).toBeCloseTo(49.07, 1);
    });
});

describe("§8. RaaS", () => {
    const raas = computeScenario("raas", SITE, ROBOT, NORMS);

    it("OPEX — 3 робота × 250 000 ₽/мес × 12 = 9 000 000 ₽/год", () => {
        expect(raas.opex).toBeCloseTo(9_000_000, 0);
    });
    it("TCO за 5 лет — 45 000 000 ₽ при нулевом разовом платеже", () => {
        expect(raas.tco).toBeCloseTo(45_000_000, 0);
    });
    it("без разового платежа срок окупаемости не определён (§8.6)", () => {
        expect(raas.paybackYears).toBeNull();
    });
});

describe("§11. Зоны интерпретации", () => {
    it.each([
        [2.5, "green"],
        [3, "yellow"],
        [4.5, "red"],
    ])("окупаемость %s года — %s", (years, zone) => {
        expect(paybackZone(years as number)).toBe(zone);
    });
    it.each([
        [50, "green"],
        [10, "yellow"],
        [-5, "red"],
    ])("ROI %i%% — %s", (roi, zone) => {
        expect(roiZone(roi as number)).toBe(zone);
    });
    it.each([
        [1, "green"],
        [1.1, "yellow"],
        [1.5, "red"],
    ])("CAPEX/бюджет %s — %s", (share, zone) => {
        expect(budgetZone(share as number)).toBe(zone);
    });
});

describe("§12. Заключение по сценариям", () => {
    const base = computeScenario("baseline", SITE, ROBOT, NORMS);
    const buy = computeScenario("buy", SITE, ROBOT, NORMS);
    const raas = computeScenario("raas", SITE, ROBOT, NORMS);

    it("на контрольном примере рекомендует сценарий с меньшим TCO", () => {
        const v = verdict(base, buy, raas, NORMS);
        const cheaper = buy.tco <= raas.tco ? "buy" : "raas";
        expect(v.winner).toBe(cheaper);
        expect(v.reasons.length).toBeGreaterThan(0);
        // Разрыв TCO считается как «RaaS минус покупка»: плюс — покупка дешевле
        expect(v.tcoGap).toBeCloseTo(raas.tco - buy.tco, 6);
    });

    it("не рекомендует роботизацию, когда она дороже, чем ничего не делать", () => {
        // Один оператор: замещать почти нечего, а парк роботов нужен тот же
        const tinySite: SiteInput = { ...SITE, staffCount: 1 };
        const b = computeScenario("baseline", tinySite, ROBOT, NORMS);
        const bu = computeScenario("buy", tinySite, ROBOT, NORMS);
        const ra = computeScenario("raas", tinySite, ROBOT, NORMS);

        const v = verdict(b, bu, ra, NORMS);
        expect(v.winner).toBe("none");
        expect(v.headline).toMatch(/не окупается/);
    });

    it("предупреждает, когда CAPEX не помещается в бюджет", () => {
        const poorSite: SiteInput = { ...SITE, budget: 1_000_000 };
        const b = computeScenario("baseline", poorSite, ROBOT, NORMS);
        const bu = computeScenario("buy", poorSite, ROBOT, NORMS);
        const ra = computeScenario("raas", poorSite, ROBOT, NORMS);

        const v = verdict(b, bu, ra, NORMS);
        if (v.winner === "buy") {
            expect(v.caveats.some((c) => /бюджет/i.test(c))).toBe(true);
        }
    });

    it("всегда добавляет оговорку об ограничениях модели", () => {
        const v = verdict(base, buy, raas, NORMS);
        expect(v.caveats.some((c) => /дисконтирован/i.test(c))).toBe(true);
    });
});
