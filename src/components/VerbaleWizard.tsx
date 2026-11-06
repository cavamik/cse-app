import { useEffect } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { PASSI } from '../constants'
import { useApp } from '../state/AppContext'
import { Banner, BrandBar, Button } from './ui'
import { ProgressBar } from './ProgressBar'
import { StepImprese } from './StepImprese'
import { StepApprestamenti } from './StepApprestamenti'
import { StepAttivita } from './StepAttivita'
import { StepPrescrizioni } from './StepPrescrizioni'
import { StepProssimeLavorazioni } from './StepProssimeLavorazioni'
import { VerbaleRiepilogo } from './VerbaleRiepilogo'

export function VerbaleWizard() {
  const { archive, view, saveError, goArchivio, setPasso, setDataVerbale } = useApp()
  const verbaleId = view.name === 'wizard' ? view.verbaleId : ''
  const verbale = archive.verbali.find((item) => item.id === verbaleId)
  const cantiere = archive.cantieri.find((item) => item.id === verbale?.cantiereId)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [verbale?.passo])

  if (!verbale || !cantiere) return null

  const ultimo = verbale.passo >= PASSI.length - 1
  const counts = [
    verbale.impresePresenti.length,
    verbale.apprestamenti.length,
    verbale.attivita.length,
    verbale.prescrizioni.length,
    verbale.prossime.length,
    0,
  ]

  return (
    <div className="min-h-dvh bg-paper">
      <BrandBar className="no-print mx-auto w-full max-w-3xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-white/10"
            onClick={goArchivio}
            aria-label="Torna all'archivio"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{cantiere.nome}</h1>
            <p className="truncate text-xs text-white/70">
              {verbale.numero}
              {cantiere.indirizzo ? ` · ${cantiere.indirizzo}` : ''}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${verbale.stato === 'completato' ? 'bg-pine text-white' : 'bg-amber text-ink'}`}>
            {verbale.stato === 'completato' ? 'Completato' : 'Bozza'}
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar passo={verbale.passo} counts={counts} onSelect={(passo) => setPasso(verbale.id, passo)} />
        </div>
      </BrandBar>

      {saveError ? (
        <div className="no-print">
          <Banner>{saveError}</Banner>
        </div>
      ) : null}

      <main id="contenuto" className="mx-auto w-full max-w-3xl px-4 py-5 pb-36 print:pb-0">
        <div className="no-print mb-4 rounded-2xl border border-line bg-card px-3 py-3">
          <label htmlFor="data-sopralluogo" className="mb-1.5 block text-sm font-semibold">
            Data sopralluogo
          </label>
          <input
            id="data-sopralluogo"
            className="field"
            type="date"
            value={verbale.data}
            onChange={(event) => setDataVerbale(verbale.id, event.target.value)}
          />
        </div>

        {verbale.passo === 0 ? <StepImprese verbale={verbale} /> : null}
        {verbale.passo === 1 ? <StepApprestamenti verbale={verbale} /> : null}
        {verbale.passo === 2 ? <StepAttivita verbale={verbale} /> : null}
        {verbale.passo === 3 ? <StepPrescrizioni verbale={verbale} /> : null}
        {verbale.passo === 4 ? <StepProssimeLavorazioni verbale={verbale} /> : null}
        {verbale.passo === 5 ? <VerbaleRiepilogo verbale={verbale} cantiere={cantiere} /> : null}
      </main>

      <footer className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-3xl gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={verbale.passo === 0}
            onClick={() => setPasso(verbale.id, verbale.passo - 1)}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            Indietro
          </Button>
          <Button
            className="flex-[1.3]"
            onClick={() => (ultimo ? goArchivio() : setPasso(verbale.id, verbale.passo + 1))}
          >
            {ultimo ? 'Chiudi' : 'Avanti'}
            {ultimo ? null : <ChevronRight className="h-5 w-5" aria-hidden="true" />}
          </Button>
        </div>
      </footer>
    </div>
  )
}
