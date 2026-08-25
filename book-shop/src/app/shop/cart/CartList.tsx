'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateCartItem } from '../actions'
import { BookCover } from '@/components/BookCover'
import { formatBaht } from '@/lib/money'

interface Item {
  id: string
  qty: number
  bookId: string
  title: string
  price: number
  coverUrl: string | null
  isPreorder: boolean
}

export function CartList({ items }: { items: Item[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function change(itemId: string, qty: number) {
    startTransition(async () => {
      await updateCartItem(itemId, qty)
      router.refresh()
    })
  }

  return (
    <div className={`space-y-2.5 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      {items.map((item) => (
        <div key={item.id} className="card flex gap-3.5">
          <Link href={`/shop/books/${item.bookId}`} prefetch={false} className="shrink-0">
            <BookCover url={item.coverUrl} className="h-[92px] w-[62px] rounded-lg" />
          </Link>

          <div className="flex min-w-0 flex-1 flex-col">
            <Link href={`/shop/books/${item.bookId}`} prefetch={false}>
              <h3 className="t-title line-clamp-2 text-[15px]">{item.title}</h3>
            </Link>
            {item.isPreorder && (
              <span className="badge badge-warn mt-1 self-start">สั่งจอง</span>
            )}

            {/* ราคารวมของรายการนี้ อยู่ใกล้ตัวเลือกจำนวน
                ของเดิมวางไว้มุมขวาล่างสุดของการ์ด ห่างจากปุ่มบวกลบ
                ทำให้กดเปลี่ยนจำนวนแล้วต้องกวาดตาไปอีกมุมเพื่อดูว่าเป็นเท่าไหร่ */}
            <div className="mt-auto flex items-end justify-between gap-3 pt-2.5">
              <div
                className="flex items-center rounded-xl border"
                style={{ borderColor: 'var(--line-strong)' }}
              >
                <button
                  aria-label="ลดจำนวน"
                  className="h-11 w-11 text-lg leading-none transition active:scale-90 disabled:opacity-30"
                  onClick={() => change(item.id, item.qty - 1)}
                  disabled={pending || item.qty <= 1}
                >
                  −
                </button>
                <span className="tabular w-8 text-center text-[15px]">{item.qty}</span>
                <button
                  aria-label="เพิ่มจำนวน"
                  className="h-11 w-11 text-lg leading-none transition active:scale-90 disabled:opacity-30"
                  onClick={() => change(item.id, item.qty + 1)}
                  disabled={pending}
                >
                  +
                </button>
              </div>

              <div className="price-sm">{formatBaht(item.qty * item.price)}</div>
            </div>

            <div className="mt-1.5 flex items-center justify-between">
              <span className="t-micro">เล่มละ {formatBaht(item.price)}</span>
              <button
                className="min-h-[36px] px-1 text-[13px] underline underline-offset-2"
                style={{ color: 'var(--ink-faint)' }}
                onClick={() => change(item.id, 0)}
                disabled={pending}
              >
                เอาออก
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
