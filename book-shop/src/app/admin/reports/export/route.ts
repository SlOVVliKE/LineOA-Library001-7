import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, can } from '@/lib/auth/permissions'
import { toCsv, csvResponse, defaultDateRange } from '@/lib/csv'

export const dynamic = 'force-dynamic'

/**
 * ดาวน์โหลดรายงานกำไรเป็น CSV
 *
 * ตรวจสิทธิ์ที่นี่ด้วย ไม่ใช่แค่ซ่อนปุ่มในหน้า
 * เพราะ URL นี้เปิดตรงได้ ใครก็พิมพ์เองได้
 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!can(user, 'cost.read')) {
    return new Response('ไม่มีสิทธิ์เข้าถึงรายงานนี้', { status: 403 })
  }

  const url = new URL(request.url)
  const fallback = defaultDateRange(30)
  const from = url.searchParams.get('from') ?? fallback.from
  const to = url.searchParams.get('to') ?? fallback.to
  const kind = url.searchParams.get('kind') ?? 'orders'

  const supabase = await createClient()
  const rows: (string | number | null)[][] = []
  let filename: string

  if (kind === 'books') {
    const { data } = await supabase
      .from('v_book_performance')
      .select('*')
      .order('gross_profit', { ascending: false })

    filename = `กำไรรายเล่ม_${from}_ถึง_${to}.csv`
    rows.push(['SKU', 'ชื่อหนังสือ', 'ผู้แต่ง', 'ขายได้ (เล่ม)', 'รายได้', 'ต้นทุน', 'กำไรขั้นต้น', 'ขายครั้งล่าสุด'])
    for (const r of data ?? []) {
      rows.push([
        r.sku as string,
        r.title as string,
        (r.author as string) ?? '',
        Number(r.qty_sold),
        Number(r.revenue).toFixed(2),
        Number(r.cogs).toFixed(2),
        Number(r.gross_profit).toFixed(2),
        r.last_sold_at ? String(r.last_sold_at).slice(0, 10) : '',
      ])
    }
  } else if (kind === 'daily') {
    const { data } = await supabase
      .from('v_daily_sales')
      .select('*')
      .gte('sale_date', from)
      .lte('sale_date', to)
      .order('sale_date')

    filename = `ยอดขายรายวัน_${from}_ถึง_${to}.csv`
    rows.push(['วันที่', 'ช่องทาง', 'จำนวนออเดอร์', 'ยอดขาย', 'ต้นทุนสินค้า', 'กำไรขั้นต้น'])
    for (const r of data ?? []) {
      rows.push([
        String(r.sale_date),
        r.channel_code as string,
        Number(r.order_count),
        Number(r.revenue).toFixed(2),
        Number(r.cogs ?? 0).toFixed(2),
        Number(r.gross_profit ?? 0).toFixed(2),
      ])
    }
  } else {
    // รายออเดอร์ — ละเอียดที่สุด ส่งให้นักบัญชีได้เลย
    const { data } = await supabase
      .from('v_order_profit')
      .select('*')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`)
      .order('created_at')

    filename = `กำไรรายออเดอร์_${from}_ถึง_${to}.csv`
    rows.push([
      'เลขที่ออเดอร์', 'วันที่สั่ง', 'วันที่ชำระเงิน', 'ช่องทาง', 'สถานะ',
      'ค่าสินค้า', 'ส่วนลด', 'ค่าส่งที่เก็บ', 'ยอดรวม',
      'ต้นทุนสินค้า', 'ค่าส่งที่จ่ายจริง', 'ค่าธรรมเนียมช่องทาง',
      'กำไรขั้นต้น', 'อัตรากำไร (%)',
    ])
    for (const r of data ?? []) {
      rows.push([
        r.order_no as string,
        String(r.created_at).slice(0, 10),
        r.paid_at ? String(r.paid_at).slice(0, 10) : '',
        r.channel_name as string,
        r.status as string,
        Number(r.subtotal).toFixed(2),
        Number(r.discount).toFixed(2),
        Number(r.shipping_fee).toFixed(2),
        Number(r.total).toFixed(2),
        r.cogs_total != null ? Number(r.cogs_total).toFixed(2) : '',
        r.shipping_actual_cost != null ? Number(r.shipping_actual_cost).toFixed(2) : '',
        Number(r.channel_fee).toFixed(2),
        Number(r.gross_profit).toFixed(2),
        r.margin_pct != null ? Number(r.margin_pct).toFixed(2) : '',
      ])
    }
  }

  if (rows.length === 1) rows.push(['ไม่มีข้อมูลในช่วงวันที่เลือก'])

  return csvResponse(toCsv(rows), encodeURIComponent(filename))
}
