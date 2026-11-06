import { useMemo, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { useApp } from '../state/AppContext'
import type { Verbale } from '../types'
import { RoleSelect } from './RoleSelect'
import { Button, Card, Field, Hint, StepHeader } from './ui'

export function StepImprese({ verbale }: { verbale: Verbale }) {
  const { archive, toggleImpresa, updateImpresa, deleteImpresa, addImpresaAndSelect } = useApp()
  const [creating, setCreating] = useState(false)
  const [nome, setNome] = useState('')
  const [ruolo, setRuolo] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const selected = new Set(verbale.impresePresenti.map((impresa) => impresa.impresaId))
  const needle = query.trim().toLowerCase()
  const archiveList = useMemo(
    () =>
      [...archive.imprese]
        .filter((impresa) => impresa.ragioneSociale.toLowerCase().includes(needle) || impresa.ruolo.toLowerCase().includes(needle))
        .sort((a, b) => a.ragioneSociale.localeCompare(b.ragioneSociale, 'it')),
    [archive.imprese, needle],
  )

  function submitNew() {
    const result = addImpresaAndSelect(verbale.id, { ragioneSociale: nome, ruolo })
    if (result === 'empty') {
      setMessage('Inserisci la ragione sociale.')
      return
    }
    setMessage(result === 'existing' ? 'Impresa già in archivio: selezionata per oggi.' : '')
    setNome('')
    setRuolo('')
    setCreating(false)
  }

  return (
    <div>
      <StepHeader
        kicker="Step 1"
        title="Imprese presenti"
        text="Segna chi è in cantiere oggi. Puoi scegliere dall’archivio oppure inserire un’impresa al volo."
      />

      {verbale.impresePresenti.length === 0 ? (
        <Hint>Nessuna impresa selezionata. Puoi proseguire comunque e annotarlo nelle prescrizioni.</Hint>
      ) : (
        <div className="space-y-3">
          {verbale.impresePresenti.map((impresa, index) => (
            <Card key={impresa.impresaId} className="border-amber/70 bg-amber/10">
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-amber-deep">In cantiere · {index + 1}</p>
                <button
                  type="button"
                  className="text-sm font-semibold text-ink"
                  onClick={() => toggleImpresa(verbale.id, impresa.impresaId)}
                >
                  Togli
                </button>
              </div>
              <div className="space-y-3">
                <Field label="Ragione sociale" htmlFor={`rs-${impresa.impresaId}`}>
                  <input
                    id={`rs-${impresa.impresaId}`}
                    className="field"
                    value={impresa.ragioneSociale}
                    onChange={(event) => updateImpresa(impresa.impresaId, { ragioneSociale: event.target.value })}
                  />
                </Field>
                <Field label="Ruolo / specializzazione">
                  <RoleSelect value={impresa.ruolo} onChange={(next) => updateImpresa(impresa.impresaId, { ruolo: next })} />
                </Field>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-5">
        {creating ? (
          <Card>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                submitNew()
              }}
            >
              <Field label="Ragione sociale" htmlFor="nuova-impresa" required>
                <input
                  id="nuova-impresa"
                  className="field"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Es. Rossi Costruzioni Srl"
                  autoComplete="organization"
                />
              </Field>
              <Field label="Ruolo / specializzazione">
                <RoleSelect value={ruolo} onChange={setRuolo} />
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="sm:flex-1">
                  Salva e seleziona
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setCreating(false)
                    setMessage('')
                  }}
                >
                  Annulla
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setCreating(true)}>
            Nuova impresa
          </Button>
        )}
        {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">Archivio imprese</h3>
        <input
          className="field mt-3"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca in archivio"
          aria-label="Cerca impresa"
        />
        {archive.imprese.length === 0 ? (
          <p className="mt-3 text-sm text-muted">L’archivio è vuoto. La prima impresa che inserisci resta disponibile per i prossimi sopralluoghi.</p>
        ) : archiveList.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nessuna impresa trovata.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {archiveList.map((impresa) => {
              const active = selected.has(impresa.id)
              return (
                <li key={impresa.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleImpresa(verbale.id, impresa.id)}
                    className={`flex min-h-14 flex-1 cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 text-left ${active ? 'border-amber bg-amber/15' : 'border-line bg-card'}`}
                  >
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${active ? 'border-amber bg-amber text-ink' : 'border-line'}`}>
                      {active ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold break-words">{impresa.ragioneSociale}</span>
                      <span className="block text-sm text-muted">{impresa.ruolo || 'Ruolo non indicato'}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="grid w-12 shrink-0 cursor-pointer place-items-center rounded-2xl border border-line bg-card text-danger"
                    aria-label={`Elimina ${impresa.ragioneSociale} dall'archivio`}
                    onClick={() => {
                      if (window.confirm(`Eliminare ${impresa.ragioneSociale} dall’archivio? Le bozze aperte non la includeranno più.`)) {
                        deleteImpresa(impresa.id)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
