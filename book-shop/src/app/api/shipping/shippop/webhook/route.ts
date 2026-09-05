import { createAdminClient } from '@/lib/supabase/admin'
import { shippopAdapter } from '@/lib/shipping/shippop'

export const dynamic = 'force-dynamic'

/**
 * Webhook รับสถานะพัสดุจาก ShipPop
 *
 * **URL นี้ต้องให้ทีม Dev SHIPPOP ลงทะเบียนให้ทาง LINE (https://lin.ee/O1ngU4e)**
 * ตั้งเองจากหน้าเว็บไม่ได้ และ ShipPop ไม่ได้รับค่านี้ตอนจอง — ดู shippopWebhookUrl()
 * ใน lib/shipping/shippop.ts ว่าต้องส่ง URL หน้าตาแบบไหนไปให้เขา
 *
 * ต่างจาก webhook ของ LINE ตรงที่ **ShipPop ไม่ได้เซ็นลายเซ็นมาให้** ด่านเดียวที่มีคือ
 * token ลับที่ฝังอยู่ใน URL ที่ลงทะเบียนไว้
 * ถ้า SHIPPOP_WEBHOOK_SECRET ไม่ได้ตั้ง จะปฏิเสธทุก request — ไม่เปิดรับแบบไม่มีด่าน
 *
 * เก็บของดิบลง shipment_events.raw ทุกครั้งแม้อ่านไม่ออก และตอบ { success: 1 } กลับไป
 * เสมอเมื่อผ่านด่าน token แล้ว เพื่อไม่ให้ ShipPop ยิงซ้ำไม่เลิก
 */
export async function POST(request: Request) {
  const raw = await request.text()

  // ShipPop ยิงกลับมาที่ URL ที่มี ?token=... เพราะแนบ custom header ให้เราไม่ได้
  const token = new URL(request.url).searchParams.get('token')
  const headers = new Headers(request.headers)
  if (token) headers.set('x-shippop-token', token)

  if (!shippopAdapter.verifyWebhook(raw, headers)) {
    return Response.json({ error: 'ไม่ได้รับอนุญาต' }, { status: 401 })
  }

  const events = shippopAdapter.parseWebhook(parseBody(raw, request.headers.get('content-type')))
  if (!events.length) {
    // อ่านไม่ออกก็ยังตอบ success ตามที่ ShipPop คาดหวัง แต่ log ของดิบไว้ให้ไล่ดูได้
    console.warn('[shippop] อ่าน webhook ไม่ออก:', raw.slice(0, 500))
    return Response.json({ success: 1 })
  }

  const supabase = createAdminClient()
  let handled = 0

  for (const event of events) {
    const { data: shipment } = await supabase
      .from('shipments')
      .select('id, order_id')
      .eq('tracking_no', event.trackingNo)
      .maybeSingle()

    // เลขพัสดุที่ไม่ใช่ของเรา (หรือมาก่อนที่เราบันทึกเสร็จ) — ข้ามไป ไม่ใช่ error
    if (!shipment) continue

    await supabase.from('shipment_events').insert({
      shipment_id: shipment.id,
      status: event.status,
      description: event.description,
      occurred_at: event.occurredAt.toISOString(),
      raw: event.raw as Record<string, unknown>,
    })

    await supabase
      .from('shipments')
      .update({
        status: event.status,
        ...(event.status === 'delivered' ? { delivered_at: event.occurredAt.toISOString() } : {}),
      })
      .eq('id', shipment.id)

    // อัปเดตออเดอร์เฉพาะตอนส่งถึงจริงเท่านั้น สถานะระหว่างทางไม่ต้องไปยุ่งกับออเดอร์
    // (ออเดอร์เปลี่ยนเป็น shipped ไปแล้วตอนแอดมินกดบันทึกการจัดส่ง)
    if (event.status === 'delivered') {
      await supabase
        .from('orders')
        .update({ status: 'delivered', delivered_at: event.occurredAt.toISOString() })
        .eq('id', shipment.order_id)
    }

    handled++
  }

  // ShipPop คาดหวัง { "success": 1 } กลับไป (ตามตัวอย่าง response ในเอกสารหัวข้อ 7.1)
  return Response.json({ success: 1, handled })
}

/**
 * ShipPop อาจยิงมาเป็น JSON หรือ form-urlencoded (เอกสารไม่ได้ระบุชัด)
 * จึงลองอ่านทั้งสองแบบ แทนที่จะยึดอย่างเดียวแล้วพังเงียบ
 */
function parseBody(raw: string, contentType: string | null): unknown {
  if (contentType?.includes('json')) {
    try {
      return JSON.parse(raw)
    } catch {
      // ตกไปลองแบบ form ข้างล่าง
    }
  }

  try {
    const parsed = JSON.parse(raw)
    return parsed
  } catch {
    return Object.fromEntries(new URLSearchParams(raw))
  }
}
