/**
 * مدى قرب الاسم من المكتوب، بالكلمات ومن غير ترتيب: كل كلمة مكتوبة لازم تطابق كلمة
 * في الاسم (من أولها أحسن، أو في نصها). يعني «سره» تلاقي «برتقال أبو سرة»، و«سرة برتقال»
 * تلاقيها برضه. بيرجّع null لو مفيش تطابق، وإلا رقم أكبر = أقرب.
 */
export function wordMatchScore(name: string, query: string): number | null {
  const qWords = normalizeAr(query).split(/\s+/).filter(Boolean);
  if (!qWords.length) return null;
  const nWords = normalizeAr(name).split(/\s+/).filter(Boolean);
  let score = 0;
  for (const q of qWords) {
    if (nWords.some((w) => w.startsWith(q))) score += 2;
    else if (nWords.some((w) => w.includes(q))) score += 1;
    else return null;
  }
  // الاسم اللي بيبدأ بالمكتوب نفسه هو الأقرب
  if (normalizeAr(name).startsWith(normalizeAr(query))) score += 3;
  return score;
}

// تطبيع النص العربي للبحث — عشان «أحمد» تلاقي «احمد» و«محمّد» تلاقي «محمد»…الخ.
// يوحّد أشكال الألف، والتاء المربوطة، والألف المقصورة، ويشيل التطويل والتشكيل،
// ويحوّل الأرقام العربية/الفارسية لأرقام لاتينية، ويقصّ ويصغّر الحروف.
export function normalizeAr(s: string): string {
  if (!s) return '';
  return s
    // أشكال الألف: أ إ آ ٱ → ا
    .replace(/[أإآٱ]/g, 'ا')
    // التاء المربوطة ة → ه
    .replace(/ة/g, 'ه')
    // الألف المقصورة ى → ي
    .replace(/ى/g, 'ي')
    // التطويل (ـ)
    .replace(/ـ/g, '')
    // التشكيل (الحركات) ً-ْ + ٰ
    .replace(/[ً-ْٰ]/g, '')
    // الأرقام العربية-الهندية ٠-٩ → 0-9
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    // الأرقام الفارسية ۰-۹ → 0-9
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .trim()
    .toLowerCase();
}
