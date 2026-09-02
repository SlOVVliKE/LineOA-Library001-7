export default function Forbidden() {
  return (
    <div className="a-card max-w-lg p-4">
      <h1 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>ไม่มีสิทธิ์เข้าถึง</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
        บัญชีของคุณไม่มีสิทธิ์ดูหน้านี้ หากคิดว่าผิดพลาด ให้ติดต่อเจ้าของร้านเพื่อขอเพิ่มสิทธิ์
      </p>
    </div>
  )
}
