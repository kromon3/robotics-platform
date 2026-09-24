// Симуляция работы. Не зависит от React. Один заказ = взять на IN → положить на стеллаж → взять со стеллажа → сдать на OUT.
// Счётчик робота растёт при сдаче на OUT. Когда счётчик достиг квоты (из расчёта) — робот уезжает на зарядку и закрывает работу.
const HANDLE = 1.5;                      // время погрузки/разгрузки, с (симуляционное)
const rnd = (a, b) => a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const eq = (a, b) => Math.abs(a - b) < 1e-3;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turn = (h, t, m) => { const d = wrap(t - h); return Math.abs(d) <= m ? t : h + Math.sign(d) * m; };

function initNode(def, f) {
  const k = Math.min(def.capacity, Math.round(def.capacity * f));
  if (def.kind === 'ring') {
    const occ = Array(def.capacity).fill(false), fifo = [];
    for (let i = 0; i < k; i++) { occ[i] = true; fifo.push(i); }
    return { def, kind: 'ring', occ, fifo, res: {}, next: k % def.capacity, fill: k, ver: 0 };
  }
  return { def, kind: def.kind, fill: k, resPut: 0, resTake: 0, ver: 0 };
}
const freePut = (n) => n.def.capacity - n.fill - (n.kind === 'ring' ? Object.keys(n.res).length : n.resPut);
const availTake = (n) => (n.kind === 'ring' ? n.fifo.length : n.fill - n.resTake);

function reservePut(sim, cell) {
  const c = cell.nodeIds.map((id) => sim.nodes[id]).filter((n) => freePut(n) > 0);
  if (!c.length) return null;
  const n = c[Math.floor(Math.random() * c.length)], cap = n.def.capacity;
  if (n.kind === 'ring') {
    let idx = 0;   // всегда первый свободный слот: слева направо, сверху вниз, без «дырок»
    for (let j = 0; j < cap; j++) { if (!n.occ[j] && !n.res[j]) { idx = j; break; } }
    n.res[idx] = true;
    return { node: n, idx, pt: n.def.slots[idx] };
  }
  n.resPut++;
  return { node: n, pt: n.def.put };
}
function applyPut(cell, ref) {
  const n = ref.node;
  if (n.kind === 'ring') { delete n.res[ref.idx]; n.occ[ref.idx] = true; n.fifo.push(ref.idx); n.fill++; }
  else { n.resPut--; n.fill = Math.min(n.def.capacity, n.fill + 1); }
  n.ver++;
  cell.putLog.push(n.def.id); if (cell.putLog.length > 60) cell.putLog.shift();
}
// Берём со стеллажа: сначала «самый давний» из тех, куда клали, потом любой другой, в крайнем случае тот же
function reserveTake(sim, cell, exclude) {
  const nodes = cell.nodeIds.map((id) => sim.nodes[id]);
  let pick = null;
  for (let i = 0; i < cell.putLog.length; i++) {
    const n = sim.nodes[cell.putLog[i]];
    if (availTake(n) > 0 && (n.def.id !== exclude || n.kind === 'ring')) { pick = n; cell.putLog.splice(i, 1); break; }
  }
  if (!pick) { const c = nodes.filter((n) => availTake(n) > 0 && n.def.id !== exclude); if (c.length) pick = c[Math.floor(Math.random() * c.length)]; }
  if (!pick && exclude) { const n = sim.nodes[exclude]; if (n && availTake(n) > 0) pick = n; }
  if (!pick) return null;
  if (pick.kind === 'ring') { const idx = Math.max(...pick.fifo); pick.fifo.splice(pick.fifo.indexOf(idx), 1); return { node: pick, idx, pt: pick.def.slots[idx] }; }   // берём с «фронта» заполнения, чтобы не ехать по грузу
  pick.resTake++;
  return { node: pick, pt: pick.def.take };
}
function applyTake(ref) {
  const n = ref.node;
  if (n.kind === 'ring') { n.occ[ref.idx] = false; n.fill--; } else { n.resTake--; n.fill = Math.max(0, n.fill - 1); }
  n.ver++;
}

function route(cell, from, to) {
  if (cell.mode === 'grid') {                      // зона хранения: по полосе проезда, в слот — по вертикали
    const p = []; let cx = from.x, cy = from.y;
    if (!eq(cy, cell.laneY)) { p.push({ x: cx, y: cell.laneY }); cy = cell.laneY; }
    if (!eq(cx, to.x)) { p.push({ x: to.x, y: cell.laneY }); cx = to.x; }
    if (!eq(cy, to.y)) p.push({ x: to.x, y: to.y });
    return p.length ? p : [to];
  }
  if (cell.mode === 'free') return eq(from.x, to.x) || eq(from.y, to.y) ? [to] : [{ x: to.x, y: from.y }, to];
  if (eq(from.y, to.y) || !cell.corridors.length) return [to];
  let best = null;
  for (const cx of cell.corridors) { const c = Math.abs(from.x - cx) * 1.001 + Math.abs(to.x - cx); if (!best || c < best.c) best = { cx, c }; }
  return [{ x: best.cx, y: from.y }, { x: best.cx, y: to.y }, to];
}

