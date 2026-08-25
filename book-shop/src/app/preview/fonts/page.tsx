import { formatBaht } from '@/lib/money'

export const metadata = { title: 'เทียบฟอนต์' }

/**
 * หน้าเทียบฟอนต์ — ไม่มีลิงก์จากที่ไหน เปิดด้วยการพิมพ์ URL เท่านั้น
 *
 * ทำไมต้องเปิดบนมือถือจริง:
 * ฟอนต์ไทยตัดสินจากภาพบนจอคอมไม่ได้ เพราะความละเอียดจอ ระยะสายตา
 * และวิธีที่แต่ละระบบเรนเดอร์ตัวอักษรต่างกันมาก โดยเฉพาะวรรณยุกต์เล็กๆ
 * ที่บนจอคอมดูคมแต่บนมือถือกลายเป็นจุดเบลอ
 *
 * เปิดผ่านเบราว์เซอร์ในแอป LINE ด้วยจะดีที่สุด เพราะเป็นที่ที่ลูกค้าเห็นจริง
 *
 * ลบทิ้งได้เมื่อเลือกฟอนต์เสร็จแล้ว
 */

const SAMPLES = [
  { label: 'ชื่อหนังสือ', text: 'เมื่อสายลมเปลี่ยนทิศ', size: 17, weight: 500 },
  { label: 'ชื่อยาวที่มีวรรณยุกต์เยอะ', text: 'ปลายทางที่ไม่มีชื่อ เล่มสอง', size: 17, weight: 500 },
  { label: 'ผู้แต่ง', text: 'ณัฐพงษ์ ศรีวัฒน์', size: 13, weight: 400 },
  { label: 'สถานะสินค้า', text: 'เปิดจอง · ของเข้า 28 ก.ย. 2569', size: 13, weight: 400 },
]

/* น้ำหนักตัวอักษร — จุดต่างที่สำคัญที่สุดระหว่างสองฟอนต์
   IBM Plex มี 400/500/600 ครบ ส่วน LINE Seed มีแค่ 400 กับ 700
   แถวนี้ทำให้เห็นว่าเวลาสั่ง 500 แล้วแต่ละฟอนต์ให้อะไรกลับมา */
const WEIGHTS = [400, 500, 600, 700]

const PARAGRAPH =
  'ภาคต่อของ "เมื่อสายลมเปลี่ยนทิศ" ที่ผู้อ่านรอคอย เปิดจองล่วงหน้าแล้ววันนี้ ' +
  'จัดส่งตามลำดับการจอง ผู้ที่ชำระเงินก่อนจะได้รับหนังสือก่อนเสมอ'

function Column({ font, name, note }: { font: string; name: string; note: string }) {
  return (
    <div className="card" style={{ fontFamily: font }}>
      <div className="mb-4 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
        <div className="text-base font-medium">{name}</div>
        <div className="mt-0.5 text-xs" style={{ color: 'var(--ink-faint)' }}>{note}</div>
      </div>

      {SAMPLES.map((s) => (
        <div key={s.label} className="mb-3">
          <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>{s.label}</div>
          <div style={{ fontSize: s.size, fontWeight: s.weight, lineHeight: 'var(--leading-thai)' }}>
            {s.text}
          </div>
        </div>
      ))}

      <div className="mb-3">
        <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>เรื่องย่อ — ดูว่าอ่านยาวๆ แล้วล้าตาไหม</div>
        <p className="text-[15px]" style={{ lineHeight: 'var(--leading-thai)' }}>{PARAGRAPH}</p>
      </div>

      <div className="mb-3">
        <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>
          น้ำหนักตัวอักษร — ดูว่าแต่ละระดับต่างกันจริงไหม
        </div>
        {WEIGHTS.map((w) => (
          <div key={w} style={{ fontWeight: w, fontSize: 16 }}>
            {w} · เมื่อสายลมเปลี่ยนทิศ
          </div>
        ))}
      </div>

      <div className="mb-3">
        <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>ราคาและตัวเลข</div>
        <div className="price">{formatBaht(1295)}</div>
        <div className="tabular text-sm" style={{ color: 'var(--ink-muted)' }}>
          เหลือ 46 เล่ม · OD-2026-000001
        </div>
      </div>

      <button className="btn-primary w-full" style={{ fontFamily: font }}>
        ใส่ตะกร้า
      </button>
    </div>
  )
}

export default function FontPreviewPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">เทียบฟอนต์ไทย</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
          เปิดหน้านี้บนมือถือผ่านแอป LINE แล้วเลื่อนดูทั้งสองคอลัมน์
          จุดที่ควรดูคือวรรณยุกต์กับสระบน (ไม้เอก ไม้โท สระอิ อี) ว่าคมชัดหรือเบลอ
          และชื่อหนังสือที่ยาวขึ้นบรรทัดใหม่แล้วอ่านสบายไหม
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Column
          font="'IBM Plex Sans Thai', sans-serif"
          name="IBM Plex Sans Thai"
          note="มีน้ำหนัก 400 500 600 ครบ ไล่ระดับได้ละเอียดกว่า"
        />
        <Column
          font="'LINE Seed Sans TH', sans-serif"
          name="LINE Seed Sans TH"
          note="มีน้ำหนัก 400 กับ 700 เท่านั้น — 500 กับ 600 จะถูกปัดไปใช้ตัวที่ใกล้ที่สุด"
        />
      </div>

      <div className="card text-sm" style={{ color: 'var(--ink-muted)' }}>
        <p className="mb-2 font-medium" style={{ color: 'var(--ink)' }}>สิ่งที่ต้องชั่งใจ</p>
        <p className="mb-2">
          LINE Seed เข้ากับ LINE ที่สุดและตัวอักษรอ่านง่าย แต่มีน้ำหนักแค่ 400 กับ 700
          แถว &ldquo;น้ำหนักตัวอักษร&rdquo; ข้างบนจะเห็นว่า 400 กับ 500 หน้าตาเหมือนกัน
          และ 600 กับ 700 ก็เหมือนกัน เพราะไม่มีไฟล์ให้เลือกตรงกลาง
        </p>
        <p>
          แปลว่าถ้าเลือก LINE Seed ชื่อหนังสือจะเน้นด้วยน้ำหนักไม่ได้
          ต้องเน้นด้วยขนาดหรือสีแทน ซึ่งทำได้และบางทีอ่านสบายกว่าด้วยซ้ำ
          เพราะตัวหนาในภาษาไทยมักทึบจนวรรณยุกต์ติดกัน
        </p>
      </div>
    </div>
  )
}
