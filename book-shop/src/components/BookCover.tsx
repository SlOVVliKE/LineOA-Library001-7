/**
 * รูปปกหนังสือ พร้อมภาพแทนตอนยังไม่มีปก
 *
 * ภาพแทนวาดเป็นสันหนังสือด้วย CSS แทนการเขียนคำว่า "ไม่มีปก"
 * เพราะคำนั้นไม่ได้บอกอะไรที่ลูกค้าใช้ตัดสินใจได้เลย มีแต่จะดึงสายตา
 * ออกจากชื่อเรื่องกับราคา รูปทรงเงียบๆ ทำหน้าที่เว้นที่ไว้ได้ดีกว่า
 */
export function BookCover({
  url,
  className = '',
}: {
  url?: string | null
  className?: string
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        loading="lazy"
        className={`object-cover ${className}`}
        style={{ background: 'var(--paper-sunken)' }}
      />
    )
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: 'var(--paper-sunken)' }}
      aria-hidden
    >
      {/* เส้นตั้งใกล้ขอบซ้าย แทนสันหนังสือ */}
      <span
        className="absolute inset-y-0 left-[18%] w-px"
        style={{ background: 'var(--line-strong)' }}
      />
      {/* เส้นนอนสองเส้น แทนตัวหนังสือบนปก */}
      <span
        className="absolute left-[32%] right-[18%] top-[34%] h-px"
        style={{ background: 'var(--line-strong)' }}
      />
      <span
        className="absolute left-[32%] right-[36%] top-[44%] h-px"
        style={{ background: 'var(--line-strong)' }}
      />
    </div>
  )
}
