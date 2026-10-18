import axios from "axios";

// Запрос коммерческого предложения: POST /quote-requests (вход не нужен).
// Если пользователь вошёл, токен уходит вместе с запросом — бэкенд привяжет запрос к аккаунту.

const API_URL = import.meta.env.VITE_API_URL;

export type QuoteTimeframe = "asap" | "1-3m" | "3-6m" | "6-12m" | "exploring";
export type QuoteSource = "compare" | "detail";
export type QuoteStatus = "NEW" | "SENT" | "ANSWERED" | "CLOSED";

export type QuoteRequestPayload = {
    contactName: string;
    company: string;
    email: string;
    phone?: string;
    inn?: string;
    comment?: string;
    deliveryRegion: string;
    timeframe: QuoteTimeframe;
    consent: true;
    consentVersion: string;
    items: { productId: string; quantity: number }[];
    source?: QuoteSource;
    /** Ловушка для ботов: человек это поле не видит и не заполняет */
    website?: string;
};

/** Ответ на запрос: номер и кому он уйдёт */
export type QuoteReceipt = {
    id: string;
    number: number;
    displayNumber: string;
    status: QuoteStatus;
    email: string;
    createdAt: string;
    suppliers: {
        companyName: string;
        items: { productId: string | null; productName: string; quantity: number; unitPrice: string | null }[];
    }[];
};

export type CurrentUser = { id: string; email: string; name: string; roles: string[] };

const auth = () => {
    const token = localStorage.getItem("token");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

export const quotesApi = {
    create: (payload: QuoteRequestPayload) => axios.post<QuoteReceipt>(`${API_URL}/quote-requests`, payload, auth()).then((r) => r.data),
    /** Кто вошёл — чтобы подставить имя и email в форму. Гостю не вызывается. */
    me: (signal?: AbortSignal) => axios.get<CurrentUser>(`${API_URL}/auth/me`, { ...auth(), signal }).then((r) => r.data),
};
