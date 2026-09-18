import { useEffect, useState } from "react";
import axios from "axios";

function App() {
    const [total, setTotal] = useState(null);

    useEffect(() => {
        axios
            .get('http://localhost:3000/catalog/products/total')
            .then((response) => {
                setTotal(response.data.total);
            })
            .catch((error) => {
                console.log(error);
            });
    }, []);

    const cards = [
        { id: 1, name: "Проектов", data:  '-'},
        { id: 2, name: "Роботов в каталоге", data: total },
        { id: 3, name: "Расчётов", data: '-' },
        { id: 4, name: "Средний ROI", data: '-' },
    ];

    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
                <div
                    key={card.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {card.name}
                    </div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight">
                        {card.data ?? '-'}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default App;