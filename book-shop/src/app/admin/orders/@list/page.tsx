import { OrderListPane } from '../OrderListPane'

export const dynamic = 'force-dynamic'

// ตรงกับ /admin/orders พอดี (ยังไม่ได้เลือกออเดอร์ไหน)
export default async function OrdersListSlot({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  return <OrderListPane status={status} />
}
