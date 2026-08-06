// Render a DOM element to a one-page A4 image — used for both PDF download and
// "one page" printing. Libraries are imported dynamically to keep the bundle lean.

// Capture the sheet at A4 width (portrait) so the output is proportioned like a page
// (the statement fills the whole screen width on screen, which would look wide/short).
async function captureSheet(el: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  const prevWidth = el.style.width;
  el.style.width = '794px'; // A4 width @96dpi
  el.classList.add('pdf-capture');
  try {
    return await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 794 });
  } finally {
    el.style.width = prevWidth;
    el.classList.remove('pdf-capture');
  }
}

export async function downloadElementAsPdf(el: HTMLElement, filename: string) {
  const jspdf = await import('jspdf');
  const JsPDF = (jspdf as any).jsPDF || (jspdf as any).default;

  const canvas = await captureSheet(el);
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

// Print the element as a single A4 page: render it to one image and print that image
// (scaled to fit one page) via a hidden iframe — so it never spills to a second page.
export async function printElementOnePage(el: HTMLElement, title: string) {
  const canvas = await captureSheet(el);
  const img = canvas.toDataURL('image/png');

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const win = iframe.contentWindow!;
  const doc = win.document;
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>${title}</title><style>` +
    '@page { size: A4; margin: 0; }' +
    'html,body { margin:0; padding:0; }' +
    'img { display:block; margin:0 auto; max-width:100%; max-height:100vh; width:auto; height:auto; }' +
    `</style></head><body><img src="${img}"/></body></html>`,
  );
  doc.close();

  win.onafterprint = () => setTimeout(() => iframe.remove(), 300);
  const imgEl = doc.querySelector('img') as HTMLImageElement;
  const go = () => { win.focus(); win.print(); };
  if (imgEl.complete) go();
  else imgEl.addEventListener('load', go);
}
