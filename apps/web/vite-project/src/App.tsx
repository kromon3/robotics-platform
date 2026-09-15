// Главная (Dashboard). Рендерится внутри AppLayout через <Outlet />.
function App() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {["Проектов", "Роботов в каталоге", "Расчётов", "Средний ROI"].map((label) => (
                <div
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                    <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">—</div>
                </div>
            ))}
        </div>
    );
}

export default App;
