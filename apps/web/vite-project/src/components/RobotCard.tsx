import { Link } from "react-router";
import { PRODUCT_STATUS_LABELS, type Product, type ProductStatus } from "../api/catalog.ts";

const statusStyles: Record<ProductStatus, string> = {
    operation: "bg-green-100 text-green-700",
    piloting: "bg-amber-100 text-amber-700",
    rnd: "bg-indigo-100 text-indigo-700",
};

export function RobotCard({ item }: { item: Product }) {
    const {
        id,
        name,
        subtype,
        category,
        description,
        price,
        ugt,
        marketPotential,
        status,
        company,
    } = item;

    // price — Decimal с бэкенда, приходит строкой; null → «по запросу», а не «0 ₽»
    const formattedPrice = price
        ? new Intl.NumberFormat("ru-RU", {
              style: "currency",
              currency: "RUB",
              maximumFractionDigits: 0,
          }).format(Number(price))
        : "Цена по запросу";

    // subtype бывает null — без фильтра рендерится « · Категория» с висящей точкой
    const subtitle = [subtype, category].filter(Boolean).join(" · ");

    return (
        <Link
            to={`/robots/${id}`}
            // h-full + flex-1: карточка растягивается на высоту ячейки грида / flex-колонки,
            // фиксированные высоты у заголовка, подзаголовка и описания — чтобы соседние карточки не «прыгали»
            className="flex h-full flex-1 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-indigo-700"
        >
            <div className="flex flex-col gap-1.5">
                <span
                    className={`self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}
                >
                    {PRODUCT_STATUS_LABELS[status]}
                </span>
                <h3 className="line-clamp-2 min-h-[2.75rem] min-w-0 break-words text-base font-semibold leading-snug text-gray-900 dark:text-slate-100">
                    {name}
                </h3>
            </div>

            {/* Subtype / Category — строка есть всегда, чтобы не сдвигать описание */}
            <p className="min-h-4 truncate text-xs text-gray-500 dark:text-slate-400" title={subtitle}>
                {subtitle || " "}
            </p>

            {/* Description — ровно 4 строки, даже если текста нет */}
            <p className="line-clamp-4 min-h-20 text-sm text-gray-700 dark:text-slate-300">
                {description ?? <span className="text-gray-400 dark:text-slate-500">Описание не указано</span>}
            </p>

            {/* Meta */}
            <div className="flex gap-4 text-xs text-gray-600 dark:text-slate-400">
                <span>
                    УГТ: <span className="font-medium text-gray-800 dark:text-slate-200">{ugt ?? "—"}</span>
                </span>
                <span>
                    Потенциал:{" "}
                    <span className="font-medium text-gray-800 dark:text-slate-200">
                        {marketPotential ?? "—"}
                    </span>
                </span>
            </div>

            {/* Price */}
            <div className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {formattedPrice}
            </div>

            {/* Company */}
            <div className="mt-auto flex flex-col border-t border-gray-100 pt-3 text-xs text-gray-600 dark:border-slate-800 dark:text-slate-400">
                <strong className="text-gray-800 dark:text-slate-200">{company?.name}</strong>
                {company?.region && <span>{company.region}</span>}
            </div>
        </Link>
    );
}