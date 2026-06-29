import { Suspense, useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { VRMLLoader } from 'three/examples/jsm/loaders/VRMLLoader.js'
import type { Panel, Vec2, Vec3 } from '../model/types'
import { localToWorld, rotateDir } from '../model/transform'
import { edgeFrame } from '../model/geometry'
import { deriveHingeAnchor } from '../model/hinges'
import { useProjectStore } from '../store/projectStore'
import { useViewStore } from '../store/viewStore'
import {
  getHingeFinishForHardware,
  getHingeVisualForHardware,
  type HingeFinish,
} from '../model/hardware-visuals'

const EPS = 1e-6

type HingeAnchor = ReturnType<typeof deriveHingeAnchor>

type SingleHingeProps = {
  hwRecord: Record<string, unknown>
  hwId: string
  placeIdx: number
  front: Panel
  side: Panel
  place: { fromEdge: number; offset: number }
  tb: number
  cupDiameter: number
}

function v3(a: Vec3): THREE.Vector3 {
  return new THREE.Vector3(a[0], a[1], a[2])
}

function safeNormalize(v: THREE.Vector3, fallback: THREE.Vector3): THREE.Vector3 {
  if (v.lengthSq() < EPS) return fallback.clone().normalize()
  return v.clone().normalize()
}

function pointOnEdge(contour: Vec2[], edgeIdx: number, along: number, inward: number): Vec2 {
  const n = contour.length
  const a = contour[((edgeIdx % n) + n) % n]
  const ef = edgeFrame(contour, edgeIdx)
  return [
    a[0] + ef.along[0] * along + ef.inward[0] * inward,
    a[1] + ef.along[1] * along + ef.inward[1] * inward,
  ]
}

function faceZ(panel: Panel, face: 'front' | 'back') {
  return face === 'front' ? 0 : -panel.thickness
}

function faceOutWorld(panel: Panel, face: 'front' | 'back') {
  const local: Vec3 = face === 'front' ? [0, 0, 1] : [0, 0, -1]
  return safeNormalize(v3(rotateDir(panel.transform.rotation, local)), new THREE.Vector3(0, 0, 1))
}

function projectOut(v: THREE.Vector3, normal: THREE.Vector3) {
  const n = safeNormalize(normal, new THREE.Vector3(0, 0, 1))
  return v.clone().sub(n.multiplyScalar(v.dot(n)))
}

function quatFromBasis(x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3) {
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}

/**
 * Body WRL axes from file analysis:
 * - local Z = long hinge/cup axis,
 * - local -Z points from cup towards mounting plate/arm end,
 * - local Y = hinge vertical axis.
 */
function bodyQuat(localMinusZWorldInput: THREE.Vector3, localYWorldInput: THREE.Vector3) {
  const zAxis = safeNormalize(localMinusZWorldInput.clone().negate(), new THREE.Vector3(0, 0, 1))
  let yAxis = projectOut(localYWorldInput, zAxis)
  yAxis = safeNormalize(yAxis, new THREE.Vector3(0, 1, 0))
  let xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis)
  xAxis = safeNormalize(xAxis, new THREE.Vector3(1, 0, 0))
  yAxis = safeNormalize(new THREE.Vector3().crossVectors(zAxis, xAxis), yAxis)
  return quatFromBasis(xAxis, yAxis, zAxis)
}

/**
 * Plate WRL axes from file analysis:
 * - local X = plate thickness,
 * - local Y = height / two mounting holes,
 * - local Z = plate width/depth in panel plane.
 * We map local -X away from side panel, i.e. towards hinge/cup.
 */
function plateQuat(localMinusXWorldInput: THREE.Vector3, localYWorldInput: THREE.Vector3, zHintInput: THREE.Vector3) {
  const xAxis = safeNormalize(localMinusXWorldInput.clone().negate(), new THREE.Vector3(1, 0, 0))
  let yAxis = projectOut(localYWorldInput, xAxis)
  yAxis = safeNormalize(yAxis, new THREE.Vector3(0, 1, 0))

  let zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis)
  zAxis = safeNormalize(zAxis, new THREE.Vector3(0, 0, 1))

  const zHint = projectOut(zHintInput, xAxis)
  if (zHint.lengthSq() > EPS && zAxis.dot(zHint) < 0) {
    yAxis.negate()
    zAxis.negate()
  }

  zAxis = safeNormalize(new THREE.Vector3().crossVectors(xAxis, yAxis), zAxis)
  return quatFromBasis(xAxis, yAxis, zAxis)
}

