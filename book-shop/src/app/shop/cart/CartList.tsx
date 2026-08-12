'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateCartItem } from '../actions'
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
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="card flex gap-3">
          <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400">
            {item.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.coverUrl} alt="" className="h-full w-full rounded object-cover" />
            ) : (
              'ไม่มีปก'
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{item.title}</div>
            {item.isPreorder && (
              <span className="badge bg-amber-50 text-amber-700">สั่งจอง</span>
            )}
            <div className="mt-1 text-sm text-neutral-600">{formatBaht(item.price)}</div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center rounded-lg border border-neutral-300">
                <button
                  className="px-3 py-1.5 leading-none"
                  onClick={() => change(item.id, item.qty - 1)}
                  disabled={pending}
                >
                  −
                </button>
                <span className="w-8 text-center text-sm">{item.qty}</span>
                <button
                  className="px-3 py-1.5 leading-none"
                  onClick={() => change(item.id, item.qty + 1)}
                  disabled={pending}
                >
                  +
                </button>
              </div>

              <button
                className="text-xs text-neutral-500 hover:text-red-600"
                onClick={() => change(item.id, 0)}
                disabled={pending}
              >
                ลบ
              </button>
            </div>
          </div>

          <div className="shrink-0 self-end text-right font-medium">
            {formatBaht(item.qty * item.price)}
          </div>
        </div>
      ))}
    </div>
  )
}
