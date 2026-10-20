// Внешний контур здания из разрозненных линий. В настоящих чертежах стены часто начерчены
// отдельными отрезками и дугами, а не одной замкнутой полилинией: концы чуть не сходятся,
// линии заходят друг за друга крестом, перегородки упираются в стену буквой «Т».
// Как собираем: режем линии в точках пересечения, стягиваем концы ближе допуска в одну точку,
// отбрасываем «хвосты» (линии, которые никуда не ведут), и обходим внешнюю границу
// каждой связной части чертежа, всё время поворачивая как можно правее. Берём наибольшую по площади.

export type Pt = { x: number; y: number };
type Seg = [number, number, number, number];

export type Contour = {
    points: Pt[];
    area: number;
    /** С каким допуском сошлись концы линий — в единицах чертежа */
    tolerance: number;
    /** Сколько ещё замкнутых контуров лежит вне найденного: взяли наибольший, но стоит проверить */
    others: number;
};

/** Больше линий не режем друг о друга — внешние стены всё равно среди самых длинных */
const MAX_SEGMENTS = 4000;

const segLen = ([x1, y1, x2, y2]: Seg) => Math.hypot(x2 - x1, y2 - y1);

function signedArea(pts: Pt[]): number {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
}

/**
 * Внешний контур: пробуем допуски от меньшего к большему и берём больший допуск, только если
 * с ним контур заметно больше — то есть концы стен действительно не сходились.
 */
export function outerContour(segments: Seg[], tolerances: number[]): Contour | null {
    const input = segments.length > MAX_SEGMENTS ? [...segments].sort((a, b) => segLen(b) - segLen(a)).slice(0, MAX_SEGMENTS) : segments;
    let best: Contour | null = null;
    for (const tol of tolerances) {
        const c = contourAt(input, tol);
        if (c && (!best || c.area > best.area * 1.001)) best = c;
    }
    return best;
}

function contourAt(segments: Seg[], tol: number): Contour | null {
    const pieces = node(segments, tol);

    // Стягиваем близкие концы: первая точка в окрестности становится общей вершиной
    const pts: Pt[] = [];
    const grid = new Map<string, number[]>();
    const vertex = (x: number, y: number) => {
        const cx = Math.floor(x / tol);
        const cy = Math.floor(y / tol);
        for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++)
                for (const i of grid.get(`${cx + dx},${cy + dy}`) ?? []) if (Math.hypot(pts[i].x - x, pts[i].y - y) <= tol) return i;
        pts.push({ x, y });
        const key = `${cx},${cy}`;
        const cell = grid.get(key);
        if (cell) cell.push(pts.length - 1);
        else grid.set(key, [pts.length - 1]);
        return pts.length - 1;
    };

    const adj = new Map<number, Set<number>>();
    const link = (a: number, b: number) => {
        if (!adj.has(a)) adj.set(a, new Set());
        adj.get(a)!.add(b);
    };
    for (const [x1, y1, x2, y2] of pieces) {
        const a = vertex(x1, y1);
        const b = vertex(x2, y2);
        if (a === b) continue;
        link(a, b);
        link(b, a);
    }

    // Хвосты — незамкнутые линии, размеры, выносы — контура не образуют: обрезаем до циклов
    const queue = [...adj.keys()].filter((v) => adj.get(v)!.size <= 1);
    while (queue.length) {
        const v = queue.pop()!;
        const near = adj.get(v);
        if (!near) continue;
        adj.delete(v);
        for (const w of near) {
            const ws = adj.get(w);
            if (!ws) continue;
            ws.delete(v);
            if (ws.size <= 1) queue.push(w);
        }
    }
    if (adj.size === 0) return null;

    // Каждая связная часть — свой внешний контур
    const seen = new Set<number>();
    const found: { points: Pt[]; area: number; box: Box }[] = [];
    for (const v of adj.keys()) {
        if (seen.has(v)) continue;
        const part: number[] = [];
        const stack = [v];
        seen.add(v);
        while (stack.length) {
            const u = stack.pop()!;
            part.push(u);
            for (const w of adj.get(u)!) {
                if (seen.has(w)) continue;
                seen.add(w);
                stack.push(w);
            }
        }
        const start = part.reduce((s, u) => (pts[u].x < pts[s].x || (pts[u].x === pts[s].x && pts[u].y < pts[s].y) ? u : s));
        const ring = walkOuter(start, adj, pts).map((i) => pts[i]);
        const area = Math.abs(signedArea(ring));
        if (area > 0) found.push({ points: ring, area, box: boxOf(ring) });
    }
    if (!found.length) return null;

    const main = found.reduce((a, b) => (b.area > a.area ? b : a));
    // Стеллажи и колонны внутри здания — тоже замкнутые контуры, но они внутри: о них не предупреждаем
    const others = found.filter((f) => f !== main && !inside(f.box, main.box)).length;
    return { points: main.points, area: main.area, tolerance: tol, others };
}

