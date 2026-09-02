/** ย้ายออกมาจาก admin/page.tsx (เดิมชื่อ Stat) ให้หน้า "งานวันนี้" เรียกใช้ร่วมได้ */
export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="a-card">
      <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: 'var(--ink)' }}>{value}</div>
    </div>
  )
}
