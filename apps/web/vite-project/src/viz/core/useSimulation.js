import { useEffect, useMemo, useState } from 'react';
import { createSim, stepSim } from './sim';

// Крутит симуляцию через requestAnimationFrame. speed — во сколько раз время симуляции быстрее реального.
export function useSimulation(layout, { running, speed }) {
  const [epoch, setEpoch] = useState(0);
  const [, setTick] = useState(0);
  const sim = useMemo(() => (layout ? createSim(layout) : null), [layout, epoch]);

  useEffect(() => {
    if (!running || !sim) return undefined;
    let raf, last = performance.now(), frame = 0;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!sim.finished) { stepSim(sim, dt * speed); if (++frame % 2 === 0 || sim.finished) setTick((t) => t + 1); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, sim]);

  return { sim, restart: () => setEpoch((e) => e + 1) };
}
