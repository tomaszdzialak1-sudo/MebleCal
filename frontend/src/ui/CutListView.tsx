import { useMemo } from 'react'
import { useProjectStore } from '../store/projectStore'
import { buildCutList } from '../model/cutlist'
import { nest } from '../model/nesting'
import type { Material } from '../model/types'
import type { NestResult } from '../model/nesting'
import { SheetLayout2D } from './SheetLayout2D'
import { NumberInput } from './widgets/NumberInput'
import { Field } from './widgets/Field'

// Etykiety krawędzi (indices 0–3 dla prostokąta).
const EDGE_LABELS = ['D', 'P', 'G', 'L'] // dół, prawo, góra, lewo
function bandingLabel(edges: number[]): string {
  return edges.length ? edges.map((i) => EDGE_LABELS[i] ?? `e${i}`).join(' ') : '—'
}

function grainLabel(dir: 0 | 90 | undefined): string {
  if (dir === 0) return '→'    // wzdłuż (X)
  if (dir === 90) return '↑'   // w górę (Y)
  return '—'
}

export function CutListView() {
  const project = useProjectStore((s) => s.project)
  const updateSettings = useProjectStore((s) => s.updateSettings)

  const cutList = useMemo(() => buildCutList(project), [project])

  const nestResults = useMemo<{ material: Material; result: NestResult }[]>(() => {
    // Grupuj formatki per materiał, nestuj każdy osobno.
    const byMat = new Map<string, typeof cutList>()
    for (const item of cutList) {
      const arr = byMat.get(item.materialId) ?? []
      arr.push(item)
      byMat.set(item.materialId, arr)
    }
    const out: { material: Material; result: NestResult }[] = []
    for (const [matId, items] of byMat) {
      const material = project.materials.find((m) => m.id === matId)
      if (!material) continue
      out.push({ material, result: nest(items, material, project.settings.kerf) })
    }
    return out
  }, [cutList, project])

  const totalSheets = nestResults.reduce((acc, r) => acc + r.result.sheetCount, 0)
  const avgWaste =
    nestResults.length > 0
      ? nestResults.reduce((acc, r) => acc + r.result.totalWastePct, 0) / nestResults.length
      : 0

  return (
    <div className="flex min-h-0 flex-col gap-4 p-4 text-sm">
      {/* Ustawienia rozkroju */}
      <section className="flex flex-wrap items-center gap-4 rounded border border-neutral-800 bg-neutral-950 p-3">
        <span className="font-semibold text-neutral-300">Ustawienia rozkroju</span>
        <Field label="Grubość ostrza (mm)">
          <NumberInput
            value={project.settings.kerf}
            min={0}
            step={0.1}
            onChange={(v) => updateSettings({ kerf: v })}
          />
        </Field>
        <Field label="Grubość obrzeża (mm)">
          <NumberInput
            value={project.settings.bandingThickness}
            min={0}
            step={0.1}
            onChange={(v) => updateSettings({ bandingThickness: v })}
          />
        </Field>
      </section>

      {/* Lista formatek */}
      <section>
        <h3 className="mb-2 font-semibold text-neutral-300">
          Lista formatek{' '}
          <span className="font-normal text-neutral-500">
            ({cutList.reduce((s, i) => s + i.qty, 0)} szt. / {cutList.length} pozycji)
          </span>
        </h3>
        {cutList.length === 0 ? (
          <p className="text-neutral-500">Brak płyt w projekcie.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-left text-neutral-500">
                  <th className="py-1 pr-3">Nazwa</th>
                  <th className="py-1 pr-3">Materiał</th>
                  <th className="py-1 pr-3">W × H cięcia</th>
                  <th className="py-1 pr-3 text-center">Szt.</th>
                  <th className="py-1 pr-3">Obrzeże</th>
                  <th className="py-1 pr-3 text-center">Słój</th>
                  <th className="py-1">Uwagi</th>
                </tr>
              </thead>
              <tbody>
                {cutList.map((item, idx) => {
                  const mat = project.materials.find((m) => m.id === item.materialId)
                  return (
                    <tr key={idx} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                      <td className="py-1 pr-3 text-neutral-200">{item.name}</td>
                      <td className="py-1 pr-3 text-neutral-400">{mat?.name ?? item.materialId}</td>
                      <td className="py-1 pr-3 font-mono text-neutral-200">
                        {item.cutW.toFixed(1)} × {item.cutH.toFixed(1)}
                      </td>
                      <td className="py-1 pr-3 text-center font-semibold text-neutral-200">{item.qty}</td>
                      <td className="py-1 pr-3 text-neutral-400">{bandingLabel(item.bandedEdges)}</td>
                      <td className="py-1 pr-3 text-center text-neutral-400">{grainLabel(item.grainDir)}</td>
                      <td className="py-1 text-amber-400">
                        {item.hasMiter ? '⚠ ukos' : ''}
                        {(item.cutW <= 0 || item.cutH <= 0) ? '⛔ ujemny wymiar' : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Podsumowanie nestingu */}
      {totalSheets > 0 && (
        <section>
          <h3 className="mb-1 font-semibold text-neutral-300">
            Nesting{' '}
            <span className="font-normal text-neutral-500">
              — {totalSheets} {totalSheets === 1 ? 'arkusz' : 'arkuszy'},{' '}
              {Math.round(avgWaste * 100)} % śr. odpad
            </span>
          </h3>
          <SheetLayout2D nestResults={nestResults} />
        </section>
      )}
    </div>
  )
}
