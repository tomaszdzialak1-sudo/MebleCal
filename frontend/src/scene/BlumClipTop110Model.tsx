/**
 * Blum CLIP top BLUMOTION 110° – standalone local geometry model.
 *
 * Local coordinate system (all dims in mm):
 *   X  = arm direction  (X=0 = cup centre, X≈100 = far edge of cabinet plate)
 *   Y  = hinge axis     (along door edge, Y=0 = hinge centre)
 *   Z  = offset from mounting surface  (Z=0 = door inner face,
 *                                        Z<0 = into panel, Z>0 = into room)
 *
 * Groups for animation:
 *   doorCupPart     – cup + boss housing + wings  (rotates with door)
 *   hingeArmPart    – connecting arm bars         (complex 4-bar motion)
 *   cabinetPlatePart – mounting plate             (static on cabinet)
 *
 * Geometry primitives: boxGeometry, cylinderGeometry, torusGeometry only.
 * Dimensions derived from Blum technical data and DAE mesh analysis:
 *   cup Ø35×13mm, boss 34×27×18mm, arm 50×14×9mm (two bars),
 *   plate 53×42×3.5mm, screw holes at Y=±22.5mm (cup) and Y=±21mm (plate).
 */

import type { HingeFinish } from '../model/hardware-visuals'

export type { HingeFinish as HingeVariant }

interface Props {
  variant?: HingeFinish
}

type MatProps = { color: string; metalness: number; roughness: number }
type Colors = { main: MatProps; dark: MatProps; bright: MatProps }

const GRAY: Colors = {
  main:   { color: '#b3b0a7', metalness: 0.68, roughness: 0.24 },
  dark:   { color: '#2a2c31', metalness: 0.78, roughness: 0.28 },
  bright: { color: '#d5d2c9', metalness: 0.60, roughness: 0.20 },
}

const BLACK: Colors = {
  main:   { color: '#242629', metalness: 0.82, roughness: 0.20 },
  dark:   { color: '#0d0f11', metalness: 0.80, roughness: 0.28 },
  bright: { color: '#333740', metalness: 0.78, roughness: 0.18 },
}

// cylinderGeometry axis is Y by default; rotate [π/2, 0, 0] to align with Z.
const ROT_Y_TO_Z = [Math.PI / 2, 0, 0] as [number, number, number]

