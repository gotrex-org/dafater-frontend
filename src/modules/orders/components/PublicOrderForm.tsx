'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCreateOrder } from '../hooks';

interface Line { name: string; qty: number; }

export function PublicOrderForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<Line[]>([{ name: '', qty: 1 }]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const createOrder = useCreateOrder();

  useEffect(() => {
    api.get<{ orderEmail: string }>('/config').then((c) => setEmail(c.orderEmail)).catch(() => {});
  }, []);

  const submit = () => {
    setError('');
    const items = lines.filter((l) => l.name.trim() && l.qty > 0);
    if (!name.trim()) return setError('اكتب اسمك');
    if (items.length === 0) return setError('أضف صنفًا واحدًا على الأقل');
    createOrder.mutate({ name, phone, note, items }, { onError: (e: any) => setError(e.message) });
  };

  const mailto = () => {
    const body = lines.filter((l) => l.name).map((l) => `${l.name} × ${l.qty}`).join('%0D%0A');
    return `mailto:${email}?subject=${encodeURIComponent('طلبية جديدة من ' + name)}&body=${body}`;
  };

  if (createOrder.isSuccess) {
    return (
      <div className="login-bg">
        <div className="login-card">
          <div className="logo">دفا<b>تر</b></div>
          <p style={{ fontWeight: 700, color: 'var(--credit)' }}>✅ اتسجّلت الطلبية</p>
          {email && <a className="btn btn-primary" href={mailto()}>إرسال نسخة بالإيميل</a>}
        </div>
      </div>
    );
  }

  return (
    <div className="login-bg">
      <div className="login-card" style={{ maxWidth: 440, textAlign: 'start' }}>
        <div className="logo" style={{ textAlign: 'center' }}>اكتب طلبيتك</div>
        <div className="field"><label>الاسم</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field" style={{ marginTop: 10 }}><label>رقم الموبايل</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div style={{ marginTop: 12, fontWeight: 700, fontSize: 13 }}>الأصناف</div>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input placeholder="الصنف" value={l.name} onChange={(e) => setLines((ls) => ls.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }} />
            <input type="number" value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, idx) => idx === i ? { ...x, qty: Number(e.target.value) } : x))} style={{ width: 70, padding: '10px 12px', border: '1.5px solid var(--line)', borderRadius: 10 }} />
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setLines((ls) => [...ls, { name: '', qty: 1 }])}>+ صنف</button>
        <div className="field" style={{ marginTop: 10 }}><label>ملاحظات</label><input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="err-text">{error}</div>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={submit} disabled={createOrder.isPending}>إرسال الطلبية</button>
      </div>
    </div>
  );
}
