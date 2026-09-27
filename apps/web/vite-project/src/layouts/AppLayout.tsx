import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Sidebar } from "../components/Sidebar.tsx";
import { navItems } from "../lib/nav.ts";

export function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
    const location = useLocation();

    // Тёмная тема: класс .dark на <html>, см. @custom-variant в index.css
    useEffect(() => {
        document.documentElement.classList.toggle("dark", darkMode);
        localStorage.setItem("theme", darkMode ? "dark" : "light");
    }, [darkMode]);

    const title =
        navItems.find((item) => (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)))
            ?.name ?? "";

    return (
        // print:* — раскладка для печати отчёта: колонка с прокруткой разворачивается в поток страницы
        <div className="flex h-screen bg-slate-100 text-slate-900 print:block print:h-auto print:bg-white dark:bg-slate-950 dark:text-slate-100">
            {/* Подложка для мобильной шторки */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <Sidebar
                open={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                darkMode={darkMode}
                onToggleDark={() => setDarkMode((v) => !v)}
            />

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 print:hidden dark:border-slate-800 dark:bg-slate-900">
                    <button
                        type="button"
                        aria-label="Открыть меню"
                        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-6 print:overflow-visible print:p-0">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
