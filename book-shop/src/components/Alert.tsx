/**
 * แถบข้อความแจ้งผล
 *
 * role="status" ทำให้โปรแกรมอ่านหน้าจออ่านข้อความนี้ให้ทันทีที่โผล่มา
 * โดยไม่ต้องขยับ focus ไปหา ถ้าไม่ใส่ คนที่ใช้โปรแกรมอ่านหน้าจอ
 * จะกดปุ่มแล้วไม่รู้เลยว่าสำเร็จหรือไม่
 */
export function Alert({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null

  return (
    <div
      role="status"
      className="rounded-xl px-3.5 py-2.5 text-[14px]"
      style={
        ok
          ? { background: 'var(--ok-bg)', color: 'var(--ok)' }
          : { background: 'var(--danger-bg)', color: 'var(--danger)' }
      }
    >
      {message}
    </div>
  )
}
