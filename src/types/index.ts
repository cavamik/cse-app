export type NavTab = 'cantieri' | 'sopralluoghi' | 'imprese';
export const NavTab = {} as unknown as NavTab;

export type StatoCantiere = 'in_corso' | 'sospeso' | 'completato' | 'programmato';
export const StatoCantiere = {} as unknown as StatoCantiere;

export interface Cantiere {
  id: string;
  nome: string;
  indirizzo: string;
  committente: string;
  direttore_lavori?: string;
  progettista?: string;
  cse?: string;
  impresa_esecutrice?: string;
  stato: StatoCantiere;
  created_at?: string;
  updated_at?: string;
}
export const Cantiere = {} as unknown as Cantiere;

export interface Impresa {
  id: string;
  cantiere_id?: string;
  ragione_sociale: string;
  p_iva?: string;
  referente?: string;
  telefono?: string;
  ruolo?: string;
}
export const Impresa = {} as unknown as Impresa;

export interface RilievoItem {
  id: string;
  descrizione: string;
  foto_urls: string[];
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
  data: string;
  ora?: string;
  lavorazioni_in_corso?: string;
  fasi_lavoro?: FaseLavoro[];
  imprese_presenti: string[];
  presenze?: PresenzeConvenuti;
  dispositivi_apprestamenti?: DispositivoApprestamento[];
  argomenti_discussi?: string;
  rilievi: RilievoItem[];
  prescrizioni_lista: PrescrizioneItem[];
  sospensione_lavori: boolean;
  motivo_sospensione?: string;
  created_at?: string;
}
export const Sopralluogo = {} as unknown as Sopralluogo;

export interface DashboardStats {
  cantieriAttivi: number;
  sopralluoghiMese: number;
  prescrizioniAperte: number;
}
export const DashboardStats = {} as unknown as DashboardStats;