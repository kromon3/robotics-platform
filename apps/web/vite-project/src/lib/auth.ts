// Минимум для MVP: токен лежит в localStorage, email берём прямо из payload JWT
// (бэкенд кладёт туда { sub, email }). Без проверки подписи — она на сервере.

export function getToken(): string | null {
    return localStorage.getItem("token");
}

export function getUserEmail(): string | null {
    const token = getToken();
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return typeof payload.email === "string" ? payload.email : null;
    } catch {
        return null;
    }
}

export function logout() {
    localStorage.removeItem("token");
}
