/**
 * Sanity: obrót wokół geometrycznego środka bryły.
 *
 * Formuła: newPos = worldCenter − rotateDir(newRot, localCenter)
 * Niezmiennik: localToWorld({position: newPos, rotation: newRot}, localCenter) == worldCenter
 *
 * (A) gizmo 90°Z  — płyta w pozycji startowej, obrót osi Z
 * (B) gizmo 90°X  — sprawdza obrót osi X
 * (C) Inspektor +90°Z  — ta sama formuła, wywołana jak z przycisku +90
 * (D) niezerowy obrót wyjściowy — obrót [90,0,0] + [90,0,90] kumulatywnie
 */

import { localToWorld, rotateDir } from '../src/model/transform'
import { panelLocalCenter } from '../src/model/factories'
import type { Panel, Vec3 } from '../src/model/types'

// ── helpers ───────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string): void {
  if (cond) { console.log(`  ✓ ${msg}`); passed++ }
  else       { console.error(`  ✗ FAIL: ${msg}`); failed++ }
}

function dist(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)
}

function mkPanel(overrides: Partial<Panel> & {
  position?: Vec3; rotation?: Vec3
}): Panel {
  const { position = [0,0,0], rotation = [0,0,0], ...rest } = overrides
  return {
    id: 'p1', name: 'test', materialId: 'm1', roomId: '',
    contour: [[0,0],[600,0],[600,720],[0,720]],
    thickness: 18,
    edges: [{ cutAngle:90 },{ cutAngle:90 },{ cutAngle:90 },{ cutAngle:90 }],
    grainDir: undefined, grainGroup: undefined, baseFace: 'front',
    operations: [],
    transform: { position, rotation },
    ...rest,
  }
}

/** Symulacja: obróć panel z `fromTransform` do newRot, zachowując środek. */
function rotateKeepCenter(
  panel: Panel,
  newRot: Vec3,
): { position: Vec3; rotation: Vec3 } {
  const lc = panelLocalCenter(panel)
  const worldCenter = localToWorld(panel.transform, lc)
  const rotated = rotateDir(newRot, lc)
  const newPos: Vec3 = [
    worldCenter[0] - rotated[0],
    worldCenter[1] - rotated[1],
    worldCenter[2] - rotated[2],
  ]
  return { position: newPos, rotation: newRot }
}

// ── (A) gizmo: obrót 90°Z, płyta startowa [100,200,0] rot [0,0,0] ───────────

console.log('\n(A) Gizmo 90°Z — worldCenter niezmieniony:')
{
  const panel = mkPanel({ position: [100, 200, 0] })
  const lcBefore = panelLocalCenter(panel)
  const centerBefore = localToWorld(panel.transform, lcBefore)  // [400, 560, -9]

  const newRot: Vec3 = [0, 0, 90]
  const newTransform = rotateKeepCenter(panel, newRot)

  const centerAfter = localToWorld(newTransform, lcBefore)
  const d = dist(centerBefore, centerAfter)
  assert(d < 1e-6, `Δ worldCenter = ${d.toExponential(2)} < 1e-6`)
  assert(
    Math.abs(newTransform.position[0] - 760) < 1e-6 &&
    Math.abs(newTransform.position[1] - 260) < 1e-6 &&
    Math.abs(newTransform.position[2] - 0)   < 1e-6,
    `newPos = [${newTransform.position.map(v=>v.toFixed(4)).join(', ')}] (oczekiwane [760, 260, 0])`,
  )
}

// ── (B) gizmo: obrót 90°X, płyta startowa [0,0,0] rot [0,0,0] ───────────────

