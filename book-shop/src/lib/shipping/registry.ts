import type { CarrierAdapter } from './types'
import { flashAdapter } from './flash'
import { jntAdapter } from './jnt'
import { shippopAdapter } from './shippop'

const adapters: Record<string, CarrierAdapter> = {
  flash: flashAdapter,
  jnt: jntAdapter,
  shippop: shippopAdapter,
}

export function getCarrier(code: string): CarrierAdapter {
  const a = adapters[code]
  if (!a) throw new Error(`ไม่รู้จักขนส่ง: ${code}`)
  return a
}

export function listCarriers(): CarrierAdapter[] {
  return Object.values(adapters)
}
