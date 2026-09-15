// Временная страница под пункты меню, которых ещё нет. Удалить, когда появятся настоящие.
export function Placeholder({ title }: { title: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Раздел в разработке</p>
        </div>
    );
}
