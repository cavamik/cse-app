import type { ReactNode } from 'react'
import { Printer, Trash2 } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { formatDateIT, formatDateLongIT } from '../lib/format'
import type { Cantiere, ImpresaPresente, Verbale } from '../types'
import { Button, StepHeader } from './ui'

function nomiImprese(ids: string[], presenti: ImpresaPresente[]) {
  if (ids.length === 0) return 'Non assegnata'
  return ids
    .map((id) => {
      const impresa = presenti.find((item) => item.impresaId === id)
      if (!impresa) return 'Impresa rimossa'
      return impresa.ruolo ? `${impresa.ragioneSociale} · ${impresa.ruolo}` : impresa.ragioneSociale
    })
    .join(', ')
}

function testo(value: string) {
  return value.trim() ? value : 'Non indicato'
}

export function VerbaleRiepilogo({ verbale, cantiere }: { verbale: Verbale; cantiere: Cantiere }) {
  const { setStato, deleteVerbale } = useApp()

  return (
    <div>
      <div className="no-print">
        <StepHeader
          kicker="Step 6"
          title="Riepilogo del verbale"
          text="Controlla il sopralluogo prima di lasciarlo in archivio. Dal browser puoi stamparlo o salvarlo in PDF."
        />
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => window.print()}>
            <Printer className="h-5 w-5" aria-hidden="true" />
            Stampa o salva PDF
          </Button>
          {verbale.stato === 'bozza' ? (
            <Button variant="secondary" onClick={() => setStato(verbale.id, 'completato')}>
              Segna come completato
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setStato(verbale.id, 'bozza')}>
              Riapri bozza
            </Button>
          )}
        </div>
      </div>

      <article id="verbale-print" className="rounded-2xl border border-line bg-white p-4 sm:p-6">
        <header className="border-b border-line pb-4">
          <p className="text-xs font-semibold tracking-[0.16em] text-amber-deep uppercase">D.Lgs. 81/2008 · art. 92</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">Verbale di sopralluogo</h3>
          <p className="mt-1 text-sm text-muted">Coordinatore per l’esecuzione dei lavori</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Numero</dt>
              <dd className="mt-1 font-semibold">{verbale.numero}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Data</dt>
              <dd className="mt-1 font-semibold">{formatDateLongIT(verbale.data)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Stato</dt>
              <dd className="mt-1 font-semibold">{verbale.stato === 'completato' ? 'Completato' : 'Bozza'}</dd>
            </div>
          </dl>
        </header>

        <section className="mt-5">
          <h4 className="text-sm font-semibold tracking-wide text-muted uppercase">Cantiere</h4>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <Info label="Nome" value={testo(cantiere.nome)} />
            <Info label="Indirizzo" value={testo(cantiere.indirizzo)} />
            <Info label="Committente" value={testo(cantiere.committente)} />
            <Info label="Oggetto dei lavori" value={testo(cantiere.oggettoLavori)} />
          </dl>
          {cantiere.note.trim() ? (
            <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap">
              <span className="font-semibold">Note generali. </span>
              {cantiere.note}
            </p>
          ) : null}
        </section>

        <Section title="1. Imprese presenti">
          {verbale.impresePresenti.length === 0 ? (
            <Empty>Nessuna impresa registrata.</Empty>
          ) : (
            <ul className="space-y-2">
              {verbale.impresePresenti.map((impresa) => (
                <li key={impresa.impresaId} className="break-words">
                  <span className="font-semibold">{impresa.ragioneSociale || 'Senza ragione sociale'}</span>
                  <span className="text-muted"> · {impresa.ruolo || 'Ruolo non indicato'}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="2. Apprestamenti e attrezzature">
          {verbale.apprestamenti.length === 0 ? (
            <Empty>Nessun apprestamento selezionato.</Empty>
          ) : (
            <ul className="space-y-3">
              {verbale.apprestamenti.map((item) => (
                <li key={item.catalogoId} className="break-inside-avoid">
                  <p className="font-semibold">{item.nome}</p>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                    {item.funzione.trim() ? item.funzione : 'Funzione non specificata'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="3. Attività in corso">
          {verbale.attivita.length === 0 ? (
            <Empty>Nessuna lavorazione registrata.</Empty>
          ) : (
            <ol className="space-y-5">
              {verbale.attivita.map((attivita, index) => (
                <li key={attivita.id} className="break-inside-avoid">
                  <p className="text-sm font-semibold text-muted">Lavorazione {index + 1}</p>
                  <p className="mt-1 leading-relaxed whitespace-pre-wrap">
                    {attivita.descrizione.trim() || 'Descrizione non inserita'}
                  </p>
                  {attivita.fotoDataUrl ? (
                    <div className="mt-3 rounded-xl bg-[#ebe4d6] p-3">
                      <img
                        src={attivita.fotoDataUrl}
                        alt={attivita.descrizione.trim() || `Fotografia della lavorazione ${index + 1}`}
                        className="mx-auto max-h-96 max-w-full rounded-lg object-contain"
                      />
                    </div>
                  ) : null}
                  <p className="mt-2 text-sm text-muted">Imprese: {nomiImprese(attivita.impreseIds, verbale.impresePresenti)}</p>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="4. Osservazioni e interventi correttivi">
          {verbale.prescrizioni.length === 0 ? (
            <Empty>Nessuna osservazione o prescrizione.</Empty>
          ) : (
            <ol className="space-y-4">
              {verbale.prescrizioni.map((prescrizione, index) => (
                <li key={prescrizione.id} className="break-inside-avoid">
                  <p className="text-sm font-semibold text-muted">Nota {index + 1}</p>
                  <p className="mt-1 leading-relaxed whitespace-pre-wrap">
                    {prescrizione.osservazione.trim() || 'Testo non inserito'}
                  </p>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                    <Info label="Intervento" value={prescrizione.intervento.trim() || 'Non indicato'} />
                    <Info label="Impresa" value={prescrizione.impresaNome.trim() || 'Non indicata'} />
                    <Info label="Termine" value={prescrizione.termine ? formatDateIT(prescrizione.termine) : 'Non indicato'} />
                  </dl>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="5. Prossime lavorazioni">
          {verbale.prossime.length === 0 ? (
            <Empty>Nessuna attività programmata.</Empty>
          ) : (
            <ol className="space-y-4">
              {verbale.prossime.map((item, index) => (
                <li key={item.id}>
                  <p className="text-sm font-semibold text-muted">Attività {index + 1}</p>
                  <p className="mt-1 leading-relaxed whitespace-pre-wrap">
                    {item.descrizione.trim() || 'Descrizione non inserita'}
                  </p>
                  <p className="mt-1 text-sm text-muted">Imprese: {nomiImprese(item.impreseIds, verbale.impresePresenti)}</p>
                  {item.noteInterferenze.trim() ? (
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                      Interferenze: {item.noteInterferenze}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {verbale.noteProgramma.trim() ? (
            <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap">
              <span className="font-semibold">Note per PSC e layout. </span>
              {verbale.noteProgramma}
            </p>
          ) : null}
        </Section>

        <footer className="mt-8 grid gap-8 border-t border-line pt-5 sm:grid-cols-2">
          <Signature label="Firma del CSE" />
          <Signature label="Firma per presa visione" />
        </footer>
        <p className="mt-6 text-xs leading-relaxed text-muted">
          Ausilio alla verbalizzazione del sopralluogo. Non sostituisce gli adempimenti formali del coordinatore.
        </p>
      </article>

      <Button
        variant="danger"
        className="no-print mt-4 w-full"
        onClick={() => {
          if (window.confirm(`Eliminare il verbale ${verbale.numero} da questo dispositivo?`)) deleteVerbale(verbale.id)
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Elimina verbale
      </Button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 border-t border-line pt-4">
      <h4 className="font-semibold">{title}</h4>
      <div className="mt-3 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap">{value}</dd>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted">{children}</p>
}

function Signature({ label }: { label: string }) {
  return (
    <div>
      <div className="h-16 border-b border-ink/30" />
      <p className="mt-2 text-sm">{label}</p>
    </div>
  )
}
