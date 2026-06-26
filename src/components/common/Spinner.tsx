export function Spinner({ text = 'جاري التحميل…' }: { text?: string }) {
  return <div className="empty">{text}</div>;
}
