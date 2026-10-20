import { describe, expect, it } from "vitest";
import { SAVED_MAX_SEGMENTS, deserializeDrawing, dxfToDrawing, fileKind, guessUnits, measure, serializeDrawing } from "./drawing";

// Минимальный DXF собираем из пар «код группы / значение» — так, как его пишет AutoCAD
const pairs = (...items: (string | number)[]) => items.join("\n");

function dxf({ insunits, entities, blocks = "" }: { insunits?: number; entities: string; blocks?: string }) {
    const header = insunits === undefined ? "" : pairs(0, "SECTION", 2, "HEADER", 9, "$INSUNITS", 70, insunits, 0, "ENDSEC");
    const blockSection = blocks ? pairs(0, "SECTION", 2, "BLOCKS", blocks, 0, "ENDSEC") : "";
    return [header, blockSection, pairs(0, "SECTION", 2, "ENTITIES", entities, 0, "ENDSEC", 0, "EOF")].filter(Boolean).join("\n");
}

const polyline = (pts: [number, number][], closed = true) =>
    pairs(0, "LWPOLYLINE", 8, "Стены", 90, pts.length, 70, closed ? 1 : 0, ...pts.flatMap(([x, y]) => [10, x, 20, y]));

const line = (x1: number, y1: number, x2: number, y2: number) => pairs(0, "LINE", 8, "0", 10, x1, 20, y1, 11, x2, 21, y2);

const rect = (w: number, l: number): [number, number][] => [[0, 0], [w, 0], [w, l], [0, l]];

describe("чертёж склада из DXF", () => {
    it("габариты и площадь берутся из контура здания в единицах файла", () => {
        const d = dxfToDrawing(dxf({ insunits: 4, entities: polyline(rect(60_000, 40_000)) }), "склад.dxf");
        expect(d.units).toBe("mm");
        expect(d.unitsSource).toBe("file");
        const m = measure(d);
        expect(m.widthM).toBeCloseTo(60);
        expect(m.lengthM).toBeCloseTo(40);
        expect(m.areaM2).toBeCloseTo(2400);
        expect(m.byOutline).toBe(true);
    });

    it("площадь Г-образного здания — по контуру, а не по рамке", () => {
        // Рамка 60 × 40 м, но вырезан угол 20 × 20 м
        const lShape: [number, number][] = [[0, 0], [60, 0], [60, 20], [40, 20], [40, 40], [0, 40]];
        const m = measure(dxfToDrawing(dxf({ insunits: 6, entities: polyline(lShape) }), "г.dxf"));
        expect(m.widthM).toBeCloseTo(60);
        expect(m.lengthM).toBeCloseTo(40);
        expect(m.areaM2).toBeCloseTo(2400 - 400);
    });

    it("контур — наибольшая замкнутая полилиния, внутренние контуры не мешают", () => {
        const entities = [polyline(rect(48, 30)), polyline([[5, 5], [10, 5], [10, 8], [5, 8]])].join("\n");
        const m = measure(dxfToDrawing(dxf({ insunits: 6, entities }), "с колонной.dxf"));
        expect(m.widthM).toBeCloseTo(48);
        expect(m.areaM2).toBeCloseTo(48 * 30);
    });

    it("без единиц в файле угадывает по размеру и даёт их поменять", () => {
        const d = dxfToDrawing(dxf({ entities: polyline(rect(48_000, 30_000)) }), "без единиц.dxf");
        expect(d.units).toBe("mm");
        expect(d.unitsSource).toBe("guess");
        expect(measure(d).widthM).toBeCloseTo(48);
        // Пользователь знает, что чертёж в сантиметрах
        expect(measure(d, "cm").widthM).toBeCloseTo(480);
    });

    it("догадка по размеру: склад 5–1000 м", () => {
        expect(guessUnits(60_000)).toBe("mm");
        expect(guessUnits(4_800)).toBe("cm");
        expect(guessUnits(60)).toBe("m");
    });

    it("без замкнутого контура — рамка всех линий, площадь честно помечена как по рамке", () => {
        const entities = [line(0, 0, 50, 0), line(50, 0, 50, 20), line(0, 0, 0, 20)].join("\n");
        const m = measure(dxfToDrawing(dxf({ insunits: 6, entities }), "линии.dxf"));
        expect(m.widthM).toBeCloseTo(50);
        expect(m.lengthM).toBeCloseTo(20);
        expect(m.byOutline).toBe(false);
    });

    it("ось Y переворачивается: верх чертежа — верх схемы", () => {
        // Отрезок по верхней стене здания (y = 30 в DXF) на схеме должен оказаться при y = 0
        const entities = [polyline(rect(48, 30)), line(0, 30, 48, 30)].join("\n");
        const m = measure(dxfToDrawing(dxf({ insunits: 6, entities }), "y.dxf"));
        const top = m.segmentsM[m.segmentsM.length - 1];
        expect(top[1]).toBeCloseTo(0);
        expect(top[3]).toBeCloseTo(0);
    });

    it("блоки разворачиваются с положением и поворотом", () => {
        // Блок «стеллаж» — отрезок длиной 10 вдоль X; вставлен в точку (20, 5) с поворотом на 90°
        const blocks = pairs(0, "BLOCK", 8, "0", 2, "Стеллаж", 70, 0, 10, 0, 20, 0, 30, 0, 3, "Стеллаж", line(0, 0, 10, 0), 0, "ENDBLK");
        const insert = pairs(0, "INSERT", 8, "0", 2, "Стеллаж", 10, 20, 20, 5, 30, 0, 50, 90);
        const d = dxfToDrawing(dxf({ insunits: 6, entities: [polyline(rect(48, 30)), insert].join("\n"), blocks }), "блок.dxf");
        const seg = d.segments[d.segments.length - 1];
        expect(seg[0]).toBeCloseTo(20);
        expect(seg[1]).toBeCloseTo(5);
        expect(seg[2]).toBeCloseTo(20);
        expect(seg[3]).toBeCloseTo(15);
    });

    it("пустой или повреждённый файл — понятная ошибка", () => {
        // В чертеже только подпись, ни одной линии
        const onlyText = pairs(0, "TEXT", 8, "0", 10, 0, 20, 0, 40, 2.5, 1, "Склад");
        expect(() => dxfToDrawing(dxf({ insunits: 4, entities: onlyText }), "только текст.dxf")).toThrow(/нет линий/);
        expect(() => dxfToDrawing("это не DXF", "мусор.dxf")).toThrow(/DXF/);
    });

    it("тип файла по расширению", () => {
        expect(fileKind("План.DXF")).toBe("dxf");
        expect(fileKind("plan.dwg")).toBe("dwg");
        expect(fileKind("scan.pdf")).toBe("pdf");
        expect(fileKind("photo.JPG")).toBe("image");
        expect(fileKind("notes.txt")).toBe("unknown");
    });
});

