import type { ConnectorType, OperationFace, OperationType } from '../model/types'

// Nazwy krawędzi prostokąta (CLAUDE.md: 0=dół,1=prawo,2=góra,3=lewo).
export const EDGE_NAMES_RECT = ['Dół', 'Prawo', 'Góra', 'Lewo']

export const edgeLabel = (i: number, n: number) =>
  n === 4 ? EDGE_NAMES_RECT[i] : `Krawędź ${i + 1}`

export const faceLabel = (face: OperationFace, nEdges: number): string =>
  face === 'front' ? 'front' : face === 'back' ? 'back' : edgeLabel(face.edge, nEdges)

export const OP_TYPE_LABEL: Record<OperationType, string> = {
  hole: 'Otwór',
  groove: 'Frez',
  cutout: 'Wycięcie',
  pocket: 'Kieszeń',
}

export const CONNECTOR_TYPE_LABEL: Record<ConnectorType, string> = {
  dowel: 'Kołek',
  confirmat: 'Konfirmat',
  cam: 'Mimośród',
}

export const OVERLAY_CLASS_LABEL: Record<'full' | 'half' | 'inset', string> = {
  full: 'nakładany',
  half: 'półnakładany',
  inset: 'wpuszczany',
}

export const CUP_MOUNTING_LABEL: Record<'screw' | 'inserta' | 'expando', string> = {
  screw: 'na wkręty',
  inserta: 'INSERTA (wpychany)',
  expando: 'EXPANDO',
}
