// Превращает результат расчёта в геометрию: ячейки, стеллажи, точки, роботы и описание маршрутов для симуляции.
// Ячейка = стеллажи + проход(ы) + точка приёма (IN) + точка выдачи (OUT) + зарядка + робот(ы).
import { minAisle } from './rules';

const M = 1, GAP_X = 1.5, GAP_Y = 3;
const even = (n) => n + (n % 2);

export function deepGeometry(rack, unit) {
  const lanes = Math.max(1, Math.floor(rack.w / Math.max(0.5, unit.w + 0.1)));
  const depth = Math.max(2, Math.min(12, Math.floor(rack.l / Math.max(0.4, unit.l))));
  return { lanes, depth, capacity: lanes * depth };
}
export function stackGeometry(w, l, unit) {
  const sw = unit.l + 0.15, sl = unit.w + 0.15;
  const cols = Math.max(1, Math.floor((w - 0.4) / sw)), rows = Math.max(1, Math.floor((l - 0.4) / sl));
  return { sw, sl, cols, rows, capacity: cols * rows };
}
// Вместимость одного стеллажного модуля (для расчёта числа стеллажей)
export function rackModuleCapacity(rack, unit) {
  if (rack.type === 'deep') return deepGeometry(rack, unit).capacity;
  if (rack.type === 'stack') return stackGeometry(rack.w, rack.l, unit).capacity;
  return Math.max(1, rack.capacityPerRack);
}

const marker = (id, role, cx, cy, s) => ({ id: `${id}-${role}`, kind: 'marker', role, x: cx - s / 2, y: cy - s / 2, w: s, l: s });

// ── Билдеры ячеек. Каждый возвращает { w, l, racks, make(ox, oy, id) → { items, desc } }
function rowsBuilder({ rack, unit, aisle, CH, perCell }) {
  const rpr = Math.ceil(perCell / 2), ZL = 2 * CH, ZR = CH, s = CH * 0.9;
  const w = ZL + rpr * rack.w + ZR, l = 2 * rack.l + aisle;
  const deep = rack.type === 'deep' ? deepGeometry(rack, unit) : null;
  return { w, l, racks: rpr * 2, make(ox, oy, id) {
    const items = [], nodes = [], laneY = oy + rack.l + aisle / 2;
    for (let i = 0; i < rpr; i++) for (const side of ['t', 'b']) {
      const x = ox + ZL + i * rack.w, y = side === 't' ? oy : oy + rack.l + aisle, rid = `${id}-${side}${i}`, nodeIds = [];
      if (deep) {
        for (let k = 0; k < deep.lanes; k++) {
          const local = (k + 0.5) * rack.w / deep.lanes, px = side === 'b' ? x + rack.w - local : x + local;
          nodes.push({ id: `${rid}-L${k}`, kind: 'lane', capacity: deep.depth, put: { x: px, y: laneY }, take: { x: px, y: laneY } });
          nodeIds.push(`${rid}-L${k}`);
        }
      } else {
        const p = { x: x + rack.w / 2, y: laneY };
        nodes.push({ id: rid, kind: 'count', capacity: rack.capacityPerRack, put: p, take: p });
        nodeIds.push(rid);
      }
      items.push({ id: rid, cell: id, kind: 'rack', type: rack.type, x, y, w: rack.w, l: rack.l, rot: side === 'b' ? 180 : 0, nodeIds, lanes: deep?.lanes });
    }
    items.push({ id: `${id}-aisle`, kind: 'aisle', x: ox, y: oy + rack.l, w, l: aisle });
    items.push(marker(id, 'charger', ox + CH / 2, laneY, s), marker(id, 'in', ox + 1.5 * CH, laneY, s), marker(id, 'out', ox + w - CH / 2, laneY, s));
    const desc = { mode: 'lanes', lanes: [laneY], corridors: [], nodes,
      stops: { charger: { x: ox + CH / 2, y: laneY }, in: { x: ox + 1.5 * CH, y: laneY }, out: { x: ox + w - CH / 2, y: laneY } } };
    return { items, desc };
  } };
}

