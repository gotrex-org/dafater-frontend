'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageTitle } from '@/components/common';
import { assistantApi, type ChatMessage } from '../api';

const SUGGESTIONS = [
  'حلّل أرقام الشهر ده وقولّي رأيك',
  'إيه أكتر بنود المصاريف عليّا؟',
  'مين العملاء اللي عليهم فلوس؟',
  'إيه اللي ممكن يتحسّن في البرنامج؟',
];

export function AssistantView() {
  const { data: status } = useQuery({ queryKey: ['assistant', 'status'], queryFn: () => assistantApi.status() });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, loading]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setError('');
    const next = [...messages, { role: 'user' as const, content: q }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await assistantApi.chat(next);
      setMessages([...next, { role: 'assistant', content: res.reply }]);
    } catch (e: any) {
      setError(e.message || 'حصل خطأ');
      setMessages(messages); // rollback the user message on hard failure
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageTitle title="المساعد الذكي" subtitle="بيشوف أرقام شغلك، يحلّلها، يفكّر معاك، ويقترح تحسينات" />

      {status && !status.configured && (
        <div className="card" style={{ padding: 14, marginBottom: 12, background: 'var(--debit-bg, #fdecea)', color: 'var(--debit)', fontWeight: 700, fontSize: 13.5 }}>
          ⚠️ المساعد لسه مش مفعّل — محتاج مفتاح Anthropic API على السيرفر (ANTHROPIC_API_KEY). تقدر تجرّب تبعت رسالة وهيقولّك.
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '68vh', overflow: 'hidden' }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 460 }}>
              <div style={{ fontSize: 40, marginBottom: 6 }}>🤖</div>
              <div className="muted" style={{ fontSize: 14, marginBottom: 14 }}>اسألني عن شغلك أو خلّينا نفكّر مع بعض.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="btn btn-ghost btn-sm" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end' }}>
              <div style={{
                maxWidth: '82%', padding: '10px 13px', borderRadius: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14,
                background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--line-soft)',
                color: 'var(--ink)',
              }}>{m.content}</div>
            </div>
          ))}
          {loading && <div style={{ alignSelf: 'flex-end' }}><div className="muted" style={{ padding: '10px 13px', fontSize: 14 }}>بيفكّر…</div></div>}
        </div>

        {error && <div className="err-text" style={{ padding: '0 16px' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--line-soft)' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="اكتب سؤالك…"
            style={{ flex: 1, padding: '11px 12px', border: '1.5px solid var(--line)', borderRadius: 10, fontSize: 14 }}
          />
          <button className="btn btn-primary" onClick={() => send(input)} disabled={loading || !input.trim()}>إرسال</button>
          {messages.length > 0 && <button className="btn btn-ghost" onClick={() => { setMessages([]); setError(''); }} title="محادثة جديدة">🗑</button>}
        </div>
      </div>
    </>
  );
}
