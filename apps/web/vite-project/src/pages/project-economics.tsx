import { useMemo, useRef } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { toast } from "sonner";
import { Wizard, type WizardStep } from "../components/Wizard.tsx";
import type { ProjectFormData } from "../store/store";
import {
    ECON_LIMITS,
    FLOOR_FLATNESS,
    WORK_MODES,
    getEconInvalid,
    getEconMissing,
    useEconStore,
    type EconFieldName,
} from "../store/econStore";
import { CARGO_TYPES, getInvalidFields, getMissingFields, useProjectStore } from "../store/store";

const n = (v: number | "") => (v === "" ? 0 : v);

/** Сводка блоков E–F: их ввели на первой фазе, здесь только показываем и даём вернуться */
function Phase1Recap({ p }: { p: ProjectFormData }) {
    const cargo = CARGO_TYPES.find((c) => c.value === p.cargoType)?.label ?? "—";
    const isPallet = p.cargoType === "pallet";
    const rows: [string, string][] = [
        ["Габариты объекта", `${n(p.width)} × ${n(p.length)} м`],
        ["Тип груза", cargo],
        ["Паллетомест", `${n(p.palletPlaces)} шт`],
        isPallet
            ? ["Паллета", `${n(p.pallet.L)} × ${n(p.pallet.W)} × ${n(p.pallet.H)} мм, ${n(p.palletMass)} кг`]
            : ["Грузовая единица", `${n(p.sku.L)} × ${n(p.sku.W)} × ${n(p.sku.H)} мм, ${n(p.skuMass)} кг`],
        ["Доля негабарита", `${n(p.oversizeShare)}%`],
        ["Приёмка / отгрузка", `${n(p.receivePalletsDay)} / ${n(p.shipPalletsDay)} паллет в сутки`],
        ["Отбор", `${n(p.pickLinesDay)} строк и ${n(p.pickPiecesDay)} штук в сутки`],
        ["Доля штучного отбора", `${n(p.piecePickShare)}%`],
        ["Активных SKU", `${n(p.skuActive)}, из них класса A — ${n(p.aClassShare)}%`],
    ];

    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {rows.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 sm:block">
                        <dt className="text-xs text-slate-500 dark:text-slate-400">{k}</dt>
                        <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-200">{v}</dd>
                    </div>
                ))}
            </dl>
            <Link
                to="/projects/warehouse"
                className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
                Изменить параметры объекта →
            </Link>
        </div>
    );
}

// Блоки A–L из требований команды. Блоки E (хранение и грузы) и F (операции) не спрашиваем:
// они введены на первой фазе (/projects) — показываем их сводкой, менять можно там же.
const buildSteps = (p: ProjectFormData, areaByDimensions: number): WizardStep<EconFieldName>[] => [
    {
        icon: "🏢",
        title: "Зона и здание",
        description: "A–C. Роботизируемая часть объекта",
        columns: 2,
        fields: [
            {
                name: "activeAreaM2",
                label: "Площадь активной зоны",
                unit: "м²",
                span: "full",
                hint: areaByDimensions
                    ? `По габаритам объекта — ${areaByDimensions.toLocaleString("ru-RU")} м². Укажите меньше, если роботизируется часть площади; пустое поле означает всю.`
                    : undefined,
            },
            { name: "floors", label: "Этажей", unit: "шт" },
            { name: "floorFlatness", label: "Отклонение пола", type: "select", span: "full" },
        ],
    },
    {
        icon: "🕒",
        title: "Режим работы",
        description: "D. Выберите режим — календарь подставится автоматически, значения можно поправить",
        columns: 2,
        fields: [
            { name: "workMode", label: "Режим работы", type: "select", span: "full" },
            { name: "workingDaysPerYear", label: "Рабочих дней в году", unit: "дн" },
            { name: "shiftsPerDay", label: "Смен в сутки", unit: "шт" },
            { name: "shiftHours", label: "Продолжительность смены", unit: "ч" },
            { name: "peakFactor", label: "Пиковый коэффициент", hint: "во сколько раз пик выше среднего" },
        ],
    },
    {
        icon: "📦",
        title: "Хранение и операции",
        description: "E–F. Уже введены в параметрах объекта — расчёт берёт их как есть",
        columns: 1,
        fields: [],
        content: <Phase1Recap p={p} />,
    },
    {
        icon: "👷",
        title: "Персонал",
        description: "G. Численность, оплата и выработка — основа расчёта замещения",
        columns: 2,
        fields: [
            { name: "staffTotal", label: "Общая численность", unit: "чел." },
            { name: "staffPickers", label: "Отборщики", unit: "чел." },
            { name: "staffForklift", label: "Операторы погрузчиков", unit: "чел." },
            { name: "staffPackers", label: "Операторы упаковки", unit: "чел." },
            { name: "salaryPicker", label: "Зарплата отборщика", unit: "₽/мес" },
            { name: "salaryForklift", label: "Зарплата оператора погрузчика", unit: "₽/мес" },
            { name: "payrollTaxPct", label: "Страховые взносы", unit: "%" },
            { name: "pickerLinesPerHour", label: "Выработка оператора", unit: "строк/ч" },
            { name: "timeLossFactor", label: "Коэффициент потерь времени", span: "full", hint: "отпуск, болезнь, текучесть — доля от 0 до 0,9" },
        ],
    },
    {
        icon: "🗺️",
        title: "Маршруты и инфраструктура",
        description: "H–L. Планировка, энергия, системы учёта и горизонт расчёта",
        columns: 2,
        fields: [
            { name: "routeLengthPerLine", label: "Маршрут отборщика на строку", unit: "м" },
            { name: "conveyorLength", label: "Длина конвейерной системы", unit: "м" },
            { name: "powerAvailableKw", label: "Доступная мощность", unit: "кВт" },
            { name: "replacedEquipmentCost", label: "Затраты на заменяемое оборудование", unit: "₽" },
            { name: "budget", label: "Бюджет роботизации", unit: "₽" },
            { name: "horizonYears", label: "Горизонт расчёта", unit: "лет" },
            { name: "hasWms", label: "Есть WMS", type: "checkbox", hint: "обязательно для роботизации" },
            { name: "hasErp", label: "Есть ERP / 1С", type: "checkbox" },
        ],
    },
];