// Поточный: вход с одной стороны (нижний проход A), выгрузка с противоположной (верхний проход B).
function flowBuilder({ rack, aisle, CH, perCell }) {
  const rpr = perCell, w = CH + rpr * rack.w + CH, l = aisle + rack.l + aisle, s = CH * 0.9;
  return { w, l, racks: rpr, make(ox, oy, id) {
    const items = [], nodes = [], laneB = oy + aisle / 2, laneA = oy + aisle + rack.l + aisle / 2;
    for (let i = 0; i < rpr; i++) {
      const x = ox + CH + i * rack.w, rid = `${id}-f${i}`, cx = x + rack.w / 2;
      nodes.push({ id: rid, kind: 'count', capacity: rack.capacityPerRack, put: { x: cx, y: laneA }, take: { x: cx, y: laneB } });
      items.push({ id: rid, cell: id, kind: 'rack', type: 'flow', x, y: oy + aisle, w: rack.w, l: rack.l, rot: 0, nodeIds: [rid] });
    }
    const xl = ox + CH / 2, xr = ox + w - CH / 2;
    items.push({ id: `${id}-aisleB`, kind: 'aisle', x: ox, y: oy, w, l: aisle }, { id: `${id}-aisleA`, kind: 'aisle', x: ox, y: oy + aisle + rack.l, w, l: aisle });
    items.push(marker(id, 'charger', xl, laneB, s), marker(id, 'in', xl, laneA, s), marker(id, 'out', xr, laneB, s));
    const desc = { mode: 'lanes', lanes: [laneB, laneA], corridors: [xl, xr], nodes,
      stops: { charger: { x: xl, y: laneB }, in: { x: xl, y: laneA }, out: { x: xr, y: laneB } } };
    return { items, desc };
  } };
}

// Зона хранения (штабель): слоты заполняются с нуля слева направо и сверху вниз.
// Сверху — слоты, снизу — свободная полоса проезда. Роботы ездят только по полосе и заезжают в слот «снизу вверх»
// по ещё пустым рядам, поэтому по поставленному грузу не ездят.
function stackBuilder({ rack, unit, aisle, CH, perCell }) {
  const rpr = Math.ceil(perCell / 2), zoneW = rpr * rack.w, zoneL = 2 * rack.l + aisle, ZL = 2 * CH, s = CH * 0.9;
  const areaH = zoneL - aisle;
  const w = ZL + zoneW + CH, l = zoneL, g = stackGeometry(zoneW, areaH, unit);
  return { w, l, racks: rpr * 2, make(ox, oy, id) {
    const local = [], slots = [], x0 = (zoneW - g.cols * g.sw) / 2, y0 = (areaH - g.rows * g.sl) / 2;
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      const lx = x0 + (c + 0.5) * g.sw, ly = y0 + (r + 0.5) * g.sl;
      local.push({ x: lx, y: ly }); slots.push({ x: ox + ZL + lx, y: oy + ly });
    }
    const laneY = oy + zoneL - aisle / 2, nid = `${id}-Z`;
    const items = [
      { id: `${id}-zone`, cell: id, kind: 'zone', x: ox + ZL, y: oy, w: zoneW, l: zoneL, laneH: aisle, nodeId: nid, slotsLocal: local, slotW: g.sw - 0.15, slotL: g.sl - 0.15 },
      { id: `${id}-aisle`, kind: 'aisle', x: ox, y: oy + zoneL - aisle, w, l: aisle },
      marker(id, 'charger', ox + CH / 2, laneY, s), marker(id, 'in', ox + 1.5 * CH, laneY, s), marker(id, 'out', ox + w - CH / 2, laneY, s),
    ];
    const desc = { mode: 'grid', laneY, lanes: [], corridors: [], nodes: [{ id: nid, kind: 'ring', capacity: g.capacity, slots }],
      stops: { charger: { x: ox + CH / 2, y: laneY }, in: { x: ox + 1.5 * CH, y: laneY }, out: { x: ox + w - CH / 2, y: laneY } } };
    return { items, desc };
  } };
}

