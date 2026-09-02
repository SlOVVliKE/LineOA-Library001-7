import { OrderListPane } from '../OrderListPane'

export const dynamic = 'force-dynamic'

// fallback ตอน URL ลึกกว่า /admin/orders (เช่น /admin/orders/[id]) ซึ่ง page.tsx
// ของสล็อตนี้เองไม่ match — ต้องมีไฟล์นี้ไม่งั้น hard reload ที่ /admin/orders/[id]
// จะ 404 เพราะสล็อต @list หาอะไรมาเรนเดอร์ไม่ได้
//
// หมายเหตุ: ยังไม่ไฮไลต์แถวที่กำลังเปิดอยู่ในโหมดนี้ (ต้องใช้
// useSelectedLayoutSegment ฝั่ง client ถึงจะรู้ id จากสล็อต @detail ได้ —
// เก็บไว้เป็นงานปรับปรุงทีหลัง ไม่ใช่ตัวบล็อกของรอบนี้)
export default async function OrdersListDefault({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  return <OrderListPane status={status} />
}
