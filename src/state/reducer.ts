import type {
  ApprestamentoSelezionato,
  Archive,
  AttivitaPatch,
  CantiereInput,
  Impresa,
  PrescrizionePatch,
  ProssimaPatch,
  Verbale,
} from '../types'
import { nowIso, todayISO, uid } from '../lib/id'

export type Action =
  | { type: 'REPLACE'; archive: Archive }
  | { type: 'SAVE_CANTIERE'; id?: string; input: CantiereInput }
  | { type: 'DELETE_CANTIERE'; id: string }
  | { type: 'START_VERBALE'; cantiereId: string; verbaleId: string }
  | { type: 'DELETE_VERBALE'; id: string }
  | { type: 'SET_PASSO'; verbaleId: string; passo: number }
  | { type: 'SET_DATA'; verbaleId: string; data: string }
  | { type: 'SET_STATO'; verbaleId: string; stato: Verbale['stato'] }
  | { type: 'ADD_RUOLO'; nome: string }
  | { type: 'UPDATE_IMPRESA'; id: string; patch: { ragioneSociale?: string; ruolo?: string } }
  | { type: 'DELETE_IMPRESA'; id: string }
  | { type: 'TOGGLE_IMPRESA'; verbaleId: string; impresaId: string }
  | { type: 'ADD_IMPRESA_AND_SELECT'; verbaleId: string; impresa: Impresa }
  | { type: 'ADD_APPRESTAMENTO'; verbaleId: string; nome: string; id: string }
  | { type: 'TOGGLE_APPRESTAMENTO'; verbaleId: string; catalogoId: string }
  | { type: 'SET_FUNZIONE'; verbaleId: string; catalogoId: string; funzione: string }
  | { type: 'ADD_ATTIVITA'; verbaleId: string; id: string }
  | { type: 'UPDATE_ATTIVITA'; verbaleId: string; attivitaId: string; patch: AttivitaPatch }
  | { type: 'REMOVE_ATTIVITA'; verbaleId: string; attivitaId: string }
  | { type: 'ADD_PRESCRIZIONE'; verbaleId: string; id: string }
  | { type: 'UPDATE_PRESCRIZIONE'; verbaleId: string; prescrizioneId: string; patch: PrescrizionePatch }
  | { type: 'REMOVE_PRESCRIZIONE'; verbaleId: string; prescrizioneId: string }
  | { type: 'ADD_PROSSIMA'; verbaleId: string; id: string }
  | { type: 'UPDATE_PROSSIMA'; verbaleId: string; itemId: string; patch: ProssimaPatch }
  | { type: 'REMOVE_PROSSIMA'; verbaleId: string; itemId: string }
  | { type: 'SET_NOTE_PROGRAMMA'; verbaleId: string; note: string }

function withVerbale(state: Archive, verbaleId: string, update: (verbale: Verbale) => Verbale): Archive {
  const current = state.verbali.find((verbale) => verbale.id === verbaleId)
  if (!current) return state
  const updatedAt = nowIso()
  const updated = { ...update(current), updatedAt }
  return {
    ...state,
    cantieri: state.cantieri.map((cantiere) =>
      cantiere.id === current.cantiereId ? { ...cantiere, updatedAt } : cantiere,
    ),
    verbali: state.verbali.map((verbale) => (verbale.id === verbaleId ? updated : verbale)),
  }
}

function withoutImpresa(verbale: Verbale, impresaId: string): Verbale {
  return {
    ...verbale,
    impresePresenti: verbale.impresePresenti.filter((impresa) => impresa.impresaId !== impresaId),
    attivita: verbale.attivita.map((attivita) => ({
      ...attivita,
      impreseIds: attivita.impreseIds.filter((id) => id !== impresaId),
    })),
    prossime: verbale.prossime.map((item) => ({
      ...item,
      impreseIds: item.impreseIds.filter((id) => id !== impresaId),
    })),
  }
}

