// ประเภทข้อมูลหลักของระบบ — ให้ตรงกับ supabase/migrations
// เมื่อ schema เปลี่ยน ให้รัน: supabase gen types typescript --local > src/lib/types/supabase.ts

export type StockMode = 'stock' | 'preorder' | 'backorder'
export type BookCondition = 'new' | 'like_new' | 'good' | 'acceptable'
export type MovementType =
  | 'purchase' | 'sale' | 'adjust' | 'return' | 'damage' | 'channel_correction'
export type OrderStatus =
  | 'pending_payment' | 'paid' | 'preorder_waiting' | 'packing'
  | 'shipped' | 'delivered' | 'completed' | 'cancelled'
export type PermissionCode =
  | 'book.write' | 'lot.write' | 'cost.read' | 'order.read' | 'order.ship'
  | 'payment.verify' | 'receipt.issue' | 'channel.manage' | 'user.manage'

export interface Book {
  id: string
  sku: string
  isbn: string | null
  title: string
  author: string | null
  publisher: string | null
  category_id: string | null
  description: string | null
  cover_url: string | null
  page_count: number | null
  weight_grams: number
  sell_price: number
  stock_mode: StockMode
  preorder_release_date: string | null
  preorder_limit: number | null
  preorder_deposit_pct: number | null
  condition: BookCondition
  is_serialized: boolean
  condition_note: string | null
  reorder_point: number
  safety_buffer: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  parent_id: string | null
  sort_order: number
}

export interface PurchaseLot {
  id: string
  book_id: string
  lot_no: string | null
  supplier: string | null
  received_at: string
  invoice_no: string | null
  qty_received: number
  qty_remaining: number
  unit_cost: number
  shipping_cost: number
  landed_unit_cost: number
  note: string | null
  created_by: string | null
  created_at: string
}

export interface StockMovement {
  id: string
  book_id: string
  lot_id: string | null
  type: MovementType
  qty: number
  order_id: string | null
  unit_cost: number | null
  reason: string | null
  created_by: string | null
  created_at: string
}

export interface StockSummary {
  book_id: string
  sku: string
  title: string
  safety_buffer: number
  on_hand: number
  reserved: number
  available_to_sell: number
  stock_value_at_cost: number
  avg_unit_cost: number | null
}

export interface BookPerformance {
  book_id: string
  sku: string
  title: string
  author: string | null
  qty_sold: number
  revenue: number
  cogs: number
  gross_profit: number
  last_sold_at: string | null
}

export interface OrderProfit {
  id: string
  order_no: string
  created_at: string
  paid_at: string | null
  status: OrderStatus
  channel_code: string
  channel_name: string
  subtotal: number
  discount: number
  shipping_fee: number
  total: number
  cogs_total: number | null
  shipping_actual_cost: number | null
  channel_fee: number
  gross_profit: number
  margin_pct: number | null
}
