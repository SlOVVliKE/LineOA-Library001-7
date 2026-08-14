import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { NotifyButton } from './NotifyButton'

export const dynamic = 'force-dynamic'

export default async function FavouritesDemandPage() {
  await requirePermission('book.write')
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('v_favourite_demand')
    .select('*')
    .order('fav_count', { ascending: false })

  const list = rows ?? []
  const totalWaiting = list.reduce((s, r) => s + Number(r.waiting_count), 0)

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">ลูกค้าสนใจ (ติดดาว)</h1>
        <p className="mt-1 text-sm text-neutral-600">
          เล่มที่มีคนติดดาวเยอะคือสัญญาณว่าควรสั่งเข้าก่อน
          ส่วนปุ่มแจ้งเตือนใช้บอกลูกค้าเมื่อของเข้าแล้ว
        </p>
      </div>

      {list.length === 0 ? (
        <p className="card text-center text-sm text-neutral-500">
          ยังไม่มีลูกค้าติดดาวหนังสือเล่มไหน
        </p>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-medium">หนังสือ</th>
                  <th className="px-3 py-2 text-right font-medium">ติดดาว</th>
                  <th className="px-3 py-2 text-right font-medium">ยังไม่ได้แจ้ง</th>
                  <th className="px-3 py-2 text-right font-medium">คงเหลือ</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const available = Number(r.available_to_sell)
                  const waiting = Number(r.waiting_count)
                  return (
                    <tr key={r.book_id as string} className="border-t border-neutral-200">
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/books/${r.book_id}`}
                          className="font-medium text-teal-800 hover:underline"
                        >
                          {r.title as string}
                        </Link>
                        <div className="text-xs text-neutral-500">
                          {(r.author as string) ?? '—'} · {r.sku as string}
                          {!r.is_active && ' · เลิกจำหน่าย'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{r.fav_count as number}</td>
                      <td className="px-3 py-2 text-right">
                        {waiting > 0 ? (
                          <span className="text-amber-700">{waiting}</span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {available > 0 ? (
                          <span className="text-teal-700">{available}</span>
                        ) : (
                          <span className="text-neutral-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <NotifyButton
                          bookId={r.book_id as string}
                          waiting={waiting}
                          available={available}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalWaiting > 0 && (
            <p className="card text-sm text-neutral-600">
              ถ้าแจ้งทุกคนที่รออยู่ตอนนี้จะใช้โควตา push ประมาณ{' '}
              <strong>{totalWaiting} ข้อความ</strong> จากโควตาฟรี 300 ข้อความ/เดือน
              ซึ่งใช้ร่วมกับแจ้งเตือนออเดอร์ (ประมาณ 3 ข้อความต่อออเดอร์)
            </p>
          )}
        </>
      )}
    </div>
  )
}
