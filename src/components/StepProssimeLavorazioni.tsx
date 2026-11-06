import { Trash2 } from 'lucide-react'
import { useApp } from '../state/AppContext'
import type { Verbale } from '../types'
import { ImpresaMultiSelect } from './ImpresaMultiSelect'
import { Button, Card, Field, StepHeader } from './ui'

export function StepProssimeLavorazioni({ verbale }: { verbale: Verbale }) {
  const { addProssima, updateProssima, removeProssima, setNoteProgramma } = useApp()

  return (
    <div>
      <StepHeader
        kicker="Step 5"
        title="Prossime lavorazioni"
        text="Annota le attività previste nei giorni successivi, per interferenze, PSC e layout di cantiere."
      />

      <div className="space-y-4">
        {verbale.prossime.map((item, index) => (
          <Card key={item.id}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Attività prevista {index + 1}</h3>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-danger"
                onClick={() => removeProssima(verbale.id, item.id)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Elimina
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Descrizione" htmlFor={`prog-${item.id}`}>
                <textarea
                  id={`prog-${item.id}`}
                  className="field min-h-24"
                  value={item.descrizione}
                  onChange={(event) => updateProssima(verbale.id, item.id, { descrizione: event.target.value })}
                  placeholder="Es. Getto del solaio di copertura, previsto giovedì"
                />
              </Field>
              <div>
                <p className="mb-2 text-sm font-semibold">Imprese interessate</p>
                <ImpresaMultiSelect
                  presenti={verbale.impresePresenti}
                  selected={item.impreseIds}
                  onChange={(impreseIds) => updateProssima(verbale.id, item.id, { impreseIds })}
                />
              </div>
              <Field label="Note su interferenze" htmlFor={`inter-${item.id}`}>
                <textarea
                  id={`inter-${item.id}`}
                  className="field min-h-20"
                  value={item.noteInterferenze}
                  onChange={(event) => updateProssima(verbale.id, item.id, { noteInterferenze: event.target.value })}
                  placeholder="Es. Sovrapposizione con la PLE sul fronte ovest"
                />
              </Field>
            </div>
          </Card>
        ))}
      </div>

      <Button className="mt-4 w-full" variant="secondary" onClick={() => addProssima(verbale.id)}>
        Aggiungi attività prevista
      </Button>

      <Card className="mt-5">
        <Field
          label="Note per PSC e layout"
          htmlFor="note-programma"
          hint="Aggiornamenti del piano, viabilità, aree di deposito o fasi da ricontrollare."
        >
          <textarea
            id="note-programma"
            className="field min-h-32"
            value={verbale.noteProgramma}
            onChange={(event) => setNoteProgramma(verbale.id, event.target.value)}
          />
        </Field>
      </Card>
    </div>
  )
}
