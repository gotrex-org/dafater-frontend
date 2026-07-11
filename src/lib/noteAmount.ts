// When a movement's amount is edited, keep any amount figure embedded in its البيان
// (note) in sync — e.g. "تحصيل 500 من أحمد" becomes "تحصيل 700 من أحمد" when the amount
// goes 500 → 700. Only the exact old number is swapped (not digits inside a larger
// number, and not a decimal's fractional part), so surrounding custom text is preserved.
// Uses no regex lookbehind (older Safari safe).
export function replaceAmountInNote(note: string, oldAmount: number, newAmount: number): string {
  if (!note || !oldAmount || oldAmount === newAmount) return note;
  const oldStr = String(oldAmount).replace(/\./g, '\\.');
  const re = new RegExp('(^|[^0-9.])' + oldStr + '($|[^0-9.])', 'g');
  return note.replace(re, (_m, before, after) => `${before}${newAmount}${after}`);
}
