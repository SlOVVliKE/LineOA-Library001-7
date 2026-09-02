// fallback ของสล็อต @detail ตอน URL ตรงกับ /admin/orders เป๊ะ (ยังไม่เลือกออเดอร์)
export default function OrdersDetailEmpty() {
  return (
    <div className="hidden items-center justify-center rounded-2xl border border-dashed p-12 text-center text-sm text-neutral-500 xl:flex"
      style={{ borderColor: 'var(--line)' }}
    >
      เลือกออเดอร์ทางซ้ายเพื่อดูรายละเอียด
    </div>
  )
}
