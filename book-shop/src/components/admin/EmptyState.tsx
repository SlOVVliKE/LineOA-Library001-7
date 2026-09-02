/** ข้อความ "ยังไม่มี..." นอกตาราง — ซ้ำแบบเดียวกันใน favourites/notifications/categories */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="card text-center text-sm text-neutral-500">{children}</p>
}
