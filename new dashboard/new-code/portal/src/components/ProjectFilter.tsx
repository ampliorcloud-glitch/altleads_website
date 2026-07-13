/**
 * ProjectFilter — the global project multi-select dropdown for the portal top bar.
 * "All projects" (clears selection) + a checkbox per accessible project. Mirrors
 * the CRM ProjectSwitcher's affordance but allows MULTI-select. Hidden when there
 * are no projects to choose between.
 */
import { useEffect, useRef, useState } from 'react'
import { Layers, ChevronDown, Check } from 'lucide-react'
import { useProjectScope } from '../contexts/ProjectScope'

export default function ProjectFilter() {
  const { projects, selectedIds, setSelectedIds, loading } = useProjectScope()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  if (loading || projects.length === 0) return null

  const label =
    selectedIds.length === 0
      ? 'All projects'
      : selectedIds.length === 1
        ? projects.find((p) => p.project_id === selectedIds[0])?.project_name ?? '1 project'
        : `${selectedIds.length} projects`

  const toggle = (id: number) =>
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
          open ? 'border-primary text-primary' : 'border-line text-ink-soft hover:border-primary/40'
        } bg-surface`}
        title={`Project scope: ${label}`}
      >
        <Layers size={15} className="text-ink-faint flex-shrink-0" />
        <span className="max-w-[150px] truncate">{label}</span>
        <ChevronDown size={14} className="text-ink-faint flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-64 bg-surface border border-line rounded-xl shadow-pop z-50 p-1.5 max-h-80 overflow-y-auto scrollbar-thin">
          <button
            onClick={() => setSelectedIds([])}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors ${
              selectedIds.length === 0 ? 'bg-primary-light text-primary font-semibold' : 'text-ink hover:bg-mist'
            }`}
          >
            <span className="flex-1 text-left">All projects</span>
            {selectedIds.length === 0 && <Check size={15} />}
          </button>
          <div className="h-px bg-line my-1.5" />
          {projects.map((p) => {
            const on = selectedIds.includes(p.project_id)
            return (
              <button
                key={p.project_id}
                onClick={() => toggle(p.project_id)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ink hover:bg-mist transition-colors"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    on ? 'bg-primary border-primary text-white' : 'border-line'
                  }`}
                >
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="flex-1 text-left truncate">{p.project_name}</span>
              </button>
            )
          })}
          {selectedIds.length > 0 && (
            <>
              <div className="h-px bg-line my-1.5" />
              <button
                onClick={() => setSelectedIds([])}
                className="w-full text-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink-mute hover:bg-mist"
              >
                Clear ({selectedIds.length})
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
