export const EGP = (n: number | undefined | null) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const USD = (n: number | undefined | null) =>
  `$ ${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const money = (n: number | undefined | null, currency?: 'EGP' | 'USD' | null) =>
  currency === 'USD' ? USD(n) : EGP(n);

export const QTY = (n: number | undefined | null) =>
  (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return iso;
  }
};

export const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export const fmtDateTime = (iso: string) => `${fmtDate(iso)} — ${fmtTime(iso)}`;
