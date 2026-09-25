import { useRef } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { toast } from "sonner";
import { Wizard, type WizardStep } from "../components/Wizard.tsx";
import {
    ECON_LIMITS,
    FLOOR_FLATNESS,
    WORK_MODES,
    getEconInvalid,
    getEconMissing,
    useEconStore,
    type EconFieldName,
} from "../store/econStore";
import { getInvalidFields, getMissingFields, useProjectStore } from "../store/store";

// Блоки A–L из требований команды. Технические параметры (фаза 1) уже введены на /projects.
const STEPS: WizardStep<EconFieldName>[] = [
    {
        icon: "🏢",
        title: "Зона и здание",
        description: "A–C. Роботизируемая часть объекта",
        columns: 2,
        fields: [
            { name: "activeAreaM2", label: "Площадь активной зоны", unit: "м²" },
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
        title: "Хранение и грузы",
        description: "E. Характеристики грузовых и штучных единиц",
        columns: 3,
        fields: [
            { name: "palletMass", label: "Масса паллеты", unit: "кг" },
            { name: "palletPlaces", label: "Паллетомест", unit: "шт" },
            { name: "oversizeShare", label: "Доля негабарита", unit: "%" },
            { name: "palletL", label: "Паллета: длина", unit: "мм" },
            { name: "palletW", label: "Паллета: ширина", unit: "мм" },
            { name: "palletH", label: "Паллета: высота", unit: "мм" },
            { name: "skuMass", label: "Масса SKU", unit: "кг" },
            { name: "skuL", label: "SKU: длина", unit: "мм" },
            { name: "skuW", label: "SKU: ширина", unit: "мм" },
            { name: "skuH", label: "SKU: высота", unit: "мм" },
        ],
    },
    {
        icon: "🔄",
        title: "Операции",
        description: "F. Объём и структура грузопотока",
        columns: 2,
        fields: [
            { name: "inboundPerDay", label: "Объём приёмки", unit: "поддонов/сут" },
            { name: "outboundPerDay", label: "Объём отгрузки", unit: "поддонов/сут" },
            { name: "pickLinesPerDay", label: "Объём отбора", unit: "строк/сут" },
            { name: "pickUnitsPerDay", label: "Объём отбора", unit: "штук/сут", hint: "≈1,5 штуки на строку" },
            { name: "piecePickShare", label: "Доля мелкоштучного отбора", unit: "%" },
            { name: "skuActive", label: "Активных SKU", unit: "шт" },
            { name: "skuAClassShare", label: "Доля SKU класса A", unit: "%", span: "full", hint: "быстрый оборот" },
        ],
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
    const formData = useProjectStore((s) => s.formData);
    const productId = useProjectStore((s) => s.selectedProductId);
    const gotoField = useRef<((name: EconFieldName) => void) | null>(null);

    // Без параметров объекта и выбранного робота считать нечего
    const phase1Ready = getMissingFields(formData).length === 0 && getInvalidFields(formData).length === 0;
    if (!phase1Ready) return <Navigate to="/projects" replace />;
    if (!productId) return <Navigate to="/projects/offers" replace />;

    const submit = () => {
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
                    <button type="button" onClick={fillExample} className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        Заполнить примером
                    </button>
                    <button type="button" onClick={reset} className="text-sm font-medium text-slate-500 hover:underline dark:text-slate-400">
                        Очистить
                    </button>
                </div>
            </div>

            <Wizard<EconFieldName>
                steps={STEPS}
                getValue={(name) => econ[name] as string | number | boolean}
                onChange={handleChange}
                getOptions={(name) =>
                    name === "workMode" ? WORK_MODES : name === "floorFlatness" ? FLOOR_FLATNESS : []
                }
                getLimit={(name) => ECON_LIMITS[name]}
                intro={{
                    icon: "📈",
                    title: "Экономика проекта",
                    text: "Заполните режим работы, объём операций, персонал и бюджет — по ним рассчитаем CAPEX, OPEX, годовой эффект, срок окупаемости, ROI и TCO за 5 лет по трём сценариям.",
                    button: "Начать →",
                }}
                submitLabel="Рассчитать →"
                onSubmit={submit}
                gotoStepRef={gotoField}
            />
        </div>
    );
}
