import { RobotShape } from './shapes/RobotShape';
import { RackShape } from './shapes/RackShape';
import { ROBOT_TYPES } from './catalog';
import { MarkerShape, StationaryShape, ZoneShape, AisleShape, FenceShape } from './shapes/MiscShapes';

export const layerOf = (it) => (it.type === 'mezzanine' ? 'mezzanine' : it.kind === 'zone' ? 'rack' : it.kind === 'fence' || it.kind === 'aisle' ? 'safety' : it.kind);
// Порядок рисования: проходы → мезонин → зоны → стеллажи → точки → ограждение
const order = (it) => (it.kind === 'aisle' ? -1 : it.type === 'mezzanine' ? 0 : { zone: 1, rack: 2, stationary: 2, marker: 3, fence: 4 }[it.kind] ?? 2);

function rackProps(it, nodes) {
  const ns = (it.nodeIds || []).map((id) => nodes[id]).filter(Boolean);
  if (!ns.length) return { ver: 0 };
  const ver = ns.reduce((s, n) => s + n.ver, 0);
  if (it.type === 'deep') return { ver, lanes: ns.map((n) => ({ fill: n.fill, cap: n.def.capacity })) };
  return { ver, frac: ns[0].fill / ns[0].def.capacity };
}

// 1 единица SVG = 1 метр: габариты из расчёта используются как есть
export function WarehouseCanvas({ warehouse, layout, sim, selectedId, onSelect, hidden = [], svgRef }) {
  const { width: W, length: L } = warehouse, T = 0.8, pad = 2.8;
  const statics = layout.items.filter((it) => !hidden.includes(layerOf(it))).sort((a, b) => order(a) - order(b));
  const sel = (it) => selectedId === it.id && <rect width={it.w} height={it.l} fill="none" stroke="#ef4444" strokeWidth={0.12} />;

  return (
    <svg ref={svgRef} viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${L + 2 * pad}`} style={{ width: '100%', height: 'auto', background: 'var(--canvas, #cbd5e1)', borderRadius: 8, display: 'block' }}>
      <defs>
        <pattern id="floor" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#dfe5ec" strokeWidth="0.03" /></pattern>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0.06" dy="0.1" stdDeviation="0.07" floodOpacity="0.35" /></filter>
        <filter id="wallshadow" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0.15" dy="0.2" stdDeviation="0.2" floodOpacity="0.35" /></filter>
      </defs>

      {/* пол */}
      <rect width={W} height={L} fill="#eef2f6" />
      <rect width={W} height={L} fill="url(#floor)" />

      {statics.map((it) => (
        <g key={it.id} transform={`translate(${it.x} ${it.y})`} onClick={() => onSelect?.(it)} style={{ cursor: it.kind === 'fence' || it.kind === 'aisle' ? 'default' : 'pointer' }}
           pointerEvents={it.kind === 'fence' || it.kind === 'aisle' ? 'none' : undefined}>
          <g transform={it.rot ? `rotate(${it.rot} ${it.w / 2} ${it.l / 2})` : undefined}>
            {it.kind === 'aisle' && <AisleShape w={it.w} l={it.l} />}
            {it.kind === 'fence' && <FenceShape w={it.w} l={it.l} label={it.label} />}
            {it.kind === 'rack' && <RackShape type={it.type} w={it.w} l={it.l} {...rackProps(it, sim.nodes)} />}
            {it.kind === 'zone' && <ZoneShape w={it.w} l={it.l} laneH={it.laneH} slotsLocal={it.slotsLocal} slotW={it.slotW} slotL={it.slotL}
              occ={sim.nodes[it.nodeId]?.occ} ver={sim.nodes[it.nodeId]?.ver} />}
            {it.kind === 'marker' && <MarkerShape role={it.role} w={it.w} l={it.l} />}
            {it.kind === 'stationary' && <StationaryShape w={it.w} l={it.l} throughput={it.throughput} />}
            {sel(it)}
          </g>
        </g>
      ))}

      {/* маршруты: пройденный путь (цвет типа робота) и оставшийся путь до следующей точки (синий пунктир) */}
      {!hidden.includes('routes') && (
        <g pointerEvents="none" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {sim.robots.filter((r) => r.kind === 'mobile').map((r) => (
            <g key={`rt${r.id}`}>
              {r.trail.length > 1 && <polyline points={r.trail.map((p) => `${p.x},${p.y}`).join(' ')} stroke={ROBOT_TYPES[r.type].color} strokeWidth={0.14} opacity={0.5} />}
              {r.path.length > 0 && <polyline points={[`${r.x},${r.y}`, ...r.path.map((p) => `${p.x},${p.y}`)].join(' ')} stroke="#2563eb" strokeWidth={0.1} strokeDasharray="0.3 0.25" />}
            </g>
          ))}
        </g>
      )}

      {!hidden.includes('robot') && (
        <g filter="url(#shadow)">
          {sim.robots.map((r) => {
            const deg = (r.heading * 180) / Math.PI - 90, dim = r.status === 'charging' || r.status === 'done';
            return (
              <g key={r.id} onClick={() => onSelect?.({ ...r, kind: 'robot' })} style={{ cursor: 'pointer' }} opacity={dim ? 0.6 : 1}>
                {r.kind === 'stationary' ? (
                  <rect x={r.x - r.w / 2} y={r.y - r.l / 2} width={r.w} height={r.l} fill="#0f172a" rx={0.05} />
                ) : (
                  <g transform={`translate(${r.x} ${r.y}) rotate(${deg})`}>
                    <g transform={`translate(${-r.w / 2} ${-r.l / 2})`}><RobotShape type={r.type} w={r.w} l={r.l} forkLen={r.forkLen} /></g>
                    {r.carrying && <rect x={-r.load.w / 2} y={r.load.dy - r.load.l / 2} width={r.load.w} height={r.load.l} rx={0.04} fill="#f97316" stroke="#7c2d12" strokeWidth={0.04} />}
                    {selectedId === r.id && <circle r={Math.max(r.w, r.l) * 0.8} fill="none" stroke="#ef4444" strokeWidth={0.1} />}
                  </g>
                )}
              </g>
            );
          })}
        </g>
      )}
      {!hidden.includes('robot') && sim.robots.map((r) => {
        const tx = r.x, ty = r.y - Math.max(r.w, r.l) / 2 - 0.25, txt = `${r.status === 'done' ? '✓' : r.status === 'charging' ? '⚡' : ''}${r.orders}/${r.quota}`;
        return (
          <g key={`t${r.id}`} pointerEvents="none" textAnchor="middle" fontSize={0.5}>
            <text x={tx} y={ty} fill="none" stroke="#fff" strokeWidth={0.16} strokeLinejoin="round">{txt}</text>
            <text x={tx} y={ty} fill="#0f172a">{txt}</text>
          </g>
        );
      })}

      {/* стены */}
      <g filter="url(#wallshadow)" pointerEvents="none">
        <path fillRule="evenodd" fill="#475569" d={`M${-T},${-T}H${W + T}V${L + T}H${-T}Z M0,0V${L}H${W}V0Z`} />
        <rect x={-T} y={-T} width={W + 2 * T} height={L + 2 * T} fill="none" stroke="#1e293b" strokeWidth={0.08} />
        <rect width={W} height={L} fill="none" stroke="#0f172a" strokeWidth={0.1} />
        <rect x={-T + 0.12} y={-T + 0.12} width={W + 2 * T - 0.24} height={L + 2 * T - 0.24} fill="none" stroke="#64748b" strokeWidth={0.06} />
      </g>
      <text x={W / 2} y={-T - 0.5} textAnchor="middle" fontSize={0.9} fill="#334155">{W} м</text>
      <text x={-T - 0.5} y={L / 2} textAnchor="middle" fontSize={0.9} fill="#334155" transform={`rotate(-90 ${-T - 0.5} ${L / 2})`}>{L} м</text>
    </svg>
  );
}