// Мезонин: платформа, в центре остров из маленьких стеллажей, по кругу ходит робособака/гуманоид.
function mezzBuilder({ rack, perCell }) {
  const RING = 1.2, sw = 1.2, sl = 0.5, perRow = Math.ceil(perCell / 2), s = 0.8;
  const pw = Math.max(rack.w, 2 * RING + perRow * sw), pl = Math.max(rack.l, 2 * RING + 2 * sl);
  return { w: pw, l: pl, racks: perRow * 2, make(ox, oy, id) {
    const iw = perRow * sw, ix = ox + (pw - iw) / 2, iy = oy + (pl - 2 * sl) / 2;
    const yT = iy - RING / 2, yB = iy + 2 * sl + RING / 2, xL = (ox + ix) / 2, xR = (ix + iw + ox + pw) / 2;
    const items = [{ id: `${id}-plat`, cell: id, kind: 'rack', type: 'mezzanine', x: ox, y: oy, w: pw, l: pl, rot: 0 }], nodes = [];
    for (let i = 0; i < perRow; i++) for (const side of ['t', 'b']) {
      const rid = `${id}-${side}${i}`, x = ix + i * sw, cx = x + sw / 2;
      nodes.push({ id: rid, kind: 'count', capacity: rack.capacityPerRack, put: { x: cx, y: side === 't' ? yT : yB }, take: { x: cx, y: side === 't' ? yT : yB } });
      items.push({ id: rid, cell: id, kind: 'rack', type: 'shelf', x, y: side === 't' ? iy : iy + sl, w: sw, l: sl, rot: side === 'b' ? 180 : 0, nodeIds: [rid] });
    }
    items.push(marker(id, 'charger', xL, yT, s), marker(id, 'in', xL, yB, s), marker(id, 'out', xR, yT, s));
    const desc = { mode: 'lanes', lanes: [yT, yB], corridors: [xL, xR], nodes,
      stops: { charger: { x: xL, y: yT }, in: { x: xL, y: yB }, out: { x: xR, y: yT } } };
    return { items, desc };
  } };
}

const BUILDERS = { shelf: rowsBuilder, deep: rowsBuilder, cantilever: rowsBuilder, flow: flowBuilder, stack: stackBuilder, mezzanine: mezzBuilder };

