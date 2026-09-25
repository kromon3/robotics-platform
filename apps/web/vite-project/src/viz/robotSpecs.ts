import type { Product } from "../api/catalog.ts";

// Робот в терминах визуализации (контракт warehouse-viz: src/viz/contract/schema.js).
export type VizRobotType = "AMR" | "UGV" | "AGV" | "MM" | "SR" | "DOG" | "HUM" | "FMR" | "CTU" | "ASRS";

export type VizRobot = {
    id: string;
    name: string;
    type: VizRobotType;
    w: number; // м, ширина корпуса
    l: number; // м, длина корпуса
    forkLen?: number; // м, только FMR/CTU
    speedMps: number;
    payloadKg: number;
    throughputPerHour: number; // заказов (перемещений) в час, паспортная
    price: number; // ₽
    specsSource: "specs" | "v0" | "type-default";
};

// ТТХ v0 — ОЦЕНКИ по открытым источникам для роботов, которых нет в каталоге робототехников.
// Производительности здесь нет намеренно: она берётся из TYPE_DEFAULTS по документу экономистов.
// Ключ — id продукта в каталоге организатора. Когда в product.specs появятся реальные
// значения (payload_kg, length_mm, width_mm, speed_m_s, throughput_units_per_h), они перекроют эти.
const V0: Record<string, Partial<Omit<VizRobot, "id" | "name" | "price" | "specsSource">>> = {
    // Ronavi Robotics
    "5760e938-9a43-45a7-b8e8-f4f2e6383930": { type: "AMR", w: 1.0, l: 1.5, speedMps: 1.5, payloadKg: 1500 }, // H1500
    "6f3da854-41da-4363-8496-5487f37c845a": { type: "AMR", w: 1.05, l: 1.6, speedMps: 1.5, payloadKg: 2000 }, // H2000
    "dcfd9975-81eb-49b5-a422-827a720ba582": { type: "AMR", w: 0.9, l: 1.3, speedMps: 1.5, payloadKg: 1200 }, // M
    "4d347e47-38f9-415b-aae1-7a6d3759a75c": { type: "AMR", w: 0.7, l: 1.0, speedMps: 1.5, payloadKg: 350 }, // RCM
    "3f2aaa1b-2237-4d7b-b215-1ac5ec789ed5": { type: "SR", w: 0.55, l: 0.75, speedMps: 2.0, payloadKg: 50 }, // SR сортировщик
    "66d8e7ad-cdcd-4287-afb0-e2afa9ef5217": { type: "SR", w: 0.5, l: 0.7, speedMps: 1.8, payloadKg: 10 }, // SD
    // Морос
    "89ffd69f-f07b-4bf2-8023-1fd765a2b6ff": { type: "AMR", w: 0.6, l: 0.9, speedMps: 1.5, payloadKg: 100 }, // AMR 100
    "5ec66969-8fcc-47b3-b517-a9c29372fffe": { type: "AMR", w: 0.85, l: 1.2, speedMps: 1.4, payloadKg: 800 }, // AMR 800
    "7d5a76d2-7bf3-4a40-b6f7-64590d4d9273": { type: "AMR", w: 1.0, l: 1.5, speedMps: 1.4, payloadKg: 1500 }, // AMR 1500
    // Диком-Сервис
    "be814758-3616-4b94-befa-9848be2ac604": { type: "AMR", w: 0.8, l: 1.1, speedMps: 1.5, payloadKg: 600 }, // DMR 600
    "cccd0c0d-8ae7-435d-a171-45f5d82886e6": { type: "AMR", w: 1.0, l: 1.4, speedMps: 1.5, payloadKg: 1200 }, // DMR 1200
    "a83abbfd-78ee-43dc-9111-f51db4938001": { type: "AMR", w: 0.7, l: 1.0, speedMps: 1.5, payloadKg: 300 }, // DMR 300 Carrier B
    "f7634ef8-0034-4c5b-b2f0-e44a14f05a76": { type: "CTU", w: 0.9, l: 1.4, forkLen: 1.1, speedMps: 1.2, payloadKg: 1000 }, // DMR Carrier P
    // Семаргл
    "993d980e-8b91-45e0-9c98-50ffab6e11e4": { type: "AMR", w: 1.0, l: 1.5, speedMps: 1.3, payloadKg: 1500 }, // Сёмабот
    "c9e9517c-18f0-47b4-aa05-4344566aa885": { type: "AGV", w: 1.6, l: 2.6, speedMps: 1.0, payloadKg: 6000 }, // Tagarka 6 т
    "3f2a1265-3c35-4823-9d20-1978c86e424b": { type: "AGV", w: 2.4, l: 4.5, speedMps: 0.8, payloadKg: 35000 }, // Tagarka 35 т
    // FMR / штабелёры / тягачи
    "5a36611d-033e-4893-bd49-5d4f776f57dd": { type: "FMR", w: 0.95, l: 1.6, forkLen: 1.15, speedMps: 1.4, payloadKg: 2000 }, // AK-2000-2
    "ecd7d582-b342-449a-b43b-66288d159a32": { type: "FMR", w: 0.9, l: 1.5, forkLen: 1.15, speedMps: 1.5, payloadKg: 1500 }, // MULE
    "2ffc706d-fe43-4c2b-baad-a624a95ad3ce": { type: "FMR", w: 1.0, l: 1.9, forkLen: 1.15, speedMps: 1.2, payloadKg: 1500 }, // RoboCV штабелёр
    "b4a9ef38-b68a-4c0f-8512-9bc9a718c4e1": { type: "AGV", w: 0.9, l: 1.8, speedMps: 1.5, payloadKg: 3000 }, // RoboCV тягач
    // Стационарные
    "cebbdfa8-500a-425f-bcbc-ad2dcc106539": { type: "ASRS", w: 6, l: 4, speedMps: 2.0, payloadKg: 1500 }, // AS-RS P
    "c125ce9a-8f04-4183-a136-5ddbb3c5ae89": { type: "ASRS", w: 6, l: 4, speedMps: 2.0, payloadKg: 800 }, // AS-RS B
    "eff2586c-892d-4e44-a407-1ec7f06c8f76": { type: "ASRS", w: 6, l: 6, speedMps: 1.5, payloadKg: 1500 }, // Pallet Shuttle
    // Комплектовщики / инвентаризаторы
    "c3d39a80-5fb9-42d3-82ae-0696fb647128": { type: "MM", w: 0.8, l: 1.2, speedMps: 1.2, payloadKg: 20 }, // Яндекс комплектовщик
};

