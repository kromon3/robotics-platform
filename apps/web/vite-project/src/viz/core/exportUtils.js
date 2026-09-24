// Экспорт визуализации (ТЗ 3.7.4): схема склада в SVG и PNG, результаты симуляции в CSV.
const SCALE = 30;   // пикселей на метр для PNG

function svgString(svgEl) {
  const vb = svgEl.viewBox.baseVal, clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', Math.round(vb.width * SCALE)); clone.setAttribute('height', Math.round(vb.height * SCALE));
  clone.removeAttribute('style');
  return { str: new XMLSerializer().serializeToString(clone), w: Math.round(vb.width * SCALE), h: Math.round(vb.height * SCALE) };
}
function save(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function downloadSvg(svgEl, name) { save(new Blob([svgString(svgEl).str], { type: 'image/svg+xml;charset=utf-8' }), `${name}.svg`); }
export function downloadPng(svgEl, name) {
  const { str, w, h } = svgString(svgEl), img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    c.toBlob((b) => b && save(b, `${name}.png`), 'image/png');
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(str)}`;
}
export function downloadCsv(name, header, rows) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const text = [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  save(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);   // BOM — чтобы Excel открыл кириллицу
}
