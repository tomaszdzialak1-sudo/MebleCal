import type { HardwareEntry } from './hardware-catalog'

export type HingeOverlayClass = 'full' | 'half' | 'inset'

export interface HingeTemplateDraft {
  name: string
  manufacturer: string
  openingAngle?: number
  overlayClass?: HingeOverlayClass
  tbDefault?: number
  plateDistance?: 0 | 3 | 6 | 9
  cupDiameter?: number
  cupDepth?: number
  cupScrewDiameter?: number
  cupScrewDepth?: number
  cupScrewInward?: number
  cupScrewSpacing?: number
  plateDiameter?: number
  plateDepth?: number
  plateInward?: number
  plateSpacing?: number
}

export interface TemplateValidation {
  errors: string[]
  warnings: string[]
}

const hasNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const positive = (v: unknown): v is number => hasNumber(v) && v > 0

export function validateHingeTemplateDraft(draft: HingeTemplateDraft): TemplateValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!draft.name.trim()) errors.push('Podaj nazwę okucia.')
  if (!positive(draft.cupDiameter) || !positive(draft.cupDepth)) {
    errors.push('Puszka wymaga średnicy i głębokości.')
  }
  if (!positive(draft.plateDiameter) || !positive(draft.plateDepth) || !positive(draft.plateInward) || !positive(draft.plateSpacing)) {
    errors.push('Prowadnik wymaga średnicy, głębokości, odsunięcia od krawędzi i rozstawu.')
  }

  const screwFilled = [
    draft.cupScrewDiameter,
    draft.cupScrewDepth,
    draft.cupScrewInward,
    draft.cupScrewSpacing,
  ].filter(hasNumber).length
  if (screwFilled > 0 && screwFilled < 4) {
    errors.push('Mocowanie puszki musi mieć komplet: średnica, głębokość, odsunięcie i rozstaw.')
  }
  if (screwFilled === 0) warnings.push('Brak wkrętów/kołków puszki w szablonie.')

  if (positive(draft.cupDiameter) && Math.abs(draft.cupDiameter - 35) > 3) {
    warnings.push(`Nietypowa średnica puszki: ${draft.cupDiameter} mm.`)
  }
  if (positive(draft.plateSpacing) && Math.abs(draft.plateSpacing - 32) > 8) {
    warnings.push(`Nietypowy rozstaw prowadnika: ${draft.plateSpacing} mm.`)
  }
  if (positive(draft.plateInward) && Math.abs(draft.plateInward - 37) > 10) {
    warnings.push(`Nietypowe odsunięcie prowadnika od krawędzi: ${draft.plateInward} mm.`)
  }
  if (positive(draft.tbDefault) && (draft.tbDefault < 3 || draft.tbDefault > 7)) {
    warnings.push(`TB/B poza typowym zakresem 3-7 mm: ${draft.tbDefault} mm.`)
  }

  return { errors, warnings }
}

export function buildHingeTemplateEntry(id: string, draft: HingeTemplateDraft): HardwareEntry {
  const check = validateHingeTemplateDraft(draft)
  if (check.errors.length) throw new Error(check.errors[0])

  const drillPattern: HardwareEntry['drillPattern'] = [
    {
      x: 0,
      y: 0,
      diameter: draft.cupDiameter!,
      depth: draft.cupDepth!,
      group: 1,
      role: 'cup',
    },
  ]

  if (
    positive(draft.cupScrewDiameter) &&
    positive(draft.cupScrewDepth) &&
    positive(draft.cupScrewInward) &&
    positive(draft.cupScrewSpacing)
  ) {
    const half = draft.cupScrewSpacing / 2
    drillPattern.push(
      {
        x: draft.cupScrewInward,
        y: -half,
        diameter: draft.cupScrewDiameter,
        depth: draft.cupScrewDepth,
        group: 1,
        role: 'cupScrew',
      },
      {
        x: draft.cupScrewInward,
        y: half,
        diameter: draft.cupScrewDiameter,
        depth: draft.cupScrewDepth,
        group: 1,
        role: 'cupScrew',
      },
    )
  }

  const plateHalf = draft.plateSpacing! / 2
  drillPattern.push(
    {
      x: draft.plateInward!,
      y: -plateHalf,
      inward: draft.plateInward!,
      along: -plateHalf,
      diameter: draft.plateDiameter!,
      depth: draft.plateDepth!,
      group: 2,
      role: 'plate',
    },
    {
      x: draft.plateInward!,
      y: plateHalf,
      inward: draft.plateInward!,
      along: plateHalf,
      diameter: draft.plateDiameter!,
      depth: draft.plateDepth!,
      group: 2,
      role: 'plate',
    },
  )

  return {
    id,
    name: draft.name.trim(),
    manufacturer: draft.manufacturer.trim(),
    kind: 'hinge',
    drillPattern,
    meta: {
      source: 'manual-creator',
      openingAngle: draft.openingAngle,
      overlayClass: draft.overlayClass,
      TB_default: draft.tbDefault,
      plateDistance: draft.plateDistance,
      cupDiameter: draft.cupDiameter,
      plateInward: draft.plateInward,
      plateSpacing: draft.plateSpacing,
    },
  }
}

