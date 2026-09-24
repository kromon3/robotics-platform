// КОНТРАКТ между расчётом (бэкенд) и визуализацией.
// Визуализация получает ОДИН объект `result` и больше ничего не знает о том, как он посчитан.
// normalizeResult() — единственная «прокладка»: дополняет значения по умолчанию, чинит типы, собирает проблемы.
// Неверные данные не роняют страницу: ошибки показываются списком, мелочи — предупреждениями.
//
// result = {
//   version: 1,
//   warehouse:  { width, length, aisleWidth },                      // м
//   cargo:      { type: 'pallet'|'box'|'long',
//                 unit: { l, w, h, massKg },                         // габариты и масса грузовой единицы
//                 oversizeShare },                                   // доля негабарита, 0..1
//   rack:       { type: 'stack'|'shelf'|'deep'|'flow'|'cantilever'|'mezzanine',
//                 w, l, capacityPerRack },                           // w вдоль прохода, l глубина; вместимость полок/мест на стеллаж
//   robot:      { id, name, type, w, l, forkLen, speedMps, payloadKg, throughputPerHour } | null,   // w, l — габариты корпуса (м); forkLen — длина вил у FMR/CTU   // мобильный робот (null, если только стационарные)
//   counts:     { robots, racks, chargers, robotsPerCell },        // итог расчёта
//   stationary: [ { id, name, w, l, throughputPerHour, speedMps } ],   // стационарные системы (2D/3D шаттлы)
//   simulation: { horizonMin, tasksPerRobot (заказов на ОДИН робот или стационарную систему за симуляцию), initialFillPct, chargeEveryOrders:[min,max], chargeSec:[min,max] },
//   kpis:       [ { id, label, value, unit } ],                    // карточки показателей — сколько угодно
//   charts:     [ { id, title, type: 'pie'|'line'|'bar', data: [ { name, value } ], unit } ],   // графики — сколько угодно
//   inputs:     [ { group, label, value, unit } ],                 // (необязательно) исходные данные для показа
//   assumptions:[ { title, text } ],                               // формулы и допущения расчёта: показываются пользователю (ТЗ 3.5.8)
//   meta:       { scenarioName, kind: 'baseline'|'buy'|'raas', modelVersion, dataVersion, calculatedAt },   // сценарий и версии (ТЗ 3.1.5)
// }
// simulation.requiredOrdersPerHour (необязательно) — расчётная потребность, ед/ч: с ней сравнивается достигнутая в симуляции производительность.
// Сценарий-основа (kind: 'baseline', текущий процесс без роботов) содержит только meta, kpis, charts, inputs — схема склада для него не строится.
// Бэкенд может вернуть один result или МАССИВ result-ов (сценарии для сравнения).
import { CARGO_TYPES, RACK_TYPES, ROBOT_TYPES, rackSize } from '../core/catalog';
import { checkCompat, minAisle } from '../core/rules';

const UNIT_DEFAULT = {
  pallet: { l: 1.2, w: 0.8, h: 1.5, massKg: 600 },
  box: { l: 0.4, w: 0.3, h: 0.3, massKg: 5 },
  long: { l: 6, w: 0.6, h: 0.4, massKg: 150 },
};

const parseKpis = (raw) => (Array.isArray(raw.kpis) ? raw.kpis : []).filter((x) => x && x.label != null && x.value != null).map((x, i) => ({ id: x.id ?? `k${i}`, label: String(x.label), value: x.value, unit: x.unit ?? '' }));
const parseCharts = (raw) => (Array.isArray(raw.charts) ? raw.charts : []).filter((x) => x && Array.isArray(x.data)).map((x, i) => ({
  id: x.id ?? `c${i}`, title: x.title ?? '', type: ['pie', 'line', 'bar'].includes(x.type) ? x.type : 'bar', unit: x.unit ?? '',
  data: x.data.filter((d) => d && Number.isFinite(+d.value)).map((d) => ({ name: String(d.name), value: +d.value })) }));
