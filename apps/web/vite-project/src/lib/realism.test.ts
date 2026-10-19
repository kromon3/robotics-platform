import { describe, expect, it } from "vitest";
import { EXAMPLE, toNumericFormData, type ProjectFormData } from "../store/store";
import { ECON_EXAMPLE, toEconNumeric, type EconFormData } from "../store/econStore";
import { checkRealism, dailyOperations } from "./realism";

/** Числа в сообщениях форматируются как в модуле: в ru-RU разряды разделяет неразрывный пробел */
const ru = (n: number) => n.toLocaleString("ru-RU");

const form = (patch: Partial<ProjectFormData> = {}) => toNumericFormData({ ...EXAMPLE, ...patch });
const econ = (patch: Partial<EconFormData> = {}) => toEconNumeric({ ...ECON_EXAMPLE, ...patch });
const keys = (patch?: Partial<ProjectFormData>, e?: Partial<EconFormData>) =>
    checkRealism(form(patch), e === undefined ? undefined : econ(e)).map((w) => w.key);

describe("проверка сочетаний параметров", () => {
    it("пример из формы противоречий не содержит", () => {
        // Если это упало — разошлись EXAMPLE и ECON_EXAMPLE, а не проверки:
        // пример показывается пользователю кнопкой «Заполнить примером» и обязан быть согласованным
        expect(checkRealism(form(), econ())).toEqual([]);
    });

    describe("интенсивность на площадь", () => {
        it("6000 строк на складе 10 × 10 м — так не бывает", () => {
            const [w] = checkRealism(form({ width: 10, length: 10 }));
            expect(w.key).toBe("density");
            expect(w.note).toContain(ru(6000));
            expect(w.note).toContain("100 м²");
            expect(w.note).toContain("60");
        });

        it("тот же объём на нормальной площади проверку проходит", () => {
            expect(keys({ width: 48, length: 30 })).not.toContain("density");
        });

        it("для паллетного склада считается приёмка и отгрузка, а порог свой", () => {
            // 2000 + 2000 поддонов на 3000 м² — 1,3 на метр, это рабочий режим РЦ
            const pallet = { cargoType: "pallet" as const, width: 75, length: 40, receivePalletsDay: 2000, shipPalletsDay: 2000 };
            expect(dailyOperations(form(pallet))).toBe(4000);
            expect(keys(pallet)).not.toContain("density");
            // А те же 4000 поддонов на 200 м² — уже нет
            expect(keys({ ...pallet, width: 20, length: 10 })).toContain("density");
        });
    });

    it("штук отбирается меньше, чем строк — логически невозможно", () => {
        expect(keys({ pickLinesDay: 6000, pickPiecesDay: 100 })).toContain("piecesVsLines");
        expect(keys({ pickLinesDay: 6000, pickPiecesDay: 6000 })).not.toContain("piecesVsLines");
    });

    describe("места хранения против площади", () => {
        it("20 000 паллетомест на 1440 м² не поместятся", () => {
            const found = checkRealism(form({ palletPlaces: 20_000 })).find((w) => w.key === "placesVsArea");
            expect(found).toBeDefined();
            expect(found!.note).toContain(`${ru(20_000)} мест`);
            expect(found!.note).toContain("яруса");
        });

        it("200 мест на той же площади — нормально", () => {
            expect(keys({ palletPlaces: 200 })).not.toContain("placesVsArea");
        });
    });

    describe("проход против груза", () => {
        it("проход уже узкой стороны груза", () => {
            // Паллета 1200 × 800: узкая сторона 0,8 м, проход 0,5 м — не провезти
            expect(keys({ cargoType: "pallet", aisleWidth: 0.5 })).toContain("aisleVsCargo");
        });

        it("длинномер везут вдоль прохода, поэтому длина 6 м проход не ограничивает", () => {
            // Иначе любой длинномерный склад получал бы предупреждение на ровном месте
            expect(keys({ rackType: "cantilever", cargoType: "long", aisleWidth: 2 })).not.toContain("aisleVsCargo");
        });
    });

    describe("вторая фаза визарда", () => {
        it("без экономики проверки по персоналу и календарю не выполняются", () => {
            const onlyPhase1 = keys({ workHours: 8 });
            expect(onlyPhase1).not.toContain("hoursVsShifts");
            expect(onlyPhase1).not.toContain("staffShortfall");
        });

        it("часы работы объекта расходятся со сменами", () => {
            // 22 ч в первой фазе против 1 × 8 ч во второй — это один и тот же календарь
            const w = checkRealism(form({ workHours: 22 }), econ({ shiftsPerDay: 1, shiftHours: 8 })).find(
                (x) => x.key === "hoursVsShifts",
            );
            expect(w).toBeDefined();
            expect(w!.note).toContain("22");
            expect(w!.note).toContain("8");
        });

        it("час разницы — округление, а не противоречие", () => {
            expect(keys({ workHours: 22 }, { shiftsPerDay: 2, shiftHours: 11.5 })).not.toContain("hoursVsShifts");
        });

        it("отборщиков не хватает на объём", () => {
            // 6000 строк при 20 строк/ч и смене 11 ч требуют ~28 человек
            const w = checkRealism(form(), econ({ staffPickers: 5 })).find((x) => x.key === "staffShortfall");
            expect(w).toBeDefined();
            expect(w!.note).toContain("28 чел.");
            expect(w!.note).toContain("5");
        });

        it("отборщиков вдвое с лишним больше, чем нужно", () => {
            expect(keys({}, { staffPickers: 120 })).toContain("staffExcess");
        });

        it("между нехваткой и избытком предупреждения нет", () => {
            const mid = keys({}, { staffPickers: 28 });
            expect(mid).not.toContain("staffShortfall");
            expect(mid).not.toContain("staffExcess");
        });

        it("на паллетном складе численность отборщиков не проверяется", () => {
            // Работу делают водители погрузчиков, а норматива их выработки в форме нет
            const pallet = { cargoType: "pallet" as const, width: 75, length: 40, receivePalletsDay: 2000, shipPalletsDay: 2000 };
            expect(keys(pallet, { staffPickers: 1 })).not.toContain("staffShortfall");
        });
    });

    it("несколько противоречий сообщаются разом", () => {
        const found = keys({ width: 10, length: 10, pickPiecesDay: 10 }, { staffPickers: 2 });
        expect(found).toEqual(expect.arrayContaining(["density", "piecesVsLines", "staffShortfall"]));
    });
});
