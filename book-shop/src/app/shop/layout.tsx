import Link from 'next/link'
import { getCustomer } from '@/lib/customer/session'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from '@/components/SignOutButton'

/**
 * ไอคอนวาดเป็น SVG ในไฟล์นี้เลย ไม่ดึงไลบรารีไอคอนเข้ามา
 * ทั้งหน้าร้านใช้แค่สามอัน การลงไลบรารีเพื่อสามอันคือให้ลูกค้า
 * โหลดของเพิ่มโดยไม่ได้อะไรกลับมา
 */
function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]" aria-hidden>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
    </svg>
  )
}

function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]" aria-hidden>
      <path d="M5 3.5h14v17l-2.3-1.5-2.4 1.5-2.3-1.5-2.4 1.5L7.3 19 5 20.5z" />
      <path d="M9 8.5h6M9 12.5h6" />
    </svg>
  )
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]" aria-hidden>
      <path d="M3.5 4h2l2.2 10.5h9.6L19.5 7H7" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="16.5" cy="19" r="1.4" />
    </svg>
  )
}

/**
 * ปุ่มในแถบบน — ไอคอนกับป้ายซ้อนกัน
 *
 * ไอคอนอย่างเดียวประหยัดที่ก็จริง แต่ลูกค้าต้องเดาความหมาย
 * ป้ายภาษาไทยสั้นๆ ใต้ไอคอนกินที่เพิ่มไม่กี่พิกเซลแต่ตัดการเดาทิ้งได้หมด
 *
 * ขนาดขั้นต่ำ 44px ทั้งกว้างและสูง ตามระยะที่นิ้วคนแตะได้โดยไม่พลาด
 */
function NavItem({
  href,
  label,
  badge,
  children,
}: {
  href: string
  label: string
  badge?: number
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="relative flex min-h-[44px] min-w-[52px] flex-col items-center justify-center
                 gap-0.5 rounded-xl px-1 transition active:scale-95"
      style={{ color: 'var(--ink-muted)' }}
    >
      {children}
      <span className="text-[10px] leading-none">{label}</span>
      {badge != null && badge > 0 && (
        <span
          className="tabular absolute right-1 top-0.5 min-w-[18px] rounded-full px-1
                     text-[10px] font-bold leading-[18px]"
          style={{ background: 'var(--line-green)', color: 'var(--on-green)' }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}

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
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          borderColor: 'var(--line)',
          background: 'color-mix(in srgb, var(--paper) 92%, transparent)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-1.5">
          <Link
            href="/shop"
            className="flex min-h-[44px] items-center rounded-xl px-2 text-[17px] font-bold"
            style={{ color: 'var(--ink)' }}
          >
            ร้านหนังสือ
          </Link>

          <nav className="flex items-center">
            <NavItem href="/shop/favourites" label="รายการโปรด"><IconStar /></NavItem>
            <NavItem href="/shop/orders" label="ออเดอร์"><IconReceipt /></NavItem>
            <NavItem href="/shop/cart" label="ตะกร้า" badge={cartCount}><IconCart /></NavItem>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>

      {/* ปุ่มออกจากระบบวางไว้ท้ายหน้า ไม่ใช่ในแถบบน
          เพราะเป็นสิ่งที่ลูกค้าใช้นานๆ ครั้ง แต่เดิมมันนั่งอยู่ข้างปุ่มตะกร้า
          ซึ่งเป็นปุ่มที่กดบ่อยที่สุด เสี่ยงกดพลาดแล้วหลุดออกกลางคัน */}
      {customer && (
        <footer className="mx-auto max-w-3xl px-4 pb-8 pt-2 text-center">
          <SignOutButton
            redirectTo="/shop"
            clearDevCustomer
            label="ออกจากระบบ"
            className="min-h-[44px] rounded-xl px-4 text-[13px]"
          />
          <p className="t-micro mt-3">ฟอนต์ LINE Seed โดย LY Corporation</p>
        </footer>
      )}
    </div>
  )
}
