import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { round2 } from '@/lib/money'
import type { PurchaseLot } from '@/lib/types/db'

/**
 * ตัดสต็อกแบบ FIFO
 *
 * ตรรกะจริงอยู่ในฟังก์ชัน Postgres `fn_consume_stock_fifo` (migration 0007)
 * เพราะต้องอยู่ใน transaction เดียวกับ SELECT ... FOR UPDATE
 * ไม่อย่างนั้นสองออเดอร์ที่เข้ามาพร้อมกันจะตัดสต็อกซ้อนกันจนติดลบ
 *
 * ห้ามย้ายตรรกะนี้มาทำใน TypeScript
 */
export async function consumeStockFifo(
  supabase: SupabaseClient,
  params: {
    bookId: string
    qty: number
    orderId?: string | null
    createdBy?: string | null
  }
): Promise<number> {
  const { data, error } = await supabase.rpc('fn_consume_stock_fifo', {
    p_book_id: params.bookId,
    p_qty: params.qty,
    p_order_id: params.orderId ?? null,
    p_created_by: params.createdBy ?? null,
  })
  if (error) throw new Error(error.message)
  return Number(data)
}

export async function receiveStock(
  supabase: SupabaseClient,
  params: {
    bookId: string
    qty: number
    unitCost: number
    shippingCost?: number
    supplier?: string | null
    receivedAt?: string | null
    invoiceNo?: string | null
    lotNo?: string | null
    note?: string | null
    createdBy?: string | null
  }
): Promise<string> {
  const { data, error } = await supabase.rpc('fn_receive_stock', {
    p_book_id: params.bookId,
    p_qty: params.qty,
    p_unit_cost: params.unitCost,
    p_shipping_cost: params.shippingCost ?? 0,
    p_supplier: params.supplier ?? null,
    p_received_at: params.receivedAt ?? null,
    p_invoice_no: params.invoiceNo ?? null,
    p_lot_no: params.lotNo ?? null,
    p_note: params.note ?? null,
    p_created_by: params.createdBy ?? null,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function adjustStock(
  supabase: SupabaseClient,
  params: {
    bookId: string
    qtyDelta: number
    reason: string
    type?: 'adjust' | 'damage' | 'return' | 'channel_correction'
    createdBy?: string | null
  }
): Promise<void> {
  const { error } = await supabase.rpc('fn_adjust_stock', {
    p_book_id: params.bookId,
    p_qty_delta: params.qtyDelta,
    p_reason: params.reason,
    p_type: params.type ?? 'adjust',
    p_created_by: params.createdBy ?? null,
  })
  if (error) throw new Error(error.message)
}

// ---------- ใช้สำหรับพรีวิวและทดสอบ (ไม่แตะฐานข้อมูล) ----------

export interface FifoPreviewLine {
  lotId: string
  lotNo: string | null
  qtyTaken: number
  unitCost: number
  lineCost: number
}

export interface FifoPreview {
  lines: FifoPreviewLine[]
  totalCogs: number
  shortfall: number
}

/**
 * จำลองการตัด FIFO เพื่อแสดงให้ผู้ใช้เห็นก่อนยืนยัน
 * ต้องให้ผลตรงกับ fn_consume_stock_fifo เสมอ
 */
export function previewFifo(
  lots: Pick<PurchaseLot, 'id' | 'lot_no' | 'qty_remaining' | 'landed_unit_cost' | 'received_at' | 'created_at'>[],
  qty: number
): FifoPreview {
  const sorted = [...lots]
    .filter((l) => l.qty_remaining > 0)
    .sort((a, b) => {
      const d = a.received_at.localeCompare(b.received_at)
      return d !== 0 ? d : a.created_at.localeCompare(b.created_at)
    })

  const lines: FifoPreviewLine[] = []
  let remaining = qty
  let total = 0

  for (const lot of sorted) {
    if (remaining <= 0) break
    const take = Math.min(lot.qty_remaining, remaining)
    const lineCost = round2(take * lot.landed_unit_cost)
    lines.push({
      lotId: lot.id,
      lotNo: lot.lot_no,
      qtyTaken: take,
      unitCost: lot.landed_unit_cost,
      lineCost,
    })
    total += lineCost
    remaining -= take
  }

  return { lines, totalCogs: round2(total), shortfall: Math.max(remaining, 0) }
}
