// СГЕНЕРИРОВАНО: node tools/gen-rack-catalog.js — правки вносите в
// apps/api/prisma/data/racks-sheet.csv (лист «Стеллажи» каталога робототехников) и перегенерируйте.
//
// Цены и габариты — из открытых прайсов поставщиков, ссылка на источник у каждой позиции.
// pricePerPlace — ₽ за место хранения: либо прямая цена за паллетоместо, либо цена секции,
// делённая на вместимость секции. Позиции «по проекту» удельной цены не имеют.

import type { RackType } from "../store/store";

export type RackPriceUnit = "place" | "section" | "m2" | "project";

export type RackSystem = {
    id: string;
    /** Тип стеллажа в терминах формы объекта; null — систему не удалось отнести к типу */
    rackType: RackType | null;
    system: string;
    brand: string;
    model: string;
    priceRub: number | null;
    priceUnit: RackPriceUnit;
    /** «от» или «ориентир» — цена не финальная */
    priceNote: string | null;
    pricePerPlace: number | null;
    pricePerM2: number | null;
    placesPerSection: number | null;
    tiers: number | null;
    tierLoadKg: number | null;
    sectionLoadKg: number | null;
    /** Габариты секции в метрах: w — вдоль прохода, l — глубина, h — высота */
    sizeM: { w: number | null; l: number | null; h: number | null };
    density: string | null;
    access: string | null;
    sourceUrl: string | null;
};

