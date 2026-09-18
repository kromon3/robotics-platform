// Типы ответа GET /catalog/products и /catalog/products/:id — по тому, что реально отдаёт бэкенд.

export type ProductType = "brs" | "bas" | "software";
export type ProductStatus = "operation" | "piloting" | "rnd";

export type Product = {
    id: string;
    name: string;
    type: ProductType;
    status: ProductStatus;
    subtype: string | null;
    category: string | null;
    description: string | null;
    price: string | null; // Decimal с бэкенда приходит строкой — Number(price) на месте
    ugt: number | null;
    marketPotential: number | null;
    specs: Record<string, unknown>;
    sourceUrl: string | null;
    sourceDate: string | null;
    verified: boolean;
    catalogVersion: number;
    companyId: string;
    company: {
        id: string;
        name: string;
        region: string | null;
    };
};

// GET /catalog/products/:id — тот же продукт плюс связи
export type ProductDetail = Omit<Product, "company"> & {
    company: Product["company"] & { website: string | null };
    productIndustries: { industry: { name: string } }[];
    productScenarios: { scenario: { name: string } }[];
    cases: {
        id: string;
        description: string;
        customer: string | null;
        resultMetrics: string | null;
    }[];
};

export type ProductsResponse = {
    items: Product[];
    total: number;
    page: number;
    limit: number;
    pages: number;
};

export type ProductsQuery = {
    q?: string;
    type?: ProductType;
    status?: ProductStatus;
    category?: string;
    industry?: string;
    scenario?: string;
    page?: number;
    limit?: number;
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
    brs: "БРС",
    bas: "БАС",
    software: "ПО",
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
    operation: "В эксплуатации",
    piloting: "Пилотирование",
    rnd: "НИОКР",
};