export function buildLayout(res) {
  const { warehouse, rack, cargo, robot, counts, stationary, simulation: sim } = res;
  const W = warehouse.width, L = warehouse.length, aisle = warehouse.aisleWidth, unit = cargo.unit;
  const CH = Math.min(1, aisle);
  const warnings = [], items = [], cells = [], robots = [];

  const stripW = stationary.length ? Math.max(...stationary.map((s) => s.w)) + M : 0;
  const availW = W - stripW;
  const robotsPerCell = counts.robotsPerCell;
  const mobile = !!robot && counts.robots > 0 && counts.racks > 0;
  // Груз на роботе — в реальных габаритах: коробка/паллета лежит на корпусе (у вилочных — на вилах), длинномер — балка вдоль движения
  const forks = !!robot && ['FMR', 'CTU'].includes(robot.type);
  const load = cargo.type === 'long' ? { w: Math.max(unit.w, 0.2), l: unit.l, dy: 0 }
    : { w: Math.max(unit.w, 0.2), l: Math.max(unit.l, 0.2), dy: forks ? robot.l / 2 + unit.l / 2 : 0 };

  let stats = { cellsNeeded: 0, cellsPlaced: 0, capacity: 0, racksPerCell: 0, robotsPerCell, racksPlaced: 0, robotsPlaced: 0, cellW: 0, cellL: 0, plannedOrders: 0 };

  if (mobile) {
    let cellsNeeded = Math.ceil(counts.robots / robotsPerCell);
    let perCell = Math.ceil(counts.racks / cellsNeeded);
    const build = (n) => BUILDERS[rack.type]({ rack, unit, aisle, CH, perCell: n });
    let B = build(perCell);
    // Ячейка шире склада: делим на более узкие. Ячеек и роботов становится больше, чем в расчёте — предупреждаем.
    if (B.w > availW - 2 * M) {
      while (B.w > availW - 2 * M && perCell > 1) { perCell -= 1; B = build(perCell); }
      if (B.w <= availW - 2 * M) {
        const n = Math.ceil(counts.racks / B.racks);
        if (n > cellsNeeded) warnings.push(`Ячейка не помещалась по ширине склада: разбита на более узкие. Ячеек ${n} вместо ${cellsNeeded}, роботов ${n * robotsPerCell} вместо ${counts.robots}.`);
        cellsNeeded = Math.max(cellsNeeded, n);
      }
    }
    const cols = Math.max(0, Math.floor((availW - 2 * M + GAP_X) / (B.w + GAP_X)));
    const rows = Math.max(0, Math.floor((L - 2 * M + GAP_Y) / (B.l + GAP_Y)));
    const capacity = cols * rows, placed = Math.min(cellsNeeded, capacity);
    if (placed < cellsNeeded) warnings.push(`Склад мал: помещается ${placed} из ${cellsNeeded} ячеек. Увеличьте площадь, уменьшите проход или выберите другой стеллаж.`);
    if (rack.type !== 'mezzanine' && aisle < minAisle(robot, cargo)) warnings.push(`Проход ${aisle} м уже рекомендуемого ${minAisle(robot, cargo)} м для ${robot.type} (робот ${robot.w}×${robot.l} м, груз ${unit.l} м).`);

    const uc = Math.min(cols, placed), ur = cols ? Math.ceil(placed / cols) : 0;
    const x0 = (availW - (uc * B.w + (uc - 1) * GAP_X)) / 2, y0 = (L - (ur * B.l + (ur - 1) * GAP_Y)) / 2;
    for (let i = 0; i < placed; i++) {
      const id = `cell${i + 1}`, ox = x0 + (i % cols) * (B.w + GAP_X), oy = y0 + Math.floor(i / cols) * (B.l + GAP_Y);
      const { items: it, desc } = B.make(ox, oy, id);
      items.push(...it, { id: `${id}-fence`, kind: 'fence', label: `Ячейка ${i + 1}`, x: ox - 0.25, y: oy - 0.25, w: B.w + 0.5, l: B.l + 0.5 });
      cells.push({ id, x: ox, y: oy, w: B.w, l: B.l, desc });
      for (let k = 0; k < robotsPerCell; k++)
        robots.push({ id: `${id}-r${k}`, cell: id, kind: 'mobile', type: robot.type, w: robot.w, l: robot.l, forkLen: robot.forkLen, speed: robot.speedMps,
          quota: sim.tasksPerRobot, load, x: desc.stops.charger.x, y: desc.stops.charger.y });
    }
    const racksPlaced = placed * B.racks;
    if (racksPlaced > counts.racks && placed === cellsNeeded) warnings.push(`Округление под ячейки: ${racksPlaced} стеллажей вместо расчётных ${counts.racks}.`);
    stats = { ...stats, cellsNeeded, cellsPlaced: placed, capacity, racksPerCell: B.racks, racksPlaced, robotsPlaced: placed * robotsPerCell, cellW: +B.w.toFixed(2), cellL: +B.l.toFixed(2) };
  }

  // Стационарные системы: столбик у правой стены, у каждой свой «челнок» и свой счётчик
  let sy = M;
  stationary.forEach((st, i) => {
    const id = st.id || `st${i + 1}`, x = W - M - st.w, y = sy, s = Math.max(0.3, Math.min(st.w, st.l) * 0.18);
    items.push({ id, kind: 'stationary', x, y, w: st.w, l: st.l, throughput: st.throughputPerHour, cell: id },
      { id: `${id}-fence`, kind: 'fence', label: `Система ${i + 1}`, x: x - 0.25, y: y - 0.25, w: st.w + 0.5, l: st.l + 0.5 });
    const stops = { in: { x: x + 0.6, y: y + st.l * 0.3 }, out: { x: x + st.w - 0.6, y: y + st.l * 0.7 } };
    cells.push({ id, x, y, w: st.w, l: st.l, desc: { mode: 'free', lanes: [], corridors: [], nodes: [], stops } });
    robots.push({ id: `${id}-shuttle`, cell: id, kind: 'stationary', type: 'ASRS', w: s, l: s, speed: st.speedMps,
      quota: sim.tasksPerRobot, minCycle: 3600 / st.throughputPerHour, x: stops.in.x, y: stops.in.y });
    sy += st.l + 1;
  });
  if (stationary.length && sy - 1 > L - M) warnings.push('Стационарные системы не помещаются по длине склада.');

  stats.plannedOrders = robots.reduce((a, r) => a + r.quota, 0);
  return { items, cells, robots, warnings, stats,
    sim: { horizonSec: sim.horizonMin * 60, requiredPerHour: sim.requiredOrdersPerHour, chargeEvery: sim.chargeEveryOrders, chargeSec: sim.chargeSec, initialFill: sim.initialFillPct / 100 } };
}
