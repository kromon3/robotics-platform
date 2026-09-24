import { ROBOT_TYPES } from '../catalog';

const ManipulatorIcon = ({ cx, cy, r }) => (
  <g stroke="#fff" strokeWidth={r * 0.28} strokeLinecap="round" strokeLinejoin="round" fill="none">
    <circle cx={cx} cy={cy} r={r * 0.45} fill="#fff" stroke="none" />
    <polyline points={`${cx},${cy} ${cx + r},${cy - r * 0.7} ${cx + r * 1.7},${cy + r * 0.1}`} />
    <line x1={cx + r * 1.7} y1={cy + r * 0.1} x2={cx + r * 1.7} y2={cy + r * 0.7} />
  </g>
);

// «Перед» робота — сторона +y. w — ширина, l — длина корпуса. Вилы (FMR, CTU) выходят вперёд на forkLen.
export const RobotShape = ({ type, w, l, forkLen }) => {
  const t = ROBOT_TYPES[type], st = { stroke: '#0f172a', strokeWidth: 0.04 };
  if (t.shape === 'dog') return (          // робособака: корпус, 4 лапы, голова с ушками, хвост
    <g {...st}>
      {[[0, 0.1], [0.82, 0.1], [0, 0.48], [0.82, 0.48]].map(([x, y], i) => <rect key={i} x={w * x} y={l * y} width={w * 0.18} height={l * 0.18} rx={0.03} fill="#334155" />)}
      <rect x={w * 0.12} y={l * 0.04} width={w * 0.76} height={l * 0.62} rx={w * 0.2} fill={t.color} />
      <circle cx={w / 2} cy={l * 0.83} r={w * 0.26} fill={t.color} />
      <circle cx={w * 0.28} cy={l * 0.7} r={w * 0.1} fill="#334155" /><circle cx={w * 0.72} cy={l * 0.7} r={w * 0.1} fill="#334155" />
      <line x1={w / 2} y1={l * 0.04} x2={w / 2} y2={-l * 0.08} strokeWidth={0.07} strokeLinecap="round" />
    </g>
  );
  if (t.shape === 'humanoid') {            // гуманоид сверху: плечи, руки, голова с направлением взгляда
    const r = Math.min(w, l) * 0.22;
    return (
      <g {...st}>
        <ellipse cx={w / 2} cy={l / 2} rx={w / 2} ry={l * 0.3} fill={t.color} />
        <circle cx={w / 2} cy={l / 2} r={r} fill="#f8fafc" />
        <circle cx={w / 2} cy={l / 2 + r * 0.6} r={r * 0.3} fill="#334155" />
        <line x1={0} y1={l * 0.55} x2={-w * 0.12} y2={l * 0.75} strokeWidth={0.07} strokeLinecap="round" />
        <line x1={w} y1={l * 0.55} x2={w * 1.12} y2={l * 0.75} strokeWidth={0.07} strokeLinecap="round" />
      </g>
    );
  }
  const forkW = Math.max(0.06, w * 0.12), fl = forkLen || l * 0.8;
  return (
    <g>
      {t.shape === 'forks' && (<>
        <rect x={w * 0.15} y={l} width={forkW} height={fl} fill="#334155" />
        <rect x={w * 0.85 - forkW} y={l} width={forkW} height={fl} fill="#334155" />
      </>)}
      <rect width={w} height={l} rx={Math.min(w, l) * 0.12} fill={t.color} {...st} />
      {t.shape === 'manipulator' && <ManipulatorIcon cx={w * 0.4} cy={l / 2} r={Math.min(w, l) * 0.22} />}
    </g>
  );
};
