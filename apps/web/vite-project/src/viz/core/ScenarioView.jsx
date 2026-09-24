// Несколько сценариев: базовый (без роботизации), покупка, услуга (RaaS) и т.д. Вкладки + сравнительная таблица + визуализация выбранного.
import { useMemo, useState } from 'react';
import { normalizeResult } from '../contract/schema';
import { Visualization } from './Visualization';
import { GenericChart } from './Dashboard';

const KIND = { baseline: 'без роботизации', buy: 'покупка', raas: 'услуга (RaaS)' };
const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('ru-RU') : String(v));

export function ScenarioView({ scenarios }) {
  const list = useMemo(() => scenarios.map((raw, i) => {
    const n = normalizeResult(raw), d = n.data;
    return { i, raw, d, name: d?.meta?.scenarioName || raw?.meta?.scenarioName || `Сценарий ${i + 1}`, kind: d?.meta?.kind || 'buy' };
  }), [scenarios]);
  const [active, setActive] = useState(() => Math.max(0, list.findIndex((s) => s.kind !== 'baseline')));   // сразу открываем первый сценарий с роботами
  const cur = list[Math.min(active, list.length - 1)];
  const withKpis = list.filter((s) => s.d?.kpis?.length);

  // Сравнительная таблица: строки — показатели (по id), столбцы — сценарии
  const rows = useMemo(() => {
    const ids = [], label = {}, unit = {};
    withKpis.forEach((s) => s.d.kpis.forEach((k) => { if (!ids.includes(k.id)) { ids.push(k.id); label[k.id] = k.label; unit[k.id] = k.unit; } }));
    return ids.map((id) => ({ id, label: label[id], unit: unit[id], vals: withKpis.map((s) => s.d.kpis.find((k) => k.id === id)) }));
  }, [withKpis]);
  const tco = rows.find((r) => r.id === 'tco');
  const tcoChart = tco && { type: 'bar', unit: tco.unit, data: withKpis.map((s, j) => ({ name: s.name, value: Number(tco.vals[j]?.value) })).filter((d) => Number.isFinite(d.value)) };

  return (
    <div>
      {list.length > 1 && (
        <>
          <div className="tabs" role="tablist">
            {list.map((s) => <button key={s.i} role="tab" aria-selected={s.i === cur.i} className={`tab ${s.i === cur.i ? 'active' : ''}`} onClick={() => setActive(s.i)}>{s.name}<small>{KIND[s.kind]}</small></button>)}
          </div>
          {rows.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3>Сравнение сценариев</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl cmp">
                  <thead><tr><th>Показатель</th>{withKpis.map((s) => <th key={s.i}>{s.name}</th>)}</tr></thead>
                  <tbody>{rows.map((r) => <tr key={r.id}><td>{r.label}</td>{r.vals.map((v, j) => <td key={j}>{v ? `${fmt(v.value)} ${v.unit}` : '—'}</td>)}</tr>)}</tbody>
                </table>
              </div>
              {tcoChart && tcoChart.data.length > 1 && <><h4>TCO по сценариям</h4><div className="chart"><GenericChart chart={tcoChart} /></div></>}
            </div>
          )}
        </>
      )}
      <Visualization key={cur.i} result={cur.raw} />
    </div>
  );
}
