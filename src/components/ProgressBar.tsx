import { PASSI } from '../constants'

export function ProgressBar({
  passo,
  counts,
  onSelect,
}: {
  passo: number
  counts: number[]
  onSelect: (passo: number) => void
}) {
  return (
    <div>
      <p className="text-xs font-medium text-white/70">
        Passo {passo + 1} di {PASSI.length}
      </p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Passi del verbale">
        {PASSI.map((label, index) => {
          const current = index === passo
          const count = counts[index] ?? 0
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={current}
              onClick={() => onSelect(index)}
              className={`min-h-11 shrink-0 cursor-pointer rounded-full px-3 py-2 text-sm font-semibold ${current ? 'bg-amber text-ink' : 'bg-white/15 text-white'}`}
            >
              {index + 1}. {label}
              {count > 0 ? <span className="ml-1 tabular-nums">{count}</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
