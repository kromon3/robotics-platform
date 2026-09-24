import { fmtTime } from './sim';

const STATUS = { move: 'едет', work: 'погрузка', charging: 'зарядка', idle: 'ожидает', done: 'план выполнен' };
const pct = (x) => `${Math.round(x * 100)}%`;
const fmt = (n) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 1 });

// Полоса «занятость / зарядка / простой / резерв»
const Split = ({ p, mini }) => (
  <span className={`split ${mini ? 'mini' : ''}`}>
    <i style={{ width: pct(p.busy), background: '#0f766e' }} /><i style={{ width: pct(p.charging), background: '#f59e0b' }} />
    <i style={{ width: pct(p.idle), background: '#94a3b8' }} /><i style={{ width: pct(p.reserve), background: '#cbd5e1' }} />
  </span>
);

export function SimPanel({ sim, stats, running, setRunning, speed, setSpeed, restart, selectedId, onSelect }) {
  const s = sim.summary, prog = stats.planned ? Math.round((stats.done / stats.planned) * 100) : 0;
  const state = sim.finished ? 'завершена' : running ? 'идёт' : 'на паузе';
  const dev = stats.required ? Math.round((stats.achieved / stats.required - 1) * 100) : 0;
  const confirmed = s && s.onTime && stats.achieved >= stats.required * 0.999;

  return (
    <div className="card">
      <h3>Симуляция и подтверждение расчёта</h3>
      <div className="toolbar">
        <button className="btn" onClick={() => setRunning(!running)} disabled={sim.finished}>{running ? '⏸ Пауза' : '▶ Пуск'}</button>
        <button className="btn" onClick={restart}>⟲ Перезапустить</button>
        <label>Скорость:{' '}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>{[1, 5, 10, 30, 60].map((v) => <option key={v} value={v}>×{v}</option>)}</select>
        </label>
        <span>Модель: <b>{state}</b></span>
        <span>Время: <b>{fmtTime(sim.t)}</b> / {fmtTime(sim.horizon)}</span>
      </div>
      <div className="bar"><i style={{ width: `${prog}%` }} /></div>
      <p className="small">Обработано заказов: <b>{stats.done} / {stats.planned}</b> ({prog}%)</p>

      {s && (confirmed
        ? <div className="ok">Расчёт подтверждён: план выполнен за {fmtTime(s.t)} из {fmtTime(s.horizon)}, производительность не ниже расчётной.</div>
        : <div className="warn">Расчёт не подтверждён: {s.onTime ? 'план выполнен, но производительность ниже расчётной' : `за ${fmtTime(s.horizon)} выполнено ${prog}% плана`}. Добавьте роботов, ускорьте маршруты или пересмотрите допущения.</div>)}

      <h4>Расчётная и фактическая производительность</h4>
      <table className="tbl">
        <tbody>
          <tr><td>Расчётная потребность</td><td><b>{fmt(stats.required)}</b> ед/ч</td></tr>
          <tr><td>Достигнуто в симуляции{sim.finished ? '' : ' (пока)'}</td><td><b>{fmt(stats.achieved)}</b> ед/ч <span className={dev >= 0 ? 'pos' : 'neg'}>({dev >= 0 ? '+' : ''}{dev}%)</span></td></tr>
        </tbody>
      </table>

      <h4>Загрузка оборудования и простои (среднее по парку)</h4>
      <Split p={stats} />
      <div className="legend">
        <span><i style={{ background: '#0f766e' }} />Работа (движение и погрузка) {pct(stats.busy)}</span>
        <span><i style={{ background: '#f59e0b' }} />Зарядка {pct(stats.charging)}</span>
        <span><i style={{ background: '#94a3b8' }} />Простой {pct(stats.idle)}</span>
        <span><i style={{ background: '#cbd5e1' }} />План выполнен, резерв {pct(stats.reserve)}</span>
      </div>
      <p className="small">{sim.finished && stats.behind.length
        ? <>Узкое место — не успевают: <b>{stats.behind.slice(0, 4).map((p) => `${p.id} (${p.orders}/${p.quota})`).join(', ')}</b></>
        : stats.busiest && <>Наиболее загружен: <b>{stats.busiest.id}</b> — {pct(stats.busiest.busy)} времени в работе</>}</p>

      <div className="rlist">
        {stats.per.map((p) => (
          <button key={p.id} className={`rrow ${selectedId === p.id ? 'active' : ''}`} onClick={() => onSelect({ ...sim.robots.find((r) => r.id === p.id), kind: 'robot' })}>
            <span>{p.id}</span><span>{STATUS[p.status]}{p.charges ? ` · заряд ×${p.charges}` : ''}</span><span>{p.orders}/{p.quota}</span><Split p={p} mini />
          </button>
        ))}
      </div>
    </div>
  );
}
