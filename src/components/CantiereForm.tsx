import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useApp } from '../state/AppContext'
import type { CantiereInput } from '../types'
import { BrandBar, Button, Card, Field } from './ui'

const empty: CantiereInput = {
  nome: '',
  indirizzo: '',
  committente: '',
  oggettoLavori: '',
  note: '',
}

export function CantiereForm() {
  const { archive, view, goArchivio, saveCantiere, deleteCantiere } = useApp()
  const cantiereId = view.name === 'cantiere' ? view.cantiereId : undefined
  const existing = archive.cantieri.find((cantiere) => cantiere.id === cantiereId)
  const [input, setInput] = useState<CantiereInput>(
    existing
      ? {
          nome: existing.nome,
          indirizzo: existing.indirizzo,
          committente: existing.committente,
          oggettoLavori: existing.oggettoLavori,
          note: existing.note,
        }
      : empty,
  )
  const [baseline] = useState(() => JSON.stringify(existing ? input : empty))

  function update<K extends keyof CantiereInput>(key: K, value: CantiereInput[K]) {
    setInput((current) => ({ ...current, [key]: value }))
  }

  function close() {
    if (JSON.stringify(input) !== baseline && !window.confirm('Uscire senza salvare le modifiche?')) return
    goArchivio()
  }

  return (
    <div className="min-h-dvh bg-paper">
      <BrandBar className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-white/10"
          onClick={close}
          aria-label="Torna all'archivio"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-lg font-semibold">{existing ? 'Modifica cantiere' : 'Nuovo cantiere'}</h1>
      </BrandBar>

      <main className="mx-auto w-full max-w-3xl px-4 py-5">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!input.nome.trim()) return
            saveCantiere(input, existing?.id)
          }}
        >
          <Card className="space-y-4">
            <Field label="Nome / identificativo" htmlFor="nome" required>
              <input
                id="nome"
                className="field"
                value={input.nome}
                onChange={(event) => update('nome', event.target.value)}
                required
                autoComplete="off"
                placeholder="Es. Cantiere Aurora — lotto 2"
              />
            </Field>
            <Field label="Indirizzo" htmlFor="indirizzo">
              <input
                id="indirizzo"
                className="field"
                value={input.indirizzo}
                onChange={(event) => update('indirizzo', event.target.value)}
                autoComplete="street-address"
                placeholder="Via, numero, comune"
              />
            </Field>
            <Field label="Committente" htmlFor="committente">
              <input
                id="committente"
                className="field"
                value={input.committente}
                onChange={(event) => update('committente', event.target.value)}
                autoComplete="organization"
              />
            </Field>
            <Field label="Oggetto dei lavori" htmlFor="oggetto">
              <textarea
                id="oggetto"
                className="field min-h-28"
                value={input.oggettoLavori}
                onChange={(event) => update('oggettoLavori', event.target.value)}
                placeholder="Descrizione sintetica dell'opera"
              />
            </Field>
            <Field label="Note generali" htmlFor="note" hint="Accessi, fasi, riferimenti di PSC o particolarità del sito.">
              <textarea
                id="note"
                className="field min-h-28"
                value={input.note}
                onChange={(event) => update('note', event.target.value)}
              />
            </Field>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="sm:flex-1" disabled={!input.nome.trim()}>
              Salva cantiere
            </Button>
            <Button type="button" variant="secondary" onClick={close}>
              Annulla
            </Button>
          </div>
        </form>

        {existing ? (
          <Button
            variant="danger"
            className="mt-8 w-full"
            onClick={() => {
              if (window.confirm('Eliminare il cantiere e tutti i verbali collegati da questo dispositivo?')) {
                deleteCantiere(existing.id)
              }
            }}
          >
            Elimina cantiere
          </Button>
        ) : null}
      </main>
    </div>
  )
}
