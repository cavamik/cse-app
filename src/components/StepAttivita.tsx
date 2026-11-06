import { useState } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { compressImage } from '../lib/image'
import type { Verbale } from '../types'
import { ImpresaMultiSelect } from './ImpresaMultiSelect'
import { Button, Card, Field, FileButton, StepHeader } from './ui'

export function StepAttivita({ verbale }: { verbale: Verbale }) {
  const { addAttivita, updateAttivita, removeAttivita } = useApp()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function onFile(attivitaId: string, file: File | undefined) {
    if (!file) return
    setError('')
    setBusyId(attivitaId)
    try {
      const fotoDataUrl = await compressImage(file)
      updateAttivita(verbale.id, attivitaId, { fotoDataUrl })
    } catch {
      setError('Fotografia non utilizzabile. Prova con uno scatto JPG o PNG, entro 25 MB.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <StepHeader
        kicker="Step 3"
        title="Attività in corso"
        text="Descrivi le lavorazioni osservate. La fotografia compare subito sotto la descrizione."
      />

      <div className="space-y-4">
        {verbale.attivita.map((attivita, index) => (
          <Card key={attivita.id}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Lavorazione {index + 1}</h3>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-danger"
                onClick={() => removeAttivita(verbale.id, attivita.id)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Elimina
              </button>
            </div>
            <Field label="Descrizione della lavorazione" htmlFor={`desc-${attivita.id}`}>
              <textarea
                id={`desc-${attivita.id}`}
                className="field min-h-28"
                value={attivita.descrizione}
                onChange={(event) => updateAttivita(verbale.id, attivita.id, { descrizione: event.target.value })}
                placeholder="Es. Posa di isolante in copertura, lato cortile"
              />
            </Field>
            {attivita.fotoDataUrl ? (
              <div className="mt-3 rounded-xl bg-[#ebe4d6] p-3">
                <img
                  src={attivita.fotoDataUrl}
                  alt={attivita.descrizione.trim() || 'Fotografia della lavorazione'}
                  className="mx-auto max-h-80 max-w-full rounded-lg object-contain"
                />
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    className="text-sm font-semibold text-danger"
                    onClick={() => updateAttivita(verbale.id, attivita.id, { fotoDataUrl: null })}
                  >
                    Rimuovi fotografia
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Imprese esecutrici</p>
              <ImpresaMultiSelect
                presenti={verbale.impresePresenti}
                selected={attivita.impreseIds}
                onChange={(impreseIds) => updateAttivita(verbale.id, attivita.id, { impreseIds })}
              />
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                id={`cam-${attivita.id}`}
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  void onFile(attivita.id, file)
                }}
              />
              <input
                id={`file-${attivita.id}`}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  void onFile(attivita.id, file)
                }}
              />
              <FileButton htmlFor={`cam-${attivita.id}`} className="flex-1">
                <Camera className="h-5 w-5" aria-hidden="true" />
                Scatta foto
              </FileButton>
              <FileButton htmlFor={`file-${attivita.id}`} className="flex-1">
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
                Carica
              </FileButton>
            </div>
            {busyId === attivita.id ? <p className="mt-2 text-sm text-muted">Elaborazione foto…</p> : null}
          </Card>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {verbale.attivita.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nessuna lavorazione registrata.</p>
      ) : null}

      <Button className="mt-4 w-full" variant="secondary" onClick={() => addAttivita(verbale.id)}>
        Aggiungi lavorazione
      </Button>
    </div>
  )
}
