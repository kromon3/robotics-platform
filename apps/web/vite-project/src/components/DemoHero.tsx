import { Link } from "react-router";
import { DEMO_CASES } from "../lib/demo-cases";

// Главный вход в демо — первым на главной, большой кнопкой и карточками примеров (по отзыву экспертов:
// руководитель должен за 40 секунд понять, что даёт платформа, ничего не заполняя и не регистрируясь).

export function DemoHero() {
    return (
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 text-white shadow-lg shadow-indigo-500/20 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl">
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Что даст роботизация вашему складу?</h2>
                    <p className="mt-2 text-sm text-indigo-100 sm:text-base">
                        Подвигайте 4 параметра — платформа сама подберёт робота из каталога, посчитает окупаемость и
                        покажет склад с роботами. Без регистрации и заполнения форм.
                    </p>
                </div>
                <Link
                    to="/demo"
                    className="group inline-flex shrink-0 items-center justify-center gap-3 rounded-xl bg-white px-6 py-4 text-lg font-semibold text-indigo-700 shadow-md transition hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-white/40"
                >
                    Посмотреть демо за 40 секунд
                    <span className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden>
                        →
                    </span>
                </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {DEMO_CASES.map((c) => (
                    <Link
                        key={c.id}
                        to={`/demo?case=${c.id}`}
                        className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/20 transition hover:bg-white/20"
                    >
                        <span className="text-2xl" aria-hidden>
                            {c.icon}
                        </span>
                        <span>
                            <span className="block text-sm font-semibold">{c.title}</span>
                            <span className="block text-xs text-indigo-100">{c.tagline}</span>
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
