import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const COLORS = ['#4f46e5', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('ru-RU') : String(n));
// Ось Y: миллионы рублей не влезают в ширину оси — сокращаем до «42,9 млн» / «300 тыс»
const fmtAxis = (n) =>
  Math.abs(n) >= 1e9
    ? `${(n / 1e9).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млрд`
    : Math.abs(n) >= 1e6
    ? `${(n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} млн`
    : Math.abs(n) >= 1e4
      ? `${Math.round(n / 1e3)} тыс`
      : fmt(n);

// Рисует ЛЮБОЙ набор kpis и charts из ответа расчёта — новые показатели и графики появляются без правки кода.
export function GenericChart({ chart }) {
  const { type, data, unit } = chart, tip = <Tooltip formatter={(v) => `${fmt(v)} ${unit}`} />;
  return (
    <ResponsiveContainer>
      {type === 'pie' ? (
        <PieChart><Pie data={data} dataKey="value" nameKey="name" outerRadius={80}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>{tip}<Legend /></PieChart>
      ) : type === 'line' ? (
        <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis tickFormatter={fmtAxis} width={70} />{tip}<Line dataKey="value" stroke="#4f46e5" strokeWidth={2} /></LineChart>
      ) : (
        <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis tickFormatter={fmtAxis} width={70} />{tip}<Bar dataKey="value" fill="#3b82f6" /></BarChart>
      )}
    </ResponsiveContainer>
  );
}

export function Dashboard({ kpis, charts, inputs }) {
  const groups = [...new Set(inputs.map((i) => i.group))];
  return (
    <>
      {kpis.length > 0 && <div className="kpis">{kpis.map((k) => <div key={k.id} className="card kpi"><span>{k.label}</span><b>{fmt(k.value)} {k.unit}</b></div>)}</div>}
      {charts.length > 0 && <div className="charts">{charts.map((c) => <div key={c.id} className="card"><h3>{c.title}</h3><div className="chart"><GenericChart chart={c} /></div></div>)}</div>}
      {inputs.length > 0 && (
        <details className="card"><summary>Исходные данные расчёта</summary>
          {groups.map((g) => (
            <div key={g}><h4>{g}</h4><div className="stats">{inputs.filter((i) => i.group === g).map((i) => <span key={i.label}>{i.label}: <b>{fmt(i.value)} {i.unit}</b></span>)}</div></div>
          ))}
        </details>
      )}
    </>
  );
}
