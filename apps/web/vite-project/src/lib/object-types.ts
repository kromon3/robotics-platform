import type { ComponentType, SVGProps } from "react";
import { AirportIcon, MedicalIcon, WarehouseIcon } from "../components/icons.tsx";

// Три типа объектов из ТЗ (п. 3.2.1). Полностью проработан склад; аэропорт и медучреждение
// доступны на уровне выбора и описания — их экраны параметров ещё в работе.

export type ObjectTypeKey = "warehouse" | "airport" | "medical";

export type ObjectType = {
    key: ObjectTypeKey;
    name: string;
    tagline: string;
    /** Что именно считает платформа для этого типа объекта */
    bullets: string[];
    ready: boolean;
    /** Классы акцента: рамка выбранной карточки, подложка иконки, текст */
    accent: { ring: string; icon: string; text: string; glow: string };
    Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const OBJECT_TYPES: ObjectType[] = [
    {
        key: "warehouse",
        name: "Склад",
        tagline: "Приёмка, хранение, отбор и отгрузка",
        bullets: ["Подбор роботов по ТТХ и проходам", "Экономика по трём сценариям", "2D-схема и имитация смены"],
        ready: true,
        accent: {
            ring: "ring-indigo-500 border-indigo-400",
            icon: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300",
            text: "text-indigo-600 dark:text-indigo-400",
            glow: "shadow-indigo-500/20",
        },
        Icon: WarehouseIcon,
    },
    {
        key: "airport",
        name: "Аэропорт",
        tagline: "Обработка багажа и перронная логистика",
        bullets: ["Каталог решений доступен", "Экран параметров в работе", "Экономическая модель общая"],
        ready: false,
        accent: {
            ring: "ring-sky-500 border-sky-400",
            icon: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300",
            text: "text-sky-600 dark:text-sky-400",
            glow: "shadow-sky-500/20",
        },
        Icon: AirportIcon,
    },
    {
        key: "medical",
        name: "Медучреждение",
        tagline: "Доставка расходников, белья и проб",
        bullets: ["Каталог решений доступен", "Экран параметров в работе", "Экономическая модель общая"],
        ready: false,
        accent: {
            ring: "ring-emerald-500 border-emerald-400",
            icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300",
            text: "text-emerald-600 dark:text-emerald-400",
            glow: "shadow-emerald-500/20",
        },
        Icon: MedicalIcon,
    },
];

export const getObjectType = (key: string | undefined): ObjectType | undefined =>
    OBJECT_TYPES.find((t) => t.key === key);
