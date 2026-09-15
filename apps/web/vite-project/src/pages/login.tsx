import { useState } from "react";
import {Link, Navigate, useNavigate} from "react-router";

import axios from "axios";
import { toast } from "sonner";

type LoginData = {
    email: string;
    password: string;
};

const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 " +
    "placeholder:text-slate-400 shadow-sm transition " +
    "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

export function Login() {
    const navigate = useNavigate();
    const [data, setData] = useState<LoginData>({
        email: "",
        password: "",
    });
    if (localStorage.getItem("token")) {
        return <Navigate to="/" replace />;
    }
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setData((prev) => ({ ...prev, [name]: value }));
    };
    const API_URL = import.meta.env.VITE_API_URL;
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        try {
            const { data: res } = await axios.post(`${API_URL}/auth/login`, data);
            localStorage.setItem("token", res.token);
            toast.success("Вы вошли");
            navigate("/");
        } catch (err) {
            const msg = axios.isAxiosError(err) ? err.response?.data?.message : null;
            toast.error(Array.isArray(msg) ? msg.join("; ") : msg ?? "Не удалось войти");
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-100 px-4 py-10">
            <div className="w-full max-w-md">
                <div className="mb-6 text-center">
                    <Link to="/" className="inline-flex items-center gap-2 text-slate-900">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="8" width="18" height="12" rx="2" />
                                <path d="M12 4v4M8 14h.01M16 14h.01M9 18h6" />
                            </svg>
                        </span>
                        <span className="text-lg font-semibold tracking-tight">Платформа роботизации</span>
                    </Link>
                    <p className="mt-2 text-sm text-slate-500">
                        Подбор роботов, экономика и имитация — в одном расчёте
                    </p>
                </div>

                {/* Карточка */}
                <form
                    onSubmit={handleSubmit}
                    className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60"
                >
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Вход</h2>
                    <p className="mt-1 mb-6 text-sm text-slate-500">
                        Войдите, чтобы открыть свои проекты и расчёты
                    </p>

                    <div className="flex flex-col gap-4">
                        <div>
                            <label htmlFor="email" className={labelClass}>
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="you@company.ru"
                                autoComplete="email"
                                value={data.email}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className={labelClass}>
                                Пароль
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="Ваш пароль"
                                autoComplete="current-password"
                                value={data.password}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 active:bg-indigo-700"
                    >
                        Войти
                    </button>

                    <p className="mt-5 text-center text-sm text-slate-500">
                        Нет аккаунта?{" "}
                        <Link to="/auth" className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline">
                            Зарегистрироваться
                        </Link>
                    </p>
                </form>

                <p className="mt-6 text-center text-xs text-slate-400">
                    Демо-доступ: admin@robotics.local / admin12345
                </p>
            </div>
        </div>
    );
}
