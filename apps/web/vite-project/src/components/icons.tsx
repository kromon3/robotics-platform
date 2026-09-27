import type { SVGProps } from "react";

// Иконки навигации. stroke="currentColor" — цвет берётся из текста родителя,
// поэтому в светлой теме серые, в тёмной светлые, у активного пункта — индиго.
// Стиль совпадает с логотипом в шапке (line icons, stroke 2).

export type IconName = "dashboard" | "folder" | "robot" | "calculator" | "settings";

const base = (props: SVGProps<SVGSVGElement>) => ({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
});

export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg {...base(props)}>
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
    );
}

export function FolderIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg {...base(props)}>
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        </svg>
    );
}

export function RobotIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg {...base(props)}>
            <rect x="3" y="8" width="18" height="12" rx="2" />
            <path d="M12 4v4M8 14h.01M16 14h.01M9 18h6" />
        </svg>
    );
}

export function CalculatorIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg {...base(props)}>
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14v4M8 18h.01M12 18h.01" />
        </svg>
    );
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg {...base(props)}>
            <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
        </svg>
    );
}

export const NAV_ICONS: Record<IconName, (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
    dashboard: DashboardIcon,
    folder: FolderIcon,
    robot: RobotIcon,
    calculator: CalculatorIcon,
    settings: SettingsIcon,
};

// Типы объектов на экране выбора нового расчёта

export function WarehouseIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg {...base(props)}>
            <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
            <path d="M7 21v-6h10v6" />
            <path d="M7 17.5h10" />
        </svg>
    );
}

export function AirportIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg {...base(props)}>
            <path d="M10.5 3.5a1.5 1.5 0 0 1 3 0V9l7 4v2l-7-2v4l2.5 2v1.5L12 19.5 8 20.5V19l2.5-2v-4l-7 2v-2l7-4z" />
        </svg>
    );
}

export function MedicalIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg {...base(props)}>
            <path d="M4 21V8.5L12 3l8 5.5V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
            <path d="M12 9.5v6M9 12.5h6" />
        </svg>
    );
}
