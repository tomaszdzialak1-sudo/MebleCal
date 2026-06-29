import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Grid, Line, OrbitControls, TransformControls } from '@react-three/drei'
import { useProjectStore } from '../store/projectStore'
import { useViewStore } from '../store/viewStore'
import { computeSnap, panelCorners, worldAABB, type AABB } from '../model/snapping'
import type { Transform } from '../model/transform'
import { localToWorld, rotateDir } from '../model/transform'
import type { Vec3 } from '../model/types'
import { panelLocalCenter } from '../model/factories'
import { wouldCollide, binarySearchPos } from '../model/obb'
import { wouldLeaveRoom } from '../model/collisions'
import { PanelMesh } from './PanelMesh'
import { RoomMesh } from './RoomMesh'
import { CollisionMarks } from './CollisionMarks'
import { CabinetAnchor } from './CabinetAnchor'
import { HingeModel } from './HingeModel'

type GizmoMode = 'translate' | 'rotate' | null

const round = (v: number) => Math.round(v * 10) / 10 // 0.1 mm / 0.1°
const SNAP_THRESHOLD = 18 // mm — próg dociągania (≈ grubość płyty)

export function SceneCanvas() {
  const projectPanels = useProjectStore((s) => s.project.panels)
  const cabinetDerived = useProjectStore((s) => s.cabinetDerived)
  const panels = useMemo(
    () => [
      ...projectPanels,
      ...Object.values(cabinetDerived).flatMap((r) => r.panels),
    ],
    [projectPanels, cabinetDerived],
  )
  const rooms = useProjectStore((s) => s.project.rooms)
  const selection = useProjectStore((s) => s.selection)
  const select = useProjectStore((s) => s.select)
  const moveCabinet = useProjectStore((s) => s.moveCabinet)
  const updateTransform = useProjectStore((s) => s.updatePanelTransform)
  const roomsVisible = useViewStore((s) => s.roomsVisible)
  const wallOpacity = useViewStore((s) => s.wallOpacity)
  const magnetEnabled = useViewStore((s) => s.magnetEnabled)

  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate')
  const [selObj, setSelObj] = useState<THREE.Object3D | null>(null)
  const [contacts, setContacts] = useState<[number, number, number][][]>([])

  const selectedPanelId = selection?.type === 'panel' ? selection.id : null
  const selectedPanel = panels.find((p) => p.id === selectedPanelId) ?? null

  const cabinets = useProjectStore((s) => s.project.cabinets)
  const selectedCabinetId = selection?.type === 'cabinet' ? selection.id : null
  const selectedCabinet = cabinets.find((c) => c.id === selectedCabinetId) ?? null

  // Alt/Ctrl wciśnięty → chwilowo wyłącz magnes w trakcie przeciągania.
  const suppressRef = useRef(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      suppressRef.current = e.altKey || e.ctrlKey
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  // AABB pozostałych płyt (dla snappingu) i same płyty (dla collision stop).
  const otherAABBs = useMemo<AABB[]>(
    () =>
      panels
        .filter((p) => p.id !== selectedPanelId)
        .map((p) => worldAABB(panelCorners(p), p.transform)),
    [panels, selectedPanelId],
  )
  const otherPanels = useMemo(
    () => panels.filter((p) => p.id !== selectedPanelId),
    [panels, selectedPanelId],
  )

  // Ostatnia znana bezkolizyjna pozycja/obrót przeciąganej płyty.
  const lastGoodTransform = useRef<Transform | null>(null)
  // World-center bryły płyty zapamiętany na start gestu obrotu (przeliczany co gest).
  const panelCenterRef = useRef<Vec3 | null>(null)
  const panelLocalCenterRef = useRef<Vec3 | null>(null)

  // Sekwencja na każdym kroku draga: snapping → collision check → zapis pozycji.
  const onObjectChange = useCallback(() => {
    if (!selObj || !selectedPanel) return
    selObj.updateMatrixWorld()

    const newPos: Vec3 = [selObj.position.x, selObj.position.y, selObj.position.z]
    const newRot: Vec3 = [
      THREE.MathUtils.radToDeg(selObj.rotation.x),
      THREE.MathUtils.radToDeg(selObj.rotation.y),
      THREE.MathUtils.radToDeg(selObj.rotation.z),
    ]

    if (gizmoMode === 'translate') {
      // 1. Snapping (gdy magnes włączony i brak Alt/Ctrl).
      if (magnetEnabled && !suppressRef.current) {
        const live: Transform = { position: newPos, rotation: newRot }
        const dragged = worldAABB(panelCorners(selectedPanel), live)
        const { offset, contacts: loops } = computeSnap(dragged, otherAABBs, SNAP_THRESHOLD)
        if (offset[0] || offset[1] || offset[2]) {
          selObj.position.set(
            newPos[0] + offset[0],
            newPos[1] + offset[1],
            newPos[2] + offset[2],
          )
          newPos[0] += offset[0]
          newPos[1] += offset[1]
          newPos[2] += offset[2]
        }
        setContacts(loops as [number, number, number][][])
      } else {
        if (contacts.length) setContacts([])
      }

      // 2. Collision stop na wyniku snappingu: płyty + pokój (bypass: Alt/Ctrl).
      if (!suppressRef.current) {
        const isBlocked = (pos: Vec3) =>
          wouldCollide(selectedPanel, { position: pos, rotation: newRot }, otherPanels) ||
          wouldLeaveRoom(selectedPanel, { position: pos, rotation: newRot }, rooms)

        if (isBlocked(newPos)) {
          const last = lastGoodTransform.current
          if (last) {
            const safe = binarySearchPos(last.position, newPos, isBlocked)
            selObj.position.set(safe[0], safe[1], safe[2])
          }
          return  // nie aktualizuj lastGoodTransform — zatrzymano
        }
      }

      // 3. Obie kontrole przeszły — zapisz jako ostatnią dobrą pozycję.
      lastGoodTransform.current = { position: newPos, rotation: newRot }

    } else if (gizmoMode === 'rotate') {
      if (contacts.length) setContacts([])

      // Obrót wokół geometrycznego środka bryły (nie pivota w rogu konturu).
      // newPos: przy obrocie TransformControls nie zmienia selObj.position — pobieramy
      // pivot z poprzedniego stanu. Liczymy nowy pivot tak, by worldCenter pozostał stały.
      const worldCenter = panelCenterRef.current
      const localCenter = panelLocalCenterRef.current
      if (worldCenter && localCenter) {
        const rotated = rotateDir(newRot, localCenter)
        newPos[0] = worldCenter[0] - rotated[0]
        newPos[1] = worldCenter[1] - rotated[1]
        newPos[2] = worldCenter[2] - rotated[2]
        selObj.position.set(newPos[0], newPos[1], newPos[2])
      }

      // Collision stop dla obrotu: odrzucenie (bez binary search).
      if (!suppressRef.current) {
        const blocked =
          wouldCollide(selectedPanel, { position: newPos, rotation: newRot }, otherPanels) ||
          wouldLeaveRoom(selectedPanel, { position: newPos, rotation: newRot }, rooms)

        if (blocked) {
          const last = lastGoodTransform.current
          if (last) {
            selObj.rotation.set(
              THREE.MathUtils.degToRad(last.rotation[0]),
              THREE.MathUtils.degToRad(last.rotation[1]),
              THREE.MathUtils.degToRad(last.rotation[2]),
            )
            // Revert position (po center-preserve position mogła się zmienić).
            selObj.position.set(last.position[0], last.position[1], last.position[2])
          }
          return
        }
      }
      lastGoodTransform.current = { position: newPos, rotation: newRot }

    } else {
      if (contacts.length) setContacts([])
    }
  }, [selObj, selectedPanel, gizmoMode, magnetEnabled, otherAABBs, otherPanels, contacts.length])

  // Gdy nic (lub pomieszczenie) nie jest zaznaczone — odepnij gizmo.
  useEffect(() => {
    if (!selectedPanelId && !selectedCabinetId) setSelObj(null)
  }, [selectedPanelId, selectedCabinetId])

  // Zatwierdź transform z gizma do store po puszczeniu myszy (bez walki w trakcie).
  const commitTransform = useCallback(() => {
    setContacts([])
    if (!selObj) return
    if (selectedCabinetId) {
      moveCabinet(selectedCabinetId, [
        round(selObj.position.x), round(selObj.position.y), round(selObj.position.z),
      ])
      return
    }
    if (!selectedPanelId) return
    updateTransform(selectedPanelId, {
      position: [round(selObj.position.x), round(selObj.position.y), round(selObj.position.z)],
      rotation: [
        round(THREE.MathUtils.radToDeg(selObj.rotation.x)),
        round(THREE.MathUtils.radToDeg(selObj.rotation.y)),
        round(THREE.MathUtils.radToDeg(selObj.rotation.z)),
      ],
    })
  }, [selObj, selectedPanelId, selectedCabinetId, updateTransform, moveCabinet])

  const modeBtn = (mode: GizmoMode) =>
    `rounded px-2 py-1 text-xs ${
      gizmoMode === mode
        ? 'bg-amber-600 text-white'
        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
    }`

  return (
    <>
      {/* Nakładka: tryb gizma (poza Canvas) */}
      <div className="pointer-events-auto absolute left-3 top-3 z-10 flex gap-1 rounded border border-neutral-700 bg-neutral-900/80 p-1 backdrop-blur">
        <button className={modeBtn('translate')} onClick={() => setGizmoMode('translate')}>
          Przesuń
        </button>
        <button className={modeBtn('rotate')} onClick={() => setGizmoMode('rotate')}>
          Obróć
        </button>
        <button className={modeBtn(null)} onClick={() => setGizmoMode(null)}>
          Wył.
        </button>
      </div>

      <Canvas
        camera={{ position: [3800, -4600, 3200], fov: 45, near: 1, far: 200000 }}
        onCreated={({ camera }) => {
          // Świat Z-up: ustaw oś "góra" kamery na Z (1 jednostka = 1 mm).
          camera.up.set(0, 0, 1)
          camera.lookAt(0, 0, 800)
        }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={['#1c1c20']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4000, -3000, 6000]} intensity={1.3} />
        <directionalLight position={[-4000, 4000, 2000]} intensity={0.4} />

        {/* siatka w płaszczyźnie XY (Z-up): obrót o 90° wokół X */}
        <Grid
          rotation={[Math.PI / 2, 0, 0]}
          infiniteGrid
          cellSize={100}
          cellThickness={0.6}
          cellColor="#3a3a40"
          sectionSize={1000}
          sectionThickness={1.1}
          sectionColor="#55555f"
          fadeDistance={40000}
          fadeStrength={1.5}
        />

        {roomsVisible &&
          rooms.map((r) => <RoomMesh key={r.id} room={r} wallOpacity={wallOpacity} />)}

        {panels.map((p) => {
          const isCabinetPanel = !!p.cabinetId
          const isSel = isCabinetPanel
            ? selection?.type === 'cabinet' && selection.id === p.cabinetId
            : selection?.type === 'panel' && selection.id === p.id
          const handleSelect = isCabinetPanel
            ? () => select({ type: 'cabinet', id: p.cabinetId! })
            : () => select({ type: 'panel', id: p.id })
          return (
            <PanelMesh
              key={p.id}
              panel={p}
              selected={isSel}
              onSelect={handleSelect}
              captureRef={!isCabinetPanel && isSel ? setSelObj : undefined}
            />
          )
        })}

        {selectedCabinet && (
          <CabinetAnchor cabinet={selectedCabinet} onCapture={setSelObj} />
        )}

        {gizmoMode && selObj && (
          <TransformControls
            object={selObj}
            mode={gizmoMode}
            onMouseDown={() => {
              if (selectedPanel) {
                // Snapshot aktualnej pozycji jako punkt startowy collision stop.
                lastGoodTransform.current = selectedPanel.transform
                // World-center bryły: przeliczany przy każdym starcie gestu obrotu,
                // żeby uwzględnić zmiany zaznaczenia/Inspektora między gestami.
                const lc = panelLocalCenter(selectedPanel)
                panelLocalCenterRef.current = lc
                panelCenterRef.current = localToWorld(selectedPanel.transform, lc)
              }
            }}
            onObjectChange={onObjectChange}
            onMouseUp={commitTransform}
          />
        )}

        {/* Feedback magnesu: linia styku łapanego lica/krawędzi. */}
        {contacts.map((loop, i) => (
          <Line key={i} points={loop} color="#22d3ee" lineWidth={3} />
        ))}

        <CollisionMarks />
        <HingeModel />

        <axesHelper args={[600]} />
        <OrbitControls makeDefault target={[0, 0, 800]} />
      </Canvas>
    </>
  )
}
