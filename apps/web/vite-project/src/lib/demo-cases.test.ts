import { describe, expect, it } from "vitest";
import { DEMO_CASES, applyParams, getDemoCase, staffFor, type DemoParams } from "./demo-cases";
import { getInvalidFields, getMissingFields } from "../store/store";
import { getEconInvalid, getEconMissing } from "../store/econStore";

// Крайние положения каждого ползунка и значения по умолчанию
function corners(c: (typeof DEMO_CASES)[number]): DemoParams[] {
    const lo = Object.fromEntries(Object.entries(c.ranges).map(([k, r]) => [k, r.min])) as DemoParams;
    const hi = Object.fromEntries(Object.entries(c.ranges).map(([k, r]) => [k, r.max])) as DemoParams;
    return [c.defaults, lo, hi, { ...lo, volume: hi.volume }, { ...hi, area: lo.area }];
}

describe("демо-примеры", () => {
    it.each(DEMO_CASES.map((c) => [c.title, c] as const))("%s: значения по умолчанию лежат в диапазонах ползунков", (_, c) => {
        for (const [key, range] of Object.entries(c.ranges)) {
            const v = c.defaults[key as keyof DemoParams];
            expect(v).toBeGreaterThanOrEqual(range.min);
            expect(v).toBeLessThanOrEqual(range.max);
        }
    });

    it.each(DEMO_CASES.map((c) => [c.title, c] as const))("%s: любое положение ползунков проходит валидацию обеих форм", (_, c) => {
        for (const params of corners(c)) {
            const { form, econ } = applyParams(c, params);
            expect(getMissingFields(form)).toEqual([]);
            expect(getInvalidFields(form)).toEqual([]);
            expect(getEconMissing(econ)).toEqual([]);
            expect(getEconInvalid(econ)).toEqual([]);
        }
    });

    it.each(DEMO_CASES.map((c) => [c.title, c] as const))("%s: формы не противоречат друг другу", (_, c) => {
        for (const params of corners(c)) {
            const { form, econ } = applyParams(c, params);
            const area = Number(form.width) * Number(form.length);
            // Площадь из габаритов совпадает с рабочей площадью экономики и близка к ползунку
            expect(econ.activeAreaM2).toBe(area);
            expect(Math.abs(area - params.area) / params.area).toBeLessThan(0.05);
            // Всего персонала — сумма групп
            expect(econ.staffTotal).toBe(Number(econ.staffPickers) + Number(econ.staffForklift) + Number(econ.staffPackers));
            // Рабочие часы объекта — смены × длительность, не больше суток
            expect(form.workHours).toBe(Math.min(24, Number(econ.shiftsPerDay) * Number(econ.shiftHours)));
            expect(Number(form.workHours)).toBeLessThanOrEqual(24);
        }
    });

    it("объём, персонал и зарплата ложатся в поля своего типа груза", () => {
        const pallet = getDemoCase("pallet");
        const pv = { ...pallet.defaults, volume: 2400, salary: 95_000 };
        const p = applyParams(pallet, pv);
        expect(Number(p.form.receivePalletsDay) + Number(p.form.shipPalletsDay)).toBe(2400);
        expect(p.econ.staffForklift).toBe(staffFor(pallet, pv));
        expect(p.econ.salaryForklift).toBe(95_000);

        const ecom = getDemoCase("ecom");
        const ev = { ...ecom.defaults, volume: 12_000, salary: 80_000 };
        const e = applyParams(ecom, ev);
        expect(e.form.pickLinesDay).toBe(12_000);
        expect(e.econ.staffPickers).toBe(staffFor(ecom, ev));
        expect(e.econ.salaryPicker).toBe(80_000);
    });

    it("персонал растёт вместе с объёмом и считается по выработке модели", () => {
        const ecom = getDemoCase("ecom");
        // 9 000 строк ÷ (20 строк/ч × 11 ч смены) = 40,9 → 41 человек
        expect(staffFor(ecom, { ...ecom.defaults, volume: 9000, shifts: 2 })).toBe(41);
        const lo = staffFor(ecom, { ...ecom.defaults, volume: ecom.ranges.volume.min });
        const hi = staffFor(ecom, { ...ecom.defaults, volume: ecom.ranges.volume.max });
        expect(hi).toBeGreaterThan(lo);
    });

    it("неизвестный пример — первый по списку", () => {
        expect(getDemoCase("nope").id).toBe(DEMO_CASES[0].id);
        expect(getDemoCase(null).id).toBe(DEMO_CASES[0].id);
    });
});
