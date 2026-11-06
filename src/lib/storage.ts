import { STORAGE_KEY, VIEW_KEY } from '../constants'
import { createSeed } from '../data/defaults'
import type {
  Archive,
  Attivita,
  Cantiere,
  CatalogoItem,
  Impresa,
  ImpresaPresente,
  LavorazioneProgrammata,
  Prescrizione,
  Verbale,
  View,
} from '../types'
import { todayISO } from './id'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCantiere(value: unknown): value is Cantiere {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.nome === 'string' &&
    typeof value.indirizzo === 'string' &&
    typeof value.committente === 'string' &&
    typeof value.oggettoLavori === 'string' &&
    typeof value.note === 'string'
  )
}

function isImpresa(value: unknown): value is Impresa {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.ragioneSociale === 'string' && typeof value.ruolo === 'string'
}

function isCatalogo(value: unknown): value is CatalogoItem {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.nome === 'string'
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function asAttivita(value: unknown): Attivita[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((item) => {
    const attivita: Attivita = {
      id: typeof item.id === 'string' ? item.id : `att-${stringList(item.impreseIds).join('-')}`,
      descrizione: typeof item.descrizione === 'string' ? item.descrizione : '',
      impreseIds: stringList(item.impreseIds),
    }
    if (typeof item.fotoDataUrl === 'string' && item.fotoDataUrl.length > 0) {
      attivita.fotoDataUrl = item.fotoDataUrl
    }
    return attivita
  })
}

function asPresenti(value: unknown): ImpresaPresente[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).flatMap((item) => {
    if (typeof item.impresaId !== 'string') return []
    return [
      {
        impresaId: item.impresaId,
        ragioneSociale: typeof item.ragioneSociale === 'string' ? item.ragioneSociale : '',
        ruolo: typeof item.ruolo === 'string' ? item.ruolo : '',
      },
    ]
  })
}

function asPrescrizioni(value: unknown): Prescrizione[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((item) => ({
    id: typeof item.id === 'string' ? item.id : 'prescrizione',
    osservazione: typeof item.osservazione === 'string' ? item.osservazione : '',
    intervento: typeof item.intervento === 'string' ? item.intervento : '',
    impresaId: typeof item.impresaId === 'string' ? item.impresaId : '',
    impresaNome: typeof item.impresaNome === 'string' ? item.impresaNome : '',
    termine: typeof item.termine === 'string' ? item.termine : '',
  }))
}

function asProssime(value: unknown): LavorazioneProgrammata[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).map((item) => ({
    id: typeof item.id === 'string' ? item.id : 'programma',
    descrizione: typeof item.descrizione === 'string' ? item.descrizione : '',
    impreseIds: stringList(item.impreseIds),
    noteInterferenze: typeof item.noteInterferenze === 'string' ? item.noteInterferenze : '',
  }))
}

function asApprestamenti(value: unknown): Verbale['apprestamenti'] {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord).flatMap((item) => {
    if (typeof item.catalogoId !== 'string') return []
    return [
      {
        catalogoId: item.catalogoId,
        nome: typeof item.nome === 'string' ? item.nome : 'Apprestamento',
        funzione: typeof item.funzione === 'string' ? item.funzione : '',
      },
    ]
  })
}

function normalizeVerbale(value: unknown): Verbale | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.cantiereId !== 'string') return null
  const passo = typeof value.passo === 'number' ? value.passo : 0
  return {
    id: value.id,
    numero: typeof value.numero === 'string' ? value.numero : 'VS',
    cantiereId: value.cantiereId,
    data: typeof value.data === 'string' ? value.data : todayISO(),
    stato: value.stato === 'completato' ? 'completato' : 'bozza',
    passo: Math.min(5, Math.max(0, passo)),
    impresePresenti: asPresenti(value.impresePresenti),
    apprestamenti: asApprestamenti(value.apprestamenti),
    attivita: asAttivita(value.attivita),
    prescrizioni: asPrescrizioni(value.prescrizioni),
    prossime: asProssime(value.prossime),
    noteProgramma: typeof value.noteProgramma === 'string' ? value.noteProgramma : '',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  }
}

export function parseArchive(data: unknown): Archive | null {
  if (!isRecord(data) || !Array.isArray(data.cantieri) || !Array.isArray(data.verbali)) return null
  const seed = createSeed()
  const ruoli = stringList(data.ruoli).map((ruolo) => ruolo.trim()).filter(Boolean)
  const apprestamenti = Array.isArray(data.apprestamenti) ? data.apprestamenti.filter(isCatalogo) : []
  return {
    version: 1,
    cantieri: data.cantieri.filter(isCantiere),
    imprese: Array.isArray(data.imprese) ? data.imprese.filter(isImpresa) : [],
    ruoli: ruoli.length > 0 ? ruoli : seed.ruoli,
    apprestamenti: apprestamenti.length > 0 ? apprestamenti : seed.apprestamenti,
    verbali: data.verbali.map(normalizeVerbale).filter((verbale): verbale is Verbale => verbale !== null),
  }
}

export function loadArchive(): Archive {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeed()
    return parseArchive(JSON.parse(raw)) ?? createSeed()
  } catch {
    return createSeed()
  }
}

export function saveArchive(archive: Archive) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(archive))
}

export function loadView(archive: Archive): View {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY)
    if (!raw) return { name: 'archivio' }
    const view = JSON.parse(raw) as View
    if (view?.name === 'archivio') return view
    if (view?.name === 'wizard' && archive.verbali.some((verbale) => verbale.id === view.verbaleId)) return view
    if (view?.name === 'cantiere') {
      if (!view.cantiereId || archive.cantieri.some((cantiere) => cantiere.id === view.cantiereId)) return view
    }
  } catch {
    return { name: 'archivio' }
  }
  return { name: 'archivio' }
}

export function saveView(view: View) {
  sessionStorage.setItem(VIEW_KEY, JSON.stringify(view))
}

export function downloadArchive(archive: Archive) {
  const blob = new Blob([JSON.stringify(archive)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `archivio-cse-${todayISO()}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
