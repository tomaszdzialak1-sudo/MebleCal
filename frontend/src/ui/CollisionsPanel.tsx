import { useMemo } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useViewStore } from '../store/viewStore'
import { checkCollisions } from '../model/collisions'

export function CollisionsPanel() {
  const project = useProjectStore((s) => s.project)
  const select = useProjectStore((s) => s.select)
  const showCollisions = useViewStore((s) => s.showCollisions)

  const violations = useMemo(
    () => (showCollisions ? checkCollisions(project) : []),
    [project, showCollisions],
  )

  if (!showCollisions) return null

  return (
    <div className="mt-3 border-t border-neutral-800 pt-2">
      <div className="mb-1 text-xs font-semibold text-neutral-400">
        Kolizje ({violations.length})
      </div>
      {violations.length === 0 ? (
        <div className="px-2 py-1 text-xs text-green-500">✓ brak kolizji</div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {violations.map((v) => (
            <li key={v.id}>
              <button
                className="flex w-full items-start gap-1 rounded px-2 py-0.5 text-left text-xs hover:bg-neutral-800"
                onClick={() =>
                  v.panelIds[0] && select({ type: 'panel', id: v.panelIds[0] })
                }
                title="Kliknij, aby zaznaczyć płytę"
              >
                <span className={v.severity === 'error' ? 'text-red-400' : 'text-amber-400'}>
                  {v.severity === 'error' ? '⛔' : '⚠'}
                </span>
                <span className="text-neutral-300">{v.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
