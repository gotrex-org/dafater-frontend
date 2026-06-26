'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function LoginForm() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) router.replace('/dashboard'); }, [user, router]);

  const submit = async () => {
    if (!username || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e.message || 'فشل الدخول');
      setBusy(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="logo">دفا<b>تر</b></div>
        <div className="tg">حسابات · فواتير · مخازن</div>

        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <input
            autoFocus
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="اسم المستخدم"
            style={{ padding: '12px 14px', border: '1.5px solid var(--line)', borderRadius: 12, fontSize: 16, textAlign: 'center' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="كلمة المرور"
              style={{ flex: 1, padding: '12px 14px', border: '1.5px solid var(--line)', borderRadius: 12, fontSize: 16, textAlign: 'center', letterSpacing: 2 }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => setShow((s) => !s)} title="إظهار/إخفاء">
              {show ? '🙈' : '👁'}
            </button>
          </div>
          {error && <div className="err-text">{error}</div>}
          <button className="btn btn-primary" onClick={submit} disabled={busy || !username || !password}>
            {busy ? '...' : 'دخول'}
          </button>
        </div>
      </div>
    </div>
  );
}