export function createSim(layout) {
  const cfg = layout.sim, cells = {}, nodes = {};
  for (const c of layout.cells) {
    cells[c.id] = { ...c.desc, id: c.id, nodeIds: c.desc.nodes.map((n) => n.id), putLog: [] };
    for (const n of c.desc.nodes) nodes[n.id] = initNode(n, n.kind === 'ring' ? 0 : cfg.initialFill);   // зона хранения заполняется с нуля
  }
  const robots0 = layout.robots;
  for (const c of Object.values(cells)) {
    c.ringId = c.nodeIds.find((id) => nodes[id].kind === 'ring');
    const q = robots0.filter((r) => r.cell === c.id).reduce((a, r) => a + r.quota, 0);
    c.fillTarget = c.ringId ? Math.min(nodes[c.ringId].def.capacity, Math.ceil(q * 0.7)) : 0;   // фаза накопления: приёмка без выдачи (70% нормы)
  }
  const robots = layout.robots.map((s) => ({
    ...s, heading: 0, targetHeading: 0, path: [], steps: [], wait: 0, carrying: false, status: 'idle',
    orders: 0, retry: 0, doneAt: null, cycleStart: 0, t: { move: 0, work: 0, charging: 0, idle: 0, done: 0 }, trail: [],
    chargeAt: s.kind === 'mobile' ? rndInt(...cfg.chargeEvery) : Infinity, charges: 0,
  }));
  return { t: 0, horizon: cfg.horizonSec, cfg, cells, nodes, robots, finished: false, summary: null };
}

function mission(sim, r) {
  const cell = sim.cells[r.cell];
  if (r.orders >= r.quota) {
    if (r.status === 'done') return [];
    return r.kind === 'mobile' ? [{ t: 'go', to: cell.stops.charger }, { t: 'do', a: 'finish' }] : [{ t: 'do', a: 'finish' }];
  }
  if (r.kind === 'stationary')
    return [{ t: 'go', to: cell.stops.in }, { t: 'do', a: 'cycleStart' }, { t: 'wait', s: 1, status: 'work' }, { t: 'do', a: 'load' },
      { t: 'go', to: cell.stops.out }, { t: 'wait', s: 1, status: 'work' }, { t: 'do', a: 'deliver' }, { t: 'do', a: 'pad' }];
  if (r.orders >= r.chargeAt)
    return [{ t: 'go', to: cell.stops.charger }, { t: 'wait', s: rnd(...sim.cfg.chargeSec), status: 'charging' }, { t: 'do', a: 'charged' }];
  const ring = cell.ringId && sim.nodes[cell.ringId];
  const filling = !!ring && ring.fill + Object.keys(ring.res).length < cell.fillTarget;
  return [{ t: 'go', to: cell.stops.in }, { t: 'wait', s: HANDLE, status: 'work' }, { t: 'do', a: 'load' }, { t: 'plan', a: 'put', fillOnly: filling }];
}

function exec(sim, r, s) {
  const cell = sim.cells[r.cell];
  switch (s.t) {
    case 'go': r.path = route(cell, { x: r.x, y: r.y }, s.to); r.status = 'move'; break;
    case 'wait': r.wait = s.s; r.status = s.status || 'work'; break;
    case 'plan':
      if (s.a === 'put') {
        const p = reservePut(sim, cell);
        if (!p) {
          if (++r.retry > 6) r.steps.unshift({ t: 'plan', a: 'take', exclude: null });
          else r.steps.unshift({ t: 'wait', s: 1, status: 'idle' }, { t: 'plan', a: 'put' });
          break;
        }
        r.retry = 0;
        r.steps.unshift({ t: 'go', to: p.pt }, { t: 'wait', s: HANDLE, status: 'work' }, { t: 'do', a: 'put', ref: p },
          s.fillOnly ? { t: 'do', a: 'count' } : { t: 'plan', a: 'take', exclude: p.node.def.id });
      } else {
        const q = reserveTake(sim, cell, s.exclude);
        if (!q) {
          if (++r.retry > 6) { r.retry = 0; r.steps.unshift({ t: 'go', to: cell.stops.out }, { t: 'wait', s: 1, status: 'work' }, { t: 'do', a: 'deliver' }); }
          else r.steps.unshift({ t: 'wait', s: 1, status: 'idle' }, { t: 'plan', a: 'take', exclude: s.exclude });
          break;
        }
        r.retry = 0;
        r.steps.unshift({ t: 'go', to: q.pt }, { t: 'wait', s: HANDLE, status: 'work' }, { t: 'do', a: 'take', ref: q },
          { t: 'go', to: cell.stops.out }, { t: 'wait', s: 1, status: 'work' }, { t: 'do', a: 'deliver' });
      }
      break;
    case 'do':
      if (s.a === 'load') r.carrying = true;
      else if (s.a === 'put') { applyPut(cell, s.ref); r.carrying = false; r.atSlot = s.ref.idx ?? null; }
      else if (s.a === 'take') { applyTake(s.ref); r.carrying = true; r.atSlot = s.ref.idx ?? null; }
      else if (s.a === 'deliver' || s.a === 'count') { r.carrying = false; r.orders++; }
      else if (s.a === 'charged') { r.charges++; r.chargeAt = r.orders + rndInt(...sim.cfg.chargeEvery); }
      else if (s.a === 'cycleStart') r.cycleStart = sim.t;
      else if (s.a === 'pad') { r.wait = Math.max(0, r.minCycle - (sim.t - r.cycleStart)); r.status = 'idle'; }
      else if (s.a === 'finish') { r.status = 'done'; r.doneAt = sim.t; r.carrying = false; }
      break;
    default: break;
  }
}

