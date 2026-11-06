import { Trash2 } from 'lucide-react'
import { useApp } from '../state/AppContext'
import type { Verbale } from '../types'
import { Button, Card, Field, StepHeader } from './ui'

export function StepPrescrizioni({ verbale }: { verbale: Verbale }) {
  const { addPrescrizione, updatePrescrizione, removePrescrizione } = useApp()

  return (
    <div>
      <StepHeader
        kicker="Step 4"
        title="Osservazioni e interventi"
        text="Annota inosservanze, criticità e prescrizioni, con l’intervento richiesto e il termine."
      />

      <div className="space-y-4">
        {verbale.prescrizioni.map((prescrizione, index) => (
          <Card key={prescrizione.id}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Nota {index + 1}</h3>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-danger"
                onClick={() => removePrescrizione(verbale.id, prescrizione.id)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Elimina
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Inosservanza, criticità o prescrizione" htmlFor={`oss-${prescrizione.id}`}>
                <textarea
                  id={`oss-${prescrizione.id}`}
                  className="field min-h-28"
                  value={prescrizione.osservazione}
                  onChange={(event) =>
                    updatePrescrizione(verbale.id, prescrizione.id, { osservazione: event.target.value })
                  }
                  placeholder="Es. Parapetto incompleto sul ponteggio lato est"
                />
              </Field>
              <Field label="Intervento correttivo richiesto" htmlFor={`int-${prescrizione.id}`}>
                <textarea
                  id={`int-${prescrizione.id}`}
                  className="field min-h-24"
                  value={prescrizione.intervento}
                  onChange={(event) =>
                    updatePrescrizione(verbale.id, prescrizione.id, { intervento: event.target.value })
                  }
                  placeholder="Es. Ripristinare il parapetto prima della ripresa dei lavori"
                />
              </Field>
              <Field label="Impresa destinataria" htmlFor={`dest-${prescrizione.id}`}>
                <select
                  id={`dest-${prescrizione.id}`}
                  className="field field-select"
                  value={prescrizione.impresaId}
                  onChange={(event) => {
                    const impresaId = event.target.value
                    const impresa = verbale.impresePresenti.find((item) => item.impresaId === impresaId)
                    updatePrescrizione(verbale.id, prescrizione.id, {
                      impresaId,
                      impresaNome: impresa?.ragioneSociale ?? '',
                    })
                  }}
                >
                  <option value="">Nessuna impresa</option>
                  {verbale.impresePresenti.map((impresa) => (
                    <option key={impresa.impresaId} value={impresa.impresaId}>
                      {impresa.ragioneSociale}
                    </option>
                  ))}
                  {prescrizione.impresaId &&
                  !verbale.impresePresenti.some((impresa) => impresa.impresaId === prescrizione.impresaId) ? (
                    <option value={prescrizione.impresaId}>{prescrizione.impresaNome || 'Impresa indicata'}</option>
                  ) : null}
                </select>
              </Field>
              <Field label="Termine di risoluzione" htmlFor={`termine-${prescrizione.id}`}>
                <input
                  id={`termine-${prescrizione.id}`}
                  className="field"
                  type="date"
                  value={prescrizione.termine}
                  onChange={(event) => updatePrescrizione(verbale.id, prescrizione.id, { termine: event.target.value })}
                />
              </Field>
            </div>
          </Card>
        ))}
      </div>

      {verbale.prescrizioni.length === 0 ? (
        <p className="text-sm text-muted">Nessuna osservazione. Se il sopralluogo non rileva criticità, puoi lasciare vuoto questo passo.</p>
      ) : null}

      <Button className="mt-4 w-full" variant="secondary" onClick={() => addPrescrizione(verbale.id)}>
        Aggiungi nota
      </Button>
    </div>
  )
}
