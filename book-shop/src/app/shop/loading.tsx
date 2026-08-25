/**
 * โครงหน้าระหว่างรอข้อมูล
 *
 * หน้าร้านเป็น force-dynamic ทุกหน้า เซิร์ฟเวอร์ต้องคุยกับฐานข้อมูลก่อน
 * ถึงจะตอบอะไรกลับมาได้ วัดจากเว็บจริงได้ราว 2 วินาที
 *
 * ถ้าไม่มีไฟล์นี้ ตอนกดจากหน้าหนึ่งไปอีกหน้าจะค้างอยู่ที่หน้าเดิมเฉยๆ
 * จนกว่าข้อมูลจะมา ลูกค้าจะไม่รู้ว่ากดติดหรือเปล่าแล้วกดซ้ำ
 * มีโครงนี้แล้วหน้าจะเปลี่ยนทันทีและเห็นว่ากำลังโหลดอยู่
 *
 * รูปทรงทำให้ใกล้เคียงการ์ดจริง เพื่อไม่ให้หน้ากระโดดตอนข้อมูลมาถึง
 */
function Bar({ w, h = 'h-3' }: { w: string; h?: string }) {
  return (
    <div
      className={`${w} ${h} animate-pulse rounded`}
      style={{ background: 'var(--paper-sunken)' }}
    />
  )
}

export default function ShopLoading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="กำลังโหลด">
      <div className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--paper-sunken)' }} />

      <div className="card space-y-3">
        <Bar w="w-20" />
        <div className="flex gap-2">
          <Bar w="w-24" h="h-10" />
          <Bar w="w-24" h="h-10" />
          <Bar w="w-28" h="h-10" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card flex gap-3.5">
            <div
              className="h-[108px] w-[72px] shrink-0 animate-pulse rounded-lg"
              style={{ background: 'var(--paper-sunken)' }}
            />
            <div className="flex flex-1 flex-col gap-2">
              <Bar w="w-4/5" h="h-4" />
              <Bar w="w-1/2" />
              <div className="mt-auto space-y-2">
                <Bar w="w-24" h="h-6" />
                <Bar w="w-32" h="h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
