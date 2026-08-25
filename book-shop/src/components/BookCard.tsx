import Link from 'next/link'
import { BookCover } from './BookCover'
import { formatBaht, formatDate } from '@/lib/money'

export interface BookCardData {
  id: string
  title: string
  author?: string | null
  cover_url?: string | null
  sell_price: number
  stock_mode?: string | null
  preorder_release_date?: string | null
  available_to_sell?: number | null
}

/**
 * การ์ดหนังสือในรายการ ใช้ร่วมกันทั้งหน้าร้านและหน้ารายการโปรด
 *
 * ลำดับสายตาที่ตั้งใจ: ปก → ชื่อเรื่อง → ราคา → สถานะ
 * ราคาใหญ่กว่าชื่อเรื่องเพราะคนซื้อของมองราคาก่อนตัดสินใจอ่านชื่อ
 * ของเดิมราคาเล็กกว่าชื่อ ซึ่งกลับลำดับที่คนใช้จริง
 *
 * ชื่อเรื่องใช้ line-clamp ไม่ใช่ truncate
 * ภาษาไทยไม่มีช่องว่างระหว่างคำ การตัดบรรทัดเดียวจบด้วยจุดไข่ปลา
 * มักตัดกลางคำจนอ่านไม่ออก เช่น "เมื่อสายลมเปลี่ยน..." ยังพอเดาได้
 * แต่ "ปลายทางที่ไม่..." เดาไม่ออกเลย สองบรรทัดจึงปลอดภัยกว่ามาก
 */
export function BookCard({ book }: { book: BookCardData }) {
  const available = Number(book.available_to_sell ?? 0)
  const isPreorder = book.stock_mode !== 'stock'
  const soldOut = !isPreorder && available <= 0

  return (
    <Link
      href={`/shop/books/${book.id}`}
      className="card flex gap-3.5 transition active:scale-[0.99]"
    >
      <BookCover
        url={book.cover_url}
        className="h-[108px] w-[72px] shrink-0 rounded-lg"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="t-title line-clamp-2">{book.title}</h3>

        {book.author && (
          <p className="t-meta mt-0.5 line-clamp-1">{book.author}</p>
        )}

        {/* ดันราคากับสถานะไปชิดล่างเสมอ การ์ดในแถวเดียวกันจึงเรียงตรงกัน
            แม้ชื่อเรื่องจะยาวไม่เท่ากัน */}
        <div className="mt-auto pt-2">
          <div className="price">{formatBaht(Number(book.sell_price))}</div>

          <div className="mt-1.5">
            {isPreorder ? (
              <span className="badge badge-warn">
                เปิดจอง · ของเข้า {formatDate(book.preorder_release_date as string)}
              </span>
            ) : soldOut ? (
              <span className="badge badge-quiet">สินค้าหมด</span>
            ) : (
              <span className="badge badge-ok">
                พร้อมส่ง · เหลือ {available} เล่ม
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