function nextNumero(state: Archive, cantiereId: string, data: string) {
  const year = data.slice(0, 4)
  const prefix = `VS-${year}-`
  const max = state.verbali
    .filter((verbale) => verbale.cantiereId === cantiereId && verbale.numero.startsWith(prefix))
    .reduce((highest, verbale) => {
      const value = Number(verbale.numero.slice(prefix.length))
      return Number.isFinite(value) ? Math.max(highest, value) : highest
    }, 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

function snapshotApprestamento(state: Archive, catalogoId: string): ApprestamentoSelezionato | null {
  const item = state.apprestamenti.find((apprestamento) => apprestamento.id === catalogoId)
  if (!item) return null
  return { catalogoId: item.id, nome: item.nome, funzione: '' }
}

export function reducer(state: Archive, action: Action): Archive {
  switch (action.type) {
    case 'REPLACE':
      return action.archive
    case 'SAVE_CANTIERE': {
      const input: CantiereInput = {
        nome: action.input.nome.trim(),
        indirizzo: action.input.indirizzo.trim(),
        committente: action.input.committente.trim(),
        oggettoLavori: action.input.oggettoLavori.trim(),
        note: action.input.note.trim(),
      }
      if (!input.nome) return state
      const updatedAt = nowIso()
      if (action.id) {
        return {
          ...state,
          cantieri: state.cantieri.map((cantiere) =>
            cantiere.id === action.id ? { ...cantiere, ...input, updatedAt } : cantiere,
          ),
        }
      }
      return {
        ...state,
        cantieri: [
          { id: uid(), ...input, createdAt: updatedAt, updatedAt },
          ...state.cantieri,
        ],
      }
    }
    case 'DELETE_CANTIERE':
      return {
        ...state,
        cantieri: state.cantieri.filter((cantiere) => cantiere.id !== action.id),
        verbali: state.verbali.filter((verbale) => verbale.cantiereId !== action.id),
      }
    case 'START_VERBALE': {
      if (!state.cantieri.some((cantiere) => cantiere.id === action.cantiereId)) return state
      const timestamp = nowIso()
      const data = todayISO()
      const verbale: Verbale = {
        id: action.verbaleId,
        numero: nextNumero(state, action.cantiereId, data),
        cantiereId: action.cantiereId,
        data,
        stato: 'bozza',
        passo: 0,
        impresePresenti: [],
        apprestamenti: [],
        attivita: [],
        prescrizioni: [],
        prossime: [],
        noteProgramma: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      return {
        ...state,
        cantieri: state.cantieri.map((cantiere) =>
          cantiere.id === action.cantiereId ? { ...cantiere, updatedAt: timestamp } : cantiere,
        ),
        verbali: [verbale, ...state.verbali],
      }
    }
    case 'DELETE_VERBALE':
      return { ...state, verbali: state.verbali.filter((verbale) => verbale.id !== action.id) }
    case 'SET_PASSO':
      return withVerbale(state, action.verbaleId, (verbale) => ({
        ...verbale,
        passo: Math.min(5, Math.max(0, action.passo)),
      }))
    case 'SET_DATA':
      return withVerbale(state, action.verbaleId, (verbale) => ({ ...verbale, data: action.data }))
    case 'SET_STATO':
      return withVerbale(state, action.verbaleId, (verbale) => ({ ...verbale, stato: action.stato }))
    case 'ADD_RUOLO': {
      const nome = action.nome.trim().replace(/\s+/g, ' ')
      if (!nome || state.ruoli.some((ruolo) => ruolo.toLowerCase() === nome.toLowerCase())) return state
      return { ...state, ruoli: [...state.ruoli, nome] }
    }
    case 'UPDATE_IMPRESA': {
      const current = state.imprese.find((impresa) => impresa.id === action.id)
      if (!current) return state
      const impresa = { ...current, ...action.patch }
      return {
        ...state,
        imprese: state.imprese.map((item) => (item.id === impresa.id ? impresa : item)),
        verbali: state.verbali.map((verbale) => {
          if (verbale.stato === 'completato') return verbale
          return {
            ...verbale,
            impresePresenti: verbale.impresePresenti.map((presente) =>
              presente.impresaId === impresa.id
                ? { ...presente, ragioneSociale: impresa.ragioneSociale, ruolo: impresa.ruolo }
                : presente,
            ),
            prescrizioni: verbale.prescrizioni.map((prescrizione) =>
              prescrizione.impresaId === impresa.id
                ? { ...prescrizione, impresaNome: impresa.ragioneSociale }
                : prescrizione,
            ),
          }
        }),
      }
    }
    case 'DELETE_IMPRESA':
      return {
        ...state,
        imprese: state.imprese.filter((impresa) => impresa.id !== action.id),
        verbali: state.verbali.map((verbale) =>
          verbale.stato === 'completato' ? verbale : withoutImpresa(verbale, action.id),
        ),
      }
    case 'TOGGLE_IMPRESA': {
      const impresa = state.imprese.find((item) => item.id === action.impresaId)
      if (!impresa) return state
      return withVerbale(state, action.verbaleId, (verbale) => {
        const selected = verbale.impresePresenti.some((item) => item.impresaId === impresa.id)
        if (selected) return withoutImpresa(verbale, impresa.id)
        return {
          ...verbale,
          impresePresenti: [
            ...verbale.impresePresenti,
            { impresaId: impresa.id, ragioneSociale: impresa.ragioneSociale, ruolo: impresa.ruolo },
          ],
        }
      })
    }
    case 'ADD_IMPRESA_AND_SELECT': {
      const ragioneSociale = action.impresa.ragioneSociale.trim().replace(/\s+/g, ' ')
      const ruolo = action.impresa.ruolo.trim().replace(/\s+/g, ' ')
      if (!ragioneSociale) return state
      const existing = state.imprese.find((impresa) => impresa.ragioneSociale.toLowerCase() === ragioneSociale.toLowerCase())
      const impresa: Impresa = existing
        ? { ...existing, ruolo: ruolo || existing.ruolo }
        : { id: action.impresa.id, ragioneSociale, ruolo }
      const imprese = existing
        ? state.imprese.map((item) => (item.id === existing.id ? impresa : item))
        : [...state.imprese, impresa]
      return withVerbale({ ...state, imprese }, action.verbaleId, (verbale) => {
        const already = verbale.impresePresenti.some((item) => item.impresaId === impresa.id)
        const impresePresenti = already
          ? verbale.impresePresenti.map((item) =>
              item.impresaId === impresa.id
                ? { ...item, ragioneSociale: impresa.ragioneSociale, ruolo: impresa.ruolo }
                : item,
            )
          : [
              ...verbale.impresePresenti,
              { impresaId: impresa.id, ragioneSociale: impresa.ragioneSociale, ruolo: impresa.ruolo },
            ]
        return { ...verbale, impresePresenti }
      })
    }
    case 'ADD_APPRESTAMENTO': {
      const nome = action.nome.trim().replace(/\s+/g, ' ')
      if (!nome) return state
      const existing = state.apprestamenti.find((item) => item.nome.toLowerCase() === nome.toLowerCase())
      const item = existing ?? { id: action.id, nome }
      const apprestamenti = existing ? state.apprestamenti : [...state.apprestamenti, item]
      return withVerbale({ ...state, apprestamenti }, action.verbaleId, (verbale) => {
        if (verbale.apprestamenti.some((selected) => selected.catalogoId === item.id)) return verbale
        return {
          ...verbale,
          apprestamenti: [...verbale.apprestamenti, { catalogoId: item.id, nome: item.nome, funzione: '' }],
        }
      })
    }
    case 'TOGGLE_APPRESTAMENTO':
      return withVerbale(state, action.verbaleId, (verbale) => {
        const selected = verbale.apprestamenti.some((item) => item.catalogoId === action.catalogoId)
        if (selected) {
          return {
            ...verbale,
            apprestamenti: verbale.apprestamenti.filter((item) => item.catalogoId !== action.catalogoId),
          }
        }
        const snapshot = snapshotApprestamento(state, action.catalogoId)
        if (!snapshot) return verbale
        return { ...verbale, apprestamenti: [...verbale.apprestamenti, snapshot] }
      })
    case 'SET_FUNZIONE':
      return withVerbale(state, action.verbaleId, (verbale) => ({
        ...verbale,
        apprestamenti: verbale.apprestamenti.map((item) =>
          item.catalogoId === action.catalogoId ? { ...item, funzione: action.funzione } : item,
        ),
      }))
    case 'ADD_ATTIVITA':
      return withVerbale(state, action.verbaleId, (verbale) => ({
        ...verbale,
        attivita: [...verbale.attivita, { id: action.id, descrizione: '', impreseIds: [] }],
      }))
    case 'UPDATE_ATTIVITA':
      return withVerbale(state, action.verbaleId, (verbale) => ({
        ...verbale,
        attivita: verbale.attivita.map((attivita) => {
          if (attivita.id !== action.attivitaId) return attivita
          const next: Verbale['attivita'][number] = {
            ...attivita,
            descrizione: action.patch.descrizione ?? attivita.descrizione,
            impreseIds: action.patch.impreseIds ?? attivita.impreseIds,
          }
          if (action.patch.fotoDataUrl === null) delete next.fotoDataUrl
          else if (typeof action.patch.fotoDataUrl === 'string') next.fotoDataUrl = action.patch.fotoDataUrl
          return next
        }),
      }))
    case 'REMOVE_ATTIVITA':
      return withVerbale(state, action.verbaleId, (verbale) => ({
        ...verbale,
        attivita: verbale.attivita.filter((attivita) => attivita.id !== action.attivitaId),
      }))
    case 'ADD_PRESCRIZIONE':
      return withVerbale(state, action.verbaleId, (verbale) => ({
        ...verbale,
        prescrizioni: [
          ...verbale.prescrizioni,
          { id: action.id, osservazione: '', intervento: '', impresaId: '', impresaNome: '', termine: '' },
        ],
      }))
    case 'UPDATE_PRESCRIZIONE':
      return withVerbale(state, action.verbaleId, (verbale) => ({
        ...verbale,
        prescrizioni: verbale.prescrizioni.map((prescrizione) =>
          prescrizione.id === action.prescrizioneId ? { ...prescrizione, ...action.patch } : prescrizione,
        ),
      }))
    case 'REMOVE_PRESCRIZIONE':
      return withVerbale(state, action.verbaleId, (verbale) => ({
        ...verbale,
        prescrizioni: verbale.prescrizioni.filter((prescrizione) => prescrizione.id !== action.prescrizioneId),
      }))
    case 'ADD_PROSSIMA':
      return withVerbale(state, action.verbaleId, (verbale) => ({
        ...verbale,
        prossime: [...verbale.prossime, { id: action.id, descrizione: '', impreseIds: [], noteInterferenze: '' }],
      }))
    case 'UPDATE_PROSSIMA':
      return withVerbale(state, action.verbaleId, (verbale) => ({
        ...verbale,
        prossime: verbale.prossime.map((item) => (item.id === action.itemId ? { ...item, ...action.patch } : item)),
      }))
    case 'REMOVE_PROSSIMA':
      return withVerbale(state, action.verbaleId, (verbale) => ({
        ...verbale,
        prossime: verbale.prossime.filter((item) => item.id !== action.itemId),
      }))
    case 'SET_NOTE_PROGRAMMA':
      return withVerbale(state, action.verbaleId, (verbale) => ({ ...verbale, noteProgramma: action.note }))
    default:
      return state
  }
}