function plateSurfacePointWorld(side: Panel, anchor: HingeAnchor): THREE.Vector3 {
  const p = pointOnEdge(side.contour, anchor.sideEdge, anchor.height, 37)
  return v3(localToWorld(side.transform, [p[0], p[1], faceZ(side, anchor.plateFace)]))
}

function modelBBox(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object)
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  box.getCenter(center)
  box.getSize(size)
  return { box, center, size }
}

function materialColorHex(mat: THREE.Material | THREE.Material[] | undefined): number | null {
  if (!mat) return null
  const first = Array.isArray(mat) ? mat[0] : mat
  const m = first as THREE.MeshStandardMaterial
  return m.color ? m.color.getHex() : null
}

function cloneWrlWithFinish(source: THREE.Object3D, finish: HingeFinish) {
  const root = source.clone(true)

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return

    mesh.castShadow = true
    mesh.receiveShadow = true

    if (finish === 'original') return

    const oldHex = materialColorHex(mesh.material)
    const oldColor = oldHex == null ? new THREE.Color(0.5, 0.5, 0.5) : new THREE.Color(oldHex)
    const lum = oldColor.r * 0.2126 + oldColor.g * 0.7152 + oldColor.b * 0.0722

    if (finish === 'black') {
      mesh.material = new THREE.MeshStandardMaterial({
        color: lum > 0.55 ? '#2f333a' : '#111418',
        metalness: 0.72,
        roughness: 0.32,
      })
    } else {
      mesh.material = new THREE.MeshStandardMaterial({
        color: lum > 0.55 ? '#c7c4bb' : '#252a32',
        metalness: 0.64,
        roughness: 0.28,
      })
    }
  })

  return root
}

function localAnchorBody(body: THREE.Object3D) {
  const { box, center } = modelBBox(body)
  // From WRL analysis body bbox is roughly:
  // x -26.5..11, y -28.5..28.5, z -29.48..51.3.
  // Cup/door mounting face is at maxZ, centered around x/y.
  return new THREE.Vector3(center.x, center.y, box.max.z)
}

function localAnchorPlate(plate: THREE.Object3D) {
  const { box, center } = modelBBox(plate)
  // From WRL analysis plate bbox is roughly:
  // x -8.5..0, y -26.5..26.5, z -20.5..21.
  // Mounting face is maxX.
  return new THREE.Vector3(box.max.x, center.y, center.z)
}