export const RACK_SYSTEMS: RackSystem[] = [
    {
        "id": "RK-001",
        "rackType": "stack",
        "system": "Горизонтальный / штабельный",
        "brand": "Промверс",
        "model": "Штабелируемый поддон с 4 угловыми стойками",
        "priceRub": 28400,
        "priceUnit": "section",
        "priceNote": null,
        "pricePerPlace": 28400,
        "pricePerM2": null,
        "placesPerSection": 1,
        "tiers": 4,
        "tierLoadKg": 800,
        "sectionLoadKg": 3200,
        "sizeM": {
            "w": 1.2,
            "l": 0.8,
            "h": 1.5
        },
        "density": "Средняя",
        "access": "LIFO",
        "sourceUrl": "https://promvers.ru/shop/stellazhi-metallicheskie/"
    },
    {
        "id": "RK-002",
        "rackType": "stack",
        "system": "Горизонтальный / штабельный",
        "brand": "Промверс",
        "model": "Штабелируемый поддон с 4 угловыми стойками для длинных грузов",
        "priceRub": 29400,
        "priceUnit": "section",
        "priceNote": null,
        "pricePerPlace": 29400,
        "pricePerM2": null,
        "placesPerSection": 1,
        "tiers": 4,
        "tierLoadKg": 800,
        "sectionLoadKg": 3200,
        "sizeM": {
            "w": 1.2,
            "l": 0.8,
            "h": 1.5
        },
        "density": "Средняя",
        "access": "LIFO",
        "sourceUrl": "https://promvers.ru/shop/stellazhi-metallicheskie/"
    },
    {
        "id": "RK-003",
        "rackType": "shelf",
        "system": "Вертикальный — фронтальный",
        "brand": "Экомет",
        "model": "СПФ 27113-60-3000",
        "priceRub": 55625,
        "priceUnit": "section",
        "priceNote": null,
        "pricePerPlace": 18542,
        "pricePerM2": null,
        "placesPerSection": 3,
        "tiers": 3,
        "tierLoadKg": 3000,
        "sectionLoadKg": 16000,
        "sizeM": {
            "w": 2.7,
            "l": 1.1,
            "h": 6
        },
        "density": "Средняя",
        "access": "FIFO/LIFO",
        "sourceUrl": "https://ekomett.ru/stellazhi/palletnyie/frontalnyie/spf/"
    },
    {
        "id": "RK-004",
        "rackType": "shelf",
        "system": "Вертикальный — фронтальный",
        "brand": "Склад-Сервис СПб",
        "model": "Фронтальный паллетный стеллаж ПТ2х2000х1980-2100",
        "priceRub": 14318,
        "priceUnit": "section",
        "priceNote": null,
        "pricePerPlace": 2386,
        "pricePerM2": null,
        "placesPerSection": 6,
        "tiers": 3,
        "tierLoadKg": 2100,
        "sectionLoadKg": 9000,
        "sizeM": {
            "w": 1.98,
            "l": 1,
            "h": 2
        },
        "density": "Средняя",
        "access": "FIFO/LIFO",
        "sourceUrl": "https://www.sklad-srv.ru/catalog/skladskie-stellazhi/stellazhi-palletnye/"
    },
    {
        "id": "RK-005",
        "rackType": "shelf",
        "system": "Вертикальный — полочный",
        "brand": "ДВК",
        "model": "СТЛ Э",
        "priceRub": 7000,
        "priceUnit": "section",
        "priceNote": "от",
        "pricePerPlace": 1400,
        "pricePerM2": null,
        "placesPerSection": 5,
        "tiers": 4,
        "tierLoadKg": 170,
        "sectionLoadKg": 750,
        "sizeM": {
            "w": 2,
            "l": 0.6,
            "h": 2.5
        },
        "density": "Средняя",
        "access": "FIFO",
        "sourceUrl": "https://www.dvkspb.ru/catalog/polochnye-stellazhi/"
    },
    {
        "id": "RK-006",
        "rackType": "shelf",
        "system": "Вертикальный — полочный",
        "brand": "ДВК",
        "model": "СТТ",
        "priceRub": 16400,
        "priceUnit": "section",
        "priceNote": "от",
        "pricePerPlace": 3280,
        "pricePerM2": null,
        "placesPerSection": 5,
        "tiers": 4,
        "tierLoadKg": 250,
        "sectionLoadKg": 2400,
        "sizeM": {
            "w": 2,
            "l": 0.6,
            "h": 2.5
        },
        "density": "Средняя",
        "access": "FIFO",
        "sourceUrl": "https://www.dvkspb.ru/catalog/polochnye-stellazhi/"
    },
    {
        "id": "RK-007",
        "rackType": "deep",
        "system": "Глубинное",
        "brand": "Стор Эдж / Prostor",
        "model": "Prostor DriveIn",
        "priceRub": 1200,
        "priceUnit": "place",
        "priceNote": "от",
        "pricePerPlace": 1200,
        "pricePerM2": null,
        "placesPerSection": 18,
        "tiers": 3,
        "tierLoadKg": 13500,
        "sectionLoadKg": 21500,
        "sizeM": {
            "w": 1.1,
            "l": 7.2,
            "h": 6
        },
        "density": "Очень высокая",
        "access": "LIFO (односторонний)",
        "sourceUrl": "https://www.prostorage.ru/production/pallet-racking/"
    },
    {
        "id": "RK-008",
        "rackType": "deep",
        "system": "Глубинное",
        "brand": "Склад-Сервис СПб",
        "model": "Глубинные набивные стеллажи",
        "priceRub": 9500,
        "priceUnit": "place",
        "priceNote": "ориентир",
        "pricePerPlace": 9500,
        "pricePerM2": null,
        "placesPerSection": 18,
        "tiers": 3,
        "tierLoadKg": 1500,
        "sectionLoadKg": 12000,
        "sizeM": {
            "w": 1.1,
            "l": 7.2,
            "h": 6
        },
        "density": "Очень высокая",
        "access": "LIFO",
        "sourceUrl": "https://www.sklad-srv.ru/catalog/skladskie-stellazhi/glubinnye-nabivnye-stellazhi/"
    },
    {
        "id": "RK-009",
        "rackType": "deep",
        "system": "Глубинное / проходное",
        "brand": "Экомет",
        "model": "Набивные паллетные стеллажи FIFO",
        "priceRub": null,
        "priceUnit": "project",
        "priceNote": null,
        "pricePerPlace": null,
        "pricePerM2": null,
        "placesPerSection": 18,
        "tiers": 3,
        "tierLoadKg": 1500,
        "sectionLoadKg": 4500,
        "sizeM": {
            "w": 1.1,
            "l": 7.2,
            "h": 6
        },
        "density": "Высокая",
        "access": "FIFO",
        "sourceUrl": "https://ekomett.ru/stellazhi/palletnyie/nabivnyie/"
    },
    {
        "id": "RK-010",
        "rackType": "flow",
        "system": "Поточное",
        "brand": "ГРОССВЕКТОР",
        "model": "Гравитационные стеллажи",
        "priceRub": null,
        "priceUnit": "project",
        "priceNote": null,
        "pricePerPlace": null,
        "pricePerM2": null,
        "placesPerSection": 9,
        "tiers": 3,
        "tierLoadKg": 1000,
        "sectionLoadKg": 8000,
        "sizeM": {
            "w": 2.7,
            "l": 1.1,
            "h": 6
        },
        "density": "Высокая",
        "access": "FIFO",
        "sourceUrl": "https://grossvektor.ru/information/articles/tipyi-stellazhej-dlya-sklada/"
    },
    {
        "id": "RK-011",
        "rackType": "flow",
        "system": "Поточное",
        "brand": "Prostor",
        "model": "Гравитационные стеллажи",
        "priceRub": null,
        "priceUnit": "project",
        "priceNote": null,
        "pricePerPlace": null,
        "pricePerM2": null,
        "placesPerSection": 9,
        "tiers": 3,
        "tierLoadKg": 1000,
        "sectionLoadKg": 8000,
        "sizeM": {
            "w": 2.7,
            "l": 1.1,
            "h": 6
        },
        "density": "Высокая",
        "access": "FIFO",
        "sourceUrl": "https://www.prostorage.ru/publications/989/"
    },
    {
        "id": "RK-012",
        "rackType": "cantilever",
        "system": "Консольные",
        "brand": "ASK Logistic",
        "model": "Консольный K1",
        "priceRub": 22000,
        "priceUnit": "section",
        "priceNote": "от",
        "pricePerPlace": 4400,
        "pricePerM2": null,
        "placesPerSection": 5,
        "tiers": 3,
        "tierLoadKg": 300,
        "sectionLoadKg": 900,
        "sizeM": {
            "w": 3,
            "l": 0.4,
            "h": 3
        },
        "density": "Средняя",
        "access": "LIFO",
        "sourceUrl": "https://www.asklogistic.ru/consolnye-stellazhi/"
    },
    {
        "id": "RK-013",
        "rackType": "cantilever",
        "system": "Консольные",
        "brand": "ASK Logistic",
        "model": "Консольный K3",
        "priceRub": 28000,
        "priceUnit": "section",
        "priceNote": "от",
        "pricePerPlace": 5600,
        "pricePerM2": null,
        "placesPerSection": 5,
        "tiers": 3,
        "tierLoadKg": 300,
        "sectionLoadKg": 900,
        "sizeM": {
            "w": 3,
            "l": 0.6,
            "h": 3
        },
        "density": "Средняя",
        "access": "LIFO",
        "sourceUrl": "https://www.asklogistic.ru/consolnye-stellazhi/"
    },
    {
        "id": "RK-014",
        "rackType": "cantilever",
        "system": "Консольные",
        "brand": "Grossvektor",
        "model": "СК3000х5000х3 (500 кг)",
        "priceRub": 354900,
        "priceUnit": "section",
        "priceNote": null,
        "pricePerPlace": 44363,
        "pricePerM2": null,
        "placesPerSection": 8,
        "tiers": 3,
        "tierLoadKg": 500,
        "sectionLoadKg": 18000,
        "sizeM": {
            "w": 5,
            "l": 1.3,
            "h": 3
        },
        "density": "Средняя",
        "access": "LIFO",
        "sourceUrl": "https://grossvektor.ru/catalog/stellazhi/konsolnyie-stellazhi/"
    },
    {
        "id": "RK-015",
        "rackType": "mezzanine",
        "system": "Мезонины",
        "brand": "Мезонин-стеллаж",
        "model": "Мезонин на базе паллетных стеллажей",
        "priceRub": 14000,
        "priceUnit": "m2",
        "priceNote": "от",
        "pricePerPlace": null,
        "pricePerM2": 14000,
        "placesPerSection": null,
        "tiers": 2,
        "tierLoadKg": 500,
        "sectionLoadKg": 500,
        "sizeM": {
            "w": null,
            "l": null,
            "h": null
        },
        "density": "Высокая",
        "access": "FIFO",
        "sourceUrl": "https://mezonin-stellag.ru/mezonin/"
    },
    {
        "id": "RK-016",
        "rackType": "mezzanine",
        "system": "Мезонины",
        "brand": "Мезонин-стеллаж",
        "model": "Свободностоящий мезонин",
        "priceRub": 16000,
        "priceUnit": "m2",
        "priceNote": "от",
        "pricePerPlace": null,
        "pricePerM2": 16000,
        "placesPerSection": null,
        "tiers": 2,
        "tierLoadKg": 500,
        "sectionLoadKg": 500,
        "sizeM": {
            "w": null,
            "l": null,
            "h": null
        },
        "density": "Высокая",
        "access": "FIFO",
        "sourceUrl": "https://mezonin-stellag.ru/mezonin/"
    },
    {
        "id": "RK-017",
        "rackType": "mezzanine",
        "system": "Мезонины",
        "brand": "Складской Порядок",
        "model": "Мезонин на базе среднегрузовых стеллажей",
        "priceRub": 1470000,
        "priceUnit": "project",
        "priceNote": null,
        "pricePerPlace": null,
        "pricePerM2": null,
        "placesPerSection": null,
        "tiers": 9,
        "tierLoadKg": 500,
        "sectionLoadKg": null,
        "sizeM": {
            "w": null,
            "l": null,
            "h": null
        },
        "density": "Высокая",
        "access": "FIFO",
        "sourceUrl": "https://sklad-prk.ru/catalog/stellaji-metallicheskie/mezonin/mezonin-na-baze-srednegruzovykh-stellazhei/"
    },
    {
        "id": "RK-018",
        "rackType": "mezzanine",
        "system": "Мезонины",
        "brand": "Склад-Сервис СПб",
        "model": "Мезонин для склада предприятия оптовой торговли",
        "priceRub": 1349000,
        "priceUnit": "project",
        "priceNote": null,
        "pricePerPlace": null,
        "pricePerM2": null,
        "placesPerSection": null,
        "tiers": 2,
        "tierLoadKg": 1000,
        "sectionLoadKg": 1000,
        "sizeM": {
            "w": 9.017,
            "l": 5.877,
            "h": 3
        },
        "density": "Высокая",
        "access": "FIFO",
        "sourceUrl": "https://sklad-servise.ru/catalog/mezonin-skladskoi/vypolnennye-raboty/mezonin-dlia-sklada-predpriiatiia-optovoi-torgovli/"
    },
    {
        "id": "RK-019",
        "rackType": "shelf",
        "system": "Вертикальный — фронтальный (усиленный)",
        "brand": "УЗСО",
        "model": "К75 2000×1800×1050 (2 яруса)",
        "priceRub": 15230,
        "priceUnit": "section",
        "priceNote": null,
        "pricePerPlace": 3808,
        "pricePerM2": null,
        "placesPerSection": 4,
        "tiers": 2,
        "tierLoadKg": 2400,
        "sectionLoadKg": 4800,
        "sizeM": {
            "w": 2,
            "l": 1.05,
            "h": 3
        },
        "density": "Средняя",
        "access": "FIFO/LIFO",
        "sourceUrl": "https://uz-so.ru"
    },
    {
        "id": "RK-020",
        "rackType": "mezzanine",
        "system": "Мезонинные (на колоннах)",
        "brand": "1Logistik",
        "model": "Мезонин на колоннах",
        "priceRub": 11270,
        "priceUnit": "m2",
        "priceNote": null,
        "pricePerPlace": null,
        "pricePerM2": 11270,
        "placesPerSection": null,
        "tiers": 3,
        "tierLoadKg": 800,
        "sectionLoadKg": 800,
        "sizeM": {
            "w": null,
            "l": null,
            "h": 2.5
        },
        "density": "Высокая",
        "access": "FIFO",
        "sourceUrl": "https://1logistik.ru"
    },
    {
        "id": "RK-021",
        "rackType": "cantilever",
        "system": "Консольные (для длинномеров)",
        "brand": "ASK Logistic",
        "model": "Консольный K3 (усиленный)",
        "priceRub": 35000,
        "priceUnit": "section",
        "priceNote": null,
        "pricePerPlace": 3889,
        "pricePerM2": null,
        "placesPerSection": 9,
        "tiers": 3,
        "tierLoadKg": 500,
        "sectionLoadKg": 3000,
        "sizeM": {
            "w": 3,
            "l": 0.6,
            "h": 3
        },
        "density": "Средняя",
        "access": "LIFO",
        "sourceUrl": "https://www.asklogistic.ru"
    },
    {
        "id": "RK-022",
        "rackType": "deep",
        "system": "Глубинное (без шаттла)",
        "brand": "Склад-Сервис СПб",
        "model": "Глубинные набивные стеллажи",
        "priceRub": 9500,
        "priceUnit": "place",
        "priceNote": null,
        "pricePerPlace": 9500,
        "pricePerM2": null,
        "placesPerSection": null,
        "tiers": 3,
        "tierLoadKg": 1500,
        "sectionLoadKg": 12000,
        "sizeM": {
            "w": null,
            "l": 8.4,
            "h": null
        },
        "density": "Очень высокая",
        "access": "LIFO",
        "sourceUrl": "https://www.sklad-srv.ru"
    }
];

/** Системы для выбранного типа стеллажа, у которых есть удельная цена — их можно посчитать в CAPEX */
export const pricedRacksFor = (rackType: RackType | ""): RackSystem[] =>
    rackType ? RACK_SYSTEMS.filter((r) => r.rackType === rackType && (r.pricePerPlace ?? r.pricePerM2)) : [];

export const rackById = (id: string): RackSystem | undefined => RACK_SYSTEMS.find((r) => r.id === id);

/** Подпись позиции для выпадающего списка и для состава затрат */
export const rackLabel = (r: RackSystem): string => {
    const price = r.pricePerPlace
        ? r.pricePerPlace.toLocaleString("ru-RU") + " ₽/место"
        : r.pricePerM2
          ? r.pricePerM2.toLocaleString("ru-RU") + " ₽/м²"
          : "цена по проекту";
    return r.brand + " " + r.model + " — " + price;
};
