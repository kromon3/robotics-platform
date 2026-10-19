import { useMemo, useRef } from "react";
import { normalizeResult } from "../viz/contract/schema";
import { buildLayout } from "../viz/core/layout";
import { useSimulation } from "../viz/core/useSimulation";
import { WarehouseCanvas } from "../viz/core/WarehouseCanvas";
import "../viz/viz.css";

// Схема склада для демо: тот же расчёт размещения и та же имитация, что на вкладке «Схема и имитация»,
// но без панелей управления — человек видит только склад и едущих роботов.

const SPEED = 10; // время имитации быстрее реального, как по умолчанию в полной визуализации

export function DemoSchema({ raw }: { raw: unknown }) {
    const norm = useMemo(() => normalizeResult(raw), [raw]);
    const layout = useMemo(() => (norm.data && !norm.data.baseline ? buildLayout(norm.data) : null), [norm]);
    const { sim } = useSimulation(layout, { running: true, speed: SPEED });
    const svgRef = useRef<SVGSVGElement>(null);

    if (!norm.data || !layout || !sim) {
        return <p className="text-sm text-slate-500 dark:text-slate-400">Схема для этого решения не строится.</p>;
    }

    return (
        // .viz — область стилей визуализации; высота ограничена, чтобы схема и цифры помещались на один экран
        <div className="viz [&_svg]:max-h-[19rem]">
            {/* Выделение робота кликом в демо не нужно — обработчик пустой */}
            <WarehouseCanvas warehouse={norm.data.warehouse} layout={layout} sim={sim} selectedId={null} onSelect={() => {}} svgRef={svgRef} />
        </div>
    );
}
