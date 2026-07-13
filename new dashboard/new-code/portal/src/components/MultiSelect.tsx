/**
 * MultiSelect — compact Odoo-clean multi-select for filter bars. Shows
 * "Label" / "Label: value" / "Label (N)" on the trigger; a checkbox list in the
 * popover. Empty selection = no filter.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export default function MultiSelect({
  label, options, selected, onChange, width = 'auto',
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  width?: number | 'auto'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])

  const trigger =
    selected.length === 0 ? label
      : selected.length === 1 ? `${label}: ${selected[0]}`
        : `${label} (${selected.length})`

  return (
    <div ref={ref} className="relative" style={{ width: width === 'auto' ? undefined : width }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-colors w-full ${
          open || selected.length ? 'border-primary text-primary' : 'border-line text-ink-soft hover:border-primary/40'
        } bg-surface`}
      >
        <span className="truncate">{trigger}</span>
        <ChevronDown size={14} className="text-ink-faint flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 mt-1.5 min-w-[200px] max-w-[280px] bg-surface border border-line rounded-xl shadow-pop z-50 p-1.5 max-h-72 overflow-y-auto scrollbar-thin">
          {options.length === 0 && <p className="px-2.5 py-2 text-sm text-ink-faint">No options</p>}
          {options.map((opt) => {
            const on = selected.includes(opt)
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ink hover:bg-mist transition-colors text-left"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    on ? 'bg-primary border-primary text-white' : 'border-line'
                  }`}
                >
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="flex-1 truncate">{opt}</span>
              </button>
            )
          })}
          {selected.length > 0 && (
            <>
              <div className="h-px bg-line my-1.5" />
              <button
                onClick={() => onChange([])}
                className="w-full text-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink-mute hover:bg-mist"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
