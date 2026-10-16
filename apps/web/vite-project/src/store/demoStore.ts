import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EXAMPLE, useProjectStore } from "./store";
import { ECON_EXAMPLE, useEconStore } from "./econStore";

// Демо-режим: гость проходит весь путь на готовых данных, ничего не вводя.
// Поля заполнены примером и заблокированы — менять их можно только после регистрации.

type DemoState = {
    active: boolean;
    start: () => void;
    stop: () => void;
};

export const useDemoStore = create<DemoState>()(
    persist(
        (set) => ({
            active: false,
            start: () => {
                // Те же данные, что даёт кнопка «Заполнить примером» на обоих экранах ввода
                useProjectStore.setState({ formData: { ...EXAMPLE }, selectedProductId: null });
                useEconStore.setState({
                    econ: { ...ECON_EXAMPLE, activeAreaM2: Number(EXAMPLE.width) * Number(EXAMPLE.length) },
                });
                set({ active: true });
            },
            stop: () => set({ active: false }),
        }),
        { name: "demo-mode" },
    ),
);
