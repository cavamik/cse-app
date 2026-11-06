import { Check } from 'lucide-react'
import type { ImpresaPresente } from '../types'

export function ImpresaMultiSelect({
  presenti,
  selected,
  onChange,
}: {
  presenti: ImpresaPresente[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  if (presenti.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Nessuna impresa allo step 1. Puoi assegnarla dopo essere tornato indietro.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {presenti.map((impresa) => {
        const active = selected.includes(impresa.impresaId)
        return (
          <button
            key={impresa.impresaId}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange(
                active
                  ? selected.filter((id) => id !== impresa.impresaId)
                  : [...selected, impresa.impresaId],
              )
            }
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-left text-sm font-medium ${active ? 'border-amber bg-amber/20 text-ink' : 'border-line bg-white text-ink'}`}
          >
            {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            <span>
              {impresa.ragioneSociale}
              {impresa.ruolo ? <span className="text-muted"> · {impresa.ruolo}</span> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
