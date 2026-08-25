import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ระบบร้านหนังสือ',
  description: 'ระบบจัดการสต็อก ต้นทุน และการขายหนังสือ',
}

/**
 * ลูกค้าเกือบทั้งหมดเข้าผ่านเบราว์เซอร์ในแอป LINE บนมือถือ
 * viewport-fit=cover ทำให้พื้นหลังไล่ไปถึงขอบจอบนเครื่องที่มีติ่งหรือมุมโค้ง
 * ส่วน themeColor คุมสีแถบสถานะให้กลืนกับหน้าเว็บแทนที่จะเป็นแถบขาวคาดอยู่
 */
export const viewport: Viewport = {
  themeColor: '#fbf9f4',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
