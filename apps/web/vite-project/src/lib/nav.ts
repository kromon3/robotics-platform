import type { IconName } from "../components/icons.tsx";

export const navItems: { name: string; to: string; icon: IconName }[] = [
    { name: "Dashboard", to: "/", icon: "dashboard" },
    { name: "Проекты", to: "/projects", icon: "folder" },
    { name: "Роботы", to: "/robots", icon: "robot" },
    { name: "Расчёты", to: "/calculations", icon: "calculator" },
    { name: "Настройки", to: "/settings", icon: "settings" },
];
