import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useApp } from '../state/AppContext'
import type { Verbale } from '../types'
import { Button, Card, Field, StepHeader } from './ui'

export function StepApprestamenti({ verbale }: { verbale: Verbale }) {
  const { archive, toggleApprestamento, setFunzioneApprestamento, addApprestamentoAndSelect } = useApp()
  const [query, setQuery] = useState('')
  const [nome, setNome] = useState('')
  const [open, setOpen] = useState(false)
  const needle = query.trim().toLowerCase()
  const selected = new Set(verbale.apprestamenti.map((item) => item.catalogoId))
  const catalogo = useMemo(
    () =>
      [...archive.apprestamenti]
        .filter((item) => item.nome.toLowerCase().includes(needle))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'it')),
    [archive.apprestamenti, needle],
  )

  return (
    <div>
      <StepHeader
        kicker="Step 2"
        title="Apprestamenti e attrezzature"
        text="Seleziona ciò che è presente e descrivi la funzione nel sopralluogo di oggi."
      />

      {verbale.apprestamenti.length > 0 ? (
        <div className="space-y-3">
          {verbale.apprestamenti.map((item) => (
            <Card key={item.catalogoId} className="border-amber/70 bg-amber/10">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="font-semibold break-words">{item.nome}</h3>
                <button
                  type="button"
                  className="shrink-0 text-sm font-semibold"
                  onClick={() => toggleApprestamento(verbale.id, item.catalogoId)}
                >
                  Rimuovi
                </button>
              </div>
              <Field label="Funzione / utilizzo" htmlFor={`funzione-${item.catalogoId}`}>
                <textarea
                  id={`funzione-${item.catalogoId}`}
                  className="field min-h-24"
                  value={item.funzione}
                  onChange={(event) => setFunzioneApprestamento(verbale.id, item.catalogoId, event.target.value)}
                  placeholder="Es. accesso in copertura per posa isolamento"
                />
              </Field>
            </Card>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-white px-3 py-3 text-sm text-muted">Nessun apprestamento selezionato.</p>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">Elenco generale</h3>
        <input
          className="field mt-3"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca un apprestamento"
          aria-label="Cerca apprestamento"
        />
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {catalogo.map((item) => {
            const active = selected.has(item.id)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleApprestamento(verbale.id, item.id)}
                  className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 text-left text-sm font-medium ${active ? 'border-amber bg-amber/15' : 'border-line bg-card'}`}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${active ? 'border-amber bg-amber text-ink' : 'border-line'}`}>
                    {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                  </span>
                  <span className="break-words">{item.nome}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {catalogo.length === 0 ? <p className="mt-3 text-sm text-muted">Nessun apprestamento trovato.</p> : null}

        <div className="mt-4">
          {open ? (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (!nome.trim()) return
                addApprestamentoAndSelect(verbale.id, nome)
                setNome('')
                setOpen(false)
              }}
            >
              <Field label="Nuovo apprestamento" htmlFor="nuovo-apprestamento">
                <input
                  id="nuovo-apprestamento"
                  className="field"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Es. Ponteggio di servizio lato nord"
                />
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={!nome.trim()}>
                  Aggiungi all’elenco
                </Button>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Annulla
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Nuovo apprestamento
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
