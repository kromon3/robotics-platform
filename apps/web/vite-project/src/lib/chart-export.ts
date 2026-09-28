// Выгрузка диаграмм отчёта в PNG (ТЗ 3.7.4).
//
// Recharts рисует обычный <svg>, но часть оформления приходит из CSS: сетка задана
// stroke="currentColor", шрифт наследуется от страницы. В отрыве от документа это теряется,
// поэтому перед сериализацией переносим вычисленные значения в атрибуты клона.

const PIXEL_RATIO = 2; // ретина-качество: картинку вставляют в презентации и печатают

/** Свойства, которые обязаны пережить отрыв от документа */
const INLINE_PROPS = [
    'fill',
    'stroke',
    'stroke-width',
    'stroke-dasharray',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
    'font-family',
    'font-size',
    'font-weight',
    'text-anchor',
] as const;

function inlineStyles(source: SVGSVGElement, clone: SVGSVGElement) {
    const from = [source, ...Array.from(source.querySelectorAll<SVGElement>('*'))];
    const to = [clone, ...Array.from(clone.querySelectorAll<SVGElement>('*'))];

    from.forEach((node, i) => {
        const target = to[i];
        if (!target) return;
        const computed = getComputedStyle(node);
        for (const prop of INLINE_PROPS) {
            const value = computed.getPropertyValue(prop);
            // currentColor и наследование шрифта за пределами документа не работают
            if (value && value !== 'none' && value !== 'normal') target.setAttribute(prop, value);
        }
    });
}

/** Готовит самодостаточную строку SVG и её размеры в CSS-пикселях */
function serialize(svg: SVGSVGElement): { xml: string; width: number; height: number } {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    const clone = svg.cloneNode(true) as SVGSVGElement;
    inlineStyles(svg, clone);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

    return { xml: new XMLSerializer().serializeToString(clone), width, height };
}

function save(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Safari успевает начать скачивание не сразу
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const slugify = (s: string) =>
    s
        .replace(/[^\wа-яё\s-]/gi, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 60)
        .toLowerCase() || 'diagramma';

/**
 * Находит <svg> внутри контейнера и сохраняет его как PNG на белом фоне.
 * Вернёт false, если диаграммы в контейнере нет (например, она ещё не отрисована).
 */
export function downloadChartPng(container: HTMLElement | null, filename: string): Promise<boolean> {
    const svg = container?.querySelector('svg');
    if (!svg) return Promise.resolve(false);

    const { xml, width, height } = serialize(svg as SVGSVGElement);

    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * PIXEL_RATIO;
            canvas.height = height * PIXEL_RATIO;

            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(false);
            // Белая подложка: у SVG фон прозрачный, в PNG это дало бы чёрный текст на чёрном
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                if (blob) save(blob, `${filename}.png`);
                resolve(Boolean(blob));
            }, 'image/png');
        };
        image.onerror = () => resolve(false);
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    });
}
