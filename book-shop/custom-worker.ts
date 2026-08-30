/**
 * Worker หลักของเว็บ — ห่อ handler ที่ OpenNext สร้างให้ แล้วเติม cron เข้าไป
 *
 * ทำไมต้องมีไฟล์นี้
 * ตัว worker ที่ `opennextjs-cloudflare build` สร้างให้ export แค่ `fetch`
 * ซึ่งพอสำหรับเสิร์ฟหน้าเว็บ แต่ไม่มีที่ให้ Cron Trigger เกาะ
 * ของเดิมบน Netlify งานตามเวลาอยู่ใน netlify/functions/*.mjs ซึ่ง Cloudflare ไม่รู้จัก
 * วิธีที่เอกสาร OpenNext แนะนำคือทำ worker ของตัวเองมาห่อ แล้วเติม `scheduled`
 * https://opennext.js.org/cloudflare/howtos/custom-worker
 *
 * จุดที่ต่างจากของเดิมและดีกว่า
 * ของเดิม cron ยิง fetch ออกไปที่ URL สาธารณะของตัวเอง = ออกอินเทอร์เน็ตแล้ววิ่งกลับเข้ามา
 * ตัวนี้เรียก handler.fetch ตรงๆ ในโปรเซสเดียวกัน ไม่ออกเน็ต เร็วกว่าและพลาดยากกว่า
 */

/*
 * บรรทัดล่างใช้ ts-ignore ไม่ใช่ ts-expect-error โดยตั้งใจ
 *
 * ไฟล์ .open-next/worker.js จะมีหรือไม่มี ขึ้นกับว่าเพิ่งรัน cf:build ไปหรือยัง
 * ถ้าใช้ ts-expect-error พอไฟล์มีอยู่จริง TypeScript จะฟ้อง "Unused directive"
 * แปลว่า npm run typecheck จะผ่านบ้างไม่ผ่านบ้างแล้วแต่จังหวะ
 * ซึ่งเป็นความไม่แน่นอนที่ไม่ควรมีในคำสั่งตรวจงาน
 *
 * (เขียนชื่อ directive แบบไม่มี @ ในคอมเมนต์นี้ด้วย เพราะถ้าขึ้นต้นบรรทัดคอมเมนต์
 *  ด้วยเครื่องหมาย @ TypeScript จะอ่านเป็นคำสั่งจริง ไม่ใช่คำอธิบาย — เจอมาแล้ว)
 */
// @ts-ignore — ไฟล์นี้ถูกสร้างตอน build
import { default as handler } from './.open-next/worker.js'

/** ผูก cron expression กับ endpoint ที่ต้องเรียก — ต้องตรงกับ wrangler.jsonc */
const CRON_ROUTES: Record<string, string> = {
  '0 * * * *': '/api/cron/send-notifications',
  '20 3 * * *': '/api/cron/expire-reservations',
}

export default {
  fetch: handler.fetch,

  // ตั้งใจไม่ใช้ type ExecutionContext จาก @cloudflare/workers-types
  // เพื่อไม่ต้องลงแพ็กเกจ type เพิ่มแค่เพื่อไฟล์เดียว และไม่ให้ tsc ของฝั่ง Next พัง
  // เราแค่รับ ctx มาแล้วส่งต่อ ไม่ได้เรียกเมธอดอะไรของมัน
  async scheduled(
    event: { cron: string; scheduledTime: number },
    env: Record<string, string | undefined>,
    ctx: unknown
  ) {
    const path = CRON_ROUTES[event.cron]
    if (!path) {
      console.error('[cron] ไม่รู้จัก schedule นี้:', event.cron)
      return
    }

    // origin ตัวนี้ไม่ได้ออกเน็ตจริง เป็นแค่ base ให้ new Request() ประกอบ URL ได้
    const origin = env.NEXT_PUBLIC_APP_URL || 'https://localhost'

    /**
     * route ฝั่ง Next เช็ค Bearer อยู่ ต้องส่งไปให้ตรงกัน
     *
     * ทำไมต้องอ่านสองที่ — เจอปัญหานี้ตอนทดสอบจริงบนเครื่อง
     * ยิง cron แล้วได้ 401 ทั้งสองตัว เพราะความลับสองฝั่งมาคนละทาง
     *   route ฝั่ง Next  อ่าน process.env ซึ่งมีค่าจาก .env.local ที่ถูกรวมตอน build
     *   worker ตัวนี้     อ่าน env ซึ่งเป็น binding ของ Cloudflare (ตอน preview มาจาก .dev.vars)
     * ถ้ามีแค่ฝั่งเดียว worker จะไม่แนบ header แต่ route ยังบังคับเช็ค = 401 ตลอดกาล
     *
     * บนของจริงทั้งสองฝั่งมาจาก secret ตัวเดียวกันจึงตรงกันอยู่แล้ว
     * แต่เขียนให้ทนไว้ดีกว่า เพราะถ้าพลาดขึ้นมาแล้วมันคือแจ้งเตือนไม่ถึงลูกค้าเงียบๆ
     *
     * ผลการทดสอบจริง (อย่าลบบรรทัดนี้)
     * ทางที่สอง (process.env) ใช้ไม่ได้ตอนรัน preview ในเครื่อง — ทดสอบแล้วยังได้ 401
     * เพราะ OpenNext เติมค่าลง process.env ตอน request วิ่งเข้า Next เท่านั้น
     * ซึ่งเกิดหลังจากบรรทัดนี้อ่านค่าไปแล้ว มันจึงเป็นแค่ตาข่ายกันพลาด ไม่ใช่ทางหลัก
     *
     * แปลว่าถ้าจะทดสอบ cron ในเครื่องให้ได้ 200 ต้องเอา CRON_SECRET ออกจาก .env.local
     * ชั่วคราว (route จะข้ามการเช็คเองเมื่อไม่เจอค่า) แล้ว build ใหม่
     * ห้ามแก้ด้วยการเอาความลับใส่ .dev.vars เด็ดขาด — ไฟล์นั้นรั่วออกไปแล้วสองรอบ
     */
    const cronSecret =
      env.CRON_SECRET ??
      (typeof process !== 'undefined' ? process.env?.CRON_SECRET : undefined)

    const headers = new Headers()
    if (cronSecret) headers.set('authorization', `Bearer ${cronSecret}`)

    try {
      const res = await handler.fetch(new Request(origin + path, { headers }), env, ctx)
      const body = await res.text()
      console.log('[cron]', event.cron, path, res.status, body.slice(0, 300))

      // สำคัญ: ต้องโยน error เมื่อ route ตอบไม่ใช่ 2xx
      //
      // ตอนทดสอบเจอว่าถ้าไม่มีบรรทัดนี้ route ตอบ 500 แล้วงานจบแบบ "สำเร็จ"
      // Cloudflare จะนับเป็น invocation ที่ผ่าน แปลว่าแจ้งเตือนค้างส่งไม่ออก
      // ติดกันเป็นวันโดยไม่มีอะไรเตือนเลย เงียบแบบนี้อันตรายกว่าพังดังๆ
      if (!res.ok) {
        throw new Error(`[cron] ${path} ตอบ ${res.status}: ${body.slice(0, 200)}`)
      }
    } catch (err) {
      // โยนต่อเพื่อให้ Cloudflare นับเป็น invocation ที่ล้มเหลว
      // จะได้เห็นใน dashboard → Workers → Cron Events ไม่ใช่เงียบหายไปเฉยๆ
      console.error('[cron] ล้มเหลว', event.cron, err)
      throw err
    }
  },
}
