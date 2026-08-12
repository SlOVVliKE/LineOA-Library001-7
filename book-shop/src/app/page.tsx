import Link from 'next/link'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold">ระบบร้านหนังสือ</h1>
      <Link href="/shop" className="card hover:border-teal-400">
        <div className="font-medium text-teal-800">หน้าร้าน</div>
        <p className="mt-1 text-sm text-neutral-600">
          สำหรับลูกค้า — เปิดผ่าน LINE หรือเปิดตรงในเบราว์เซอร์ก็ได้
        </p>
      </Link>
      <Link href="/admin" className="card hover:border-teal-400">
        <div className="font-medium text-teal-800">หลังบ้าน</div>
        <p className="mt-1 text-sm text-neutral-600">
          จัดการสต็อก ต้นทุน ออเดอร์ และรายงานกำไร
        </p>
      </Link>
    </main>
  )
}
