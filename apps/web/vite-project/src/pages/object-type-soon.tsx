import { Link, Navigate, useParams } from "react-router";
import { getObjectType } from "../lib/object-types";

// Аэропорт и медучреждение: выбор типа объекта есть, экран параметров ещё в работе (ТЗ 3.2.1, 5.5).
// Честно показываем, что готово, что нет и чем можно пользоваться уже сейчас.

type Stage = { title: string; text: string; done: boolean };

const STAGES: Record<string, Stage[]> = {
    airport: [
        { title: "Выбор типа объекта", text: "Аэропорт заведён как отдельный тип со своим набором процессов", done: true },
        { title: "Каталог решений", text: "Решения для обработки багажа и перронной логистики ищутся в общем каталоге", done: true },
        { title: "Экономическая модель", text: "CAPEX, OPEX, окупаемость, ROI и TCO считаются теми же формулами", done: true },
        { title: "Экран параметров объекта", text: "Терминалы, пиковый пассажиропоток, багажные линии, регламент обработки", done: false },
        { title: "Правила подбора и имитация", text: "Проверка по габаритам зон, схема перрона и модель смены", done: false },
    ],
    medical: [
        { title: "Выбор типа объекта", text: "Медучреждение заведено как отдельный тип со своим набором процессов", done: true },
        { title: "Каталог решений", text: "Транспортные роботы для доставки расходников, белья и проб — в общем каталоге", done: true },
        { title: "Экономическая модель", text: "CAPEX, OPEX, окупаемость, ROI и TCO считаются теми же формулами", done: true },
        { title: "Экран параметров объекта", text: "Корпуса и этажи, лифты, маршруты доставки, режим работы отделений", done: false },
        { title: "Правила подбора и имитация", text: "Требования к дезинфекции и шуму, схема этажа и модель смены", done: false },
    ],
};

export function ObjectTypeSoon() {
    const { type } = useParams();
    const objectType = getObjectType(type);
    if (!objectType) return <Navigate to="/projects" replace />;

    const { name, tagline, accent, Icon } = objectType;
    const stages = STAGES[objectType.key] ?? [];
    const done = stages.filter((s) => s.done).length;
    const progress = stages.length ? Math.round((done / stages.length) * 100) : 0;

    return (
        <div className="mx-auto flex max-w-3xl flex-col items-center py-8">
            <div className="relative flex h-24 w-24 items-center justify-center">
                {/* Две расходящиеся волны — «работа идёт» */}
                <span aria-hidden className={`absolute inset-0 animate-ping rounded-full opacity-20 motion-reduce:animate-none ${accent.icon}`} />
                <span aria-hidden className={`absolute inset-3 rounded-full opacity-40 ${accent.icon}`} />
                <span className={`relative flex h-16 w-16 items-center justify-center rounded-2xl ${accent.icon}`}>
                    <Icon className="h-8 w-8" />
                </span>
            </div>

            <span className="mt-6 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                В разработке
            </span>
            <h2 className="mt-4 text-center text-2xl font-bold tracking-tight sm:text-3xl">{name}</h2>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">{tagline}</p>

            <div className="mt-8 w-full rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Готовность направления
                    </h3>
                    <span className={`text-sm font-semibold ${accent.text}`}>
                        {done} из {stages.length}
                    </span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                        className={`h-full rounded-full bg-current transition-[width] duration-700 ease-out motion-reduce:transition-none ${accent.text}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <ol className="mt-6 space-y-4">
                    {stages.map((s) => (
                        <li key={s.title} className="flex gap-3">
                            <span
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                    s.done
                                        ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300"
                                        : "border border-dashed border-slate-300 text-slate-400 dark:border-slate-700 dark:text-slate-500"
                                }`}
                            >
                                {s.done ? "✓" : ""}
                            </span>
                            <span>
                                <span className={`block text-sm font-medium ${s.done ? "" : "text-slate-500 dark:text-slate-400"}`}>
                                    {s.title}
                                </span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">{s.text}</span>
                            </span>
                        </li>
                    ))}
                </ol>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                    to="/robots"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                    Посмотреть каталог решений
                </Link>
                <Link
                    to="/projects/warehouse"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    Рассчитать склад
                </Link>
                <Link
                    to="/projects"
                    className="text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                    ← Выбрать другой объект
                </Link>
            </div>

            <p className="mt-6 max-w-xl text-center text-xs text-slate-400 dark:text-slate-500">
                Экономическая модель, каталог и правила подбора не зависят от типа объекта — для нового типа
                добавляются только экран параметров и модель процессов.
            </p>
        </div>
    );
}