describe("чертёж сохраняется вместе с расчётом", () => {
    const plan = () => {
        // Контур 60 × 40 м в миллиметрах и 8 рядов стеллажей
        const racks = Array.from({ length: 8 }, (_, i) => polyline(rect(50_000, 1100).map(([x, y]) => [x + 4000, y + 4000 + i * 4200] as [number, number])));
        return dxfToDrawing(dxf({ insunits: 4, entities: [polyline(rect(60_000, 40_000)), ...racks].join("\n") }), "план.dxf");
    };

    it("после сохранения и открытия габариты, площадь и линии те же", () => {
        const d = plan();
        const before = measure(d);
        const restored = deserializeDrawing(JSON.parse(JSON.stringify(serializeDrawing(d, d.units, true))));
        expect(restored).not.toBeNull();
        const after = measure(restored!.drawing);
        expect(after.widthM).toBeCloseTo(before.widthM, 1);
        expect(after.lengthM).toBeCloseTo(before.lengthM, 1);
        expect(after.areaM2).toBeCloseTo(before.areaM2, 0);
        expect(after.segmentsM).toHaveLength(before.segmentsM.length);
        expect(restored!.applied).toBe(true);
        expect(restored!.drawing.name).toBe("план.dxf");
    });

    it("учитывает выбранные пользователем единицы", () => {
        const d = plan();
        // Пользователь сказал, что чертёж в сантиметрах — сохраняется именно так
        const restored = deserializeDrawing(serializeDrawing(d, "cm", false))!;
        expect(measure(restored.drawing).widthM).toBeCloseTo(600, 0);
    });

    it("огромный чертёж ужимается до лимита запроса, длинные линии остаются", () => {
        // 20 000 коротких отрезков-«мебели» и одна длинная стена
        const noise = Array.from({ length: 20_000 }, (_, i) => line(i % 500, Math.floor(i / 500), (i % 500) + 0.3, Math.floor(i / 500))).join("\n");
        const d = dxfToDrawing(dxf({ insunits: 6, entities: [noise, line(0, 0, 500, 0)].join("\n") }), "шум.dxf");
        const saved = serializeDrawing(d, "m", false);
        expect(JSON.stringify(saved).length).toBeLessThanOrEqual(80_000);
        expect(saved.s.length / 4).toBeLessThanOrEqual(SAVED_MAX_SEGMENTS);
        expect(saved.total).toBe(20_001);
        // Стена длиной 500 м — среди сохранённых первой
        expect(saved.s.slice(0, 4)).toEqual([0, 0, 5000, 0]);
        const restored = deserializeDrawing(saved)!;
        expect(restored.drawing.stats.truncated).toBe(true);
    });

    it("мусор с сервера не восстанавливается", () => {
        expect(deserializeDrawing(null)).toBeNull();
        expect(deserializeDrawing({ v: 2, name: "x", s: [0, 0, 1, 1] })).toBeNull();
        expect(deserializeDrawing({ v: 1, name: "x", s: [0, 0, 1] })).toBeNull();
        expect(deserializeDrawing({ v: 1, name: "x", s: [0, 0, "1", 1] })).toBeNull();
        expect(deserializeDrawing({ v: 1, name: "x", s: [] })).toBeNull();
    });
});