console.log('\n(B) Gizmo 90°X — worldCenter niezmieniony:')
{
  const panel = mkPanel({ position: [0, 0, 0] })
  const lc = panelLocalCenter(panel)
  const centerBefore = localToWorld(panel.transform, lc)   // [300, 360, -9]

  const newRot: Vec3 = [90, 0, 0]
  const newTransform = rotateKeepCenter(panel, newRot)

  const centerAfter = localToWorld(newTransform, lc)
  const d = dist(centerBefore, centerAfter)
  assert(d < 1e-6, `Δ worldCenter = ${d.toExponential(2)} < 1e-6`)
  // R_x(90°)·[300,360,-9] = [300, 9, 360] → newPos = [300-300, 360-9, -9-360] = [0, 351, -369]
  assert(
    Math.abs(newTransform.position[0] - 0)    < 1e-6 &&
    Math.abs(newTransform.position[1] - 351)  < 1e-6 &&
    Math.abs(newTransform.position[2] + 369)  < 1e-6,
    `newPos = [${newTransform.position.map(v=>v.toFixed(4)).join(', ')}] (oczekiwane [0, 351, -369])`,
  )
}

// ── (C) Inspektor +90°Z (ta sama formuła, wywołana bez gizma) ────────────────

console.log('\n(C) Inspektor +90°Z — worldCenter niezmieniony (brak gizma):')
{
  // Symulacja setRot: panel w stanie bieżącym, kliknięcie +90 na osi Z.
  const panel = mkPanel({ position: [100, 200, 0] })
  const pos  = panel.transform.position
  const rot  = panel.transform.rotation

  const lc = panelLocalCenter(panel)
  const worldCenter = localToWorld({ position: pos, rotation: rot }, lc)

  const next: Vec3 = [rot[0], rot[1], rot[2] + 90]   // +90 na Z
  const rotated = rotateDir(next, lc)
  const newPos: Vec3 = [
    worldCenter[0] - rotated[0],
    worldCenter[1] - rotated[1],
    worldCenter[2] - rotated[2],
  ]

  const centerAfter = localToWorld({ position: newPos, rotation: next }, lc)
  const d = dist(worldCenter, centerAfter)
  assert(d < 1e-6, `Δ worldCenter = ${d.toExponential(2)} < 1e-6`)
  assert(
    Math.abs(newPos[0] - 760) < 1e-6 &&
    Math.abs(newPos[1] - 260) < 1e-6 &&
    Math.abs(newPos[2] - 0)   < 1e-6,
    `newPos = [${newPos.map(v=>v.toFixed(4)).join(', ')}] (oczekiwane [760, 260, 0])`,
  )
}

// ── (D) Niezerowy obrót wyjściowy: rot [90,0,0] → nowy [90,0,90] ─────────────

console.log('\n(D) Niezerowy obrót wyjściowy rot=[90,0,0] → +90°Z — worldCenter niezmieniony:')
{
  const panel = mkPanel({ position: [100, 200, 0], rotation: [90, 0, 0] })
  const lc = panelLocalCenter(panel)
  const centerBefore = localToWorld(panel.transform, lc)
  // R_x(90°)·[300,360,-9] = [300, 9, 360] → worldCenter = [400, 209, 360]

  const newRot: Vec3 = [90, 0, 90]
  const newTransform = rotateKeepCenter(panel, newRot)

  const centerAfter = localToWorld(newTransform, lc)
  const d = dist(centerBefore, centerAfter)
  assert(d < 1e-6, `Δ worldCenter = ${d.toExponential(2)} < 1e-6`)
  // rotateDir([90,0,90], [300,360,-9]) = Rx(90°)·Rz(90°)·[300,360,-9]
  //   = Rx(90°)·[-360,300,-9] = [-360, 9, 300]
  // newPos = [400-(-360), 209-9, 360-300] = [760, 200, 60]
  assert(
    Math.abs(newTransform.position[0] - 760) < 1e-6 &&
    Math.abs(newTransform.position[1] - 200) < 1e-6 &&
    Math.abs(newTransform.position[2] - 60)  < 1e-6,
    `newPos = [${newTransform.position.map(v=>v.toFixed(4)).join(', ')}] (oczekiwane [760, 200, 60])`,
  )
}

// ── Podsumowanie ───────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(48)}`)
console.log(`Wynik: ${passed} ok, ${failed} fail`)
if (failed > 0) process.exit(1)
