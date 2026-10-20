// Импорт по умолчанию, а не { DxfParser }: в браузере берётся ESM-сборка пакета, где есть оба варианта,
// а в Node (тесты) — CommonJS, где класс и есть весь модуль и именованного экспорта нет
import DxfParser from "dxf-parser";
import type { IDxf, IEntity, IPoint } from "dxf-parser";
import { outerContour } from "./contour";

// Чертёж склада из AutoCAD (DXF). Минимально рабочий, а не декоративный: из чертежа берутся
// реальные габариты и площадь контура здания — они уходят в расчёт (модель маршрута → число
// роботов → CAPEX и окупаемость; площадь → подготовка пола). Сами линии рисуются поверх схемы.
// Чего здесь нет: расстановки стеллажей и маршрутов по реальным стенам — это отдельная задача.

export type DrawingUnits = "mm" | "cm" | "m" | "in" | "ft";

export const UNIT_LABEL: Record<DrawingUnits, string> = { mm: "мм", cm: "см", m: "м", in: "дюймы", ft: "футы" };
const TO_METERS: Record<DrawingUnits, number> = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 };
// $INSUNITS по спецификации DXF; 0 — «без единиц», тогда угадываем по размеру
const INSUNITS: Record<number, DrawingUnits> = { 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m" };

/** Отрезок [x1, y1, x2, y2] */
export type Segment = [number, number, number, number];
type Pt = { x: number; y: number };

export type Drawing = {
    name: string;
    units: DrawingUnits;
    /** Откуда единицы: заголовок файла или догадка по размеру чертежа */
    unitsSource: "file" | "guess";
    /** Отрезки в единицах файла — единицы можно поменять без повторного разбора */
    segments: Segment[];
    /** Контур здания — замкнутая полилиния или собранный из отдельных линий; нет — берём рамку всех линий */
    outline: Pt[] | null;
    /** Сколько сущностей разобрано и каких типов пропущено */
    stats: { entities: number; skipped: Record<string, number>; truncated: boolean; outline?: OutlineInfo };
};

/** Откуда контур: из полилинии или собран из линий — и насколько пришлось стягивать концы */
export type OutlineInfo = {
    from: "polyline" | "lines";
    /** Наибольший зазор между концами линий, который пришлось закрыть, в метрах */
    gapM: number;
    /** Сколько ещё замкнутых контуров вне найденного */
    others: number;
};

export type Measured = {
    widthM: number;
    lengthM: number;
    areaM2: number;
    /** Площадь посчитана по контуру здания (true) или по прямоугольной рамке (false) */
    byOutline: boolean;
    /** Отрезки в метрах: начало координат — левый верхний угол контура, ось Y вниз, как на схеме */
    segmentsM: Segment[];
    /** Контур здания в тех же координатах — чтобы показать, что именно нашли */
    outlineM: [number, number][] | null;
};

/** Больше отрезков схема не тянет без тормозов; для плана склада этого достаточно с запасом */
const MAX_SEGMENTS = 60_000;
/** Вложенные блоки (INSERT внутри блока) разворачиваем не глубже — защита от зацикленных ссылок */
const MAX_DEPTH = 4;
const ARC_STEPS = 24;
/** Допуски стягивания концов линий, м: 0,01 мм — погрешность чисел, 1 мм — неаккуратная привязка, 1 см — уже повод проверить */
const SNAP_M = [0.00001, 0.001, 0.01];

type Transform = (p: Pt) => Pt;
const identity: Transform = (p) => p;

/** Число шагов для дуги: полная окружность — ARC_STEPS, короткая дуга — меньше, но не меньше двух */
const arcSteps = (sweep: number) => Math.max(2, Math.ceil((ARC_STEPS * Math.abs(sweep)) / (2 * Math.PI)));

type BulgeVertex = IPoint & { bulge?: number };

/**
 * Вершины полилинии с дугами. В DXF скругление хранится в вершине как bulge = tg(угол дуги / 4):
 * дуга идёт от этой вершины к следующей, знак — направление. Без этого скругления превращаются в хорды.
 */
export function expandBulges(vertices: BulgeVertex[], closed: boolean): Pt[] {
    const out: Pt[] = [];
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
        const a = vertices[i];
        out.push({ x: a.x, y: a.y });
        const b = vertices[(i + 1) % n];
        const bulge = a.bulge ?? 0;
        if (!bulge || (!closed && i === n - 1)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const chord = Math.hypot(dx, dy);
        if (chord === 0) continue;
        // Центр — на перпендикуляре к хорде; при bulge > 0 дуга против часовой, центр слева
        const off = (1 - bulge * bulge) / (4 * bulge);
        const c = { x: (a.x + b.x) / 2 - dy * off, y: (a.y + b.y) / 2 + dx * off };
        const r = Math.hypot(a.x - c.x, a.y - c.y);
        const start = Math.atan2(a.y - c.y, a.x - c.x);
        const sweep = 4 * Math.atan(bulge);
        const steps = arcSteps(sweep);
        for (let k = 1; k < steps; k++) {
            const t = start + (sweep * k) / steps;
            out.push({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) });
        }
    }
    return out;
}

