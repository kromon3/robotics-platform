import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { UNIT_LABEL, dxfToDrawing, fileKind, measure, type DrawingUnits } from "../lib/drawing";
import { useDrawingStore } from "../store/drawingStore";
import { FIELD_LIMITS, toNumericFormData, useProjectStore } from "../store/store";
import { toEconNumeric, useEconStore } from "../store/econStore";
import { checkRealism } from "../lib/realism";

// Загрузка чертежа склада (по отзыву эксперта: технические специалисты должны иметь возможность
// загрузить свою схему). DXF — рабочий: габариты и площадь контура уходят в расчёт по кнопке.
// PNG, JPG, PDF — подложка для сверки, в расчёт не идут. DWG браузер не читает — подсказываем, как сохранить в DXF.

const ACCEPT = ".dxf,.dwg,.png,.jpg,.jpeg,.webp,.pdf";
/** Больше — уже не план склада, а целый генплан с подложками; браузер будет разбирать его слишком долго */
const MAX_DXF_MB = 25;

const fmt = (n: number, digits = 1) => n.toLocaleString("ru-RU", { maximumFractionDigits: digits });

function Preview({ segments, width, length }: { segments: [number, number, number, number][]; width: number; length: number }) {
    // Превью — не больше 4000 отрезков: для узнавания контура хватает
    const step = Math.max(1, Math.ceil(segments.length / 4000));
    const pad = Math.max(width, length) * 0.03;
    return (
        <svg
            viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${length + 2 * pad}`}
            className="h-32 w-full rounded-lg bg-slate-50 dark:bg-slate-800/60"
            aria-label="Превью чертежа"
        >
            <g stroke="currentColor" strokeWidth={Math.max(width, length) / 400} className="text-slate-700 dark:text-slate-300">
                {segments
                    .filter((_, i) => i % step === 0)
                    .map(([x1, y1, x2, y2], i) => (
                        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
                    ))}
            </g>
        </svg>
    );
}

export function DrawingUpload() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const underlay = useDrawingStore((s) => s.underlay);
    const formData = useProjectStore((s) => s.formData);
    const econ = useEconStore((s) => s.econ);
    const { setDxf, setUnits, setFile, markApplied, clear } = useDrawingStore.getState();

    const measured = useMemo(
        () => (underlay?.kind === "dxf" ? measure(underlay.drawing, underlay.units) : null),
        [underlay],
    );

    const onFile = async (file: File) => {
        const kind = fileKind(file.name);
        if (kind === "dwg") {
            toast.error(
                "DWG — закрытый формат AutoCAD, браузер его не читает. В AutoCAD: «Файл → Сохранить как → DXF» и загрузите DXF.",
                { duration: 8000 },
            );
            return;
        }
        if (kind === "unknown") {
            toast.error("Поддерживаются DXF, PNG, JPG и PDF");
            return;
        }
        if (kind === "image" || kind === "pdf") {
            setFile(kind, file.name, URL.createObjectURL(file));
            return;
        }
        if (file.size > MAX_DXF_MB * 1024 * 1024) {
            toast.error(`Чертёж больше ${MAX_DXF_MB} МБ. Оставьте в нём только план склада (без подложек и соседних зданий)`);
            return;
        }
        setBusy(true);
        try {
            setDxf(dxfToDrawing(await file.text(), file.name));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Не удалось прочитать чертёж");
        } finally {
            setBusy(false);
        }
    };

    const limits = { w: FIELD_LIMITS.width!, l: FIELD_LIMITS.length! };
    const fits =
        measured !== null &&
        measured.widthM >= limits.w.min &&
        measured.widthM <= limits.w.max &&
        measured.lengthM >= limits.l.min &&
        measured.lengthM <= limits.l.max;

    // Что изменится в проверках реалистичности, если подставить габариты чертежа. Показываем только новые
    // противоречия: старые к чертежу отношения не имеют и уже видны под формой
    const newWarnings = useMemo(() => {
        if (!measured || !fits) return [];
        const e = econ.workMode ? toEconNumeric(econ) : undefined;
        const before = new Set(checkRealism(toNumericFormData(formData), e).map((w) => w.key));
        const after = checkRealism(
            toNumericFormData({ ...formData, width: Math.round(measured.widthM * 10) / 10, length: Math.round(measured.lengthM * 10) / 10 }),
            e,
        );
        return after.filter((w) => !before.has(w.key));
    }, [measured, fits, formData, econ]);

    const apply = () => {
        if (!measured || !fits) return;
        const width = Math.round(measured.widthM * 10) / 10;
        const length = Math.round(measured.lengthM * 10) / 10;
        useProjectStore.setState((s) => ({ formData: { ...s.formData, width, length } }));
        // Рабочая площадь — из контура здания: от неё зависит статья «подготовка пола»
        useEconStore.getState().patch({ activeAreaM2: Math.round(measured.areaM2) });
        markApplied();
        toast.success(`Из чертежа в расчёт: ${fmt(width)} × ${fmt(length)} м, площадь ${fmt(measured.areaM2, 0)} м²`);
    };

    return (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                    e.target.value = ""; // тот же файл можно загрузить повторно
                }}
            />

            {!underlay && (
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-2xl" aria-hidden>
                        📐
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Есть чертёж склада?</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            DXF из AutoCAD — габариты и площадь здания подставятся в расчёт. PNG, JPG, PDF — подложкой для сверки
                            со схемой.
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => inputRef.current?.click()}
                        className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                    >
                        {busy ? "Читаю чертёж…" : "Загрузить чертёж"}
                    </button>
                </div>
            )}

            {underlay?.kind === "dxf" && measured && (
                <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                            📐 {underlay.name}
                            <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                                {fmt(underlay.drawing.segments.length, 0)} линий
                                {underlay.drawing.stats.truncated ? " (показана часть — чертёж очень большой)" : ""}
                            </span>
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                Единицы чертежа
                                <select
                                    value={underlay.units}
                                    onChange={(e) => setUnits(e.target.value as DrawingUnits)}
                                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                                >
                                    {(Object.keys(UNIT_LABEL) as DrawingUnits[]).map((u) => (
                                        <option key={u} value={u}>
                                            {UNIT_LABEL[u]}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                {underlay.drawing.unitsSource === "file" ? "из файла" : "определены по размеру — проверьте"}
                            </span>
                        </div>

                        <p className="mt-3 text-base">
                            Габариты {measured.byOutline ? "контура здания" : "чертежа"}:{" "}
                            <b className="tabular-nums">
                                {fmt(measured.widthM)} × {fmt(measured.lengthM)} м
                            </b>
                            , площадь <b className="tabular-nums">{fmt(measured.areaM2, 0)} м²</b>
                        </p>
                        {!measured.byOutline && (
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                Замкнутого контура здания в чертеже нет — площадь посчитана по прямоугольной рамке всех линий.
                            </p>
                        )}
                        {!fits && (
                            <p className="mt-1 text-xs text-red-700 dark:text-red-400">
                                Склад {fmt(measured.widthM)} × {fmt(measured.lengthM)} м выходит за допустимые {limits.w.min}–{limits.w.max} м —
                                скорее всего, неверно определены единицы. Выберите другие выше.
                            </p>
                        )}

                        {newWarnings.length > 0 && !underlay.applied && (
                            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                                <p className="font-semibold">С этими габаритами параметры перестанут сходиться:</p>
                                <ul className="mt-1 list-disc space-y-1 pl-4">
                                    {newWarnings.map((w) => (
                                        <li key={w.key}>
                                            <span className="font-medium">{w.title}</span> — {w.note}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-1">Проверьте единицы и тот ли контур найден. Подставить можно — но расчёт будет выглядеть убедительно и не значить ничего.</p>
                            </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={apply}
                                disabled={!fits}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {underlay.applied
                                    ? "✓ Габариты в расчёте"
                                    : newWarnings.length > 0
                                      ? "Подставить всё равно"
                                      : "Подставить габариты в расчёт"}
                            </button>
                            <button type="button" onClick={() => inputRef.current?.click()} className="text-sm text-slate-500 hover:underline dark:text-slate-400">
                                Другой файл
                            </button>
                            <button type="button" onClick={clear} className="text-sm text-slate-500 hover:underline dark:text-slate-400">
                                Убрать
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                            От габаритов зависят пробег робота и число роботов, от площади — подготовка пола. Чертёж будет
                            нарисован поверх схемы склада на странице результата. Стеллажи и маршруты по стенам чертежа пока не
                            расставляются.
                        </p>
                    </div>
                    <Preview segments={measured.segmentsM} width={measured.widthM} length={measured.lengthM} />
                </div>
            )}

            {underlay && underlay.kind !== "dxf" && (
                <div className="flex flex-wrap items-center gap-4">
                    {underlay.kind === "image" ? (
                        <img src={underlay.url} alt="" className="h-20 w-28 rounded-lg bg-slate-50 object-contain dark:bg-slate-800" />
                    ) : (
                        <span className="flex h-20 w-28 items-center justify-center rounded-lg bg-slate-50 text-2xl dark:bg-slate-800">📄</span>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{underlay.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {underlay.kind === "image"
                                ? "Подложка под схемой склада на странице результата — для визуальной сверки. В расчёт не идёт: габариты введите в форму или загрузите DXF."
                                : "PDF открывается рядом со схемой для сверки. В расчёт не идёт: габариты введите в форму или загрузите DXF."}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => inputRef.current?.click()} className="text-sm text-slate-500 hover:underline dark:text-slate-400">
                            Другой файл
                        </button>
                        <button type="button" onClick={clear} className="text-sm text-slate-500 hover:underline dark:text-slate-400">
                            Убрать
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
