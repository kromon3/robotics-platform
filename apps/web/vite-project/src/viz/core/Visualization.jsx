// ГЛАВНЫЙ КОМПОНЕНТ ВИЗУАЛИЗАЦИИ ОДНОГО СЦЕНАРИЯ. Вход: result (формат — src/contract/schema.js).
import { useMemo, useRef, useState } from 'react';
import { normalizeResult } from '../contract/schema';
import { buildLayout } from './layout';
import { useSimulation } from './useSimulation';
import { simStats } from './sim';
import { WarehouseCanvas } from './WarehouseCanvas';
import { SimPanel } from './SimPanel';
import { Dashboard } from './Dashboard';
import { ROBOT_TYPES, RACK_TYPES } from './catalog';
import { downloadSvg, downloadPng, downloadCsv } from './exportUtils';

const LAYERS = { rack: 'Стеллажи и зоны', mezzanine: 'Мезонин', marker: 'Точки приёма/выдачи, зарядки', safety: 'Проходы и ограждение', routes: 'Маршруты', robot: 'Роботы', stationary: 'Стационарные' };

function Footer({ meta }) {
  const d = meta?.calculatedAt ? new Date(meta.calculatedAt).toLocaleString('ru-RU') : '';
  return (
    <p className="foot">
      Предварительная оценка: результат требует верификации при обследовании объекта.
      {d && ` Расчёт от ${d}.`}{meta?.modelVersion && ` Модель: ${meta.modelVersion}.`}{meta?.dataVersion && ` Данные: ${meta.dataVersion}.`}
    </p>
  );
}

