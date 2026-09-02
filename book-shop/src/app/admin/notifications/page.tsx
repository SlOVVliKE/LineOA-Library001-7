import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { formatDateTime } from '@/lib/money'
import { Table, TableHead, TableRow, EmptyRow } from '@/components/admin/Table'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  order_paid:         'ยืนยันรับเงิน',
  preorder_confirmed: 'รับการสั่งจอง',
  preorder_arrived:   'ของที่จองเข้าแล้ว',
  awaiting_balance:   'รอชำระส่วนที่เหลือ',
  order_shipped:      'จัดส่งแล้ว',
  order_delivered:    'พัสดุถึงมือ',
  order_cancelled:    'ยกเลิกคำสั่งซื้อ',
}

const STATUS_STYLE: Record<string, string> = {
  queued:  'badge-warn',
  sent:    'badge-ok',
  failed:  'badge-danger',
  skipped: 'badge-quiet',
}

const STATUS_LABEL: Record<string, string> = {
  queued:  'รอส่ง',
  sent:    'ส่งแล้ว',
  failed:  'ส่งไม่สำเร็จ',
  skipped: 'ข้าม',
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requirePermission('order.read')
  const { status } = await searchParams
  const supabase = await createClient()

  // นับจากทั้งหมดเสมอ (ไม่กรอง) การ์ดสรุปด้านบนจะได้ไม่เปลี่ยนเลขตามตัวกรองที่เลือก
  const { data: allRows } = await supabase
    .from('v_notification_log')
    .select('status')
    .order('created_at', { ascending: false })
    .limit(100)

  const counts = (allRows ?? []).reduce<Record<string, number>>((acc, r) => {
    const s = r.status as string
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  let query = supabase
    .from('v_notification_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (status) query = query.eq('status', status)
  const { data: rows } = await query

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">แจ้งเตือนที่ส่งเข้า LINE</h1>
        <p className="mt-1 text-sm text-neutral-600">
          ระบบบันทึกทุกครั้งที่สถานะออเดอร์เปลี่ยน แล้วส่งออกทันทีในจังหวะนั้น
          โดยมี cron คอยกวาดซ้ำทุกชั่วโมงเผื่อรอบแรกพลาด —
          ส่งไม่สำเร็จจะลองซ้ำได้ถึง 3 ครั้ง และเห็นสาเหตุที่นี่
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <Link
          href="/admin/notifications"
          className="card"
          style={!status ? { borderColor: 'var(--info)', background: 'var(--info-bg)' } : undefined}
        >
          <div className="text-xs text-neutral-500">ทั้งหมด</div>
          <div className="mt-1 text-2xl font-semibold">{allRows?.length ?? 0}</div>
        </Link>
        {(['queued', 'sent', 'failed', 'skipped'] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/notifications?status=${s}`}
            className="card"
            style={status === s ? { borderColor: 'var(--info)', background: 'var(--info-bg)' } : undefined}
          >
            <div className="text-xs text-neutral-500">{STATUS_LABEL[s]}</div>
            <div className="mt-1 text-2xl font-semibold">{counts[s] ?? 0}</div>
          </Link>
        ))}
      </div>

      <Table>
        <TableHead>
          <th className="th">เวลา</th>
          <th className="th">ชนิด</th>
          <th className="th">ออเดอร์</th>
          <th className="th">ลูกค้า</th>
          <th className="th">สถานะ</th>
          <th className="th text-right">ครั้งที่ลอง</th>
          <th className="th">สาเหตุที่พลาด</th>
        </TableHead>
        <tbody>
          {(rows ?? []).map((r) => (
            <TableRow key={r.id as string}>
              <td className="td text-neutral-500">{formatDateTime(r.created_at as string)}</td>
              <td className="td">{TYPE_LABEL[r.type as string] ?? (r.type as string)}</td>
              <td className="td font-mono text-xs">{(r.order_no as string) ?? '—'}</td>
              <td className="td text-neutral-600">{(r.customer_name as string) ?? '—'}</td>
              <td className="td">
                <span className={`badge ${STATUS_STYLE[r.status as string] ?? ''}`}>
                  {STATUS_LABEL[r.status as string] ?? (r.status as string)}
                </span>
              </td>
              <td className="td text-right text-neutral-500">{Number(r.attempts)}</td>
              <td className="td max-w-xs truncate text-xs text-red-600" title={(r.last_error as string) ?? ''}>
                {(r.last_error as string) ?? ''}
              </td>
            </TableRow>
          ))}
          {!rows?.length && (
            <EmptyRow colSpan={7}>
              {status
                ? `ไม่มีการแจ้งเตือนสถานะ "${STATUS_LABEL[status] ?? status}"`
                : 'ยังไม่มีการแจ้งเตือน — จะขึ้นเมื่อมีออเดอร์เปลี่ยนสถานะ'}
            </EmptyRow>
          )}
        </tbody>
      </Table>

      <p className="text-xs text-neutral-500">
        สถานะ &ldquo;ข้าม&rdquo; คือลูกค้าที่ยังไม่ได้ผูกบัญชี LINE (เช่นบัญชีทดสอบที่เข้าผ่านเบราว์เซอร์)
        — ระบบไม่พยายามส่งให้เพราะไม่มีปลายทาง
      </p>
    </div>
  )
}
