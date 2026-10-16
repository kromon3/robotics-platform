import { useNavigate } from "react-router";
import { useDemoStore } from "../store/demoStore";

// Вход в демо с экранов авторизации: гость смотрит готовый расчёт, ничего не заполняя.

export function DemoButton({ className = "" }: { className?: string }) {
    const navigate = useNavigate();
    const start = useDemoStore((s) => s.start);

    return (
        <button
            type="button"
            onClick={() => {
                start();
                navigate("/projects/warehouse");
            }}
            className={`group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-left shadow-lg shadow-indigo-500/30 transition hover:shadow-xl hover:shadow-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 ${className}`}
        >
            {/* Блик, пробегающий по кнопке: её трудно не заметить */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-full w-1/2 skew-x-12 bg-white/20 transition-transform duration-700 group-hover:translate-x-[300%] motion-reduce:hidden"
            />
            <span className="flex items-center justify-between gap-3">
                <span>
                    <span className="block text-base font-semibold text-white">Посмотреть демо без регистрации</span>
                    <span className="mt-0.5 block text-xs text-indigo-100">
                        Готовый склад 40 × 24 м: подбор решения, экономика и имитация за полминуты
                    </span>
                </span>
                <span className="shrink-0 text-2xl text-white transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                    →
                </span>
            </span>
        </button>
    );
}
