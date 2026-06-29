import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { Field, SectionTitle } from './widgets/Field'
import { HardwareCatalogImporter } from './HardwareCatalogImporter'
import { NumberInput } from './widgets/NumberInput'
import { TextInput } from './widgets/TextInput'
import { CONNECTOR_TYPE_LABEL } from './labels'
import { CollisionsPanel } from './CollisionsPanel'

const rowBtn = (active: boolean) =>
  `flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm ${
    active ? 'bg-amber-600/30 text-amber-200' : 'hover:bg-neutral-800'
  }`

export function Sidebar() {
  const project = useProjectStore((s) => s.project)
  const selection = useProjectStore((s) => s.selection)
  const select = useProjectStore((s) => s.select)
  const removePanel = useProjectStore((s) => s.removePanel)
  const removeRoom = useProjectStore((s) => s.removeRoom)
  const removeConnector = useProjectStore((s) => s.removeConnector)
  const removeHardware = useProjectStore((s) => s.removeHardware)
  const addCabinet = useProjectStore((s) => s.addCabinet)
  const removeCabinet = useProjectStore((s) => s.removeCabinet)
  const addMaterial = useProjectStore((s) => s.addMaterial)
  const updateMaterial = useProjectStore((s) => s.updateMaterial)
  const updateSettings = useProjectStore((s) => s.updateSettings)
  const [showImporter, setShowImporter] = useState(false)

  return (
    <>
    <aside className="flex w-64 flex-shrink-0 flex-col overflow-y-auto border-r border-neutral-800 bg-neutral-900 p-2">
      <SectionTitle>Drzewo projektu</SectionTitle>

      <div className="text-xs text-neutral-500">Szafki ({project.cabinets.length})</div>
      {project.cabinets.map((cab) => (
        <div key={cab.id} className="group flex items-center">
          <button
            className={rowBtn(selection?.type === 'cabinet' && selection.id === cab.id)}
            onClick={() => select({ type: 'cabinet', id: cab.id })}
          >
            <span className="truncate">{cab.name}</span>
            <span className="ml-1 shrink-0 text-[10px] text-neutral-600">
              {cab.params.W}×{cab.params.H}×{cab.params.D}
            </span>
          </button>
          <button
            className="ml-1 hidden px-1 text-neutral-500 hover:text-red-400 group-hover:block"
            title="Usuń szafkę"
            onClick={() => removeCabinet(cab.id)}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="mt-0.5 flex gap-1">
        <button
          className="flex-1 rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
          onClick={() => addCabinet('standing')}
        >+ stojąca</button>
        <button
          className="flex-1 rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
          onClick={() => addCabinet('wall')}
        >+ wisząca</button>
        <button
          className="flex-1 rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
          onClick={() => addCabinet('base')}
        >+ dolna</button>
      </div>

      <div className="mt-2 text-xs text-neutral-500">Płyty ({project.panels.length})</div>
      {project.panels.map((p) => (
        <div key={p.id} className="group flex items-center">
          <button
            className={rowBtn(selection?.type === 'panel' && selection.id === p.id)}
            onClick={() => select({ type: 'panel', id: p.id })}
          >
            <span className="truncate">{p.name}</span>
            <span className="ml-1 shrink-0 text-[10px] text-neutral-600">{p.id.slice(0, 4)}</span>
          </button>
          <button
            className="ml-1 hidden px-1 text-neutral-500 hover:text-red-400 group-hover:block"
            title="Usuń płytę"
            onClick={() => removePanel(p.id)}
          >
            ✕
          </button>
        </div>
      ))}
      {project.panels.length === 0 && <div className="px-2 py-1 text-xs text-neutral-600">brak — dodaj „+ Płyta”</div>}

      <div className="mt-2 text-xs text-neutral-500">Pomieszczenia ({project.rooms.length})</div>
      {project.rooms.map((r) => (
        <div key={r.id} className="group flex items-center">
          <button
            className={rowBtn(selection?.type === 'room' && selection.id === r.id)}
            onClick={() => select({ type: 'room', id: r.id })}
          >
            <span className="truncate">{r.name}</span>
          </button>
          <button
            className="ml-1 hidden px-1 text-neutral-500 hover:text-red-400 group-hover:block"
            title="Usuń pomieszczenie"
            onClick={() => removeRoom(r.id)}
          >
            ✕
          </button>
        </div>
      ))}

      <div className="mt-2 text-xs text-neutral-500">Łączniki ({project.connectors.length})</div>
      {project.connectors.map((c) => {
        const pa = project.panels.find((p) => p.id === c.panelA)?.name ?? '?'
        const pb = project.panels.find((p) => p.id === c.panelB)?.name ?? '?'
        return (
          <div key={c.id} className="group flex items-center">
            <button
              className={rowBtn(selection?.type === 'connector' && selection.id === c.id)}
              onClick={() => select({ type: 'connector', id: c.id })}
            >
              <span className="truncate">
                {CONNECTOR_TYPE_LABEL[c.type]}: {pa}↔{pb}
              </span>
            </button>
            <button
              className="ml-1 hidden px-1 text-neutral-500 hover:text-red-400 group-hover:block"
              title="Usuń łącznik"
              onClick={() => removeConnector(c.id)}
            >
              ✕
            </button>
          </div>
        )
      })}

      <div className="mt-2 text-xs text-neutral-500">Okucia ({project.hardware.length})</div>
      {project.hardware.map((h) => {
        const fn = project.panels.find((p) => p.id === h.hinge?.doorPanel)?.name ?? '?'
        const sn = project.panels.find((p) => p.id === h.hinge?.sidePanel)?.name ?? '?'
        return (
          <div key={h.id} className="group flex items-center">
            <button
              className={rowBtn(selection?.type === 'hardware' && selection.id === h.id)}
              onClick={() => select({ type: 'hardware', id: h.id })}
            >
              <span className="truncate">
                Zawias: {fn}→{sn}
              </span>
              <span className="ml-1 shrink-0 text-[10px] text-neutral-600">×{h.hinge?.placement.length ?? 0}</span>
            </button>
            <button
              className="ml-1 hidden px-1 text-neutral-500 hover:text-red-400 group-hover:block"
              title="Usuń okucie"
              onClick={() => removeHardware(h.id)}
            >
              ✕
            </button>
          </div>
        )
      })}

      <button
        className="mt-1 rounded border border-neutral-700 px-2 py-0.5 text-xs hover:bg-neutral-800"
        onClick={() => setShowImporter(true)}
      >
        + Kreator okucia
      </button>

      <SectionTitle>Materiały</SectionTitle>
      {project.materials.map((m) => (
        <div key={m.id} className="mb-2 rounded border border-neutral-800 p-1.5">
          <TextInput value={m.name} onChange={(name) => updateMaterial(m.id, { name })} className="mb-1 w-full" />
          <Field label="Grubość">
            <NumberInput value={m.thickness} min={1} onChange={(thickness) => updateMaterial(m.id, { thickness })} />
          </Field>
          <Field label="Arkusz szer.">
            <NumberInput value={m.sheet.w} min={1} onChange={(w) => updateMaterial(m.id, { sheet: { ...m.sheet, w } })} />
          </Field>
          <Field label="Arkusz wys.">
            <NumberInput value={m.sheet.h} min={1} onChange={(h) => updateMaterial(m.id, { sheet: { ...m.sheet, h } })} />
          </Field>
        </div>
      ))}
      <button className="rounded border border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-800" onClick={addMaterial}>
        + Materiał
      </button>

      <SectionTitle>Ustawienia</SectionTitle>
      <Field label="Lico bazowe">
        <select
          className="rounded border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-sm"
          value={project.settings.defaultBaseFace}
          onChange={(e) => updateSettings({ defaultBaseFace: e.target.value as 'front' | 'back' })}
        >
          <option value="front">front</option>
          <option value="back">back</option>
        </select>
      </Field>

      <CollisionsPanel />
    </aside>
    {showImporter && <HardwareCatalogImporter onClose={() => setShowImporter(false)} />}
    </>
  )
}
