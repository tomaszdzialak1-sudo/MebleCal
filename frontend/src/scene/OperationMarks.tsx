import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Html, Line } from '@react-three/drei'
import type { Connector, Operation, Panel, Vec2 } from '../model/types'
import { edgeAnchorLocal, edgeFrame } from '../model/geometry'
import { useProjectStore } from '../store/projectStore'
import { useViewStore } from '../store/viewStore'

// Kolory markerów per typ operacji.
const COLOR = {
  hole: '#ef4444',
  groove: '#38bdf8', // LED/nut
  cutout: '#a78bfa',
  pocket: '#eab308',
} as const

/**
 * Rola otworu pochodzącego z łącznika → ETYKIETA + KOLOR. Klucz = `${typ}:${suffix}`,
 * gdzie suffix to ogon deterministycznego id operacji (np. "A:0"). Dzięki temu w 3D
 * widać, który otwór to puszka / trzpień / dojście i NIE da się ich pomylić wzrokiem.
 * Mapa lustrzana do emitConnectorOps (connectors.ts).
 */
const CONNECTOR_ROLE: Record<string, { label: string; color: string }> = {
  'cam:A:0': { label: 'trzpień', color: '#3b82f6' }, // niebieski — w licu A
  'cam:B:0': { label: 'puszka', color: '#ef4444' }, // czerwony — Ø15 na licu B
  'cam:B:1': { label: 'dojście', color: '#22c55e' }, // zielony — w czole B
  'dowel:A:0': { label: 'kołek A', color: '#ef4444' },
  'dowel:B:0': { label: 'kołek B', color: '#3b82f6' },
  'confirmat:A:0': { label: 'konfirmat', color: '#ef4444' },
  'confirmat:A:1': { label: 'łeb', color: '#f97316' },
  'confirmat:B:0': { label: 'pilot', color: '#3b82f6' },
}

/** Etykieta+kolor roli, jeśli operacja pochodzi ze znanego łącznika. */
function connectorRole(op: Operation, connectors: Connector[]): { label: string; color: string } | null {
  if (typeof op.source !== 'object' || !('connector' in op.source)) return null
  const cid = op.source.connector
  const c = connectors.find((x) => x.id === cid)
  if (!c) return null
  const suffix = op.id.slice(cid.length + 1) // ogon po "cid:" (np. "A:0")
  return CONNECTOR_ROLE[`${c.type}:${suffix}`] ?? null
}

const ANTI_Z = 0.6 // mm — odsunięcie linii/wypełnień od lica (anty z-fight)

/** Z lica front/back w lokalnym układzie płyty (front=0, back=−thickness). */
const faceZ = (face: Operation['face'], thickness: number) =>
  face === 'back' ? -thickness : 0
/** Znak odsunięcia markera na zewnątrz lica (front → +Z, back → −Z). */
const faceOut = (face: Operation['face']) => (face === 'back' ? -1 : 1)

/** Mała etykieta 3D (DOM overlay) przy markerze otworu. */
function MarkLabel({ position, text, color }: { position: [number, number, number]; text: string; color: string }) {
  return (
    <Html position={position} center distanceFactor={700} style={{ pointerEvents: 'none' }} zIndexRange={[10, 0]}>
      <div
        style={{
          padding: '1px 5px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          color: '#fff',
          background: color,
          border: '1px solid rgba(0,0,0,0.4)',
          transform: 'translateY(-50%)',
        }}
      >
        {text}
      </div>
    </Html>
  )
}

export function OperationMarks({ panel }: { panel: Panel }) {
  const connectors = useProjectStore((s) => s.project.connectors)
  const showLabels = useViewStore((s) => s.showLabels)
  const showHingeDrills = useViewStore((s) => s.showHingeDrills)
  return (
    <>
      {panel.operations
        .filter(
          (op) => showHingeDrills || typeof op.source !== 'object' || !('hardware' in op.source),
        )
        .map((op) => (
          <OpMark key={op.id} op={op} panel={panel} role={connectorRole(op, connectors)} showLabels={showLabels} />
        ))}
    </>
  )
}

interface MarkProps {
  op: Operation
  panel: Panel
  role: { label: string; color: string } | null
  showLabels: boolean
}