// Типовые значения по типу робота, если ни specs, ни v0 не дают величину.
// Производительность: колонка «Заявленная производительность, ед/ч» в каталоге ТТХ пуста у всех 48
// решений, поэтому берётся из документа экономистов (§2): для AMR указан диапазон 80–100 паллет/ч,
// модельное значение 90. Остальные типы — пропорционально характеру операции.
// Это модельное допущение: как только робототехники заполнят колонку, значение придёт из specs.
const TYPE_DEFAULTS: Record<VizRobotType, Omit<VizRobot, "id" | "name" | "price" | "specsSource" | "type">> = {
    AMR: { w: 0.8, l: 1.2, speedMps: 1.5, payloadKg: 500, throughputPerHour: 90 },
    UGV: { w: 1.0, l: 1.6, speedMps: 1.2, payloadKg: 500, throughputPerHour: 40 },
    AGV: { w: 1.1, l: 2.1, speedMps: 1.0, payloadKg: 1000, throughputPerHour: 35 },
    MM: { w: 0.8, l: 1.2, speedMps: 1.0, payloadKg: 20, throughputPerHour: 60 },
    SR: { w: 0.55, l: 0.75, speedMps: 1.8, payloadKg: 10, throughputPerHour: 120 },
    DOG: { w: 0.45, l: 1.0, speedMps: 1.0, payloadKg: 10, throughputPerHour: 45 },
    HUM: { w: 0.6, l: 0.4, speedMps: 0.9, payloadKg: 10, throughputPerHour: 40 },
    FMR: { w: 0.9, l: 1.5, forkLen: 1.1, speedMps: 1.2, payloadKg: 1200, throughputPerHour: 60 },
    CTU: { w: 0.85, l: 1.2, forkLen: 0.9, speedMps: 1.2, payloadKg: 800, throughputPerHour: 70 },
    ASRS: { w: 6, l: 4, speedMps: 2.0, payloadKg: 1500, throughputPerHour: 150 },
};

