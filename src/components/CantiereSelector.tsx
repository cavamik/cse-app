import { useRef, useState } from 'react'
import { Building2, ChevronRight, HardHat, MapPin, Plus, Search, Trash2 } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { downloadArchive, parseArchive } from '../lib/storage'
import { formatDateIT } from '../lib/format'
import { Badge, BrandBar, Button, Card } from './ui'

export function CantiereSelector() {
  const { archive, openCantiereForm, startVerbale, openVerbale, deleteVerbale, replaceArchive, saveError } = useApp()
  const [query, setQuery] = useState('')
  const [importError, setImportError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const needle = query.trim().toLowerCase()
  const cantieri = [...archive.cantieri]
    .filter((cantiere) => {
      if (!needle) return true
      return [cantiere.nome, cantiere.indirizzo, cantiere.committente, cantiere.oggettoLavori]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  function onImport(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseArchive(JSON.parse(String(reader.result)))
        if (!parsed) {
          setImportError('Questo file non contiene un archivio CSE riconoscibile.')
          return
        }
        if (!window.confirm('Sostituire l’archivio di questo dispositivo con il file scelto?')) return
        setImportError('')
        replaceArchive(parsed)
      } catch {
        setImportError('Impossibile leggere il file.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-dvh bg-paper">
      <BrandBar className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10">
          <HardHat className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.16em] text-amber uppercase">CSE · D.Lgs. 81/08</p>
          <h1 className="truncate text-lg font-semibold">Archivio cantieri</h1>
        </div>
        <Button className="shrink-0 bg-amber text-ink hover:bg-amber/90" onClick={() => openCantiereForm()}>
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Nuovo cantiere</span>
          <span className="sm:hidden">Nuovo</span>
        </Button>
      </BrandBar>

      {saveError ? <p className="bg-danger-soft px-4 py-3 text-sm text-danger">{saveError}</p> : null}

      <main className="mx-auto w-full max-w-5xl px-4 py-5">
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Seleziona un cantiere e avvia il verbale di sopralluogo. I dati restano su questo dispositivo.
        </p>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            className="field pr-4 pl-11"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca per nome, indirizzo o committente"
            aria-label="Cerca cantiere"
          />
        </div>

        {archive.cantieri.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-card px-5 py-10 text-center">
            <Building2 className="mx-auto h-8 w-8 text-amber-deep" aria-hidden="true" />
            <h2 className="mt-3 text-xl font-semibold">Nessun cantiere in archivio</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              Crea la scheda del cantiere prima del sopralluogo: nome, indirizzo, committente e oggetto dei lavori.
            </p>
            <Button className="mt-5" onClick={() => openCantiereForm()}>
              <Plus className="h-5 w-5" aria-hidden="true" />
              Nuovo cantiere
            </Button>
          </div>
        ) : cantieri.length === 0 ? (
          <p className="mt-6 text-sm text-muted">Nessun cantiere corrisponde alla ricerca.</p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {cantieri.map((cantiere) => {
              const verbali = archive.verbali
                .filter((verbale) => verbale.cantiereId === cantiere.id)
                .sort((a, b) => b.data.localeCompare(a.data) || b.createdAt.localeCompare(a.createdAt))
              return (
                <Card key={cantiere.id} className="flex flex-col">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold break-words">{cantiere.nome}</h2>
                    {cantiere.indirizzo ? (
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{cantiere.indirizzo}</span>
                      </p>
                    ) : null}
                    {cantiere.committente ? (
                      <p className="mt-2 text-sm">
                        <span className="text-muted">Committente · </span>
                        {cantiere.committente}
                      </p>
                    ) : null}
                    {cantiere.oggettoLavori ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink">{cantiere.oggettoLavori}</p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button className="sm:flex-1" onClick={() => startVerbale(cantiere.id)}>
                      Nuovo verbale
                    </Button>
                    <Button variant="secondary" onClick={() => openCantiereForm(cantiere.id)}>
                      Modifica
                    </Button>
                  </div>

                  <div className="mt-4 border-t border-line pt-3">
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                      {verbali.length === 0 ? 'Nessun verbale' : `${verbali.length} verbal${verbali.length === 1 ? 'e' : 'i'}`}
                    </p>
                    <ul className="mt-1">
                      {verbali.map((verbale) => (
                        <li key={verbale.id} className="flex items-center gap-1 border-b border-line/80 last:border-b-0">
                          <button
                            type="button"
                            className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 py-2 text-left"
                            onClick={() => openVerbale(verbale.id)}
                          >
                            <span className="font-semibold">{verbale.numero}</span>
                            <span className="text-sm text-muted">{formatDateIT(verbale.data)}</span>
                            <Badge stato={verbale.stato} />
                            <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-danger"
                            aria-label={`Elimina verbale ${verbale.numero}`}
                            onClick={() => {
                              if (window.confirm(`Eliminare il verbale ${verbale.numero} da questo dispositivo?`)) {
                                deleteVerbale(verbale.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-muted">
            Copia di sicurezza: esporta l’archivio prima di cambiare browser o dispositivo.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => downloadArchive(archive)}>
              Esporta
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              Importa
            </Button>
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) onImport(file)
              }}
            />
          </div>
        </div>
        {importError ? <p className="mt-3 text-sm text-danger">{importError}</p> : null}
      </main>
    </div>
  )
}