function OpMark({ op, panel, role, showLabels }: MarkProps) {
  const onEdge = typeof op.face !== 'string'
  if (onEdge) return <EdgeMark op={op} panel={panel} role={role} showLabels={showLabels} />

  switch (op.type) {
    case 'hole':
      return op.hole ? <HoleMark op={op} panel={panel} role={role} showLabels={showLabels} /> : null
    case 'groove':
      return op.groove ? (
        <PathMark path={op.groove.path} face={op.face} thickness={panel.thickness} color={COLOR.groove} closed={false} />
      ) : null
    case 'cutout':
      return op.cutout ? (
        <PathMark path={op.cutout.path} face={op.face} thickness={panel.thickness} color={COLOR.cutout} closed fill />
      ) : null
    case 'pocket':
      return op.pocket ? (
        <PathMark path={op.pocket.path} face={op.face} thickness={panel.thickness} color={COLOR.pocket} closed fill />
      ) : null
  }
}

// --- Otwór na licu front/back: walec wzdłuż Z, w głąb materiału -------------
function HoleMark({ op, panel, role, showLabels }: MarkProps) {
  const h = op.hole!
  const z0 = faceZ(op.face, panel.thickness)
  const out = faceOut(op.face)
  const z = z0 + out * ANTI_Z
  const color = role?.color ?? COLOR.hole
  return (
    <>
      <mesh position={[h.x, h.y, z]}>
        <circleGeometry args={[h.diameter / 2, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      {showLabels && role && <MarkLabel position={[h.x, h.y, z0 + out * 8]} text={role.label} color={color} />}
    </>
  )
}

// --- Ścieżka (groove/cutout/pocket) na licu front/back ----------------------
function PathMark({
  path,
  face,
  thickness,
  color,
  closed,
  fill,
}: {
  path: Vec2[]
  face: Operation['face']
  thickness: number
  color: string
  closed: boolean
  fill?: boolean
}) {
  const z = faceZ(face, thickness) + faceOut(face) * ANTI_Z
  const points = useMemo<[number, number, number][]>(() => {
    const pts = path.map((p) => [p[0], p[1], z] as [number, number, number])
    if (closed && pts.length > 2) pts.push(pts[0])
    return pts
  }, [path, z, closed])

  const fillGeom = useMemo(() => {
    if (!fill || path.length < 3) return null
    const shape = new THREE.Shape()
    path.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [fill, path])

  useEffect(() => () => fillGeom?.dispose(), [fillGeom])

  return (
    <>
      {points.length >= 2 && <Line points={points} color={color} lineWidth={3} />}
      {fillGeom && (
        <mesh geometry={fillGeom} position={[0, 0, z - faceOut(face) * 0.2]}>
          <meshBasicMaterial color={color} transparent opacity={0.22} side={THREE.DoubleSide} />
        </mesh>
      )}
    </>
  )
}

// --- Marker w czole (face:{edge}) --------------------------------------------
// Anchor liczony WSPÓLNĄ edgeAnchorLocal (ta sama konwencja co łączniki).
function EdgeMark({ op, panel, role, showLabels }: MarkProps) {
  const edge = typeof op.face === 'string' ? 0 : op.face.edge
  const { inward } = edgeFrame(panel.contour, edge)

  // x = wzdłuż krawędzi, y = przez grubość od lica 'front'
  const x = op.hole ? op.hole.x : 0
  const y = op.hole ? op.hole.y : panel.thickness / 2
  const [px, py, pz] = edgeAnchorLocal(panel.contour, edge, x, y)
  const color = role?.color ?? COLOR.hole

  if (op.type === 'hole' && op.hole) {
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(-inward[0], -inward[1], 0),
    )
    return (
      <>
        <mesh
          position={[px - inward[0] * ANTI_Z, py - inward[1] * ANTI_Z, pz]}
          quaternion={[q.x, q.y, q.z, q.w]}
        >
          <circleGeometry args={[op.hole.diameter / 2, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
        {showLabels && role && <MarkLabel position={[px - inward[0] * 8, py - inward[1] * 8, pz]} text={role.label} color={color} />}
      </>
    )
  }

  // pozostałe typy w czole nie są dozwolone (reguła Fazy 3) — placeholder.
  return (
    <mesh position={[px, py, pz]}>
      <sphereGeometry args={[6, 12, 12]} />
      <meshStandardMaterial color={COLOR[op.type]} />
    </mesh>
  )
}
