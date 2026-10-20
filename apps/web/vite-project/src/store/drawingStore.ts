import { create } from "zustand";
import { deserializeDrawing, measure, serializeDrawing, type Drawing, type DrawingUnits, type SavedDrawing, type Segment } from "../lib/drawing";

// Загруженный чертёж склада. В localStorage не хранится: картинки живут как object URL, а линий в DXF
// бывают десятки тысяч. DXF сохраняется вместе с расчётом (упрощённой копией в params) и восстанавливается
// при открытии расчёта из «Моих расчётов». Картинки и PDF с расчётом не сохраняются — для них нужно хранилище файлов.

export type Underlay =
    | { kind: "dxf"; name: string; drawing: Drawing; units: DrawingUnits; applied: boolean }
    | { kind: "image" | "pdf"; name: string; url: string };

/** Что рисовать под схемой склада: линии в метрах (ось Y вниз) или картинку на габариты склада */
export type CanvasUnderlay = { kind: "lines"; segments: Segment[] } | { kind: "image"; url: string } | null;

type DrawingState = {
    underlay: Underlay | null;
    setDxf: (drawing: Drawing) => void;
    setUnits: (units: DrawingUnits) => void;
    setFile: (kind: "image" | "pdf", name: string, url: string) => void;
    markApplied: () => void;
    clear: () => void;
    /** Открыли сохранённый расчёт: его чертёж или ничего — чтобы чужой чертёж не остался на схеме */
    restore: (saved: unknown) => void;
};

const revoke = (u: Underlay | null) => {
    if (u && u.kind !== "dxf") URL.revokeObjectURL(u.url);
};

export const useDrawingStore = create<DrawingState>()((set, get) => ({
    underlay: null,
    setDxf: (drawing) => {
        revoke(get().underlay);
        set({ underlay: { kind: "dxf", name: drawing.name, drawing, units: drawing.units, applied: false } });
    },
    setUnits: (units) => {
        const u = get().underlay;
        // Сменили единицы — прежние габариты уже не те: их нужно подставить заново
        if (u?.kind === "dxf") set({ underlay: { ...u, units, applied: false } });
    },
    setFile: (kind, name, url) => {
        revoke(get().underlay);
        set({ underlay: { kind, name, url } });
    },
    markApplied: () => {
        const u = get().underlay;
        if (u?.kind === "dxf") set({ underlay: { ...u, applied: true } });
    },
    clear: () => {
        revoke(get().underlay);
        set({ underlay: null });
    },
    restore: (saved) => {
        revoke(get().underlay);
        const r = saved ? deserializeDrawing(saved) : null;
        set({ underlay: r ? { kind: "dxf", name: r.drawing.name, drawing: r.drawing, units: "m", applied: r.applied } : null });
    },
}));

/** Что положить в расчёт при сохранении: только DXF — картинки и PDF для этого слишком велики */
export function toSavedDrawing(u: Underlay | null): SavedDrawing | undefined {
    return u?.kind === "dxf" ? serializeDrawing(u.drawing, u.units, u.applied) : undefined;
}

/** Подложка для схемы. PDF под схему не кладётся — браузер не рисует PDF внутри SVG */
export function toCanvasUnderlay(u: Underlay | null): CanvasUnderlay {
    if (!u) return null;
    if (u.kind === "dxf") return { kind: "lines", segments: measure(u.drawing, u.units).segmentsM };
    if (u.kind === "image") return { kind: "image", url: u.url };
    return null;
}
