import type { RealismWarning } from "../lib/realism";

// Предупреждения о противоречиях в параметрах (src/lib/realism.ts).
// Намеренно не блокируют расчёт и не выглядят ошибкой: это повод перепроверить ввод,
// а не запрет. Поэтому жёлтый, а не красный, и формулировка «проверьте», а не «исправьте».

export function RealismWarnings({ warnings, className = "" }: { warnings: RealismWarning[]; className?: string }) {
    if (warnings.length === 0) return null;
    return (
        <section
            className={`rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40 ${className}`}
            aria-label="Предупреждения о параметрах"
        >
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Проверьте параметры: {warnings.length === 1 ? "одно значение не сходится" : `${warnings.length} значения не сходятся`} с остальными
            </h3>
            <ul className="mt-2 space-y-2">
                {warnings.map((w) => (
                    <li key={w.key} className="text-sm text-amber-900 dark:text-amber-200">
                        <span className="font-medium">{w.title}</span> — {w.note}
                    </li>
                ))}
            </ul>
            <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
                Это предупреждение, а не ошибка: расчёт выполнится с вашими значениями. Но если данные введены
                по ошибке, результат будет выглядеть убедительно и не значить ничего.
            </p>
        </section>
    );
}
