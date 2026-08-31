'use client';

import { money, fmtDate } from '@/lib/format';

/**
 * جسم ورقة الفاتورة بشكل الشيت — مستخرَج من InvoiceDetail عشان الفاتورة تطلع
 * **بنفس الشكل بالحرف** في كل مكان: صفحة الفاتورة، تابات فواتير العميل، وبوابة
 * العميل. أي تعديل هنا بيتطبّق على التلاتة مع بعض، فمستحيل يحصل اختلاف بينهم.
 *
 * الشكل مطابق لشيت جوجل اللي الشغل ماشي عليه:
 *   تاريخ التسليم | العدد. | الصنف. | السعر. | الاجمالي.   + عمود ملخّص جانبي
 *   وأول سطر «حــــســـــاب قــــديــــم»، والملخّص: اجمالي الفاتورة / نقل نقدية /
 *   سدادات / الباقي عليه.
 */

export interface SheetItem { name: string; qty: number; price: number }
export interface SheetPayment { id: string; date: string; note?: string | null; amount: number }

export interface InvoiceSheetBodyProps {
  items: SheetItem[];
  cur: 'EGP' | 'USD';
  /** إجمالي الأصناف بعد الخصم */
  netTotal: number;
  discount: number;
  /** الحساب القديم — null يعني مش متاح (فاتورة وهمية مثلاً) فالسطر ما بيظهرش */
  previousBalance: number | null;
  cashTransfer: number;
  /** مصاريف الفترة: المصاريف على الطرف بره الفاتورة، من الفاتورة دي لحد اللي بعدها */
  expensesTotal: number;
  paymentsTotal: number | null;
  /** حركات أخرى في نفس الفترة (مرتجع/خصم) — بتظهر لو مش صفر */
  other: number;
  remaining: number | null;
  isSale: boolean;
}

export function InvoiceSheetBody({
  items, cur, netTotal, discount, previousBalance, cashTransfer, expensesTotal, paymentsTotal, other, remaining, isSale,
}: InvoiceSheetBodyProps) {
  // اجمالي الفاتورة في الشيت شامل الحساب القديم (مجموع عمود «الاجمالي» كله).
  const sheetTotal = previousBalance !== null ? previousBalance + netTotal : null;

  return (
    <div className="sh-body">
      <div className="sh-items tbl-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 90 }}>العدد</th>
              <th>الصنف</th>
              <th style={{ width: 110 }}>السعر {cur === 'USD' ? '($)' : '(ج.م)'}</th>
              <th style={{ width: 120 }}>الاجمالي</th>
            </tr>
          </thead>
          <tbody>
            {previousBalance !== null && (
              <tr className="sh-old">
                <td colSpan={3}>حــــســـــاب قــــديــــم</td>
                <td className="num">{money(previousBalance, cur)}</td>
              </tr>
            )}
            {items.map((it, i) => (
              <tr key={i}>
                <td className="num">{it.qty}</td>
                <td>{it.name}</td>
                <td className="num">{money(it.price, cur)}</td>
                <td className="num">{money(it.qty * it.price, cur)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="mf-total">
              <td colSpan={3}>{discount > 0 ? 'إجمالي الأصناف بعد الخصم' : 'إجمالي الأصناف'}</td>
              <td className="num">{money(netTotal, cur)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <aside className="sh-side">
        <div className="sh-box">
          <div className="sh-box-l">اجمالي الفاتورة</div>
          <div className="sh-box-v num">{money(sheetTotal ?? netTotal, cur)}</div>
        </div>
        {cashTransfer !== 0 && (
          <div className="sh-box">
            <div className="sh-box-l">نقل نقدية</div>
            <div className="sh-box-v num">{money(cashTransfer, cur)}</div>
          </div>
        )}
        {/* مصاريف الفترة — المصاريف اللي اتسجّلت على الطرف بره الفاتورة، من الفاتورة
            دي لحد اللي بعدها (نفس نافذة السدادات). */}
        {expensesTotal !== 0 && (
          <div className="sh-box">
            <div className="sh-box-l">مصاريف الفترة</div>
            <div className="sh-box-v num">{money(expensesTotal, cur)}</div>
          </div>
        )}
        {paymentsTotal !== null && (
          <>
            <div className="sh-box">
              <div className="sh-box-l">سدادات</div>
              <div className="sh-box-v num">{money(paymentsTotal, cur)}</div>
            </div>
            {Math.abs(other) > 0.005 && (
              <div className="sh-box">
                <div className="sh-box-l">حركات أخرى</div>
                <div className="sh-box-v num">{money(other, cur)}</div>
              </div>
            )}
            <div className="sh-box sh-box-end">
              <div className="sh-box-l">{isSale ? 'الباقي عليه' : 'الباقي له'}</div>
              <div className="sh-box-v num">{money(remaining ?? 0, cur)}</div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/**
 * بلوك السدادات بشكل الشيت: التاريخ. | البيان | المبلغ. وإجمالي تحتهم.
 * (في جوجل شيت الإجمالي عمود مدموج على البلوك كله — هنا سطر إجمالي، نفس الرقم.)
 */
export function InvoiceSheetPayments({
  payments, total, cur, title,
}: { payments: SheetPayment[]; total: number; cur: 'EGP' | 'USD'; title: React.ReactNode }) {
  return (
    <div className="sh-pay tbl-wrap">
      <div className="sh-pay-title">{title}</div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 110 }}>التاريخ.</th>
            <th>البيان</th>
            <th style={{ width: 130 }}>المبلغ.</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{fmtDate(p.date)}</td>
              <td>{p.note || 'استلام نقدية'}</td>
              <td className="num">{money(p.amount, cur)}</td>
            </tr>
          ))}
          {payments.length === 0 && (
            <tr><td colSpan={3} className="empty">مفيش استلامات في الفترة دي</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className="mf-total">
            <td colSpan={2}>الاجمالي.</td>
            <td className="num">{money(total, cur)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
