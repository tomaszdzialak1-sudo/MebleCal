import { useProjectStore } from '../store/projectStore'
import type { Cabinet } from '../model/types'
import { Field, SectionTitle } from './widgets/Field'
import { NumberInput } from './widgets/NumberInput'
import { TextInput } from './widgets/TextInput'

interface Props {
  cabinet: Cabinet
}

export function CabinetEditor({ cabinet }: Props) {
  const updateCabinet = useProjectStore((s) => s.updateCabinet)
  const project = useProjectStore((s) => s.project)

  const setParam = (patch: Partial<Cabinet['params']>) =>
    updateCabinet(cabinet.id, { params: { ...cabinet.params, ...patch } })

  const mat = project.materials.find((m) => m.id === cabinet.materialId)

  return (
    <div>
      <SectionTitle>Szafka</SectionTitle>

      <Field label="Nazwa">
        <TextInput
          value={cabinet.name}
          onChange={(name) => updateCabinet(cabinet.id, { name })}
          className="w-full"
        />
      </Field>

      <div className="mt-1 rounded border border-neutral-700 bg-neutral-800/50 px-2 py-1 text-xs text-neutral-400">
        {cabinet.type === 'standing' && 'Szafka stojąca'}
        {cabinet.type === 'wall'     && 'Szafka wisząca'}
        {cabinet.type === 'base'     && 'Szafka dolna (z cokołem)'}
      </div>

      <SectionTitle>Wymiary</SectionTitle>
      <Field label="Szerokość W">
        <NumberInput value={cabinet.params.W} min={100} onChange={(W) => setParam({ W })} />
      </Field>
      <Field label="Wysokość H">
        <NumberInput value={cabinet.params.H} min={100} onChange={(H) => setParam({ H })} />
      </Field>
      <Field label="Głębokość D">
        <NumberInput value={cabinet.params.D} min={100} onChange={(D) => setParam({ D })} />
      </Field>
      <Field label="Grubość płyty T">
        <NumberInput value={cabinet.params.T} min={6} max={36} onChange={(T) => setParam({ T })} />
      </Field>
      <Field label="Grubość plecy">
        <NumberInput value={cabinet.params.backT} min={2} max={18} onChange={(backT) => setParam({ backT })} />
      </Field>

      {cabinet.type === 'base' && (
        <Field label="Cokół H">
          <NumberInput
            value={cabinet.params.plinth ?? 100}
            min={0} max={300}
            onChange={(plinth) => setParam({ plinth })}
          />
        </Field>
      )}

      <SectionTitle>Drzwi i półki</SectionTitle>
      <Field label="Drzwi">
        <select
          className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm"
          value={cabinet.params.doors}
          onChange={(e) => setParam({ doors: Number(e.target.value) as 0 | 1 | 2 })}
        >
          <option value={0}>brak</option>
          <option value={1}>1 drzwi</option>
          <option value={2}>2 drzwi</option>
        </select>
      </Field>
      <Field label="Półki">
        <NumberInput
          value={cabinet.params.shelves}
          min={0} max={10}
          onChange={(shelves) => setParam({ shelves: Math.round(shelves) })}
        />
      </Field>

      <SectionTitle>Materiał i pokój</SectionTitle>
      <Field label="Materiał">
        <select
          className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm"
          value={cabinet.materialId}
          onChange={(e) => updateCabinet(cabinet.id, { materialId: e.target.value })}
        >
          {project.materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </Field>
      {mat && (
        <div className="mt-0.5 px-1 text-xs text-neutral-500">
          grubość z materiału: {mat.thickness} mm
        </div>
      )}
      <Field label="Pokój">
        <select
          className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm"
          value={cabinet.roomId}
          onChange={(e) => updateCabinet(cabinet.id, { roomId: e.target.value })}
        >
          {project.rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </Field>

      <SectionTitle>Pozycja (świat)</SectionTitle>
      {(['X', 'Y', 'Z'] as const).map((axis, i) => (
        <Field key={axis} label={axis}>
          <NumberInput
            value={cabinet.position[i]}
            onChange={(v) => {
              const pos: [number, number, number] = [...cabinet.position] as [number, number, number]
              pos[i] = v
              updateCabinet(cabinet.id, { position: pos })
            }}
          />
        </Field>
      ))}
    </div>
  )
}