function SingleHinge({
  hwRecord,
  hwId,
  placeIdx,
  front,
  side,
  place,
  tb,
  cupDiameter,
}: SingleHingeProps) {
  const visual = getHingeVisualForHardware(hwRecord)
  const finish = getHingeFinishForHardware(hwRecord, visual)

  const bodyLoaded = useLoader(VRMLLoader, visual.bodyUrl)
  const plateLoaded = useLoader(VRMLLoader, visual.plateUrl)

  const body = useMemo(() => cloneWrlWithFinish(bodyLoaded, finish), [bodyLoaded, finish])
  const plate = useMemo(() => cloneWrlWithFinish(plateLoaded, finish), [plateLoaded, finish])

  const anchor = useMemo(
    () => deriveHingeAnchor(front, side, place.fromEdge, place.offset, tb, cupDiameter),
    [front, side, place.fromEdge, place.offset, tb, cupDiameter],
  )

  const frame = useMemo(() => {
    const cupSurface = v3(localToWorld(front.transform, [anchor.cup[0], anchor.cup[1], -front.thickness]))
    const plateSurface = plateSurfacePointWorld(side, anchor)

    const ef = edgeFrame(front.contour, place.fromEdge)
    const hingeAxis = safeNormalize(
      v3(rotateDir(front.transform.rotation, [ef.along[0], ef.along[1], 0])),
      new THREE.Vector3(0, 1, 0),
    )

    const cupToPlate = safeNormalize(plateSurface.clone().sub(cupSurface), new THREE.Vector3(1, 0, 0))
    const plateToCup = cupToPlate.clone().negate()

    let cupNormal = faceOutWorld(front, 'back')
    if (cupNormal.dot(cupToPlate) < 0) cupNormal = cupNormal.negate()

    let plateNormal = faceOutWorld(side, anchor.plateFace)
    if (plateNormal.dot(plateToCup) < 0) plateNormal = plateNormal.negate()

    return {
      cupSurface,
      plateSurface,
      hingeAxis,
      cupToPlate,
      plateToCup,
      cupNormal,
      plateNormal,
      bodyQuat: bodyQuat(cupToPlate, hingeAxis),
      plateQuat: plateQuat(plateNormal, hingeAxis, plateToCup),
    }
  }, [front, side, anchor, place.fromEdge])

  const bodyPosition = useMemo(() => localAnchorBody(body).multiplyScalar(-1), [body])
  const platePosition = useMemo(() => localAnchorPlate(plate).multiplyScalar(-1), [plate])

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const cupOp = front.operations.find((op) => op.id === `${hwId}:cup:${placeIdx}`)
    if (cupOp?.hole) {
      const cupOpWorld = v3(localToWorld(front.transform, [cupOp.hole.x, cupOp.hole.y, -front.thickness]))
      console.log(`[HingeModel WRL] ${hwId}:${placeIdx} cup Δ`, frame.cupSurface.distanceTo(cupOpWorld).toFixed(6), 'mm')
    }

    console.log(`[HingeModel WRL] ${hwId}:${placeIdx}`, {
      visual: visual.id,
      finish,
      bodyBox: modelBBox(body).size.toArray().map((v) => Math.round(v * 10) / 10),
      plateBox: modelBBox(plate).size.toArray().map((v) => Math.round(v * 10) / 10),
    })
  }, [body, finish, frame.cupSurface, front, hwId, placeIdx, plate, visual.id])

  return (
    <group name={`hinge-${hwId}-${placeIdx}-wrl`}>
      <group name="hinge-moving-door-part" position={frame.cupSurface} quaternion={frame.bodyQuat}>
        <primitive object={body} position={bodyPosition} />
      </group>

      <group name="hinge-fixed-cabinet-part" position={frame.plateSurface} quaternion={frame.plateQuat}>
        <primitive object={plate} position={platePosition} />
      </group>
    </group>
  )
}

function HingeModels() {
  const projectPanels = useProjectStore((s) => s.project.panels)
  const cabinetDerived = useProjectStore((s) => s.cabinetDerived)
  const allPanels = useMemo(
    () => [...projectPanels, ...Object.values(cabinetDerived).flatMap((r) => r.panels)],
    [projectPanels, cabinetDerived],
  )

  const hardware = useProjectStore((s) => s.project.hardware)
  const showHingeModels = useViewStore((s) => s.showHingeModels)

  if (!showHingeModels) return null

  return (
    <>
      {hardware
        .filter((hw) => hw.kind === 'hinge' && hw.hinge)
        .flatMap((hw) => {
          const h = hw.hinge!
          const front = allPanels.find((p) => p.id === h.doorPanel)
          const side = allPanels.find((p) => p.id === h.sidePanel)

          if (!front || !side) return []

          return h.placement.map((place, k) => (
            <SingleHinge
              key={`${hw.id}:${k}`}
              hwRecord={hw as unknown as Record<string, unknown>}
              hwId={hw.id}
              placeIdx={k}
              front={front}
              side={side}
              place={place}
              tb={h.cup.distanceTB}
              cupDiameter={h.cup.diameter}
            />
          ))
        })}
    </>
  )
}

export function HingeModel() {
  return (
    <Suspense fallback={null}>
      <HingeModels />
    </Suspense>
  )
}
