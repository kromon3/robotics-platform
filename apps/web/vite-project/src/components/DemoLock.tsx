import { Link } from "react-router";

// Подпись поверх заблокированных полей в демо-режиме.
// Данные видно сквозь размытие — видно, что расчёт настоящий, а не картинка.

export function DemoLock({ compact = false }: { compact?: boolean }) {
    return (
        <div className="pointer-events-auto max-w-sm rounded-xl border border-indigo-200 bg-white/95 px-4 py-3 text-center shadow-lg dark:border-indigo-900 dark:bg-slate-900/95">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <span aria-hidden>🔒</span> Демо: данные зафиксированы
            </div>
            {!compact && (
                <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
                    Это параметры типового склада 40 × 24 м. Пройдите расчёт до конца и посмотрите результат —
                    чтобы ввести свой объект, нужна регистрация.
                </p>
            )}
            <Link
                to="/auth"
                className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
                Зарегистрироваться и ввести свои данные →
            </Link>
        </div>
    );
}
