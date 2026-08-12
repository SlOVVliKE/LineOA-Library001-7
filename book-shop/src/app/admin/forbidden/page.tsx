export default function Forbidden() {
  return (
    <div className="card max-w-lg">
      <h1 className="text-lg font-semibold">ไม่มีสิทธิ์เข้าถึง</h1>
      <p className="mt-2 text-sm text-neutral-600">
        บัญชีของคุณไม่มีสิทธิ์ดูหน้านี้ หากคิดว่าผิดพลาด ให้ติดต่อเจ้าของร้านเพื่อขอเพิ่มสิทธิ์
      </p>
    </div>
  )
}
