import { useState } from "react";
import { Link } from "react-router";

// Уведомление об обработке персональных данных (152-ФЗ): показывается один раз,
// отметка о прочтении лежит там же, где и остальные технические данные — в браузере.

const KEY = "pdn-notice-ack";

const seen = () => {
    try {
        return localStorage.getItem(KEY) === "1";
    } catch {
        // Приватный режим или заблокированное хранилище — тогда просто показываем уведомление
        return false;
    }
};

export function PrivacyNotice() {
    const [hidden, setHidden] = useState(seen);
    if (hidden) return null;

    const accept = () => {
        try {
            localStorage.setItem(KEY, "1");
        } catch {
            // Не смогли запомнить — не беда, уведомление появится снова
        }
        setHidden(true);
    };

    return (
        <div
            role="region"
            aria-label="Уведомление об обработке персональных данных"
            className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] backdrop-blur print:hidden dark:border-slate-700 dark:bg-slate-900/95"
        >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
                <p className="max-w-3xl text-sm text-slate-700 dark:text-slate-300">
                    Платформа сохраняет в вашем браузере токен авторизации и черновики форм, а на сервере — учётную
                    запись и сохранённые расчёты. Это обработка персональных данных по 152-ФЗ.{" "}
                    <Link to="/privacy" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        Что именно и зачем
                    </Link>
                    .
                </p>
                <button
                    type="button"
                    onClick={accept}
                    className="shrink-0 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                >
                    Понятно
                </button>
            </div>
        </div>
    );
}
