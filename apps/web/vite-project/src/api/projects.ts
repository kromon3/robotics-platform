import axios from "axios";
import type { EconFormData } from "../store/econStore";
import type { ProjectFormData } from "../store/store";

const API_URL = import.meta.env.VITE_API_URL;

/** Итоги расчёта — Decimal с бэкенда приходит строкой */
export type ProjectSummary = {
    id: string;
    name: string;
    objectType: string;
    robotsCount: number | null;
    capex: string | null;
    opexPerYear: string | null;
    annualEffect: string | null;
    paybackYears: string | null;
    roiPercent: number | null;
    tco: string | null;
    catalogVersion: number;
    modelVersion: string;
    createdAt: string;
    updatedAt: string;
    product: { id: string; name: string; price: string | null; specs: Record<string, unknown> } | null;
};

export type ProjectDetail = ProjectSummary & {
    params: ProjectFormData;
    econ: EconFormData | null;
    norms: Record<string, unknown> | null;
    productId: string | null;
};

export type SaveProjectPayload = {
    name: string;
    params: ProjectFormData;
    econ?: EconFormData;
    norms?: Record<string, unknown>;
    productId?: string;
    robotsCount?: number;
    capex?: number;
    opexPerYear?: number;
    annualEffect?: number;
    paybackYears?: number;
    roiPercent?: number;
    tco?: number;
};

const auth = () => {
    const token = localStorage.getItem("token");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const projectsApi = {
    list: () =>
        axios.get<{ items: ProjectSummary[]; total: number }>(`${API_URL}/projects`, auth()).then((r) => r.data),
    get: (id: string) => axios.get<ProjectDetail>(`${API_URL}/projects/${id}`, auth()).then((r) => r.data),
    create: (payload: SaveProjectPayload) =>
        axios.post<ProjectSummary>(`${API_URL}/projects`, payload, auth()).then((r) => r.data),
    update: (id: string, payload: Partial<SaveProjectPayload>) =>
        axios.patch<ProjectSummary>(`${API_URL}/projects/${id}`, payload, auth()).then((r) => r.data),
    remove: (id: string) => axios.delete(`${API_URL}/projects/${id}`, auth()).then((r) => r.data),
};

export const isAuthenticated = () => Boolean(localStorage.getItem("token"));
