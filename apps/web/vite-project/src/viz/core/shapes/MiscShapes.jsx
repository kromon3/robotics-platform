import { memo } from 'react';
import { PORT_COLORS } from '../catalog';

export const Port = ({ x, y, kind, r = 0.2 }) => (
  <circle cx={x} cy={y} r={r} fill={PORT_COLORS[kind]} stroke="#fff" strokeWidth={r * 0.25} />
);

// Маркеры: зарядка, точка приёма (IN), точка выдачи (OUT)
export const MarkerShape = ({ role, w, l }) => {
  if (role === 'charger') return (
    <g>
      <rect width={w} height={l} rx={0.1} fill="#fde047" stroke="#854d0e" strokeWidth={0.05} />
      <polygon points={`${w * 0.55},${l * 0.15} ${w * 0.3},${l * 0.55} ${w * 0.5},${l * 0.55} ${w * 0.42},${l * 0.85} ${w * 0.72},${l * 0.42} ${w * 0.52},${l * 0.42}`} fill="#854d0e" />
    </g>
  );
  const c = role === 'in' ? '#16a34a' : '#dc2626';
  return (
    <g>
      <rect width={w} height={l} rx={0.1} fill={role === 'in' ? '#dcfce7' : '#fee2e2'} stroke={c} strokeWidth={0.06} />
      <polygon points={`${w * 0.28},${l * 0.25} ${w * 0.78},${l * 0.5} ${w * 0.28},${l * 0.75}`} fill={c} />
    </g>
  );
};

// Стационарная система: прямоугольник со входами слева и выходами справа (шаттл рисуется поверх из симуляции)
export const StationaryShape = ({ w, l, throughput }) => (
  <g>
    <rect width={w} height={l} fill="#cbd5e1" stroke="#334155" strokeWidth={0.08} />
    <line x1={0.6} y1={l * 0.3} x2={w - 0.6} y2={l * 0.3} stroke="#94a3b8" strokeWidth={0.04} strokeDasharray="0.2 0.2" />
    <line x1={0.6} y1={l * 0.7} x2={w - 0.6} y2={l * 0.7} stroke="#94a3b8" strokeWidth={0.04} strokeDasharray="0.2 0.2" />
    {[0.3, 0.7].map((k) => <Port key={`i${k}`} x={0} y={l * k} kind="in" />)}
    {[0.3, 0.7].map((k) => <Port key={`o${k}`} x={w} y={l * k} kind="out" />)}
    <text x={w / 2} y={l - 0.25} textAnchor="middle" fontSize={0.45} fill="#0f172a">{throughput} ед/ч</text>
  </g>
);

// Зона хранения: штрих-пунктир, слоты закрашиваются по мере заполнения
export const ZoneShape = memo(({ w, l, laneH = 0, slotsLocal, slotW, slotL, occ }) => (
  <g>
    <rect width={w} height={l} fill="#f1f5f9" stroke="#475569" strokeWidth={0.1} strokeDasharray="1 0.3 0.2 0.3" />
    <rect y={l - laneH} width={w} height={laneH} fill="#dbeafe" opacity={0.7} />
    <line x1={0.2} y1={l - laneH / 2} x2={w - 0.2} y2={l - laneH / 2} stroke="#93c5fd" strokeWidth={0.05} strokeDasharray="0.4 0.3" />
    {slotsLocal.map((s, i) => (
      <rect key={i} x={s.x - slotW / 2} y={s.y - slotL / 2} width={slotW} height={slotL} rx={0.04}
            fill={occ?.[i] ? '#0f766e' : '#e2e8f0'} stroke="#cbd5e1" strokeWidth={0.02} />
    ))}
  </g>
), (a, b) => a.ver === b.ver);

// Проход: голубая полоса с пунктиром по оси — по ней ездят роботы
export const AisleShape = ({ w, l }) => (
  <g>
    <rect width={w} height={l} fill="#dbeafe" opacity={0.7} />
    <line x1={0.2} y1={l / 2} x2={w - 0.2} y2={l / 2} stroke="#93c5fd" strokeWidth={0.05} strokeDasharray="0.4 0.3" />
  </g>
);

// Ограждение зоны работы роботов: жёлто-чёрная полосатая лента, столбики по углам, подпись
export const FenceShape = ({ w, l, label }) => (
  <g>
    <rect width={w} height={l} fill="none" stroke="#facc15" strokeWidth={0.24} />
    <rect width={w} height={l} fill="none" stroke="#1f2937" strokeWidth={0.24} strokeDasharray="0.3 0.3" />
    {[[0, 0], [w, 0], [0, l], [w, l]].map(([x, y], i) => <rect key={i} x={x - 0.16} y={y - 0.16} width={0.32} height={0.32} fill="#1f2937" />)}
    {label && <text x={0.1} y={-0.35} fontSize={0.5} fill="#475569">{label}</text>}
  </g>
);