/** Точка B-сплайна по алгоритму де Бура; веса рациональных сплайнов dxf-parser не читает — для плана это не важно */
function deBoor(ctrl: IPoint[], knots: number[], p: number, t: number): Pt {
    let k = p;
    while (k < ctrl.length - 1 && t >= knots[k + 1]) k++;
    const d = Array.from({ length: p + 1 }, (_, j) => ({ x: ctrl[j + k - p].x, y: ctrl[j + k - p].y }));
    for (let r = 1; r <= p; r++) {
        for (let j = p; j >= r; j--) {
            const i = j + k - p;
            const denom = knots[i + p - r + 1] - knots[i];
            const alpha = denom === 0 ? 0 : (t - knots[i]) / denom;
            d[j] = { x: (1 - alpha) * d[j - 1].x + alpha * d[j].x, y: (1 - alpha) * d[j - 1].y + alpha * d[j].y };
        }
    }
    return d[p];
}

/** Сплайн ломаной: по узлам и контрольным точкам, если их хватает; иначе — через точки, по которым его строили */
function splinePoints(ent: Record<string, unknown>): Pt[] {
    const ctrl = (ent.controlPoints as IPoint[] | undefined) ?? [];
    const knots = (ent.knotValues as number[] | undefined) ?? [];
    const p = (ent.degreeOfSplineCurve as number | undefined) ?? 3;
    if (ctrl.length > p && knots.length === ctrl.length + p + 1) {
        const t0 = knots[p];
        const t1 = knots[ctrl.length];
        const steps = Math.max(ARC_STEPS, ctrl.length * 4);
        return Array.from({ length: steps + 1 }, (_, i) => deBoor(ctrl, knots, p, t0 + ((t1 - t0) * i) / steps));
    }
    const fit = (ent.fitPoints as IPoint[] | undefined) ?? [];
    return fit.length >= 2 ? fit : ctrl;
}

function shoelace(pts: Pt[]): number {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
}

function bbox(segments: Segment[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x1, y1, x2, y2] of segments) {
        minX = Math.min(minX, x1, x2);
        maxX = Math.max(maxX, x1, x2);
        minY = Math.min(minY, y1, y2);
        maxY = Math.max(maxY, y1, y2);
    }
    return { minX, minY, maxX, maxY };
}

const pointsBox = (pts: Pt[]) =>
    bbox(pts.map((p, i) => [p.x, p.y, pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y] as Segment));

/**
 * Единицы, если в файле их нет. Склад — от 5 до 1000 м, поэтому по наибольшему размеру:
 * от 5 000 — миллиметры (5–1000 м), от 500 — сантиметры (5–50 м), меньше — метры.
 * Российские архитектурные чертежи почти всегда в миллиметрах. Пользователь может поправить.
 */
export function guessUnits(maxExtent: number): DrawingUnits {
    if (maxExtent >= 5000) return "mm";
    if (maxExtent >= 500) return "cm";
    return "m";
}