// Подтип из каталога организатора -> тип визуализации
function typeFromSubtype(subtype: string | null, category: string | null): VizRobotType {
    const s = (subtype ?? "").toLowerCase();
    const c = (category ?? "").toLowerCase();
    if (/fmr|штабел|погрузчик|шаттл/.test(s)) return "FMR";
    if (/тягач|тележк|agv/.test(s)) return "AGV";
    if (/ctu/.test(s)) return "CTU";
    if (/собак/.test(s)) return "DOG";
    if (/гуманоид|антропоморф/.test(s) || /антропоморф/.test(c)) return "HUM";
    if (/манипулятор|комплектовщик/.test(s) || /мобильные манипуляторы/.test(c)) return "MM";
    if (/сортиров/.test(s)) return "SR";
    if (/стационар|кран/.test(s) || /стационарные/.test(c)) return "ASRS";
    if (/наземные транспортные/.test(c)) return "UGV";
    return "AMR";
}

// «Ronavi H1500 (грузоподъемность до 1 500 кг)» -> 1500
function payloadFromName(name: string): number | null {
    const m = name.match(/до\s*([\d\s]+)\s*кг/i);
    return m ? Number(m[1].replace(/\s/g, "")) : null;
}

const num = (v: unknown): number | null => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
};

/** Продукт каталога -> робот для визуализации. Приоритет: product.specs > таблица v0 > дефолты по типу. */
export function toVizRobot(p: Product): VizRobot {
    const s = (p.specs ?? {}) as Record<string, unknown>;
    const v0 = V0[p.id];
    // robot_type — из каталога ТТХ робототехников (AMR/FMR/UGV/AGV/MM/SR/ASRS…)
    const fromCatalog = typeof s.robot_type === "string" && s.robot_type in TYPE_DEFAULTS ? (s.robot_type as VizRobotType) : null;
    const type: VizRobotType = fromCatalog ?? v0?.type ?? typeFromSubtype(p.subtype, p.category);
    const d = TYPE_DEFAULTS[type];

    // Имена полей — как в листе «Экспорт» каталога ТТХ (prisma/data/robot-specs.json)
    const fromSpecs = {
        w: num(s.width_mm) ? num(s.width_mm)! / 1000 : null,
        l: num(s.length_mm) ? num(s.length_mm)! / 1000 : null,
        forkLen: num(s.fork_length_mm) ? num(s.fork_length_mm)! / 1000 : null,
        speedMps: num(s.speed_mps) ?? num(s.speed_m_s),
        payloadKg: num(s.payload_kg),
        // В каталоге ТТХ колонка пустая у всех — производительность берётся из дефолтов по типу
        throughputPerHour: num(s.throughput_per_hour) ?? num(s.throughput_units_per_h),
    };
    const hasSpecs = Object.values(fromSpecs).some((v) => v !== null);

    const robot: VizRobot = {
        id: p.id,
        name: p.name,
        type,
        w: fromSpecs.w ?? v0?.w ?? d.w,
        l: fromSpecs.l ?? v0?.l ?? d.l,
        speedMps: fromSpecs.speedMps ?? v0?.speedMps ?? d.speedMps,
        payloadKg: fromSpecs.payloadKg ?? v0?.payloadKg ?? payloadFromName(p.name) ?? d.payloadKg,
        throughputPerHour: fromSpecs.throughputPerHour ?? v0?.throughputPerHour ?? d.throughputPerHour,
        price: p.price ? Number(p.price) : 0,
        specsSource: hasSpecs ? "specs" : v0 ? "v0" : "type-default",
    };
    if (type === "FMR" || type === "CTU") robot.forkLen = fromSpecs.forkLen ?? v0?.forkLen ?? d.forkLen ?? robot.l * 0.8;
    return robot;
}
