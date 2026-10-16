import { Link, useNavigate } from "react-router";
import { useDemoStore } from "../store/demoStore";

// Полоса над приложением: пользователь всегда понимает, что смотрит демо, и может выйти.

export function DemoBanner() {
    const navigate = useNavigate();
    const active = useDemoStore((s) => s.active);
    const stop = useDemoStore((s) => s.stop);
    if (!active) return null;

    return (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-indigo-600 px-4 py-2 text-center text-sm text-white print:hidden">
            <span>
                <b>Демо-режим.</b> Данные типового склада зафиксированы — расчёт настоящий, менять параметры нельзя.
            </span>
            <Link to="/auth" className="font-semibold underline underline-offset-2 hover:text-indigo-100">
                Зарегистрироваться
            </Link>
            <button
                type="button"
                onClick={() => {
                    stop();
                    navigate("/");
                }}
                className="rounded-md border border-white/40 px-2 py-0.5 text-xs transition hover:bg-white/10"
            >
                Выйти из демо
            </button>
        </div>
    );
}
