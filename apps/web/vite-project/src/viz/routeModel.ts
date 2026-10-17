// Модель маршрута: геометрия объекта → пробег → время цикла → производительность робота.
//
// Зачем: паспортная производительность (или типовая для класса, 90 ед/ч у AMR) не знает ни
// размеров склада, ни скорости робота, ни того, где стоят ворота. Модель связывает схему
// с экономикой: средний пробег до места хранения и обратно, делённый на скорость, плюс время
// погрузки и выгрузки дают время цикла, а из него — сколько операций в час робот реально сделает.
// Дальше формулы экономистов не меняются: N = пик ÷ (производительность × загрузка) × (1 + резерв).
//
// Пробег считается по осям (робот едет по проходам, а не по диагонали). Склад W × L, где W — стена
// с воротами (приёмка и отгрузка), L — глубина. Место хранения равновероятно по площади, поэтому
// среднее расстояние от точки на стене до случайной точки прямоугольника:
//   ворота в центре стены:  E|x − W/2| + E|y| = W/4 + L/2
//   ворота в углу:          E|x| + E|y|       = W/2 + L/2
// Коэффициент обхода учитывает, что ряды стеллажей приходится объезжать.

export type DockLayout = "center" | "corner";

export const DOCK_LABEL: Record<DockLayout, string> = {
    center: "в центре стены",
    corner: "в углу",
};

/** Значения по умолчанию — модельные допущения, каждое показывается пользователю в «Формулах и допущениях» */
export const ROUTE_DEFAULTS = {
    dock: "center" as DockLayout,
    /** Доля максимальной скорости в среднем по маршруту: разгон, торможение, повороты, зоны с людьми */
    speedFactor: 0.8,
    /** Обход рядов стеллажей: фактический путь длиннее расстояния по осям */
    detour: 1.2,
    /** Погрузка + выгрузка за один цикл, с */
    handlingSec: 20,
    /** Загрузка робота, когда пробег считается явно: остаются только трафик и простои (вместо 0,7) */
    utilization: 0.85,
};

export type RouteParams = {
    widthM: number;
    lengthM: number;
    dock: DockLayout;
    /** Пробег в одну сторону, заданный пользователем, м. Если > 0 — используется вместо расчёта по габаритам */
    routeOverrideM?: number;
    speedMps: number;
    speedFactor?: number;
    detour?: number;
    handlingSec?: number;
    /** Время работы от одной зарядки, ч */
    runtimeH?: number;
    /** Время зарядки, ч */
    chargeH?: number;
    /** Сколько часов в сутки работает объект */
    hoursPerDay: number;
};

export type RouteCycle = {
    /** Средний пробег в одну сторону, м */
    oneWayM: number;
    /** Время цикла: дорога туда и обратно плюс погрузка и выгрузка, с */
    cycleSec: number;
    /** Доля времени, когда робот не на зарядке, 0…1 */
    availability: number;
    /** Операций в час с учётом зарядки; 0 — посчитать нельзя (нет габаритов или скорости) */
    perHour: number;
    /** Пробег взят из поля пользователя, а не из габаритов */
    overridden: boolean;
    /** Параметры, с которыми посчитано, — для объяснения в отчёте */
    speedFactor: number;
    detour: number;
    handlingSec: number;
};

const pos = (v: number | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const nonNeg = (v: number | undefined, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback);

/** Средний пробег в одну сторону по габаритам, м (без пользовательского значения) */
export function meanOneWay(widthM: number, lengthM: number, dock: DockLayout, detour = ROUTE_DEFAULTS.detour): number {
    if (!pos(widthM) || !pos(lengthM)) return 0;
    const base = dock === "corner" ? widthM / 2 + lengthM / 2 : widthM / 4 + lengthM / 2;
    return base * (pos(detour) ? detour : ROUTE_DEFAULTS.detour);
}

/**
 * Время цикла и производительность робота по геометрии объекта.
 *   d = (W/4 + L/2) × k_обход   — ворота в центре стены
 *   d = (W/2 + L/2) × k_обход   — ворота в углу
 *   d = routeOverrideM          — если пользователь задал пробег сам
 *   T = 2d / (v × k_v) + t_погр+выгр
 *   A = runtime / (runtime + charge), если объект работает дольше, чем робот от одной зарядки; иначе 1
 *   П = 3600 / T × A
 * Не хватает данных (нет габаритов или скорости) — perHour = 0, вызывающий берёт паспортное значение.
 */
export function routeCycle(p: RouteParams): RouteCycle {
    const speedFactor = pos(p.speedFactor) ? Math.min(1, p.speedFactor) : ROUTE_DEFAULTS.speedFactor;
    const detour = pos(p.detour) ? p.detour : ROUTE_DEFAULTS.detour;
    const handlingSec = nonNeg(p.handlingSec, ROUTE_DEFAULTS.handlingSec);
    const overridden = pos(p.routeOverrideM);
    const oneWayM = overridden ? p.routeOverrideM! : meanOneWay(p.widthM, p.lengthM, p.dock, detour);

    const availability =
        pos(p.runtimeH) && pos(p.chargeH) && pos(p.hoursPerDay) && p.hoursPerDay > p.runtimeH
            ? p.runtimeH / (p.runtimeH + p.chargeH)
            : 1;

    const empty = { oneWayM, cycleSec: 0, availability, perHour: 0, overridden, speedFactor, detour, handlingSec };
    if (!pos(p.speedMps) || !pos(oneWayM)) return empty;

    const cycleSec = (2 * oneWayM) / (p.speedMps * speedFactor) + handlingSec;
    if (!pos(cycleSec)) return empty;
    return { ...empty, cycleSec, perHour: (3600 / cycleSec) * availability };
}
