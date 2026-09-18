import { Link, NavLink, useNavigate } from "react-router";
import { getUserEmail, logout } from "../lib/auth.ts";
import { navItems } from "../lib/nav.ts";
import { NAV_ICONS } from "./icons.tsx";


type SidebarProps = {
    open: boolean;
    onClose: () => void;
    darkMode: boolean;
    onToggleDark: () => void;
};

export function Sidebar({ open, onClose, darkMode, onToggleDark }: SidebarProps) {
    const navigate = useNavigate();
    const email = getUserEmail();

    function handleLogout() {
        logout();
        onClose();
        navigate("/login", { replace: true });
    }

    return (
        <aside
            className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white
                        transition-transform duration-200 ease-out
                        dark:border-slate-800 dark:bg-slate-900
                        lg:static lg:translate-x-0
                        ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
            {/* Логотип — тот же, что на auth-страницах */}
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
                <Link to="/" className="flex items-center gap-2 text-slate-900 dark:text-slate-100" onClick={onClose}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="8" width="18" height="12" rx="2" />
                            <path d="M12 4v4M8 14h.01M16 14h.01M9 18h6" />
                        </svg>
                    </span>
                    <span className="text-sm font-semibold tracking-tight">Платформа роботизации</span>
                </Link>
                <button
                    type="button"
                    aria-label="Закрыть меню"
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
                    onClick={onClose}
                >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                </button>
            </div>

            {/* Навигация */}
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        onClick={onClose}
                        className={({ isActive }) =>
                            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                                isActive
                                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            }`
                        }
                    >
                        {(() => {
                            const Icon = NAV_ICONS[item.icon];
                            return <Icon className="h-5 w-5 shrink-0" />;
                        })()}
                        {item.name}
                    </NavLink>
                ))}
            </nav>

            {/* Низ: тема + пользователь */}
            <div className="space-y-3 border-t border-slate-200 p-3 dark:border-slate-800">
                <button
                    type="button"
                    onClick={onToggleDark}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                    <span className="text-lg leading-none">{darkMode ? "🌞" : "🌙"}</span>
                    {darkMode ? "Светлая тема" : "Тёмная тема"}
                </button>

                {email ? (
                    <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold uppercase text-white">
                            {email[0]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300" title={email}>
                            {email}
                        </span>
                        <button
                            type="button"
                            onClick={handleLogout}
                            title="Выйти"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <Link
                        to="/login"
                        onClick={onClose}
                        className="block w-full rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                    >
                        Войти
                    </Link>
                )}
            </div>
        </aside>
    );
}

