/**
 * ฟอนต์ของระบบ
 *
 * ตัวเลือกที่ 1 — IBM Plex Sans Thai (ใช้อยู่ตอนนี้)
 * ตัวไทยออกแบบโดย Cadson Demak เจ้าเดียวกับที่ทำตัวไทยให้ LINE Seed
 *
 * ---------------------------------------------------------------
 * ทำไมใช้ @fontsource แทน next/font/google
 *
 * next/font/google จะ "ดาวน์โหลดฟอนต์จาก Google ตอน build"
 * แปลว่าทุกครั้งที่ deploy ถ้าเครื่อง build ต่อ fonts.googleapis.com ไม่ได้
 * build จะล้มทั้งก้อน ทั้งที่โค้ดไม่มีอะไรผิด
 * เจอปัญหานี้จริงตอนทดสอบ build ในสภาพแวดล้อมที่ไม่มีเน็ตออกนอก
 *
 * @fontsource ติดตั้งไฟล์ฟอนต์มากับ npm ตั้งแต่แรก ไฟล์อยู่ใน node_modules
 * ตอน build จึงไม่ต้องต่อเน็ตไปไหนเลย และตอนลูกค้าเปิดเว็บก็โหลดจากโดเมนเรา
 * ไม่ได้ยิงไป Google ซึ่งเร็วกว่าและไม่มีเรื่องการส่ง IP ลูกค้าให้บุคคลที่สาม
 * ---------------------------------------------------------------
 *
 * โหลดเฉพาะ subset ไทยกับละติน และเฉพาะน้ำหนักที่ใช้จริง
 * แต่ละไฟล์คือของที่ลูกค้าต้องโหลดผ่านเน็ตมือถือ
 *   400 เนื้อหา · 500 ชื่อหนังสือและหัวข้อ · 600 ราคาและปุ่ม
 */
import '@fontsource/ibm-plex-sans-thai/thai-400.css'
import '@fontsource/ibm-plex-sans-thai/thai-500.css'
import '@fontsource/ibm-plex-sans-thai/thai-600.css'
import '@fontsource/ibm-plex-sans-thai/latin-400.css'
import '@fontsource/ibm-plex-sans-thai/latin-500.css'
import '@fontsource/ibm-plex-sans-thai/latin-600.css'
