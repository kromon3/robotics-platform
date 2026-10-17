import { describe, expect, it } from "vitest";
import {
    COMPARE_LIMIT,
    analyzeRows,
    bestIndices,
    hasAnyValue,
    parseCompareIds,
    rowDiffers,
    serializeCompareIds,
    toggleCompareId,
    type CompareRow,
} from "./compare";

type Item = { name: string; payload: number | null; charge: number | null; nav: string | null };

const items: Item[] = [
    { name: "A", payload: 1500, charge: 2, nav: "SLAM" },
    { name: "B", payload: 2000, charge: 3, nav: "SLAM" },
    { name: "C", payload: null, charge: 2, nav: null },
];

const num = (get: (i: Item) => number | null, best?: "min" | "max", unit = ""): CompareRow<Item> => ({
    group: "Характеристики",
    label: "x",
    value: (i) => (get(i) === null ? null : `${get(i)} ${unit}`),
    num: get,
    best,
});

describe("сравнение: различия в строке", () => {
    it("одинаковые значения — не различие", () => {
        const row: CompareRow<Item> = { group: "g", label: "nav", value: (i) => i.nav };
        expect(rowDiffers(row, items.slice(0, 2))).toBe(false);
    });

    it("«нет данных» против значения — различие", () => {
        const row: CompareRow<Item> = { group: "g", label: "nav", value: (i) => i.nav };
        expect(rowDiffers(row, items)).toBe(true);
    });

    it("у одного решения различий не бывает", () => {
        expect(rowDiffers(num((i) => i.payload), [items[0]])).toBe(false);
    });

    it("строка без данных у всех не показывается", () => {
        const empty: CompareRow<Item> = { group: "g", label: "e", value: () => null };
        expect(hasAnyValue(empty, items)).toBe(false);
        expect(hasAnyValue(num((i) => i.payload), items)).toBe(true);
    });
});

describe("сравнение: лучшее значение", () => {
    it("больше — лучше: максимум, пропуски не участвуют", () => {
        expect([...bestIndices(num((i) => i.payload, "max"), items)]).toEqual([1]);
    });

    it("меньше — лучше: при равенстве отмечаются все лучшие", () => {
        expect([...bestIndices(num((i) => i.charge, "min"), items)]).toEqual([0, 2]);
    });

    it("без направления лучшее не отмечается", () => {
        expect(bestIndices(num((i) => i.payload), items).size).toBe(0);
    });

    it("все значения равны — лучшего нет", () => {
        const same = [items[0], { ...items[1], charge: 2 }];
        expect(bestIndices(num((i) => i.charge, "min"), same).size).toBe(0);
    });

    it("данные только у одного решения — «лучше неизвестного» не бывает", () => {
        const one = [items[0], { ...items[2] }];
        expect(bestIndices(num((i) => i.payload, "max"), one).size).toBe(0);
    });

    it("analyzeRows отдаёт и различие, и лучшее", () => {
        const [a] = analyzeRows([num((i) => i.payload, "max", "кг")], items);
        expect(a.differs).toBe(true);
        expect(a.best.has(1)).toBe(true);
    });
});

describe("сравнение: выбор решений", () => {
    it("лимит — три решения", () => {
        expect(COMPARE_LIMIT).toBe(3);
    });

    it("добавляет и снимает отметку", () => {
        const added = toggleCompareId(["a"], "b");
        expect(added).toEqual({ ids: ["a", "b"], status: "added" });
        expect(toggleCompareId(added.ids, "a")).toEqual({ ids: ["b"], status: "removed" });
    });

    it("четвёртое решение не добавляется, набор не меняется", () => {
        const full = ["a", "b", "c"];
        const r = toggleCompareId(full, "d");
        expect(r.status).toBe("limit");
        expect(r.ids).toEqual(full);
    });

    it("при полном наборе отметку можно снять", () => {
        expect(toggleCompareId(["a", "b", "c"], "b")).toEqual({ ids: ["a", "c"], status: "removed" });
    });

    it("набор из адреса: без пустых, без повторов, не больше лимита", () => {
        expect(parseCompareIds(" a,,b,a , c,d")).toEqual(["a", "b", "c"]);
        expect(parseCompareIds(null)).toEqual([]);
        expect(parseCompareIds(serializeCompareIds(["x", "y"]))).toEqual(["x", "y"]);
    });
});