export function Visualization({ result }) {
  const norm = useMemo(() => normalizeResult(result), [result]);
  const layout = useMemo(() => (norm.data && !norm.data.baseline ? buildLayout(norm.data) : null), [norm]);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(10);
  const [hidden, setHidden] = useState([]);
  const [selected, setSelected] = useState(null);
  const svgRef = useRef(null);
  const { sim, restart } = useSimulation(layout, { running, speed });

  const d = norm.data;
  const errors = norm.problems.filter((p) => p.level === 'error');
  if (norm.fatal || !d) {
    return <div className="err"><b>Ответ расчёта не подходит для визуализации:</b><ul>{errors.map((p, i) => <li key={i}><code>{p.path}</code>: {p.msg}</li>)}</ul></div>;
  }
  if (d.baseline) {   // сценарий без роботизации: схемы и симуляции нет, только показатели для сравнения
    return (
      <div className="main">
        <div className="card"><h3>{d.meta.scenarioName || 'Текущий процесс без роботизации'}</h3>
          <p className="small">Базовый сценарий: работа выполняется вручную. Схема роботов не строится — показатели используются для сравнения с вариантами роботизации.</p></div>
        <Dashboard kpis={d.kpis} charts={d.charts} inputs={d.inputs} />
        {d.assumptions.length > 0 && <details className="card"><summary>Формулы и допущения расчёта</summary>{d.assumptions.map((a, i) => <p key={i} className="small">{a.title && <b>{a.title}. </b>}{a.text}</p>)}</details>}
        <Footer meta={d.meta} />
      </div>
    );
  }
  if (!layout || !sim) return null;

  const stats = simStats(sim), st = layout.stats;
  const live = selected && (sim.robots.find((r) => r.id === selected.id) || selected);
  const warns = [...norm.problems.filter((p) => p.level === 'warn').map((p) => `${p.path}: ${p.msg}`), ...layout.warnings];
  const toggle = (l) => setHidden((h) => (h.includes(l) ? h.filter((x) => x !== l) : [...h, l]));
  const fname = `sklad-${(d.meta.scenarioName || 'scenario').replace(/[^\wа-яё]+/gi, '_')}`;
  const exportCsv = () => downloadCsv(`${fname}-simulation`,
    ['Робот', 'Ячейка', 'Тип', 'Заказов', 'Норма', 'Работа, %', 'Зарядка, %', 'Простой, %', 'Резерв, %'],
    stats.per.map((p) => [p.id, p.cell, p.type, p.orders, p.quota, Math.round(p.busy * 100), Math.round(p.charging * 100), Math.round(p.idle * 100), Math.round(p.reserve * 100)]));

  return (
    <div className="main">
      {warns.map((w) => <div key={w} className="warn">{w}</div>)}

      <div className="card">
        <h3>План склада</h3>
        <div className="toolbar">
          {Object.entries(LAYERS).map(([k, label]) => <label key={k}><input type="checkbox" checked={!hidden.includes(k)} onChange={() => toggle(k)} /> {label}</label>)}
        </div>
        <WarehouseCanvas warehouse={d.warehouse} layout={layout} sim={sim} selectedId={selected?.id} onSelect={setSelected} hidden={hidden} svgRef={svgRef} />
        <div className="toolbar" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => downloadPng(svgRef.current, fname)}>Сохранить схему (PNG)</button>
          <button className="btn" onClick={() => downloadSvg(svgRef.current, fname)}>Сохранить схему (SVG)</button>
          <button className="btn" onClick={exportCsv}>Результаты симуляции (CSV)</button>
        </div>
        {live && <p className="sel">
          {live.kind === 'robot' ? `${ROBOT_TYPES[live.type]?.label ?? live.type} · заказов ${live.orders}/${live.quota}` : (ROBOT_TYPES[live.type]?.label || RACK_TYPES[live.type]?.label || live.kind)} · {live.w} × {live.l} м
        </p>}
        <div className="legend">
          {Object.entries(ROBOT_TYPES).map(([k, v]) => <span key={k}><i style={{ background: v.color }} />{k}</span>)}
          <span><i style={{ background: '#fde047' }} />Зарядка</span><span><i style={{ background: '#16a34a' }} />Приём (IN)</span>
          <span><i style={{ background: '#dc2626' }} />Выдача (OUT)</span><span><i style={{ background: '#0f766e' }} />Занятое место</span>
          <span><i style={{ background: '#facc15', outline: '2px dashed #1f2937', outlineOffset: -3 }} />Зона работы роботов</span>
          <span><i style={{ background: '#2563eb' }} />Маршрут до цели</span><span><i style={{ background: '#f97316' }} />Груз на роботе</span>
        </div>
      </div>

      <SimPanel sim={sim} stats={stats} running={running} setRunning={setRunning} speed={speed} setSpeed={setSpeed} restart={restart} selectedId={selected?.id} onSelect={setSelected} />

      {st.cellsNeeded > 0 && (
        <div className="card"><h3>Ячейка (клонируется по складу)</h3>
          <div className="stats">
            <span>Ячеек: <b>{st.cellsPlaced} / {st.cellsNeeded}</b></span><span>Стеллажей в ячейке: <b>{st.racksPerCell}</b></span>
            <span>Роботов в ячейке: <b>{st.robotsPerCell}</b></span><span>Размер ячейки: <b>{st.cellW} × {st.cellL} м</b></span>
            <span>Стеллаж: <b>{d.rack.w} × {d.rack.l} м</b></span>
            <span>Робот: <b>{d.robot?.w} × {d.robot?.l} м</b></span>
            <span>Роботов / стеллажей всего: <b>{st.robotsPlaced} / {st.racksPlaced}</b></span><span>Зарядок: <b>{st.cellsPlaced}</b> (расчёт: {d.counts.chargers})</span>
          </div>
        </div>
      )}
      <Dashboard kpis={d.kpis} charts={d.charts} inputs={d.inputs} />
      {d.assumptions.length > 0 && (
        <details className="card"><summary>Формулы и допущения расчёта</summary>
          {d.assumptions.map((a, i) => <p key={i} className="small">{a.title && <b>{a.title}. </b>}{a.text}</p>)}
        </details>
      )}
      <Footer meta={d.meta} />
    </div>
  );
}
