export type Cantiere = {
  id: string
  nome: string
  indirizzo: string
  committente: string
  oggettoLavori: string
  note: string
  createdAt: string
  updatedAt: string
}

export type CantiereInput = {
  nome: string
  indirizzo: string
  committente: string
  oggettoLavori: string
  note: string
}

export type Impresa = {
  id: string
  ragioneSociale: string
  ruolo: string
}

export type ImpresaPresente = {
  impresaId: string
  ragioneSociale: string
  ruolo: string
}

export type CatalogoItem = {
  id: string
  nome: string
}

export type ApprestamentoSelezionato = {
  catalogoId: string
  nome: string
  funzione: string
}

export type Attivita = {
  id: string
  descrizione: string
  impreseIds: string[]
  fotoDataUrl?: string
}

export type AttivitaPatch = {
  descrizione?: string
  impreseIds?: string[]
  fotoDataUrl?: string | null
}

export type Prescrizione = {
  id: string
  osservazione: string
  intervento: string
  impresaId: string
  impresaNome: string
  termine: string
}

export type PrescrizionePatch = Partial<
  Pick<Prescrizione, 'osservazione' | 'intervento' | 'impresaId' | 'impresaNome' | 'termine'>
>

export type LavorazioneProgrammata = {
  id: string
  descrizione: string
  impreseIds: string[]
  noteInterferenze: string
}

export type ProssimaPatch = Partial<
  Pick<LavorazioneProgrammata, 'descrizione' | 'impreseIds' | 'noteInterferenze'>
>

export type Verbale = {
  id: string
  numero: string
  cantiereId: string
  data: string
  stato: 'bozza' | 'completato'
  passo: number
  impresePresenti: ImpresaPresente[]
  apprestamenti: ApprestamentoSelezionato[]
  attivita: Attivita[]
  prescrizioni: Prescrizione[]
  prossime: LavorazioneProgrammata[]
  noteProgramma: string
  createdAt: string
  updatedAt: string
}

export type Archive = {
  version: 1
  cantieri: Cantiere[]
  imprese: Impresa[]
  ruoli: string[]
  apprestamenti: CatalogoItem[]
  verbali: Verbale[]
}

export type View =
  | { name: 'archivio' }
  | { name: 'cantiere'; cantiereId?: string }
  | { name: 'wizard'; verbaleId: string }
