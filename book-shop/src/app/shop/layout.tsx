import Link from 'next/link'
import { getCustomer } from '@/lib/customer/session'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/SignOutButton'

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomer()

  let cartCount = 0
  if (customer) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('cart')
      .select('cart_items(qty)')
      .eq('user_id', customer.id)
      .maybeSingle()
    const items = (data?.cart_items ?? []) as { qty: number }[]
    cartCount = items.reduce((s, i) => s + i.qty, 0)
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/shop" className="font-semibold">ร้านหนังสือ</Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/shop/favourites"
              className="rounded-lg px-2 py-1.5 text-neutral-600 hover:bg-neutral-100"
              title="รายการโปรด"
            >
              <span aria-hidden>★</span>
              <span className="sr-only">รายการโปรด</span>
            </Link>
            <Link href="/shop/orders" className="rounded-lg px-3 py-1.5 text-neutral-600 hover:bg-neutral-100">
              ออเดอร์ของฉัน
            </Link>
            <Link href="/shop/cart" className="rounded-lg px-3 py-1.5 font-medium text-teal-700 hover:bg-teal-50">
              ตะกร้า{cartCount > 0 && ` (${cartCount})`}
            </Link>
            {customer && (
              <SignOutButton
                redirectTo="/shop"
                clearDevCustomer
                label="ออก"
                className="rounded-lg px-2 py-1.5 text-xs text-neutral-400 hover:text-red-600"
              />
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  )
}