export function dxfToDrawing(text: string, name: string): Drawing {
    let dxf: IDxf | null;
    try {
        dxf = new DxfParser().parseSync(text);
    } catch (error) {
        throw new Error(`Не удалось прочитать DXF: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
    if (!dxf || !Array.isArray(dxf.entities)) throw new Error("Не удалось прочитать DXF: файл пустой или повреждён");

    const segments: Segment[] = [];
    const skipped: Record<string, number> = {};
    const closed: Pt[][] = [];
    let truncated = false;

    const push = (a: Pt, b: Pt) => {
        if (segments.length >= MAX_SEGMENTS) {
            truncated = true;
            return;
        }
        segments.push([a.x, a.y, b.x, b.y]);
    };

    const walk = (entities: IEntity[], tf: Transform, depth: number, topLevel: boolean) => {
        for (const e of entities) {
            const ent = e as IEntity & Record<string, unknown>;
            switch (e.type) {
                case "LINE": {
                    const v = ent.vertices as IPoint[] | undefined;
                    if (v && v.length >= 2) push(tf(v[0]), tf(v[1]));
                    break;
                }
                case "LWPOLYLINE":
                case "POLYLINE": {
                    const isClosed = Boolean(ent.shape);
                    const v = expandBulges((ent.vertices as BulgeVertex[] | undefined) ?? [], isClosed).map(tf);
                    for (let i = 0; i + 1 < v.length; i++) push(v[i], v[i + 1]);
                    if (isClosed && v.length > 2) {
                        push(v[v.length - 1], v[0]);
                        // Контуром здания может быть только полилиния самого чертежа, не деталь блока
                        if (topLevel) closed.push(v);
                    }
                    break;
                }
                case "ELLIPSE": {
                    const c = ent.center as IPoint;
                    const m = ent.majorAxisEndPoint as IPoint;
                    const ratio = (ent.axisRatio as number) || 1;
                    const start = (ent.startAngle as number) ?? 0;
                    let end = (ent.endAngle as number) ?? Math.PI * 2;
                    if (end <= start) end += Math.PI * 2;
                    // Точка эллипса: центр + большая полуось · cos t + малая (большая, повёрнутая на 90°, × ratio) · sin t
                    const at = (t: number) =>
                        tf({ x: c.x + m.x * Math.cos(t) - m.y * ratio * Math.sin(t), y: c.y + m.y * Math.cos(t) + m.x * ratio * Math.sin(t) });
                    const steps = arcSteps(end - start);
                    for (let i = 0; i < steps; i++) push(at(start + ((end - start) * i) / steps), at(start + ((end - start) * (i + 1)) / steps));
                    break;
                }
                case "SPLINE": {
                    const v = splinePoints(ent).map(tf);
                    for (let i = 0; i + 1 < v.length; i++) push(v[i], v[i + 1]);
                    if (ent.closed && v.length > 2) push(v[v.length - 1], v[0]);
                    break;
                }
                case "CIRCLE":
                case "ARC": {
                    const c = ent.center as IPoint;
                    const r = ent.radius as number;
                    const start = e.type === "CIRCLE" ? 0 : (ent.startAngle as number);
                    let end = e.type === "CIRCLE" ? Math.PI * 2 : (ent.endAngle as number);
                    if (end < start) end += Math.PI * 2;
                    let prev = tf({ x: c.x + r * Math.cos(start), y: c.y + r * Math.sin(start) });
                    for (let i = 1; i <= ARC_STEPS; i++) {
                        const a = start + ((end - start) * i) / ARC_STEPS;
                        const next = tf({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
                        push(prev, next);
                        prev = next;
                    }
                    break;
                }
                case "INSERT": {
                    // Блок — стеллаж, ворота, колонна: разворачиваем с его положением, масштабом и поворотом
                    const block = dxf!.blocks?.[ent.name as string];
                    if (!block?.entities || depth >= MAX_DEPTH) {
                        skipped.INSERT = (skipped.INSERT ?? 0) + 1;
                        break;
                    }
                    const pos = ent.position as IPoint;
                    const base = (block.position as IPoint | undefined) ?? { x: 0, y: 0 };
                    const sx = (ent.xScale as number) || 1;
                    const sy = (ent.yScale as number) || 1;
                    const rot = (((ent.rotation as number) || 0) * Math.PI) / 180;
                    const cos = Math.cos(rot);
                    const sin = Math.sin(rot);
                    const local: Transform = (p) => {
                        const x = (p.x - base.x) * sx;
                        const y = (p.y - base.y) * sy;
                        return tf({ x: pos.x + x * cos - y * sin, y: pos.y + x * sin + y * cos });
                    };
                    walk(block.entities, local, depth + 1, false);
                    break;
                }
                default:
                    // Текст, размеры, штриховка — для габаритов не нужны
                    skipped[e.type] = (skipped[e.type] ?? 0) + 1;
            }
        }
    };

    walk(dxf.entities, identity, 0, true);
    if (segments.length === 0) throw new Error("В чертеже нет линий: нужны отрезки или полилинии с контуром здания");

    const header = dxf.header?.$INSUNITS;
    const fromFile = typeof header === "number" ? INSUNITS[header] : undefined;
    const all = bbox(segments);
    const guessAll = guessUnits(Math.max(all.maxX - all.minX, all.maxY - all.minY));

    // Контур здания: наибольшая замкнутая полилиния — или внешняя граница, собранная из всех линий,
    // если она больше (стены отдельными отрезками, здание из нескольких полилиний)
    // Контур должен быть зданием, а не стеллажом внутри стен с проёмами ворот: если он не дотягивает
    // до половины чертежа хотя бы по одной стороне — не доверяем ему и честно берём рамку
    const covers = (pts: Pt[]) => {
        const b = pointsBox(pts);
        return (b.maxX - b.minX) * 2 >= all.maxX - all.minX && (b.maxY - b.minY) * 2 >= all.maxY - all.minY;
    };
    const largest = closed.length ? closed.reduce((best, p) => (shoelace(p) > shoelace(best) ? p : best)) : null;
    const polyline = largest && covers(largest) ? largest : null;
    const polyArea = polyline ? shoelace(polyline) : 0;
    const k = TO_METERS[fromFile ?? guessAll];
    const assembled = outerContour(segments, SNAP_M.map((m) => m / k));
    const useAssembled = assembled !== null && covers(assembled.points) && assembled.area > polyArea * 1.001;

    let outline: Pt[] | null = polyline;
    let info: OutlineInfo | undefined = polyline ? { from: "polyline", gapM: 0, others: 0 } : undefined;
    if (useAssembled) {
        outline = assembled.points;
        info = { from: "lines", gapM: assembled.tolerance * k, others: assembled.others };
    }

    const box = outline ? pointsBox(outline) : all;

    return {
        name,
        units: fromFile ?? guessUnits(Math.max(box.maxX - box.minX, box.maxY - box.minY)),
        unitsSource: fromFile ? "file" : "guess",
        segments,
        outline,
        stats: { entities: dxf.entities.length, skipped, truncated, outline: info },
    };
}

/** Габариты и площадь в метрах + отрезки в координатах схемы (метры, ось Y вниз) */
export function measure(d: Drawing, units: DrawingUnits = d.units): Measured {
    const k = TO_METERS[units];
    const box = d.outline ? pointsBox(d.outline) : bbox(d.segments);
    const widthM = (box.maxX - box.minX) * k;
    const lengthM = (box.maxY - box.minY) * k;
    // В DXF ось Y смотрит вверх, на схеме — вниз: отражаем относительно верхней границы контура
    const toSchema = (x: number, y: number): [number, number] => [(x - box.minX) * k, (box.maxY - y) * k];
    return {
        widthM,
        lengthM,
        areaM2: d.outline ? shoelace(d.outline) * k * k : widthM * lengthM,
        byOutline: d.outline !== null,
        segmentsM: d.segments.map(([x1, y1, x2, y2]) => [...toSchema(x1, y1), ...toSchema(x2, y2)] as Segment),
        outlineM: d.outline ? d.outline.map((p) => toSchema(p.x, p.y)) : null,
    };
}

/** Какой файл загружен — по расширению; DWG отдельно, его браузер не читает */
export type DrawingFileKind = "dxf" | "image" | "pdf" | "dwg" | "unknown";

export function fileKind(fileName: string): DrawingFileKind {
    const ext = fileName.toLowerCase().split(".").pop() ?? "";
    if (ext === "dxf") return "dxf";
    if (ext === "dwg") return "dwg";
    if (ext === "pdf") return "pdf";
    if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return "image";
    return "unknown";
}

// ── Сохранение чертежа вместе с расчётом ────────────────────────────────────────────────
// Кладём в params расчёта упрощённую копию: бэкенд принимает JSON до 100 КБ, а в настоящем
// чертеже бывают десятки тысяч линий. Оставляем самые длинные (стены, ряды стеллажей), координаты —
// целыми дециметрами в метрической системе чертежа: точность 10 см, а линия на схеме толще.

/** Сколько линий сохраняем; плюс контроль размера ниже — на случай нетипично длинных чисел */
export const SAVED_MAX_SEGMENTS = 3000;
const SAVED_MAX_BYTES = 80_000;

export type SavedDrawing = {
    v: 1;
    name: string;
    /** Габариты подставлены в форму — чтобы карточка показала «✓ Габариты в расчёте» */
    applied: boolean;
    /** Отрезки x1,y1,x2,y2 подряд, дециметры, оси как в DXF (Y вверх) */
    s: number[];
    /** Контур здания x,y подряд, дециметры; null — контура нет */
    o: number[] | null;
    /** Сколько линий было в исходном чертеже — если сохранили не все, карточка об этом скажет */
    total: number;
};

const toDm = (v: number, k: number) => Math.round(v * k * 10);

export function serializeDrawing(d: Drawing, units: DrawingUnits, applied: boolean): SavedDrawing {
    const k = TO_METERS[units];
    const len = ([x1, y1, x2, y2]: Segment) => Math.hypot(x2 - x1, y2 - y1);
    const byLength = d.segments.length > SAVED_MAX_SEGMENTS ? [...d.segments].sort((a, b) => len(b) - len(a)) : d.segments;
    const outline = d.outline ? d.outline.flatMap((p) => [toDm(p.x, k), toDm(p.y, k)]) : null;

    let keep = Math.min(SAVED_MAX_SEGMENTS, byLength.length);
    for (;;) {
        const saved: SavedDrawing = {
            v: 1,
            name: d.name,
            applied,
            s: byLength.slice(0, keep).flatMap((seg) => seg.map((v) => toDm(v, k))),
            o: outline,
            total: d.segments.length,
        };
        if (JSON.stringify(saved).length <= SAVED_MAX_BYTES || keep <= 100) return saved;
        keep = Math.floor(keep * 0.8);
    }
}

const isNumArray = (v: unknown, multipleOf: number): v is number[] =>
    Array.isArray(v) && v.length % multipleOf === 0 && v.every((x) => typeof x === "number" && Number.isFinite(x));

/** Обратно в чертёж (в метрах). Данные пришли с сервера — проверяем форму, мусор не восстанавливаем */
export function deserializeDrawing(raw: unknown): { drawing: Drawing; applied: boolean; total: number } | null {
    const s = raw as Partial<SavedDrawing> | null;
    if (!s || s.v !== 1 || typeof s.name !== "string" || !isNumArray(s.s, 4) || s.s.length === 0) return null;
    if (s.o !== null && s.o !== undefined && !isNumArray(s.o, 2)) return null;

    const segments: Segment[] = [];
    for (let i = 0; i < s.s.length; i += 4) segments.push([s.s[i] / 10, s.s[i + 1] / 10, s.s[i + 2] / 10, s.s[i + 3] / 10]);
    const outline = s.o && s.o.length >= 6 ? Array.from({ length: s.o.length / 2 }, (_, i) => ({ x: s.o![2 * i] / 10, y: s.o![2 * i + 1] / 10 })) : null;

    return {
        drawing: {
            name: s.name,
            units: "m",
            unitsSource: "file",
            segments,
            outline,
            stats: { entities: segments.length, skipped: {}, truncated: (s.total ?? segments.length) > segments.length },
        },
        applied: Boolean(s.applied),
        total: typeof s.total === "number" ? s.total : segments.length,
    };
}
