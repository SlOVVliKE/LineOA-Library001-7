import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, can } from '@/lib/auth/permissions'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { defaultDateRange } from '@/lib/csv'
import { StockPanels } from './StockPanels'
import { OverviewTab } from './OverviewTab'
import { LotsTab } from './LotsTab'
import { MovementTab } from './MovementTab'

export const dynamic = 'force-dynamic'

type TabKey = 'summary' | 'lots' | 'movement'

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!can(user, 'lot.write') && !can(user, 'cost.read')) redirect('/admin/forbidden')

  const showCost = can(user, 'cost.read')
  const sp = await searchParams
  const fallback = defaultDateRange(30)
  const from = sp.from ?? fallback.from
  const to = sp.to ?? fallback.to

  // "ล็อตและต้นทุน" มีแต่ตัวเลขต้นทุน ถ้าไม่มีสิทธิ์ดูต้นทุนก็ไม่มีอะไรให้ดูในแท็บนี้
  const TABS: { key: TabKey; label: string }[] = [
    { key: 'summary', label: 'สต็อกคงเหลือ' },
    ...(showCost ? [{ key: 'lots' as const, label: 'ล็อตและต้นทุน' }] : []),
    { key: 'movement', label: 'ความเคลื่อนไหว' },
  ]
  const requested = (sp.tab ?? 'summary') as TabKey
  const tab: TabKey = TABS.some((t) => t.key === requested) ? requested : 'summary'

  const supabase = await createClient()
  const [{ data: books }, { data: adjustBooks }] = await Promise.all([
    supabase.from('books').select('id, sku, title').eq('is_active', true).order('title'),
    supabase.from('v_stock_summary').select('book_id, sku, title, on_hand').order('title'),
  ])

  const qs = (t: TabKey) => `?tab=${t}${sp.from ? `&from=${sp.from}` : ''}${sp.to ? `&to=${sp.to}` : ''}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">สต็อกและต้นทุน</h1>
        <StockPanels
          books={(books ?? []) as { id: string; sku: string; title: string }[]}
          adjustBooks={(adjustBooks ?? []) as { book_id: string; sku: string; title: string; on_hand: number }[]}
        />
      </div>

      <div className="a-tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={qs(t.key)}
            className={`a-tab ${tab === t.key ? 'a-tab-active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ตัวกรองช่วงวันที่ใช้ร่วมกันระหว่างแท็บที่มีข้อมูลตามช่วงวันที่ (ล็อต/ความเคลื่อนไหว) —
          ค่า from/to เก็บใน URL เดียวกัน สลับแท็บแล้วช่วงวันที่ไม่รีเซ็ต
          "สต็อกคงเหลือ" เป็นตัวเลข ณ ปัจจุบัน ไม่มีมิติเวลาให้กรอง จึงไม่โชว์ตัวกรองนี้ */}
      {tab !== 'summary' && <DateRangeFilter from={from} to={to} />}

      {tab === 'summary' && <OverviewTab showCost={showCost} />}
      {tab === 'lots' && showCost && <LotsTab from={from} to={to} />}
      {tab === 'movement' && <MovementTab from={from} to={to} showCost={showCost} />}
    </div>
  )
}