function advance(sim, r, dt) {
  let t = dt, guard = 0;
  while (t > 1e-9 && guard++ < 100) {
    if (r.wait > 0) { const d = Math.min(r.wait, t); r.wait -= d; t -= d; continue; }
    if (r.path.length) {
      const p = r.path[0], dx = p.x - r.x, dy = p.y - r.y, dist = Math.hypot(dx, dy), can = r.speed * t;
      if (dist > 1e-6) r.targetHeading = Math.atan2(dy, dx);
      if (dist <= can) { r.x = p.x; r.y = p.y; r.path.shift(); t -= dist / r.speed; }
      else { r.x += (dx / dist) * can; r.y += (dy / dist) * can; t = 0; }
      continue;
    }
    const s = r.steps.shift();
    if (s) { exec(sim, r, s); continue; }
    const m = mission(sim, r);
    if (!m.length) return;
    r.steps.push(...m);
  }
}

export function stepSim(sim, dtSim) {
  let rem = dtSim;
  while (rem > 1e-9 && !sim.finished) {
    const d = Math.min(rem, 0.25);
    rem -= d; sim.t += d;
    for (const r of sim.robots) {
      advance(sim, r, d); r.heading = turn(r.heading, r.targetHeading, 8 * d);
      r.t[r.status] += d;                                                     // учёт времени: движение / погрузка / зарядка / простой / резерв
      if (r.kind === 'mobile') {                                              // след маршрута для показа на схеме
        const l = r.trail[r.trail.length - 1];
        if (!l || Math.hypot(r.x - l.x, r.y - l.y) > 0.4) { r.trail.push({ x: r.x, y: r.y }); if (r.trail.length > 50) r.trail.shift(); }
      }
    }
    const allDone = sim.robots.every((r) => r.status === 'done');
    if (allDone || sim.t >= sim.horizon) {
      sim.finished = true;
      const planned = sim.robots.reduce((a, r) => a + r.quota, 0), done = sim.robots.reduce((a, r) => a + Math.min(r.orders, r.quota), 0);
      sim.summary = { t: sim.t, planned, done, onTime: sim.robots.every((r) => r.orders >= r.quota), horizon: sim.horizon };
    }
  }
}

export const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Статистика для блока «Подтверждение расчёта»: потребность vs достигнутая производительность, загрузка, простои, узкие места
export function simStats(sim) {
  const planned = sim.robots.reduce((a, r) => a + r.quota, 0);
  const done = sim.robots.reduce((a, r) => a + Math.min(r.orders, r.quota), 0);
  const span = sim.finished && sim.summary && !sim.summary.onTime ? sim.horizon : sim.t;      // по какому времени считаем производительность
  const required = sim.cfg.requiredPerHour ?? planned / (sim.horizon / 3600);
  const achieved = span > 0 ? (done / span) * 3600 : 0;
  const per = sim.robots.map((r) => {
    const tot = Object.values(r.t).reduce((a, b) => a + b, 0) || 1;
    return { id: r.id, cell: r.cell, type: r.type, kind: r.kind, status: r.status, orders: r.orders, quota: r.quota, charges: r.charges,
      busy: (r.t.move + r.t.work) / tot, charging: r.t.charging / tot, idle: r.t.idle / tot, reserve: r.t.done / tot };
  });
  const avg = (k) => (per.length ? per.reduce((a, p) => a + p[k], 0) / per.length : 0);
  const behind = per.filter((p) => p.orders < p.quota);
  const busiest = per.reduce((a, p) => (!a || p.busy > a.busy ? p : a), null);
  return { planned, done, required, achieved, busy: avg('busy'), charging: avg('charging'), idle: avg('idle'), reserve: avg('reserve'), per, behind, busiest };
}
