import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import axios from "axios";
import { productPhotoUrl, type Product } from "../api/catalog.ts";
import { CompareView } from "../components/CompareView.tsx";
import { useCompareStore } from "../store/compareStore.ts";
import { COMPARE_LIMIT, COMPARE_MIN, parseCompareIds, serializeCompareIds } from "../lib/compare";
import { DATA_GROUP, SPEC_GROUP, formatPrice, productRows, type ProductCompareItem } from "../lib/product-compare";
import { toVizRobot } from "../viz/robotSpecs";

// Сравнение решений из каталога «Роботы» — для снабженца, который зашёл гостем,
// отметил 2–3 решения и хочет понять, чем они отличаются, прежде чем запрашивать КП.
// Только характеристики и происхождение данных: экономика зависит от объекта, а его здесь нет.
// Набор — в адресе (?ids=…), так ссылкой можно поделиться; выбор синхронизирован с каталогом.

const API_URL = import.meta.env.VITE_API_URL;
const GROUPS = [SPEC_GROUP, DATA_GROUP];
const ROWS = productRows("declared");

export function RobotCompare() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const storeIds = useCompareStore((s) => s.ids);
    const products = useCompareStore((s) => s.products);
    const setIds = useCompareStore((s) => s.setIds);
    const remember = useCompareStore((s) => s.remember);
    const clear = useCompareStore((s) => s.clear);
    const catalogSearch = useCompareStore((s) => s.catalogSearch);
    // Ошибка привязана к набору, который грузили: сменился набор — старая ошибка не показывается
    const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);

    const urlIds = useMemo(() => parseCompareIds(searchParams.get("ids")), [searchParams]);
    // Без ?ids= берём выбор из каталога
    const ids = urlIds.length > 0 ? urlIds : storeIds;

    // Адрес — главный: открыли по ссылке — отметки в каталоге совпадут с ним
    useEffect(() => {
        if (urlIds.length === 0 && storeIds.length > 0) {
            setSearchParams({ ids: serializeCompareIds(storeIds) }, { replace: true });
        } else if (urlIds.length > 0 && serializeCompareIds(urlIds) !== serializeCompareIds(storeIds)) {
            setIds(urlIds);
        }
    }, [urlIds, storeIds, setIds, setSearchParams]);

    // Решения, которых нет в кэше (ссылка из другого браузера), догружаем по одному
    const missing = ids.filter((id) => !products[id]);
    const missingKey = missing.join(",");
    useEffect(() => {
        if (!missingKey) return;
        const controller = new AbortController();
        Promise.all(
            missingKey.split(",").map((id) =>
                axios.get<Product>(`${API_URL}/catalog/products/${id}`, { signal: controller.signal }).then((r) => r.data),
            ),
        )
            .then(remember)
            .catch((err) => {
                if (axios.isCancel(err)) return;
                setFailed({ key: missingKey, message: err instanceof Error ? err.message : "Что-то пошло не так" });
            });
        return () => controller.abort();
    }, [missingKey, remember]);

    const error = failed && failed.key === missingKey ? failed.message : null;

    const items: ProductCompareItem[] = useMemo(
        () => ids.filter((id) => products[id]).map((id) => ({ product: products[id], robot: toVizRobot(products[id]) })),
        [ids, products],
    );

    const backTo = `/robots${catalogSearch}`;

    const remove = (id: string) => {
        const next = ids.filter((x) => x !== id);
        setIds(next);
        setSearchParams(next.length ? { ids: serializeCompareIds(next) } : {}, { replace: true });
    };

    const reset = () => {
        clear();
        navigate(backTo);
    };

    const loading = missing.length > 0 && !error;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Link
                    to={backTo}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                    ← К каталогу
                </Link>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Сравнение решений</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                    Характеристики, заявленные производителями, и происхождение данных: источник, проверка, дата.
                    Подсвечены строки, где решения различаются; звёздочкой — лучшее значение там, где «лучше» очевидно.
                    Экономику здесь не считаем — она зависит от вашего объекта:{" "}
                    <Link to="/projects" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        рассчитать окупаемость для склада
                    </Link>
                    .
                </p>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    <p className="font-medium">Не удалось загрузить решения для сравнения</p>
                    <p className="mt-1 text-sm">{error}</p>
                </div>
            )}

            {loading && <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />}

            {!loading && items.length < COMPARE_MIN && (
                <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
                    {items.length === 0 ? "Решения для сравнения не выбраны." : "Для сравнения нужно хотя бы два решения."} Отметьте
                    «Сравнить» у 2–{COMPARE_LIMIT} решений в каталоге.
                    <div className="mt-3">
                        <Link
                            to={backTo}
                            className="inline-block rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                        >
                            Выбрать в каталоге
                        </Link>
                    </div>
                </div>
            )}

            {!loading && items.length >= COMPARE_MIN && (
                <CompareView
                    title="Сравнение"
                    items={items}
                    rows={ROWS}
                    groups={GROUPS}
                    getId={(i) => i.product.id}
                    getName={(i) => i.product.name}
                    onRemove={remove}
                    onClear={reset}
                    renderHeader={(i) => <CompareHeader product={i.product} />}
                    renderFooter={(i) => (
                        <div className="flex flex-col gap-1.5">
                            <Link
                                to={`/robots/${i.product.id}`}
                                className="block rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Подробнее
                            </Link>
                            {i.product.sourceUrl && (
                                <a
                                    href={i.product.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-center text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                    Сайт поставщика ↗
                                </a>
                            )}
                        </div>
                    )}
                    note={
                        <p>
                            «Нет данных» — производитель не заявил значение; типовые оценки в каталоге не подставляются.
                            Строки, где данных нет ни у одного решения, скрыты. Цена — из каталога, без доставки и внедрения.
                            {items.length < COMPARE_LIMIT && (
                                <>
                                    {" "}
                                    <Link to={backTo} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                                        Добавить ещё решение
                                    </Link>
                                </>
                            )}
                        </p>
                    }
                />
            )}
        </div>
    );
}

function CompareHeader({ product }: { product: Product }) {
    const photo = productPhotoUrl(product.specs);
    return (
        <div className="flex flex-col gap-1.5">
            <div className="aspect-[4/3] w-full max-w-[10rem] overflow-hidden rounded-lg bg-slate-50 dark:bg-slate-800/50">
                {photo && <img src={photo} alt="" loading="lazy" className="h-full w-full object-contain p-1.5" />}
            </div>
            <Link to={`/robots/${product.id}`} className="text-sm font-semibold leading-snug hover:underline">
                {product.name}
            </Link>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                {product.company?.name} · {formatPrice(product.price)}
            </span>
        </div>
    );
}