const parseMeta = (m = {}) => ({ scenarioName: m.scenarioName ?? '', kind: ['baseline', 'buy', 'raas'].includes(m.kind) ? m.kind : 'buy',
  modelVersion: m.modelVersion ?? '', dataVersion: m.dataVersion ?? '', calculatedAt: m.calculatedAt ?? '' });

export function normalizeResult(raw) {
  const problems = [];
  const err = (path, msg) => problems.push({ level: 'error', path, msg });
  const warn = (path, msg) => problems.push({ level: 'warn', path, msg });
  if (!raw || typeof raw !== 'object') { err('result', 'Пустой или неверный ответ расчёта'); return { data: null, problems, fatal: true }; }

  const num = (v, def, path, min = -Infinity) => {
    if (v === undefined || v === null) return def;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min) { warn(path, `неверное значение «${v}», взято ${def}`); return def; }
    return n;
  };
  const pair = (v, def, path) => (Array.isArray(v) && v.length === 2 && v.every((x) => Number.isFinite(+x)) ? [+v[0], +v[1]] : (v != null && warn(path, 'ожидается [мин, макс]'), def));

  const meta = parseMeta(raw.meta);
  if (meta.kind === 'baseline')       // сценарий без роботизации: только показатели и графики для сравнения
    return { data: { baseline: true, meta, kpis: parseKpis(raw), charts: parseCharts(raw), inputs: Array.isArray(raw.inputs) ? raw.inputs : [],
      assumptions: (Array.isArray(raw.assumptions) ? raw.assumptions : []).filter((x) => x && x.text).map((x) => ({ title: String(x.title ?? ''), text: String(x.text) })) }, problems, fatal: false };

  const wh = raw.warehouse || {};
  const warehouse = { width: num(wh.width, 0, 'warehouse.width'), length: num(wh.length, 0, 'warehouse.length'), aisleWidth: num(wh.aisleWidth, 2, 'warehouse.aisleWidth', 0.5) };
  if (!(warehouse.width > 0 && warehouse.length > 0)) err('warehouse', 'Не заданы размеры склада: передайте warehouse.width и warehouse.length (метры)');

  const c = raw.cargo || {};
  const ctype = CARGO_TYPES[c.type] ? c.type : (warn('cargo.type', `неизвестный тип груза «${c.type}», взят box`), 'box');
  const u = { ...UNIT_DEFAULT[ctype], ...(c.unit || {}) };
  const cargo = { type: ctype, oversizeShare: num(c.oversizeShare, 0, 'cargo.oversizeShare', 0),
    unit: { l: num(u.l, 1, 'cargo.unit.l', 0.05), w: num(u.w, 1, 'cargo.unit.w', 0.05), h: num(u.h, 1, 'cargo.unit.h', 0.05), massKg: num(u.massKg, 1, 'cargo.unit.massKg', 0) } };

  const rk = raw.rack || {};
  if (!RACK_TYPES[rk.type]) err('rack.type', `Неизвестный тип стеллажа «${rk.type}»: допустимы ${Object.keys(RACK_TYPES).join(', ')}`);
  const rdef = rackSize(rk.type, cargo.type);
  const rack = { type: rk.type, w: num(rk.w, rdef.w, 'rack.w', 0.3), l: num(rk.l, rdef.l, 'rack.l', 0.3), capacityPerRack: Math.max(1, Math.round(num(rk.capacityPerRack, 8, 'rack.capacityPerRack', 1))) };

  let robot = null;
  if (raw.robot) {
    const r = raw.robot;
    if (!ROBOT_TYPES[r.type] || r.type === 'ASRS') err('robot.type', `Неизвестный тип мобильного робота «${r.type}»`);
    robot = { id: r.id ?? 'robot', name: r.name ?? r.type, type: r.type, w: num(r.w, 0.8, 'robot.w', 0.1), l: num(r.l, 1.2, 'robot.l', 0.1),
      forkLen: ['FMR', 'CTU'].includes(r.type) ? num(r.forkLen, +(num(r.l, 1.2, 'robot.l', 0.1) * 0.8).toFixed(2), 'robot.forkLen', 0.1) : 0,
      speedMps: num(r.speedMps, 1.2, 'robot.speedMps', 0.1), payloadKg: num(r.payloadKg, 100, 'robot.payloadKg', 0), throughputPerHour: num(r.throughputPerHour, 60, 'robot.throughputPerHour', 1) };
  }
  const stationary = (Array.isArray(raw.stationary) ? raw.stationary : []).map((s, i) => ({
    id: s.id ?? `st${i + 1}`, name: s.name ?? 'Стационарная система', w: num(s.w, 5, `stationary[${i}].w`, 1), l: num(s.l, 3, `stationary[${i}].l`, 1),
    throughputPerHour: num(s.throughputPerHour, 60, `stationary[${i}].throughputPerHour`, 1), speedMps: num(s.speedMps, 2, `stationary[${i}].speedMps`, 0.1) }));
  if (!robot && !stationary.length) err('robot', 'В ответе нет ни мобильного робота (robot), ни стационарных систем (stationary)');

  const k = raw.counts || {};
  const counts = { robots: Math.round(num(k.robots, 0, 'counts.robots', 0)), racks: Math.round(num(k.racks, 0, 'counts.racks', 0)),
    chargers: Math.round(num(k.chargers, 0, 'counts.chargers', 0)), robotsPerCell: Math.max(1, Math.round(num(k.robotsPerCell, 1, 'counts.robotsPerCell', 1))) };
  if (robot && (counts.robots < 1 || counts.racks < 1)) warn('counts', 'Для ячеек нужны counts.robots ≥ 1 и counts.racks ≥ 1 — склад с роботами не будет нарисован');

  const s = raw.simulation || {};
  const simulation = { horizonMin: num(s.horizonMin, 15, 'simulation.horizonMin', 1), tasksPerRobot: Math.max(1, Math.round(num(s.tasksPerRobot, 10, 'simulation.tasksPerRobot', 1))),
    initialFillPct: Math.min(85, num(s.initialFillPct, 35, 'simulation.initialFillPct', 0)), requiredOrdersPerHour: s.requiredOrdersPerHour == null ? undefined : num(s.requiredOrdersPerHour, undefined, 'simulation.requiredOrdersPerHour', 0),
    chargeEveryOrders: pair(s.chargeEveryOrders, [5, 10], 'simulation.chargeEveryOrders'), chargeSec: pair(s.chargeSec, [15, 40], 'simulation.chargeSec') };

  const kpis = parseKpis(raw);
  const charts = parseCharts(raw);
  const inputs = Array.isArray(raw.inputs) ? raw.inputs : [];
  const assumptions = (Array.isArray(raw.assumptions) ? raw.assumptions : []).filter((x) => x && x.text).map((x) => ({ title: String(x.title ?? ''), text: String(x.text) }));

  // Совместимость (мягкие предупреждения — картинку не блокируют)
  if (robot && RACK_TYPES[rack.type]) checkCompat(robot, rack.type, cargo).forEach((m) => warn('robot', m));
  stationary.forEach((st) => checkCompat({ type: 'ASRS', payloadKg: 1e9 }, rack.type, cargo).forEach((m) => warn(`stationary ${st.id}`, m)));
  if (robot && rack.type !== 'mezzanine' && warehouse.aisleWidth < minAisle(robot, cargo))
    warn('warehouse.aisleWidth', `Проход ${warehouse.aisleWidth} м уже рекомендуемого ${minAisle(robot, cargo)} м для ${robot.type}: увеличьте ширину прохода в расчёте.`);
  if (cargo.oversizeShare > 0.05 && robot && !['CTU', 'FMR'].includes(robot.type))
    warn('cargo.oversizeShare', `Негабарита ${Math.round(cargo.oversizeShare * 100)}%: для него нужны роботы CTU/FMR`);

  const fatal = problems.some((p) => p.level === 'error');
  return { data: fatal ? null : { version: 1, meta, warehouse, cargo, rack, robot, counts, stationary, simulation, kpis, charts, inputs, assumptions }, problems, fatal };
}
