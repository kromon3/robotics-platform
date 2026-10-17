import { describe, expect, it } from "vitest";
import type { Product } from "../api/catalog.ts";
import { toVizRobot } from "../viz/robotSpecs";
import { analyzeRows } from "./compare";
import { cardSpecs, formatSourceDate, productRows, provenanceRows, specRows, specsSourceLabel, type ProductCompareItem } from "./product-compare";

const product = (over: Partial<Product> & { specs?: Record<string, unknown> }): Product => ({
    id: "p",
    name: "Робот",
    type: "brs",
    status: "operation",
    subtype: null,
    category: null,
    description: null,
    price: null,
    ugt: null,
    marketPotential: null,
    specs: {},
    sourceUrl: null,
    sourceDate: null,
    verified: false,
    catalogVersion: 1,
    companyId: "c",
    company: { id: "c", name: "Компания", region: null },
    ...over,
});

// toLocaleString("ru-RU") разделяет тысячи неразрывным пробелом — в ожиданиях пишем обычный
const sp = (s: string | null) => s?.replace(/[\u00a0\u202f]/g, " ") ?? null;

const item = (p: Product): ProductCompareItem => ({ product: p, robot: toVizRobot(p) });

const ronavi = item(
    product({
        id: "r1",
        name: "Ronavi H1500",
        price: "2700000",
        verified: true,
        sourceUrl: "https://ronavi-robotics.ru/catalogue/h1500",
        sourceDate: "2026-09-20",
        specs: { robot_type: "AMR", payload_kg: 1500, speed_mps: 1.5, runtime_h: 10, charge_h: 2, length_mm: 1044, width_mm: 654, lift_height_mm: 0 },
    }),
);
const other = item(
    product({
        id: "r2",
        name: "AMR 800",
        price: "1900000",
        sourceDate: "2026-05-01",
        specs: { robot_type: "AMR", payload_kg: "800", speed_mps: "1,4", charge_h: 2 },
    }),
);
// Решение без ТТХ: в каталоге — «нет данных», а не типовые значения класса
const bare = item(product({ id: "r3", name: "Без ТТХ" }));

const rowOf = (label: string, mode: "declared" | "model" = "declared") => productRows(mode).find((r) => r.label === label)!;

describe("строки сравнения каталога", () => {
    it("в каталоге не подставляются типовые значения: нет ТТХ — нет данных", () => {
        expect(rowOf("Грузоподъёмность").value(bare)).toBeNull();
        expect(rowOf("Скорость").value(bare)).toBeNull();
        expect(specsSourceLabel(bare, "declared")).toBe("ТТХ не заявлены");
    });

    it("на витрине — значения модели, с которыми идёт расчёт", () => {
        expect(rowOf("Грузоподъёмность", "model").value(bare)).not.toBeNull();
        expect(specsSourceLabel(bare, "model")).toBe("типовые для класса");
    });

    it("единица одна на строку: строковые и числовые specs приводятся одинаково", () => {
        expect(rowOf("Скорость").value(ronavi)).toBe("1,5 м/с");
        expect(rowOf("Скорость").value(other)).toBe("1,4 м/с");
        expect(sp(rowOf("Габариты (Д × Ш)").value(ronavi))).toBe("1 044 × 654 мм");
    });

    it("0 в ТТХ — не заявлено, а не «0 мм»", () => {
        expect(rowOf("Высота подъёма").value(ronavi)).toBeNull();
    });

    it("лучшее: грузоподъёмность и скорость — больше, цена — меньше", () => {
        const set = [ronavi, other];
        const analyzed = analyzeRows(productRows("declared"), set);
        const best = (label: string) => [...analyzed.find((a) => a.row.label === label)!.best];
        expect(best("Грузоподъёмность")).toEqual([0]);
        expect(best("Скорость")).toEqual([0]);
        expect(best("Цена за единицу")).toEqual([1]);
        expect(best("Дата данных")).toEqual([0]);
        // Время зарядки одинаковое — ни различия, ни лучшего
        const charge = analyzed.find((a) => a.row.label === "Время зарядки")!;
        expect(charge.differs).toBe(false);
        expect(charge.best.size).toBe(0);
    });

    it("цена «по запросу» не участвует в выборе лучшей", () => {
        const analyzed = analyzeRows(productRows("declared"), [ronavi, bare]);
        const price = analyzed.find((a) => a.row.label === "Цена за единицу")!;
        expect(price.differs).toBe(true);
        expect(price.best.size).toBe(0);
    });

    it("происхождение данных: проверка, дата, источник", () => {
        const label = (l: string, i: ProductCompareItem) => provenanceRows("declared").find((r) => r.label === l)!.value(i);
        expect(label("Достоверность", ronavi)).toBe("Подтверждены");
        expect(label("Достоверность", other)).toBe("Требуют проверки");
        expect(label("Дата данных", ronavi)).toBe("20.09.2026");
        expect(label("Ссылка на источник", ronavi)).toBe("ronavi-robotics.ru");
        expect(label("Ссылка на источник", other)).toBeNull();
    });

    it("в строках каталога нет экономики", () => {
        const labels = productRows("declared").map((r) => r.label.toLowerCase());
        expect(labels.some((l) => /окупаем|opex|capex|роботов|эффект/.test(l))).toBe(false);
    });

    it("на карточке — четыре ключевые характеристики", () => {
        expect(cardSpecs(ronavi, "declared").map((s) => ({ ...s, value: sp(s.value) }))).toEqual([
            { label: "Грузоподъёмность", value: "1 500 кг" },
            { label: "Скорость", value: "1,5 м/с" },
            { label: "Габариты", value: "1 044 × 654 мм" },
            { label: "На заряде", value: "10 ч" },
        ]);
        expect(cardSpecs(bare, "declared").every((s) => s.value === null)).toBe(true);
        expect(specRows("model").length).toBe(specRows("declared").length);
    });

    it("дата из Excel-выгрузки: серийный номер, в том числе уже ставший «46292 годом»", () => {
        expect(formatSourceDate("46292")).toBe("27.09.2026");
        expect(formatSourceDate("+046289-01-01T00:00:00.000Z")).toBe("24.09.2026");
        expect(formatSourceDate("2026-09-20T00:00:00.000Z")).toBe("20.09.2026");
    });

    it("дата: мусор не превращается в Invalid Date", () => {
        expect(formatSourceDate("не дата")).toBeNull();
        expect(formatSourceDate(null)).toBeNull();
    });
});

describe("ссылка на источник", () => {
    it("кривой адрес не растягивает таблицу", () => {
        const broken = item(product({ sourceUrl: "https://en.galaxis-tech.com (amr robot solutions pdf)" }));
        const row = provenanceRows("declared").find((r) => r.label === "Ссылка на источник")!;
        expect(row.value(broken)).toBe("ссылка");
        expect(row.href!(broken)).toBe("https://en.galaxis-tech.com (amr robot solutions pdf)");
    });
});