export function BlumClipTop110Model({ variant = 'gray' }: Props) {
  const c: Colors = variant === 'black' ? BLACK : GRAY

  return (
    <group name="blum-clip-top-110-local">

      {/* ───────────────────────────────────────── doorCupPart ──── */}
      {/* Entire door-side assembly.  Pivot axis = Y at X=0. */}
      <group name="doorCupPart">

        {/* Cup cylinder: Ø35 mm, 13 mm into panel (Z < 0) */}
        <mesh position={[0, 0, -6.5]} rotation={ROT_Y_TO_Z}>
          <cylinderGeometry args={[17.5, 17.5, 13, 32]} />
          <meshStandardMaterial {...c.main} />
        </mesh>

        {/* Cup bottom disc – visual closure inside panel */}
        <mesh position={[0, 0, -13.2]} rotation={ROT_Y_TO_Z}>
          <cylinderGeometry args={[17, 17, 0.5, 32]} />
          <meshStandardMaterial {...c.dark} />
        </mesh>

        {/* Cup rim ring at mounting surface */}
        <mesh position={[0, 0, 0.4]}>
          <torusGeometry args={[17.5, 1.8, 10, 32]} />
          <meshStandardMaterial {...c.dark} />
        </mesh>

        {/* Boss housing body – main dark block raised above door surface */}
        {/* X: 0–34  Y: ±13.5  Z: 0–18 */}
        <mesh position={[17, 0, 9]}>
          <boxGeometry args={[34, 27, 18]} />
          <meshStandardMaterial {...c.dark} />
        </mesh>

        {/* Bright metal top cap / cover plate on boss */}
        <mesh position={[22, 0, 18.2]}>
          <boxGeometry args={[20, 22, 0.8]} />
          <meshStandardMaterial {...c.bright} />
        </mesh>

        {/* Left wing / saddle flange (overlaps boss edge at Y≈13) */}
        <mesh position={[4, 19, 5]}>
          <boxGeometry args={[20, 11, 9]} />
          <meshStandardMaterial {...c.bright} />
        </mesh>

        {/* Right wing / saddle flange */}
        <mesh position={[4, -19, 5]}>
          <boxGeometry args={[20, 11, 9]} />
          <meshStandardMaterial {...c.bright} />
        </mesh>

        {/* CLIP snap release tab left (visible on outer edge of wing) */}
        <mesh position={[24, 15, 8.5]}>
          <boxGeometry args={[14, 2.5, 9]} />
          <meshStandardMaterial {...c.bright} />
        </mesh>

        {/* CLIP snap release tab right */}
        <mesh position={[24, -15, 8.5]}>
          <boxGeometry args={[14, 2.5, 9]} />
          <meshStandardMaterial {...c.bright} />
        </mesh>

        {/* Cup mounting screw heads – Blum spec: 45 mm apart, 9.5 mm from cup */}
        {/* left screw */}
        <mesh position={[9.5, 22.5, 0.5]} rotation={ROT_Y_TO_Z}>
          <cylinderGeometry args={[2.8, 2.8, 1, 16]} />
          <meshStandardMaterial {...c.bright} />
        </mesh>
        {/* right screw */}
        <mesh position={[9.5, -22.5, 0.5]} rotation={ROT_Y_TO_Z}>
          <cylinderGeometry args={[2.8, 2.8, 1, 16]} />
          <meshStandardMaterial {...c.bright} />
        </mesh>

      </group>

      {/* ───────────────────────────────────────── hingeArmPart ──── */}
      {/* Connecting arm (simplified from 4-bar linkage). */}
      <group name="hingeArmPart">

        {/* Primary arm bar – outer dark shell, X: 22–72 */}
        <mesh position={[47, 0, 11.5]}>
          <boxGeometry args={[50, 14, 9]} />
          <meshStandardMaterial {...c.dark} />
        </mesh>

        {/* Inner bright slider rail – characteristic CLIP top appearance */}
        <mesh position={[46, 0, 14]}>
          <boxGeometry args={[28, 10, 4]} />
          <meshStandardMaterial {...c.main} />
        </mesh>

        {/* Secondary (lower) arm bar – parallelogram mechanism, X: 26–68 */}
        <mesh position={[47, 0, 7.5]}>
          <boxGeometry args={[42, 7.5, 3.5]} />
          <meshStandardMaterial {...c.main} />
        </mesh>

        {/* Door-side pivot knuckle joint */}
        <mesh position={[23, 0, 10]}>
          <boxGeometry args={[9, 13, 11.5]} />
          <meshStandardMaterial {...c.main} />
        </mesh>

        {/* Cabinet-side clip end (snaps onto plate tower) */}
        <mesh position={[72, 0, 10]}>
          <boxGeometry args={[9, 13, 11.5]} />
          <meshStandardMaterial {...c.main} />
        </mesh>

        {/* Step / bridge near door pivot (arm shape offset) */}
        <mesh position={[30, 0, 14.5]}>
          <boxGeometry args={[8, 10, 6]} />
          <meshStandardMaterial {...c.main} />
        </mesh>

        {/* BLUMOTION soft-close insert – bright indicator strip on top */}
        <mesh position={[52, 0, 16.3]}>
          <boxGeometry args={[14, 8, 1.2]} />
          <meshStandardMaterial {...c.bright} />
        </mesh>

      </group>

      {/* ─────────────────────────────────────── cabinetPlatePart ── */}
      {/* Mounting plate screwed to cabinet side wall (static). */}
      <group name="cabinetPlatePart">

        {/* Main flat plate – from DAE: 53 mm wide, 42 mm deep, 3.5 mm thick */}
        {/* X: 72–114  Y: ±26.5  Z: 0–3.5 */}
        <mesh position={[93, 0, 1.75]}>
          <boxGeometry args={[42, 53, 3.5]} />
          <meshStandardMaterial {...c.main} />
        </mesh>

        {/* Narrowed front tongue where arm clips in (DAE: 11 mm wide) */}
        <mesh position={[73.5, 0, 1.75]}>
          <boxGeometry args={[9, 11, 3.5]} />
          <meshStandardMaterial {...c.main} />
        </mesh>

        {/* Raised arm-reception tower (arm end clips into this from the front) */}
        {/* X: 68–79  Y: ±19  Z: 0–22 */}
        <mesh position={[73, 0, 11]}>
          <boxGeometry args={[11, 38, 22]} />
          <meshStandardMaterial {...c.dark} />
        </mesh>

        {/* Top bright strip on tower (visible snap ledge) */}
        <mesh position={[73, 0, 22.2]}>
          <boxGeometry args={[11, 34, 0.8]} />
          <meshStandardMaterial {...c.bright} />
        </mesh>

        {/* Plate screw slots – Blum spec: Y = ±21 mm from centre */}
        {/* left slot */}
        <mesh position={[93, 21, 3.8]} rotation={ROT_Y_TO_Z}>
          <cylinderGeometry args={[4, 4, 1, 20]} />
          <meshStandardMaterial {...c.dark} />
        </mesh>
        {/* right slot */}
        <mesh position={[93, -21, 3.8]} rotation={ROT_Y_TO_Z}>
          <cylinderGeometry args={[4, 4, 1, 20]} />
          <meshStandardMaterial {...c.dark} />
        </mesh>

      </group>

    </group>
  )
}
