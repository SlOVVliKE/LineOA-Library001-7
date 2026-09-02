import { OrdersSplitView } from '@/components/admin/OrdersSplitView'

export default function OrdersLayout({
  list,
  detail,
}: {
  list: React.ReactNode
  detail: React.ReactNode
}) {
  return <OrdersSplitView list={list} detail={detail} />
}