type Box = { minX: number; minY: number; maxX: number; maxY: number };

function boxOf(pts: Pt[]): Box {
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const inside = (a: Box, b: Box) => a.minX >= b.minX && a.maxX <= b.maxX && a.minY >= b.minY && a.maxY <= b.maxY;

/**
 * Обход внешней границы против часовой стрелки: начинаем с самой левой нижней вершины
 * и на каждой развилке берём самый правый поворот — снаружи от него уже ничего нет.
 */
function walkOuter(start: number, adj: Map<number, Set<number>>, pts: Pt[]): number[] {
    const angle = (from: number, to: number) => Math.atan2(pts[to].y - pts[from].y, pts[to].x - pts[from].x);
    const path: number[] = [];
    let cur = start;
    // Как будто пришли снизу: всё, что есть у самой левой нижней вершины, лежит выше или правее
    let back = -Math.PI / 2;
    let first = -1;
    let edges = 0;
    for (const s of adj.values()) edges += s.size;

    for (let step = 0; step <= edges + 1; step++) {
        let next = -1;
        let bestTurn = Infinity;
        for (const w of adj.get(cur)!) {
            let turn = (angle(cur, w) - back) % (2 * Math.PI);
            if (turn < 0) turn += 2 * Math.PI;
            // Назад — только из тупика
            if (turn < 1e-12) turn = 2 * Math.PI;
            if (turn < bestTurn) {
                bestTurn = turn;
                next = w;
            }
        }
        if (step === 0) first = next;
        else if (cur === start && next === first) break;
        path.push(cur);
        back = angle(next, cur);
        cur = next;
    }
    return path;
}

/**
 * Режем отрезки в точках пересечения (в том числе почти-пересечения ближе допуска — недотянутая
 * до стены линия). Перебор с отсечением по X: отрезки отсортированы по левому краю.
 */
function node(segments: Seg[], tol: number): Seg[] {
    const items = segments
        .filter((s) => segLen(s) > tol)
        .map((s) => ({ s, minX: Math.min(s[0], s[2]), maxX: Math.max(s[0], s[2]), minY: Math.min(s[1], s[3]), maxY: Math.max(s[1], s[3]), cuts: [0, 1] }))
        .sort((a, b) => a.minX - b.minX);

    for (let i = 0; i < items.length; i++) {
        const a = items[i];
        for (let j = i + 1; j < items.length && items[j].minX <= a.maxX + tol; j++) {
            const b = items[j];
            if (b.minY > a.maxY + tol || b.maxY < a.minY - tol) continue;
            cross(a.s, b.s, tol, a.cuts, b.cuts);
        }
    }

    const out: Seg[] = [];
    for (const { s, cuts } of items) {
        const ts = [...new Set(cuts)].sort((x, y) => x - y);
        const at = (t: number): [number, number] => [s[0] + (s[2] - s[0]) * t, s[1] + (s[3] - s[1]) * t];
        for (let k = 0; k + 1 < ts.length; k++) out.push([...at(ts[k]), ...at(ts[k + 1])]);
    }
    return out;
}

function cross(a: Seg, b: Seg, tol: number, cutsA: number[], cutsB: number[]) {
    const rx = a[2] - a[0], ry = a[3] - a[1];
    const sx = b[2] - b[0], sy = b[3] - b[1];
    const la = Math.hypot(rx, ry);
    const lb = Math.hypot(sx, sy);
    const qx = b[0] - a[0], qy = b[1] - a[1];
    const denom = rx * sy - ry * sx;
    const clamp = (t: number) => Math.min(1, Math.max(0, t));

    if (Math.abs(denom) > 1e-9 * la * lb) {
        const t = (qx * sy - qy * sx) / denom;
        const u = (qx * ry - qy * rx) / denom;
        // Допуск по длине: конец, не дотянутый до другой линии меньше чем на tol, считаем касанием
        if (t >= -tol / la && t <= 1 + tol / la && u >= -tol / lb && u <= 1 + tol / lb) {
            cutsA.push(clamp(t));
            cutsB.push(clamp(u));
        }
        return;
    }
    // Параллельные: если лежат на одной прямой — режем каждую концами другой
    const onLine = (px: number, py: number, s: Seg, len: number, cuts: number[]) => {
        const dx = s[2] - s[0], dy = s[3] - s[1];
        const t = ((px - s[0]) * dx + (py - s[1]) * dy) / (len * len);
        if (t <= 0 || t >= 1) return;
        const dist = Math.abs((px - s[0]) * dy - (py - s[1]) * dx) / len;
        if (dist <= tol) cuts.push(t);
    };
    onLine(b[0], b[1], a, la, cutsA);
    onLine(b[2], b[3], a, la, cutsA);
    onLine(a[0], a[1], b, lb, cutsB);
    onLine(a[2], a[3], b, lb, cutsB);
}
