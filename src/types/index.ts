export type NavTab = 'cantieri' | 'sopralluoghi' | 'imprese';

export type StatoCantiere = 'in_corso' | 'sospeso' | 'completato' | 'programmato';

export type TipoSoggetto = 'impresa' | 'lavoratore_autonomo';
export type RuoloCantiere = 'appalto' | 'subappalto';

/**
 * Tipologie di atto / verbale gestite da CantierHub:
 * - CSE: Coordinatore per la Sicurezza in fase di Esecuzione (D.Lgs. 81/08)
 * - DL: Direttore dei Lavori (Avanzamento opere, maestranze, ordini di servizio)
 * - RILIEVO: Fascicolo fotografico tecnico e rilievo dimensionale dello stato di fatto
 */
export type TipoVerbale = 'CSE' | 'DL' | 'RILIEVO';

export interface Cantiere {
  id: string;
  nome: string;
  indirizzo: string;
  committente: string;
  direttore_lavori?: string;
  progettista?: string;
  cse?: string;
  impresa_esecutrice?: string;
  imprese_ids?: string[]; // Array di ID imprese associate al cantiere
  stato: StatoCantiere;
  created_at?: string;
  updated_at?: string;
}

export interface Impresa {
  id: string;
  cantiere_id?: string;
  ragione_sociale: string;
  tipo?: TipoSoggetto;
  p_iva?: string;
  email?: string;
  referente?: string;
  telefono?: string;
  ruolo?: string;
}

export interface ImpresaPresenteItem {
  nome: string;
  ruolo_cantiere: RuoloCantiere;
  tipo?: TipoSoggetto;
  operai_presenti?: number; // Per DL: numero maestranze / operai presenti
}

export interface RilievoItem {
  id: string;
  descrizione: string;
  foto_urls: string[];
  ambiente?: string; // Per RILIEVO (es. Piano 1, Prospetto Sud, Vano Scala)
  quote_note?: string; // Compatibilità note dimensionali legacy
  misura_1?: string; // Misura opzionale 1 (es. H = 2.70 m, L = 4.50 m)
  misura_2?: string; // Misura opzionale 2 (es. Spessore = 30 cm)
  misura_3?: string; // Misura opzionale 3 (es. Diagonale = 5.24 m)
}

export interface PrescrizioneItem {
  id: string;
  testo: string;
  impresa_destinataria?: string;
  data_scadenza?: string;
}

export interface DispositivoApprestamento {
  id?: string;
  nome: string;
  selezionato: boolean;
  note?: string;
}

export interface FaseLavoro {
  id: string;
  descrizione: string;
  impresa?: string;
}

export interface PresenzeConvenuti {
  committente?: { presente: boolean; nome?: string };
  dl?: { presente: boolean; nome?: string };
  progettista?: { presente: boolean; nome?: string };
  cse?: { presente: boolean; nome?: string };
}

export interface Sopralluogo {
  id: string;
  cantiere_id: string;
  cantiere_nome?: string;
  tipo_verbale?: TipoVerbale; // Default 'CSE' per retrocompatibilità
  data: string;
  ora?: string;
  lavorazioni_in_corso?: string;
  fasi_lavoro?: FaseLavoro[];
  imprese_presenti: string[];
  imprese_dettaglio?: ImpresaPresenteItem[];
  presenze?: PresenzeConvenuti;
  dispositivi_apprestamenti?: DispositivoApprestamento[];
  argomenti_discussi?: string;
  rilievi: RilievoItem[];
  prescrizioni_lista: PrescrizioneItem[];
  sospensione_lavori: boolean;
  motivo_sospensione?: string | null;
  created_at?: string;

  // Campi dedicati per Direzione Lavori (DL)
  condizioni_meteo?: string | null; // es. Sereno / Coperto / Pioggia (operatività cantiere)
  ordini_servizio?: string | null; // Ordini di servizio e disposizioni della D.L.
  operai_totali?: number | null; // Totale maestranze presenti in cantiere

  // Campi dedicati per RILIEVO fotografico / tecnico
  note_tecniche?: string | null; // Note introduttive generali del rilievo

  // Campi per supporto Offline-First
  is_pending?: boolean;
  pending_status?: 'pending' | 'syncing' | 'error';
  pending_error?: string;
  temp_id?: string;
}

export interface PendingFoto {
  rilievoId: string;
  fileBlob: Blob;
  fileName: string;
  path: string;
}

export interface PendingSopralluogo {
  tempId: string;
  sopralluogoId?: string;
  cantiere_id: string;
  payload: Omit<Sopralluogo, 'id'> & { id?: string };
  pendingFotos: PendingFoto[];
  status: 'pending' | 'syncing' | 'error';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  cantieriAttivi: number;
  sopralluoghiMese: number;
  prescrizioniAperte: number;
}
