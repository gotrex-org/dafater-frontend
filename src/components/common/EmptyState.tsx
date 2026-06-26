export function EmptyState({ text = 'لا توجد بيانات' }: { text?: string }) {
  return <div className="empty">{text}</div>;
}
