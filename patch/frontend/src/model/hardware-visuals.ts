/**
 * Katalog wizualizacji okuć.
 *
 * V11: prawdziwa geometria Blum z WRL + domyślny kolor szary.
 *
 * Renderer nadal obsługuje:
 * - "gray"     → szary/srebrny metal,
 * - "black"    → czarny/ciemny metal,
 * - "original" → materiały z pliku WRL.
 *
 * Na teraz domyślnie używamy "gray", bo WRL z Blum potrafi ładować się jako czarny.
 */

export type HingeFinish = 'original' | 'gray' | 'black'

export interface WrlHingeVisualCatalogItem {
  id: string
  kind: 'hinge'
  format: 'split-wrl'
  brand: string
  name: string
  bodyUrl: string
  plateUrl: string
  defaultFinish: HingeFinish
  availableFinishes: HingeFinish[]
}

export const DEFAULT_HINGE_VISUAL_ID = 'blum-71b3550-67-wrl'

export const HINGE_VISUALS: Record<string, WrlHingeVisualCatalogItem> = {
  'blum-71b3550-67-wrl': {
    id: 'blum-71b3550-67-wrl',
    kind: 'hinge',
    format: 'split-wrl',
    brand: 'Blum',
    name: 'CLIP top BLUMOTION 110° / WRL',
    bodyUrl: '/models/hardware/blum/hinges/71B3550_67/body.wrl',
    plateUrl: '/models/hardware/blum/hinges/71B3550_67/plate.wrl',
    defaultFinish: 'gray',
    availableFinishes: ['gray', 'black', 'original'],
  },
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') return value
  }
  return undefined
}

function readNestedString(record: Record<string, unknown>, parentKey: string, keys: string[]): string | undefined {
  const parent = record[parentKey]
  if (!parent || typeof parent !== 'object') return undefined
  return readString(parent as Record<string, unknown>, keys)
}

export function getHingeVisualForHardware(hw: Record<string, unknown>): WrlHingeVisualCatalogItem {
  const visualId =
    readString(hw, ['visualId', 'visualModelId', 'modelId', 'catalogVisualId']) ??
    readNestedString(hw, 'visual', ['id', 'visualId', 'modelId']) ??
    readNestedString(hw, 'hinge', ['visualId', 'visualModelId', 'modelId']) ??
    DEFAULT_HINGE_VISUAL_ID

  return HINGE_VISUALS[visualId] ?? HINGE_VISUALS[DEFAULT_HINGE_VISUAL_ID]
}

export function getHingeFinishForHardware(
  hw: Record<string, unknown>,
  visual: WrlHingeVisualCatalogItem,
): HingeFinish {
  const raw =
    readString(hw, ['finish', 'color', 'visualFinish']) ??
    readNestedString(hw, 'visual', ['finish', 'color']) ??
    readNestedString(hw, 'hinge', ['finish', 'color'])

  if (raw === 'original' || raw === 'black' || raw === 'gray') return raw
  return visual.defaultFinish
}
