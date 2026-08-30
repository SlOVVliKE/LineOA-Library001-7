import { defineCloudflareConfig } from '@opennextjs/cloudflare'

/**
 * ตั้งค่า adapter ที่แปลง Next.js ให้รันบน Cloudflare Workers
 *
 * ยังไม่ได้ตั้ง incrementalCache (R2) ไว้ตรงนี้ตั้งใจ
 * ทุกหน้าในเว็บนี้เป็น force-dynamic อยู่แล้ว แปลว่าไม่มีอะไรให้แคชระหว่าง request
 * การผูก R2 เข้ามาตอนนี้จะเพิ่มของให้ตั้งค่าและให้พังโดยไม่ได้อะไรกลับมา
 *
 * ถ้าวันไหนเอาแคชรายการหนังสือมาใช้ (เปลี่ยนจาก force-dynamic เป็น revalidate)
 * ค่อยกลับมาเติม r2IncrementalCache ตรงนี้
 * https://opennext.js.org/cloudflare/caching
 */
export default defineCloudflareConfig({})
