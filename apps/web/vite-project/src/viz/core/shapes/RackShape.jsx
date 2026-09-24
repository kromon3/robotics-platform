import { memo } from 'react';
import { RACK_TYPES } from '../catalog';
import { Port } from './MiscShapes';

const range = (n) => Array.from({ length: Math.max(0, n) }, (_, i) => i);
const ON = '#0f766e', OFF = 'rgba(255,255,255,0.65)';

// Все стеллажи нарисованы «лицом» вниз (сторона y = l); нижний ряд ячейки поворачивается на 180°.
// frac — заполнение 0..1 (полки, консоль, поточный); lanes — [{fill, cap}] для глубинного.
export const RackShape = memo(({ type, w, l, frac = 0, lanes }) => {
  const c = RACK_TYPES[type].color, pr = Math.min(0.2, Math.max(0.05, Math.min(w, l) * 0.12));
  const frame = { fill: c, stroke: '#1e293b', strokeWidth: 0.06 }, thin = { stroke: '#1e293b', strokeWidth: 0.03 };

  switch (type) {
    case 'shelf': {
      const n = Math.min(10, Math.max(2, Math.floor(w / 0.25))), lit = frac > 0 ? Math.max(1, Math.round(frac * n)) : 0, sz = Math.min(l * 0.5, (w / n) * 0.8);
      return (
        <g>
          <rect width={w} height={l} {...frame} />
          {range(n).map((i) => <rect key={i} x={((i + 0.5) * w) / n - sz / 2} y={l / 2 - sz / 2} width={sz} height={sz} fill={i < lit ? ON : OFF} />)}
          {range(Math.max(2, Math.floor(w / 1.2))).map((i, _, a) => { const x = ((i + 0.5) * w) / a.length; return <g key={`p${i}`}><Port x={x} y={0} kind="inout" r={pr} /><Port x={x} y={l} kind="inout" r={pr} /></g>; })}
        </g>
      );
    }
    case 'deep': {
      const k = lanes?.length || Math.max(1, Math.floor(w / 0.9));
      return (
        <g>
          <rect width={w} height={l} {...frame} />
          {range(k - 1).map((i) => <line key={i} x1={((i + 1) * w) / k} y1={0} x2={((i + 1) * w) / k} y2={l} {...thin} strokeDasharray="0.2 0.2" />)}
          {range(k).map((i) => {
            const ln = lanes?.[i] || { fill: 0, cap: 5 }, r = Math.min(w / k / 2 * 0.7, (l / ln.cap / 2) * 0.8, 0.28), cx = ((i + 0.5) * w) / k;
            return (<g key={i}>
              {range(ln.cap).map((d) => <circle key={d} cx={cx} cy={l - (d + 0.5) * (l / ln.cap)} r={r} fill={d >= ln.cap - ln.fill ? ON : OFF} />)}
              <Port x={cx} y={l} kind="inout" r={pr} />
            </g>);
          })}
        </g>
      );
    }
    case 'flow': {
      const n = Math.max(2, Math.floor(l)), lit = Math.round(frac * n);
      return (
        <g>
          <rect width={w} height={l} {...frame} />
          {range(n - 1).map((i) => <line key={i} x1={0.2} y1={(i + 1) * l / n} x2={w - 0.2} y2={(i + 1) * l / n} {...thin} />)}
          {range(n).map((i) => <circle key={`d${i}`} cx={w / 2} cy={(i + 0.5) * l / n} r={Math.min(0.25, l / n * 0.3)} fill={i < lit ? ON : OFF} />)}
          <Port x={w / 2} y={l} kind="in" r={pr} /><Port x={w / 2} y={0} kind="out" r={pr} />
        </g>
      );
    }
    case 'cantilever': {
      const arms = Math.max(3, Math.floor(w / 0.6)), lit = Math.round(frac * arms);
      return (
        <g strokeLinecap="round">
          <line x1={0} y1={0.15} x2={w} y2={0.15} stroke="#44403c" strokeWidth={0.3} />
          {range(arms).map((i) => { const x = ((i + 0.5) * w) / arms; return <line key={i} x1={x} y1={0.15} x2={x} y2={l} stroke={i < lit ? ON : '#44403c'} strokeWidth={0.12} />; })}
          <Port x={w / 2} y={l} kind="inout" r={pr} />
        </g>
      );
    }
    case 'mezzanine':
      return (
        <g>
          <rect width={w} height={l} fill={c} fillOpacity={0.18} stroke={c} strokeWidth={0.12} strokeDasharray="0.5 0.3" />
          <text x={w - 0.2} y={0.7} textAnchor="end" fontSize={0.6} fill="#1d4ed8">Мезонин</text>
        </g>
      );
    default:
      return <rect width={w} height={l} {...frame} />;
  }
}, (a, b) => a.ver === b.ver);
