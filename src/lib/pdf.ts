// Render a DOM element to a one-page A4 PDF and download it.
// Libraries are imported dynamically so they don't bloat the initial bundle.
export async function downloadElementAsPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, jspdf] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const JsPDF = (jspdf as any).jsPDF || (jspdf as any).default;

  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const img = canvas.toDataURL('image/png');

  const pdf = new JsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  pdf.addImage(img, 'PNG', (pageW - w) / 2, 0, w, h);
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