export function ProjectEconomics() {
    const navigate = useNavigate();
    const econ = useEconStore((s) => s.econ);
    const handleChange = useEconStore((s) => s.handleChange);
    const fillExample = useEconStore((s) => s.fillExample);
    const reset = useEconStore((s) => s.reset);
    const setDefaults = useEconStore((s) => s.setDefaults);
    const formData = useProjectStore((s) => s.formData);
    const productId = useProjectStore((s) => s.selectedProductId);
    const gotoField = useRef<((name: EconFieldName) => void) | null>(null);

    // Площадь объекта по габаритам первой фазы — подсказка и значение по умолчанию для блока A
    const areaByDimensions = Math.round(n(formData.width) * n(formData.length));
    const steps = useMemo(() => buildSteps(formData, areaByDimensions), [formData, areaByDimensions]);

    // Без параметров объекта и выбранного робота считать нечего
    const phase1Ready = getMissingFields(formData).length === 0 && getInvalidFields(formData).length === 0;
    if (!phase1Ready) return <Navigate to="/projects/warehouse" replace />;
    if (!productId) return <Navigate to="/projects/offers" replace />;

    const submit = () => {
        // Площадь не указали — роботизируется весь объект
        if (areaByDimensions > 0) setDefaults({ activeAreaM2: areaByDimensions });
        const missing = getEconMissing(econ);
        if (missing.length > 0) {
            toast.error(`Заполните: ${missing.map((m) => m.label).join(", ")}`);
            gotoField.current?.(missing[0].name);
            return;
        }
        const invalid = getEconInvalid(econ);
        if (invalid.length > 0) {
            toast.error(invalid.map((i) => i.message).join("\n"), { duration: 6000 });
            gotoField.current?.(invalid[0].name);
            return;
        }
        if (!econ.hasWms) {
            toast.warning("WMS обязательна для роботизации — расчёт выполнен, отметьте это в допущениях");
        }
        navigate("/projects/result");
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <Link to="/projects/offers" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                        ← Выбрать другого робота
                    </Link>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">Данные для экономического расчёта</h2>
                </div>
                <div className="flex gap-4">
                    <button type="button" onClick={() => fillExample(areaByDimensions ? { activeAreaM2: areaByDimensions } : undefined)} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        Заполнить примером
                    </button>
                    <button type="button" onClick={reset} className="text-sm font-medium text-slate-500 hover:underline dark:text-slate-400">
                        Очистить
                    </button>
                </div>
            </div>

            <Wizard<EconFieldName>
                steps={steps}
                getValue={(name) => econ[name] as string | number | boolean}
                onChange={handleChange}
                getOptions={(name) =>
                    name === "workMode" ? WORK_MODES : name === "floorFlatness" ? FLOOR_FLATNESS : []
                }
                getLimit={(name) => ECON_LIMITS[name]}
                intro={{
                    icon: "📈",
                    title: "Экономика проекта",
                    text: "Параметры объекта и грузопоток уже введены — здесь нужны календарь работы, персонал, инфраструктура и бюджет. По ним рассчитаем CAPEX, OPEX, годовой эффект, срок окупаемости, ROI и TCO по трём сценариям.",
                    button: "Начать →",
                }}
                submitLabel="Рассчитать →"
                onSubmit={submit}
                gotoStepRef={gotoField}
            />
        </div>
    );
}
