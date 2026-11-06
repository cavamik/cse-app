import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react'
import type {
  Archive,
  AttivitaPatch,
  CantiereInput,
  PrescrizionePatch,
  ProssimaPatch,
  Verbale,
  View,
} from '../types'
import { uid } from '../lib/id'
import { loadArchive, loadView, saveArchive, saveView } from '../lib/storage'
import { reducer } from './reducer'

type AppContextValue = {
  archive: Archive
  view: View
  saveError: string | null
  goArchivio: () => void
  openCantiereForm: (cantiereId?: string) => void
  saveCantiere: (input: CantiereInput, id?: string) => void
  deleteCantiere: (id: string) => void
  startVerbale: (cantiereId: string) => void
  openVerbale: (verbaleId: string) => void
  deleteVerbale: (verbaleId: string) => void
  setPasso: (verbaleId: string, passo: number) => void
  setDataVerbale: (verbaleId: string, data: string) => void
  setStato: (verbaleId: string, stato: Verbale['stato']) => void
  addRuolo: (nome: string) => string | null
  updateImpresa: (id: string, patch: { ragioneSociale?: string; ruolo?: string }) => void
  deleteImpresa: (id: string) => void
  toggleImpresa: (verbaleId: string, impresaId: string) => void
  addImpresaAndSelect: (verbaleId: string, input: { ragioneSociale: string; ruolo: string }) => 'added' | 'existing' | 'empty'
  addApprestamentoAndSelect: (verbaleId: string, nome: string) => void
  toggleApprestamento: (verbaleId: string, catalogoId: string) => void
  setFunzioneApprestamento: (verbaleId: string, catalogoId: string, funzione: string) => void
  addAttivita: (verbaleId: string) => void
  updateAttivita: (verbaleId: string, attivitaId: string, patch: AttivitaPatch) => void
  removeAttivita: (verbaleId: string, attivitaId: string) => void
  addPrescrizione: (verbaleId: string) => void
  updatePrescrizione: (verbaleId: string, prescrizioneId: string, patch: PrescrizionePatch) => void
  removePrescrizione: (verbaleId: string, prescrizioneId: string) => void
  addProssima: (verbaleId: string) => void
  updateProssima: (verbaleId: string, itemId: string, patch: ProssimaPatch) => void
  removeProssima: (verbaleId: string, itemId: string) => void
  setNoteProgramma: (verbaleId: string, note: string) => void
  replaceArchive: (archive: Archive) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [bootState] = useState(() => {
    const archive = loadArchive()
    return { archive, view: loadView(archive) }
  })
  const [archive, dispatch] = useReducer(reducer, bootState.archive)
  const [view, setView] = useState<View>(bootState.view)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        saveArchive(archive)
        setSaveError(null)
      } catch {
        setSaveError('Memoria del browser piena. Elimina qualche fotografia o esporta una copia dell’archivio.')
      }
    }, 250)
    return () => window.clearTimeout(handle)
  }, [archive])

  useEffect(() => {
    try {
      saveView(view)
    } catch {
      setSaveError('Impossibile ricordare la schermata corrente su questo browser.')
    }
  }, [view])

  useEffect(() => {
    if (view.name === 'wizard' && !archive.verbali.some((verbale) => verbale.id === view.verbaleId)) {
      setView({ name: 'archivio' })
    }
    if (view.name === 'cantiere' && view.cantiereId && !archive.cantieri.some((cantiere) => cantiere.id === view.cantiereId)) {
      setView({ name: 'archivio' })
    }
  }, [archive.cantieri, archive.verbali, view])

  const value: AppContextValue = {
    archive,
    view,
    saveError,
    goArchivio: () => setView({ name: 'archivio' }),
    openCantiereForm: (cantiereId) => setView({ name: 'cantiere', cantiereId }),
    saveCantiere: (input, id) => {
      dispatch({ type: 'SAVE_CANTIERE', input, id })
      setView({ name: 'archivio' })
    },
    deleteCantiere: (id) => {
      dispatch({ type: 'DELETE_CANTIERE', id })
      setView({ name: 'archivio' })
    },
    startVerbale: (cantiereId) => {
      const verbaleId = uid()
      dispatch({ type: 'START_VERBALE', cantiereId, verbaleId })
      setView({ name: 'wizard', verbaleId })
    },
    openVerbale: (verbaleId) => setView({ name: 'wizard', verbaleId }),
    deleteVerbale: (verbaleId) => {
      dispatch({ type: 'DELETE_VERBALE', id: verbaleId })
      if (view.name === 'wizard' && view.verbaleId === verbaleId) setView({ name: 'archivio' })
    },
    setPasso: (verbaleId, passo) => dispatch({ type: 'SET_PASSO', verbaleId, passo }),
    setDataVerbale: (verbaleId, data) => dispatch({ type: 'SET_DATA', verbaleId, data }),
    setStato: (verbaleId, stato) => dispatch({ type: 'SET_STATO', verbaleId, stato }),
    addRuolo: (nome) => {
      const clean = nome.trim().replace(/\s+/g, ' ')
      if (!clean) return null
      const found = archive.ruoli.find((ruolo) => ruolo.toLowerCase() === clean.toLowerCase())
      if (!found) dispatch({ type: 'ADD_RUOLO', nome: clean })
      return found ?? clean
    },
    updateImpresa: (id, patch) => dispatch({ type: 'UPDATE_IMPRESA', id, patch }),
    deleteImpresa: (id) => dispatch({ type: 'DELETE_IMPRESA', id }),
    toggleImpresa: (verbaleId, impresaId) => dispatch({ type: 'TOGGLE_IMPRESA', verbaleId, impresaId }),
    addImpresaAndSelect: (verbaleId, input) => {
      const ragioneSociale = input.ragioneSociale.trim()
      if (!ragioneSociale) return 'empty'
      const existing = archive.imprese.some((impresa) => impresa.ragioneSociale.toLowerCase() === ragioneSociale.toLowerCase())
      dispatch({
        type: 'ADD_IMPRESA_AND_SELECT',
        verbaleId,
        impresa: { id: uid(), ragioneSociale, ruolo: input.ruolo },
      })
      return existing ? 'existing' : 'added'
    },
    addApprestamentoAndSelect: (verbaleId, nome) => {
      dispatch({ type: 'ADD_APPRESTAMENTO', verbaleId, nome, id: uid() })
    },
    toggleApprestamento: (verbaleId, catalogoId) => dispatch({ type: 'TOGGLE_APPRESTAMENTO', verbaleId, catalogoId }),
    setFunzioneApprestamento: (verbaleId, catalogoId, funzione) =>
      dispatch({ type: 'SET_FUNZIONE', verbaleId, catalogoId, funzione }),
    addAttivita: (verbaleId) => dispatch({ type: 'ADD_ATTIVITA', verbaleId, id: uid() }),
    updateAttivita: (verbaleId, attivitaId, patch) => dispatch({ type: 'UPDATE_ATTIVITA', verbaleId, attivitaId, patch }),
    removeAttivita: (verbaleId, attivitaId) => dispatch({ type: 'REMOVE_ATTIVITA', verbaleId, attivitaId }),
    addPrescrizione: (verbaleId) => dispatch({ type: 'ADD_PRESCRIZIONE', verbaleId, id: uid() }),
    updatePrescrizione: (verbaleId, prescrizioneId, patch) =>
      dispatch({ type: 'UPDATE_PRESCRIZIONE', verbaleId, prescrizioneId, patch }),
    removePrescrizione: (verbaleId, prescrizioneId) =>
      dispatch({ type: 'REMOVE_PRESCRIZIONE', verbaleId, prescrizioneId }),
    addProssima: (verbaleId) => dispatch({ type: 'ADD_PROSSIMA', verbaleId, id: uid() }),
    updateProssima: (verbaleId, itemId, patch) => dispatch({ type: 'UPDATE_PROSSIMA', verbaleId, itemId, patch }),
    removeProssima: (verbaleId, itemId) => dispatch({ type: 'REMOVE_PROSSIMA', verbaleId, itemId }),
    setNoteProgramma: (verbaleId, note) => dispatch({ type: 'SET_NOTE_PROGRAMMA', verbaleId, note }),
    replaceArchive: (next) => {
      dispatch({ type: 'REPLACE', archive: next })
      setView({ name: 'archivio' })
    },
  }

  return <AppContext value={value}>{children}</AppContext>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp deve essere usato dentro AppProvider')
  return context
}
