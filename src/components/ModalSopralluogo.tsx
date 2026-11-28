import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ClipboardCheck, Plus, Trash2, Camera, AlertOctagon, 
  Building2, Users, Loader2, CheckSquare, Square, Clock,
  ArrowUp, ArrowDown, AlertTriangle, Check, Eye, Compass,
  Layers, CloudSun, ScrollText, MapPin, Maximize2, HardHat,
  Lock, Unlock, ClipboardPaste, UploadCloud, ChevronLeft,
  ChevronRight, ListOrdered
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { compressImage } from '../utils/imageCompressor';
import { VerbalePdfModal } from './VerbalePdfModal';
import { 
  getImpreseDelCantiere, 
  associaImpresaACantiere, 
  isValidEmail 
} from '../utils/cantiereImprese';
import { 
  getCachedData, 
  setCachedData, 
  savePendingSopralluogo, 
  removePendingSopralluogo,
  sanitizeStoragePath,
  extractStoragePath,
  isUUID,
  OFFLINE_KEYS 
} from '../lib/offlineStore';
import type { 
  Cantiere, Impresa, RilievoItem, PrescrizioneItem, 
  DispositivoApprestamento, Sopralluogo, FaseLavoro, PresenzeConvenuti,
  ImpresaPresenteItem, RuoloCantiere, TipoSoggetto, PendingFoto, TipoVerbale
} from '../types';

interface StagedPhotoThumbnailProps {
  file: File;
  onRemove: () => void;
}

const StagedPhotoThumbnail: React.FC<StagedPhotoThumbnailProps> = ({ file, onRemove }) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    let isSubscribed = true;
    const objectUrl = URL.createObjectURL(file);
    if (isSubscribed) {
      setPreviewUrl(objectUrl);
    }
    return () => {
      isSubscribed = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return (
    <div className="relative group w-20 h-20 rounded-xl overflow-hidden border border-amber-500/50 bg-slate-950 flex flex-col justify-end shadow">
      {previewUrl ? (
        <img src={previewUrl} alt="Nuova foto" className="w-full h-full object-cover opacity-80" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-[10px] text-slate-500">
          Caricamento...
        </div>
      )}
      <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-slate-950 text-[10px] font-bold text-center">Nuova</span>
      <button
        type="button"
        title="Rimuovi"
        onClick={onRemove}
        className="absolute top-1 right-1 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md"
      >
        <X className="w-3.5 h-3.5 stroke-[3]" />
      </button>
    </div>
  );
};

interface ModalSopralluogoProps {
  isOpen: boolean;
  onClose: () => void;
  cantieri: Cantiere[];
  imprese?: Impresa[];
  sopralluoghi?: Sopralluogo[];
  initialCantiereId?: string;
  initialTipoVerbale?: TipoVerbale;
  sopralluogoToEdit?: Sopralluogo | null;
  onSuccess: () => void;
}

const DISPOSITIVI_PREDEFINITI = [
  'PONTEGGIO',
  'PARAPETTI TEMPORANEI',
  'TRABATTELLI',
  'PROTEZIONE DELLO SCAVO',
  'MEZZI DI SOLLEVAMENTO'
];

interface StepDef {
  id: number;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS_CSE: StepDef[] = [
  { id: 1, label: 'Dati Generali', shortLabel: 'Dati', icon: Clock },
  { id: 2, label: 'Presenze & Lavori', shortLabel: 'Presenze', icon: Users },
  { id: 3, label: 'Sicurezza & Apprestamenti', shortLabel: 'Sicurezza', icon: CheckSquare },
  { id: 4, label: 'Coordinamento', shortLabel: 'Coordinam.', icon: ScrollText },
  { id: 5, label: 'Rilievo Fotografico', shortLabel: 'Foto', icon: Camera },
  { id: 6, label: 'Prescrizioni & Esito', shortLabel: 'Prescrizioni', icon: AlertTriangle },
];

const STEPS_DL: StepDef[] = [
  { id: 1, label: 'Dati & Meteo', shortLabel: 'Dati & Meteo', icon: CloudSun },
  { id: 2, label: 'Maestranze & Lavori', shortLabel: 'Maestranze', icon: Users },
  { id: 3, label: 'Ordini di Servizio', shortLabel: 'Ordini DL', icon: ScrollText },
  { id: 4, label: 'Rilievo Fotografico', shortLabel: 'Foto', icon: Camera },
];

const STEPS_RILIEVO: StepDef[] = [
  { id: 1, label: 'Dati Generali', shortLabel: 'Dati', icon: Clock },
  { id: 2, label: 'Premesse Tecniche', shortLabel: 'Premesse', icon: ScrollText },
  { id: 3, label: 'Rilievo & Misure', shortLabel: 'Rilievo & Foto', icon: Camera },
];

export const ModalSopralluogo: React.FC<ModalSopralluogoProps> = ({ 
  isOpen, 
  onClose, 
  cantieri, 
  imprese = [],
  sopralluoghi = [],
  initialCantiereId,
  initialTipoVerbale = 'CSE',
  sopralluogoToEdit,
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [tipoVerbale, setTipoVerbale] = useState<TipoVerbale>('CSE');
  const [isTipoUnlocked, setIsTipoUnlocked] = useState(false);
  const [cantiereId, setCantiereId] = useState('');

  // Navigazione Guidata a Step o Vista Completa
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'steps' | 'all'>('steps');
  const activeStepBtnRef = useRef<HTMLButtonElement | null>(null);
  const stepperContainerRef = useRef<HTMLDivElement | null>(null);

  const currentStepsList = tipoVerbale === 'DL' 
    ? STEPS_DL 
    : tipoVerbale === 'RILIEVO' 
      ? STEPS_RILIEVO 
      : STEPS_CSE;

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
    }
  }, [isOpen]);

  useEffect(() => {
    const max = currentStepsList.length;
    if (currentStep > max) {
      setCurrentStep(max);
    }
  }, [tipoVerbale, currentStepsList.length, currentStep]);

  // Scorrimento automatico per mantenere lo step attivo sempre visibile nella barra (anche su smartphone)
  useEffect(() => {
    if (viewMode === 'steps' && activeStepBtnRef.current) {
      activeStepBtnRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'nearest',
        block: 'nearest',
      });
    }
  }, [currentStep, viewMode]);
  const [dataSopralluogo, setDataSopralluogo] = useState(() => new Date().toISOString().split('T')[0]);
  const [oraSopralluogo, setOraSopralluogo] = useState('09:00');
  const [argomentiDiscussi, setArgomentiDiscussi] = useState('');

  // Campi dedicati Direzione Lavori (DL)
  const [condizioniMeteo, setCondizioniMeteo] = useState<string>('Sereno - Cantiere regolarmente operativo');
  const [ordiniServizio, setOrdiniServizio] = useState<string>('');
  const [operaiTotali, setOperaiTotali] = useState<number | undefined>(undefined);

  // Campi dedicati RILIEVO fotografico / dimensionale
  const [noteTecniche, setNoteTecniche] = useState<string>('');

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [verbaleInAnteprima, setVerbaleInAnteprima] = useState<Sopralluogo | null>(null);
  const previewBlobUrlsRef = React.useRef<string[]>([]);
  const [fotoUrlsDaEliminareStorage, setFotoUrlsDaEliminareStorage] = useState<string[]>([]);

  const revokePreviewBlobUrls = () => {
    previewBlobUrlsRef.current.forEach(u => {
      try { URL.revokeObjectURL(u); } catch {}
    });
    previewBlobUrlsRef.current = [];
  };

  useEffect(() => {
    return () => {
      revokePreviewBlobUrls();
    };
  }, []);

  const [presenze, setPresenze] = useState<PresenzeConvenuti>({
    committente: { presente: false, nome: '' },
    dl: { presente: false, nome: '' },
    progettista: { presente: false, nome: '' },
    cse: { presente: true, nome: 'arch. Cavalleri Michele' }
  });

  const [fasiLavoro, setFasiLavoro] = useState<FaseLavoro[]>([
    { id: crypto.randomUUID(), descrizione: '', impresa: '' }
  ]);

  const [dispositivi, setDispositivi] = useState<DispositivoApprestamento[]>(
    DISPOSITIVI_PREDEFINITI.map(d => ({ nome: d, selezionato: false, note: '' }))
  );

  // Database Imprese
  const [tutteLeImpreseDB, setTutteLeImpreseDB] = useState<Impresa[]>([]);
  
  // Imprese presenti nel verbale: ogni riga contiene Nome, Ruolo nel cantiere (Appalto / Subappalto) e Tipologia
  const [impresePresentiLista, setImpresePresentiLista] = useState<ImpresaPresenteItem[]>([]);
  
  const [nuovaImpresaNome, setNuovaImpresaNome] = useState('');
  const [nuovaEmail, setNuovaEmail] = useState('');
  const [nuovoTipo, setNuovoTipo] = useState<TipoSoggetto>('impresa');
  const [mostraAddImpresa, setMostraAddImpresa] = useState(false);

  const [conflittoImpresa, setConflittoImpresa] = useState<{
    nomeDigitato: string;
    impresaEsistente: Impresa;
  } | null>(null);

  const [rilievi, setRilievi] = useState<RilievoItem[]>([
    { id: crypto.randomUUID(), descrizione: '', foto_urls: [] }
  ]);
  const [filesPerRilievo, setFilesPerRilievo] = useState<Record<string, File[]>>({});
  const [draggingRilievoId, setDraggingRilievoId] = useState<string | null>(null);
  const [activeRilievoId, setActiveRilievoId] = useState<string | null>(null);

  const [prescrizioni, setPrescrizioni] = useState<PrescrizioneItem[]>([]);
  const [sospensione, setSospensione] = useState(false);
  const [motivoSospensione, setMotivoSospensione] = useState('');

  useEffect(() => {
    if (sopralluogoToEdit) {
      setIsTipoUnlocked(false);
      setTipoVerbale(sopralluogoToEdit.tipo_verbale || initialTipoVerbale || 'CSE');
      setCantiereId(sopralluogoToEdit.cantiere_id);
      setDataSopralluogo(sopralluogoToEdit.data);
      setOraSopralluogo(sopralluogoToEdit.ora || '09:00');
      setArgomentiDiscussi(sopralluogoToEdit.argomenti_discussi || '');
      setCondizioniMeteo(sopralluogoToEdit.condizioni_meteo || 'Sereno - Cantiere regolarmente operativo');
      setOrdiniServizio(sopralluogoToEdit.ordini_servizio || '');
      setOperaiTotali(sopralluogoToEdit.operai_totali ?? undefined);
      setNoteTecniche(sopralluogoToEdit.note_tecniche || '');

      setRilievi(sopralluogoToEdit.rilievi?.length ? sopralluogoToEdit.rilievi : [{ id: crypto.randomUUID(), descrizione: '', foto_urls: [] }]);
      setPrescrizioni(sopralluogoToEdit.prescrizioni_lista || []);
      setSospensione(sopralluogoToEdit.sospensione_lavori || false);
      setMotivoSospensione(sopralluogoToEdit.motivo_sospensione || '');
      setFilesPerRilievo({});

      const cRef = cantieri.find(c => c.id === sopralluogoToEdit.cantiere_id);

      setPresenze({
        committente: sopralluogoToEdit.presenze?.committente || { presente: false, nome: cRef?.committente || '' },
        dl: sopralluogoToEdit.presenze?.dl || { presente: false, nome: cRef?.direttore_lavori || '' },
        progettista: sopralluogoToEdit.presenze?.progettista || { presente: false, nome: cRef?.progettista || '' },
        cse: sopralluogoToEdit.presenze?.cse || { presente: true, nome: cRef?.cse || 'arch. Cavalleri Michele' }
      });

      // Caricamento presenze imprese con ruoli Appalto/Subappalto
      if (sopralluogoToEdit.imprese_dettaglio && sopralluogoToEdit.imprese_dettaglio.length > 0) {
        setImpresePresentiLista(sopralluogoToEdit.imprese_dettaglio);
      } else if (sopralluogoToEdit.imprese_presenti && sopralluogoToEdit.imprese_presenti.length > 0) {
        const parsed: ImpresaPresenteItem[] = sopralluogoToEdit.imprese_presenti.map(str => {
          const isSub = str.toLowerCase().includes('subappalto');
          const cleanName = str.replace(/\s*\((Appalto|Subappalto|Subappaltatrice|Affidataria|Esecutrice)[^)]*\)/i, '').trim();
          return {
            nome: cleanName,
            ruolo_cantiere: isSub ? 'subappalto' : 'appalto',
          };
        });
        setImpresePresentiLista(parsed);
      } else {
        setImpresePresentiLista([]);
      }

      if (sopralluogoToEdit.fasi_lavoro && sopralluogoToEdit.fasi_lavoro.length > 0) {
        setFasiLavoro(sopralluogoToEdit.fasi_lavoro);
      } else if (sopralluogoToEdit.lavorazioni_in_corso) {
        setFasiLavoro([{ id: crypto.randomUUID(), descrizione: sopralluogoToEdit.lavorazioni_in_corso, impresa: '' }]);
      }

      if (sopralluogoToEdit.dispositivi_apprestamenti?.length) {
        setDispositivi(sopralluogoToEdit.dispositivi_apprestamenti);
      }
    } else {
      setIsTipoUnlocked(true);
      setTipoVerbale(initialTipoVerbale || 'CSE');
      const selectedCId = initialCantiereId || (cantieri.length > 0 ? cantieri[0].id : '');
      setCantiereId(selectedCId);

      const cRef = cantieri.find(c => c.id === selectedCId);
      setPresenze({
        committente: { presente: false, nome: cRef?.committente || '' },
        dl: { presente: false, nome: cRef?.direttore_lavori || '' },
        progettista: { presente: false, nome: cRef?.progettista || '' },
        cse: { presente: true, nome: cRef?.cse || 'arch. Cavalleri Michele' }
      });

      setDataSopralluogo(new Date().toISOString().split('T')[0]);
      setOraSopralluogo('09:00');
      setFasiLavoro([{ id: crypto.randomUUID(), descrizione: '', impresa: '' }]);
      setArgomentiDiscussi('');
      setCondizioniMeteo('Sereno - Cantiere regolarmente operativo');
      setOrdiniServizio('');
      setOperaiTotali(undefined);
      setNoteTecniche('');
      setImpresePresentiLista([]);
      setRilievi([{ id: crypto.randomUUID(), descrizione: '', foto_urls: [] }]);
      setFilesPerRilievo({});
      setPrescrizioni([]);
      setSospensione(false);
      setMotivoSospensione('');
      setDispositivi(DISPOSITIVI_PREDEFINITI.map(d => ({ nome: d, selezionato: false, note: '' })));
    }
  }, [sopralluogoToEdit, initialCantiereId, initialTipoVerbale, cantieri, isOpen]);

  // Caricamento archivio completo imprese con supporto Offline-First
  const fetchTutteLeImprese = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const { data, error } = await supabase
          .from('imprese')
          .select('*')
          .order('ragione_sociale');

        if (!error && data && data.length > 0) {
          setTutteLeImpreseDB(data);
          await setCachedData(OFFLINE_KEYS.IMPRESE, data);
          return;
        }
      }

      // Fallback su cache locale IndexedDB
      const cached = await getCachedData<Impresa[]>(OFFLINE_KEYS.IMPRESE);
      if (cached && cached.length > 0) {
        setTutteLeImpreseDB(cached);
      } else if (imprese && imprese.length > 0) {
        setTutteLeImpreseDB(imprese);
      }
    } catch (err) {
      console.warn('Fallback lettura imprese offline:', err);
      const cached = await getCachedData<Impresa[]>(OFFLINE_KEYS.IMPRESE);
      if (cached && cached.length > 0) {
        setTutteLeImpreseDB(cached);
      } else if (imprese && imprese.length > 0) {
        setTutteLeImpreseDB(imprese);
      }
    }
  };

  const appendFilesToRilievo = (rilievoId: string, filesToAdd: File[]) => {
    const validImages = filesToAdd.filter(f => f.type.startsWith('image/'));
    if (validImages.length === 0) return;
    setFilesPerRilievo(prev => ({
      ...prev,
      [rilievoId]: [...(prev[rilievoId] || []), ...validImages]
    }));
  };

  // Listener globale Ctrl+V per incollare foto catturate da Google Foto o Appunti
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const hasImage = Array.from(items).some(it => it.type.startsWith('image/'));
      if (!hasImage) return;

      const targetId = activeRilievoId || (rilievi.length > 0 ? rilievi[0].id : null);
      if (!targetId) return;

      const pastedImages: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            const ext = item.type.split('/')[1] || 'png';
            pastedImages.push(new File([f], `foto_${Date.now()}_${i + 1}.${ext}`, { type: f.type }));
          }
        }
      }

      if (pastedImages.length > 0) {
        e.preventDefault();
        appendFilesToRilievo(targetId, pastedImages);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [isOpen, activeRilievoId, rilievi]);

  useEffect(() => {
    if (isOpen) {
      fetchTutteLeImprese();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Genera stringhe formattate per la stampa: "Nome Impresa (Appalto)"
  const arrayStringheImpresePresenti = impresePresentiLista.map(item => {
    const labelRuolo = item.ruolo_cantiere === 'subappalto' ? 'Subappalto' : 'Appalto';
    return `${item.nome} (${labelRuolo})`;
  });

  const handleOpenPreview = () => {
    try {
      revokePreviewBlobUrls();

      const lavorazioniSintetiche = (fasiLavoro || [])
        .filter(f => f && f.descrizione && f.descrizione.trim())
        .map(f => `${f.descrizione.trim()}${f.impresa && f.impresa.trim() ? ` (${f.impresa.trim()})` : ''}`)
        .join('; ');

      const rilieviAnteprima: RilievoItem[] = (rilievi || []).map(r => {
        const stagedFiles = filesPerRilievo[r.id] || [];
        const stagedUrls = stagedFiles
          .filter(f => f instanceof Blob)
          .map(f => {
            try {
              const u = URL.createObjectURL(f);
              previewBlobUrlsRef.current.push(u);
              return u;
            } catch (e) {
              console.warn('Errore generazione blob url anteprima:', e);
              return '';
            }
          })
          .filter(Boolean);

        return {
          id: r.id,
          descrizione: r.descrizione || '',
          ambiente: r.ambiente || undefined,
          quote_note: r.quote_note || undefined,
          misura_1: r.misura_1 || undefined,
          misura_2: r.misura_2 || undefined,
          misura_3: r.misura_3 || undefined,
          foto_urls: [...(r.foto_urls || []), ...stagedUrls],
        };
      });

      setVerbaleInAnteprima({
        id: sopralluogoToEdit?.id || 'anteprima-live',
        cantiere_id: cantiereId || '',
        tipo_verbale: tipoVerbale,
        data: dataSopralluogo || new Date().toISOString().split('T')[0],
        ora: oraSopralluogo || '09:00',
        lavorazioni_in_corso: lavorazioniSintetiche || '',
        fasi_lavoro: fasiLavoro || [],
        imprese_presenti: arrayStringheImpresePresenti || [],
        imprese_dettaglio: impresePresentiLista || [],
        presenze: presenze,
        dispositivi_apprestamenti: dispositivi || [],
        argomenti_discussi: argomentiDiscussi || '',
        rilievi: rilieviAnteprima,
        prescrizioni_lista: prescrizioni || [],
        sospensione_lavori: Boolean(sospensione),
        motivo_sospensione: motivoSospensione || undefined,
        condizioni_meteo: condizioniMeteo || undefined,
        ordini_servizio: ordiniServizio || undefined,
        operai_totali: operaiTotali || undefined,
        note_tecniche: noteTecniche || undefined,
      });

      setIsPreviewOpen(true);
    } catch (err) {
      console.error('[ModalSopralluogo] Errore apertura anteprima:', err);
      alert('Impossibile aprire l\'anteprima: ' + (err as any)?.message);
    }
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    revokePreviewBlobUrls();
    setVerbaleInAnteprima(null);
  };

  // Funzione per spostare elementi Su o Giù
  const moveItem = <T,>(list: T[], index: number, direction: 'up' | 'down'): T[] => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return list;
    const copy = [...list];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    return copy;
  };

  // 1. Fasi di Lavoro
  const addFaseLavoro = () => setFasiLavoro(prev => [{ id: crypto.randomUUID(), descrizione: '', impresa: '' }, ...prev]);
  const removeFaseLavoro = (id: string) => setFasiLavoro(prev => prev.filter(f => f.id !== id));
  const updateFaseLavoro = (id: string, field: 'descrizione' | 'impresa', value: string) => setFasiLavoro(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  const moveFaseLavoro = (index: number, direction: 'up' | 'down') => setFasiLavoro(prev => moveItem(prev, index, direction));

  // 2. Rilievi
  const addRilievo = () => setRilievi(prev => [{ id: crypto.randomUUID(), descrizione: '', ambiente: '', quote_note: '', misura_1: '', misura_2: '', misura_3: '', foto_urls: [] }, ...prev]);
  const removeRilievo = (id: string) => setRilievi(prev => prev.filter(r => r.id !== id));
  const updateRilievoTesto = (id: string, text: string) => setRilievi(prev => prev.map(r => r.id === id ? { ...r, descrizione: text } : r));
  const updateRilievoAmbiente = (id: string, amb: string) => setRilievi(prev => prev.map(r => r.id === id ? { ...r, ambiente: amb } : r));
  const updateRilievoQuote = (id: string, q: string) => setRilievi(prev => prev.map(r => r.id === id ? { ...r, quote_note: q } : r));
  const updateRilievoMisura = (id: string, field: 'misura_1' | 'misura_2' | 'misura_3', val: string) =>
    setRilievi(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const moveRilievo = (index: number, direction: 'up' | 'down') => setRilievi(prev => moveItem(prev, index, direction));

  // 3. Prescrizioni
  const addPrescrizione = () => setPrescrizioni(prev => [{ id: crypto.randomUUID(), testo: '', impresa_destinataria: '', data_scadenza: '' }, ...prev]);
  const removePrescrizione = (id: string) => setPrescrizioni(prev => prev.filter(p => p.id !== id));
  const updatePrescrizione = (id: string, field: keyof PrescrizioneItem, val: string) => setPrescrizioni(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
  const movePrescrizione = (index: number, direction: 'up' | 'down') => setPrescrizioni(prev => moveItem(prev, index, direction));

  // 4. GESTIONE IMPRESE: NOME + RUOLO NEL CANTIERE (APPALTO / SUBAPPALTO) + RIORDINO
  const aggiungiImpresaPresente = (nome: string, ruoloIniziale: RuoloCantiere = 'appalto') => {
    if (!impresePresentiLista.some(i => i.nome === nome)) {
      const impRef = tutteLeImpreseDB.find(i => i.ragione_sociale === nome);
      setImpresePresentiLista(prev => [
        ...prev, 
        { 
          nome, 
          ruolo_cantiere: ruoloIniziale,
          tipo: impRef?.tipo || (impRef?.ruolo === 'lavoratore_autonomo' ? 'lavoratore_autonomo' : 'impresa')
        }
      ]);
    }
  };

  const rimuoviImpresaPresente = (nome: string) => {
    setImpresePresentiLista(prev => prev.filter(i => i.nome !== nome));
  };

  const updateRuoloCantiere = (nome: string, nuovoRuolo: RuoloCantiere) => {
    setImpresePresentiLista(prev => prev.map(i => 
      i.nome === nome ? { ...i, ruolo_cantiere: nuovoRuolo } : i
    ));
  };

  const updateOperaiImpresa = (nome: string, operai?: number) => {
    setImpresePresentiLista(prev => prev.map(i =>
      i.nome === nome ? { ...i, operai_presenti: operai } : i
    ));
  };

  const moveImpresaPresente = (index: number, direction: 'up' | 'down') => {
    setImpresePresentiLista(prev => moveItem(prev, index, direction));
  };

  const nomiSelezionati = impresePresentiLista.map(i => i.nome);

  const cantiereAttivo = cantieri.find(c => c.id === cantiereId);
  const impreseAssociateAlCantiere = getImpreseDelCantiere(cantiereAttivo, tutteLeImpreseDB, sopralluoghi);

  const altreImpreseDelCantiere = impreseAssociateAlCantiere.filter(
    imp => !nomiSelezionati.includes(imp.ragione_sociale)
  );

  const altreImpreseArchivioGenerale = tutteLeImpreseDB.filter(
    imp => !impreseAssociateAlCantiere.some(a => a.id === imp.id) && !nomiSelezionati.includes(imp.ragione_sociale)
  );

  const handleAssociaImpresaDallArchivio = async (ragioneSociale: string) => {
    if (!ragioneSociale) return;
    aggiungiImpresaPresente(ragioneSociale, 'appalto');
    const imp = tutteLeImpreseDB.find(i => i.ragione_sociale === ragioneSociale);
    if (imp && cantiereAttivo) {
      await associaImpresaACantiere(cantiereAttivo, imp.id, tutteLeImpreseDB, sopralluoghi);
    }
  };

  // Creazione nuova impresa
  const handleVerificaECreaNuovaImpresa = async () => {
    const nome = nuovaImpresaNome.trim();
    if (!nome) return;

    if (nuovaEmail.trim() && !isValidEmail(nuovaEmail)) {
      alert('Inserisci un indirizzo email valido (es. info@impresa.it) oppure lascia il campo vuoto.');
      return;
    }

    const giaPresente = tutteLeImpreseDB.find(
      i => i.ragione_sociale.toLowerCase() === nome.toLowerCase()
    );

    if (giaPresente) {
      setConflittoImpresa({
        nomeDigitato: nome,
        impresaEsistente: giaPresente
      });
      return;
    }

    await procediCreazioneImpresa(nome, nuovoTipo, nuovaEmail);
  };

  const handleUsaEsistente = async () => {
    if (!conflittoImpresa) return;
    const esistente = conflittoImpresa.impresaEsistente;
    aggiungiImpresaPresente(esistente.ragione_sociale, 'appalto');
    if (cantiereAttivo) {
      await associaImpresaACantiere(cantiereAttivo, esistente.id, tutteLeImpreseDB, sopralluoghi);
    }
    setNuovaImpresaNome('');
    setNuovaEmail('');
    setMostraAddImpresa(false);
    setConflittoImpresa(null);
  };

  const handleCreaOmonimaComunque = async () => {
    if (!conflittoImpresa) return;
    const nome = conflittoImpresa.nomeDigitato;
    setConflittoImpresa(null);
    await procediCreazioneImpresa(nome, nuovoTipo, nuovaEmail);
  };

  const procediCreazioneImpresa = async (nome: string, tipoSogg: TipoSoggetto, emailInput?: string) => {
    const nuovaLocale: Impresa = {
      id: crypto.randomUUID(),
      ragione_sociale: nome,
      tipo: tipoSogg,
      email: emailInput?.trim() || undefined,
      cantiere_id: cantiereId || undefined,
      ruolo: tipoSogg === 'lavoratore_autonomo' ? 'lavoratore_autonomo' : 'impresa',
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setTutteLeImpreseDB(prev => [...prev, nuovaLocale]);
      const cached = (await getCachedData<Impresa[]>(OFFLINE_KEYS.IMPRESE)) || [];
      await setCachedData(OFFLINE_KEYS.IMPRESE, [...cached, nuovaLocale]);
      if (cantiereAttivo) {
        await associaImpresaACantiere(cantiereAttivo, nuovaLocale.id, [...tutteLeImpreseDB, nuovaLocale], sopralluoghi);
      }
      aggiungiImpresaPresente(nome, 'appalto');
      setNuovaImpresaNome('');
      setNuovaEmail('');
      setMostraAddImpresa(false);
      return;
    }

    try {
      const { data, error } = await supabase.from('imprese').insert([{
        ragione_sociale: nome,
        tipo: tipoSogg,
        email: emailInput?.trim() || null,
        cantiere_id: cantiereId || null,
      }]).select().single();

      if (!error && data) {
        setTutteLeImpreseDB(prev => [...prev, data]);
        const cached = (await getCachedData<Impresa[]>(OFFLINE_KEYS.IMPRESE)) || [];
        await setCachedData(OFFLINE_KEYS.IMPRESE, [...cached, data]);
        if (cantiereAttivo) {
          await associaImpresaACantiere(cantiereAttivo, data.id, [...tutteLeImpreseDB, data], sopralluoghi);
        }
        aggiungiImpresaPresente(nome, 'appalto');
        setNuovaImpresaNome('');
        setNuovaEmail('');
        setMostraAddImpresa(false);
      } else {
        // Fallback locale in caso di errore server/rete
        setTutteLeImpreseDB(prev => [...prev, nuovaLocale]);
        if (cantiereAttivo) {
          await associaImpresaACantiere(cantiereAttivo, nuovaLocale.id, [...tutteLeImpreseDB, nuovaLocale], sopralluoghi);
        }
        aggiungiImpresaPresente(nome, 'appalto');
        setNuovaImpresaNome('');
        setNuovaEmail('');
        setMostraAddImpresa(false);
      }
    } catch {
      setTutteLeImpreseDB(prev => [...prev, nuovaLocale]);
      if (cantiereAttivo) {
        await associaImpresaACantiere(cantiereAttivo, nuovaLocale.id, [...tutteLeImpreseDB, nuovaLocale], sopralluoghi);
      }
      aggiungiImpresaPresente(nome, 'appalto');
      setNuovaImpresaNome('');
      setNuovaEmail('');
      setMostraAddImpresa(false);
    }
  };

  // Dispositivi e apprestamenti
  const toggleDispositivo = (index: number) => {
    setDispositivi(prev => prev.map((item, i) => i === index ? { ...item, selezionato: !item.selezionato } : item));
  };
  const updateNotaDispositivo = (index: number, nota: string) => {
    setDispositivi(prev => prev.map((item, i) => i === index ? { ...item, note: nota } : item));
  };
  const updateNomeDispositivo = (index: number, nome: string) => {
    setDispositivi(prev => prev.map((item, i) => i === index ? { ...item, nome: nome } : item));
  };
  const addAltroDispositivo = () => {
    setDispositivi(prev => [...prev, { id: crypto.randomUUID(), nome: 'ALTRO', selezionato: true, note: '' }]);
  };
  const removeDispositivoCustom = (index: number) => {
    setDispositivi(prev => prev.filter((_, i) => i !== index));
  };

  // Upload foto e acquisizione Drag & Drop / Appunti (Ctrl + V)
  const handleFilesChange = (rilievoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    appendFilesToRilievo(rilievoId, Array.from(e.target.files));
  };

  const handlePaste = (rilievoId: string, e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    const files = e.clipboardData?.files;
    const pastedImages: File[] = [];

    // 1. Cerca file immagine diretti
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          pastedImages.push(files[i]);
        }
      }
    }

    // 2. Se non trovati nei files, cerca negli items (tipico di 'Copia immagine' da Google Foto o screenshot)
    if (pastedImages.length === 0 && items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const ext = item.type.split('/')[1] || 'png';
            pastedImages.push(new File([file], `foto_${Date.now()}_${i + 1}.${ext}`, { type: file.type }));
          }
        }
      }
    }

    if (pastedImages.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      appendFilesToRilievo(rilievoId, pastedImages);
    }
  };

  const handleDragOver = (rilievoId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (draggingRilievoId !== rilievoId) {
      setDraggingRilievoId(rilievoId);
    }
  };

  const handleDragEnter = (rilievoId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDraggingRilievoId(rilievoId);
  };

  const handleDragLeave = (rilievoId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (draggingRilievoId === rilievoId) {
      setDraggingRilievoId(null);
    }
  };

  const handleDrop = async (rilievoId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingRilievoId(null);

    const droppedImages: File[] = [];

    // 1. Controlla file diretti dal sistema operativo (Explorer, Desktop, etc.)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const isImage = file.type.startsWith('image/') || 
                        /\.(jpe?g|png|webp|gif|bmp|heic|jfif|tiff?|avif)$/i.test(file.name);
        if (isImage) {
          if (!file.type) {
            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            droppedImages.push(new File([file], file.name, { type: mime }));
          } else {
            droppedImages.push(file);
          }
        }
      }
    }

    // 2. Se non trovati, cerca negli items con getAsFile()
    if (droppedImages.length === 0 && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) droppedImages.push(file);
        }
      }
    }

    // 3. Se ancora vuoto, verifica se è un'immagine trascinata da un'altra scheda web (es. HTML o URL)
    if (droppedImages.length === 0) {
      let imageUrl: string | null = null;
      const html = e.dataTransfer.getData('text/html');
      if (html) {
        const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1]) {
          imageUrl = match[1];
        }
      }

      if (!imageUrl) {
        const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('URL') || e.dataTransfer.getData('text/plain');
        if (uri && (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:image/') || uri.startsWith('blob:'))) {
          imageUrl = uri.trim();
        }
      }

      if (imageUrl) {
        if (imageUrl.startsWith('data:image/')) {
          try {
            const parts = imageUrl.split(',');
            const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            const ext = mime.split('/')[1] || 'jpg';
            droppedImages.push(new File([blob], `trascinata_${Date.now()}.${ext}`, { type: mime }));
          } catch (err) {
            console.warn('Errore parsing data URL:', err);
          }
        } else {
          try {
            const resp = await fetch(imageUrl, { mode: 'cors' });
            if (resp.ok) {
              const blob = await resp.blob();
              const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
              const ext = mime.split('/')[1] || 'jpg';
              droppedImages.push(new File([blob], `trascinata_${Date.now()}.${ext}`, { type: mime }));
            } else {
              throw new Error('HTTP ' + resp.status);
            }
          } catch {
            // Google Foto protegge con cross-origin le immagini trascinate tra schede
            alert("Attenzione: Google Foto blocca il trascinamento diretto delle foto tra schede del browser per motivi di sicurezza di Google.\n\nPer inserire le foto da Google Foto usa il metodo rapido via appunti:\n1. Tasto destro sulla foto in Google Foto > 'Copia immagine'\n2. Premi Ctrl + V qui nel verbale!\n(Funziona all'istante senza dover scaricare il file)");
            return;
          }
        }
      }
    }

    if (droppedImages.length > 0) {
      appendFilesToRilievo(rilievoId, droppedImages);
    }
  };

  const handleRemoveExistingPhoto = (rilievoId: string, urlToRemove: string) => {
    setRilievi(prev => prev.map(r => {
      if (r.id === rilievoId) {
        return { ...r, foto_urls: (r.foto_urls || []).filter(url => url !== urlToRemove) };
      }
      return r;
    }));

    // Se l'immagine era già su Supabase Storage, traccia il percorso per eliminarla fisicamente
    const path = extractStoragePath(urlToRemove, 'foto-sopralluoghi');
    if (path) {
      setFotoUrlsDaEliminareStorage(prev => [...prev, path]);
    }
  };
  const handleRemoveStagedFile = (rilievoId: string, fileIndex: number) => {
    setFilesPerRilievo(prev => ({ ...prev, [rilievoId]: (prev[rilievoId] || []).filter((_, idx) => idx !== fileIndex) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cantiereId) {
      alert('Seleziona un cantiere prima di procedere al salvataggio.');
      setCurrentStep(1);
      return;
    }

    if (tipoVerbale === 'CSE' && sospensione && !motivoSospensione?.trim()) {
      alert('Inserisci la motivazione della sospensione dei lavori.');
      setCurrentStep(6);
      return;
    }

    setLoading(true);

    try {
      // 1. Compressione preventiva e sanitizzazione dei percorsi
      const cleanCantiere = sanitizeStoragePath(cantiereId);
      const compressedByRilievo: Record<string, { blob: Blob; fileName: string; path: string }[]> = {};
      const pendingFotosToSave: PendingFoto[] = [];

      for (const ril of rilievi) {
        const fileList = filesPerRilievo[ril.id] || [];
        compressedByRilievo[ril.id] = [];

        for (const file of fileList) {
          const fileCompresso = await compressImage(file, 100);
          const isWebp = fileCompresso.type === 'image/webp';
          const ext = isWebp ? 'webp' : 'jpg';
          const rawName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
          const fileName = sanitizeStoragePath(rawName);
          const path = sanitizeStoragePath(`sopralluoghi/${cleanCantiere}/${fileName}`);

          compressedByRilievo[ril.id].push({
            blob: fileCompresso,
            fileName,
            path
          });

          pendingFotosToSave.push({
            rilievoId: ril.id,
            fileBlob: fileCompresso,
            fileName,
            path
          });
        }
      }

      const fasiValide = (fasiLavoro || []).filter(f => f && f.descrizione && f.descrizione.trim());
      const lavorazioniSintetiche = fasiValide
        .map(f => `${f.descrizione.trim()}${f.impresa && f.impresa.trim() ? ` (${f.impresa.trim()})` : ''}`)
        .join('; ');

      // Riconosciamo i rilievi che contengono almeno una informazione (foto, note/testo, misure o ambiente)
      const rilieviValidi = rilievi.filter(ril => {
        const hasText = Boolean(ril.descrizione && ril.descrizione.trim());
        const hasAmbiente = Boolean(ril.ambiente && ril.ambiente.trim());
        const hasQuote = Boolean(ril.quote_note && ril.quote_note.trim());
        const hasMisura = Boolean(
          (ril.misura_1 && ril.misura_1.trim()) ||
          (ril.misura_2 && ril.misura_2.trim()) ||
          (ril.misura_3 && ril.misura_3.trim())
        );
        const hasExistingPhotos = Boolean(ril.foto_urls && ril.foto_urls.length > 0);
        const hasStagedPhotos = Boolean(filesPerRilievo[ril.id] && filesPerRilievo[ril.id].length > 0);
        return hasText || hasAmbiente || hasQuote || hasMisura || hasExistingPhotos || hasStagedPhotos;
      });

      // Rilievi privi di blob URL effimeri (le foto staged offline vivono come Blob in pendingFotos)
      const rilieviBase: RilievoItem[] = rilieviValidi.map(ril => ({
        id: ril.id,
        descrizione: ril.descrizione || '',
        ambiente: ril.ambiente || undefined,
        quote_note: ril.quote_note || undefined,
        misura_1: ril.misura_1 || undefined,
        misura_2: ril.misura_2 || undefined,
        misura_3: ril.misura_3 || undefined,
        foto_urls: (ril.foto_urls || []).filter(u => !u.startsWith('blob:'))
      }));

      const basePayload = {
        cantiere_id: cantiereId,
        tipo_verbale: tipoVerbale,
        data: dataSopralluogo,
        ora: oraSopralluogo,
        lavorazioni_in_corso: lavorazioniSintetiche || '',
        fasi_lavoro: fasiValide,
        imprese_presenti: arrayStringheImpresePresenti || [],
        imprese_dettaglio: impresePresentiLista || [],
        presenze: presenze,
        dispositivi_apprestamenti: dispositivi || [],
        argomenti_discussi: argomentiDiscussi || '',
        rilievi: rilieviBase,
        prescrizioni_lista: prescrizioni || [],
        sospensione_lavori: Boolean(sospensione),
        motivo_sospensione: (sospensione && motivoSospensione) ? motivoSospensione : null,
        condizioni_meteo: condizioniMeteo || null,
        ordini_servizio: ordiniServizio || null,
        operai_totali: operaiTotali ?? null,
        note_tecniche: noteTecniche || null,
      };

      const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      const isRealEdit = isUUID(sopralluogoToEdit?.id);
      const persistentId = isRealEdit ? sopralluogoToEdit?.id : undefined;

      // Determina ID temporaneo offline o persistente
      const tempId = (isRealEdit && sopralluogoToEdit?.id)
        ? sopralluogoToEdit.id
        : (sopralluogoToEdit?.id && sopralluogoToEdit.id.startsWith('pending_'))
          ? sopralluogoToEdit.id
          : `pending_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // MODALITÀ OFFLINE ESPLICITA
      if (!isCurrentlyOnline) {
        await savePendingSopralluogo({
          tempId,
          sopralluogoId: persistentId,
          cantiere_id: cantiereId,
          payload: {
            ...basePayload,
            tipo_verbale: tipoVerbale,
            id: tempId,
          },
          pendingFotos: pendingFotosToSave,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        alert('Connessione di cantiere non disponibile.\n\nIl verbale e tutte le fotografie sono stati salvati in sicurezza sul dispositivo.\nVerranno sincronizzati automaticamente con il cloud non appena tornerà la rete.');
        onSuccess();
        onClose();
        return;
      }

      // MODALITÀ ONLINE CON FALLBACK SU OFFLINE IN CASO DI ERRORE RETE
      try {
        // Se c'erano foto rimosse dall'utente durante l'editing, eliminale fisicamente dal bucket
        if (fotoUrlsDaEliminareStorage.length > 0) {
          try {
            await supabase.storage.from('foto-sopralluoghi').remove(fotoUrlsDaEliminareStorage);
            setFotoUrlsDaEliminareStorage([]);
          } catch (remErr) {
            console.warn('[ModalSopralluogo] Errore rimozione foto scartate:', remErr);
          }
        }

        const rilieviFinali: RilievoItem[] = [];

        for (const ril of rilieviValidi) {
          const uploadedUrls: string[] = [...(ril.foto_urls || []).filter(u => !u.startsWith('blob:'))];
          const stagedList = compressedByRilievo[ril.id] || [];

          for (const item of stagedList) {
            const isWebp = item.path.toLowerCase().endsWith('.webp');
            const { error: upErr } = await supabase.storage
              .from('foto-sopralluoghi')
              .upload(item.path, item.blob, {
                contentType: isWebp ? 'image/webp' : 'image/jpeg',
                upsert: true
              });

            if (upErr) throw upErr;

            const { data } = supabase.storage.from('foto-sopralluoghi').getPublicUrl(item.path);
            if (data?.publicUrl) {
              uploadedUrls.push(data.publicUrl);
            }
          }

          rilieviFinali.push({
            id: ril.id,
            descrizione: ril.descrizione || '',
            ambiente: ril.ambiente || undefined,
            quote_note: ril.quote_note || undefined,
            misura_1: ril.misura_1 || undefined,
            misura_2: ril.misura_2 || undefined,
            misura_3: ril.misura_3 || undefined,
            foto_urls: uploadedUrls,
          });
        }

        const cloudPayload = {
          ...basePayload,
          tipo_verbale: tipoVerbale,
          rilievi: rilieviFinali,
        };

        if (isRealEdit && sopralluogoToEdit?.id) {
          const { error } = await supabase.from('sopralluoghi').update(cloudPayload).eq('id', sopralluogoToEdit.id);
          if (error) throw error;
        } else {
          delete (cloudPayload as any).id;
          const { error } = await supabase.from('sopralluoghi').insert([cloudPayload]);
          if (error) throw error;

          // Se l'elemento proveniva dalla coda offline, rimuovilo da IndexedDB
          if (sopralluogoToEdit?.id?.startsWith('pending_')) {
            await removePendingSopralluogo(sopralluogoToEdit.id);
          }
        }

        onSuccess();
        onClose();
      } catch (cloudErr: any) {
        console.error('[ModalSopralluogo] Errore salvataggio cloud:', {
          message: cloudErr?.message,
          details: cloudErr?.details,
          hint: cloudErr?.hint,
          code: cloudErr?.code,
          raw: cloudErr,
        });

        await savePendingSopralluogo({
          tempId,
          sopralluogoId: persistentId,
          cantiere_id: cantiereId,
          payload: {
            ...basePayload,
            tipo_verbale: tipoVerbale,
            id: tempId,
          },
          pendingFotos: pendingFotosToSave,
          status: 'pending',
          errorMessage: cloudErr?.message,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const isSchemaError = cloudErr?.code === '42703' || 
          cloudErr?.message?.toLowerCase().includes('column') || 
          cloudErr?.message?.toLowerCase().includes('schema');

        if (isSchemaError) {
          alert(`Attenzione: Salvataggio su database cloud non riuscito a causa dello schema delle tabelle:\n"${cloudErr.message}"\n\nAssicurati di aver eseguito lo script SQL di migrazione su Supabase per aggiungere tutte le colonne.\n\nIl verbale è stato comunque salvato localmente sul dispositivo.`);
        } else {
          alert('Connessione cloud non disponibile o errore di rete.\n\nIl verbale è stato salvato in sicurezza sul dispositivo e verrà sincronizzato automaticamente al rientro online.');
        }

        onSuccess();
        onClose();
      }
    } catch (err: any) {
      alert('Errore salvataggio verbale: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const isEditMode = Boolean(sopralluogoToEdit && sopralluogoToEdit.id);

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl my-auto text-sm relative">
          
          {/* Header Modale */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/70 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                tipoVerbale === 'DL' 
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                  : tipoVerbale === 'RILIEVO'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
              }`}>
                {tipoVerbale === 'DL' ? <Compass className="w-5 h-5" /> : tipoVerbale === 'RILIEVO' ? <Camera className="w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="font-bold text-white text-base sm:text-lg">
                  {isEditMode 
                    ? `Modifica ${tipoVerbale === 'DL' ? 'Verbale Direzione Lavori' : tipoVerbale === 'RILIEVO' ? 'Sopralluogo/Rilievo' : 'Verbale Sopralluogo CSE'}` 
                    : `Nuovo ${tipoVerbale === 'DL' ? 'Verbale Direzione Lavori (DL)' : tipoVerbale === 'RILIEVO' ? 'Sopralluogo/Rilievo' : 'Verbale di Sopralluogo CSE'}`}
                </h2>
                <p className="text-xs text-slate-400">
                  {tipoVerbale === 'DL' ? 'Direzione dei Lavori & Avanzamento Opere' : tipoVerbale === 'RILIEVO' ? 'Rilievo Fotografico & Misure di Cantiere' : 'Arch. Michele Cavalleri &bull; Coordinamento Sicurezza D.Lgs. 81/08'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode(prev => prev === 'steps' ? 'all' : 'steps')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 shadow-sm transition cursor-pointer text-xs"
                title={viewMode === 'steps' ? "Passa a vista completa continua (tutte le sezioni a scorrimento)" : "Passa a compilazione guidata a step"}
              >
                <ListOrdered className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">{viewMode === 'steps' ? 'Vista continua' : 'A Step'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPreview}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl border border-amber-500/30 flex items-center gap-1.5 shadow-sm transition cursor-pointer text-xs"
                title="Vedi l'anteprima del verbale impaginato prima di salvare"
              >
                <Eye className="w-4 h-4 text-amber-400" />
                <span>Anteprima PDF</span>
              </button>

              <button 
                type="button" 
                onClick={() => {
                  revokePreviewBlobUrls();
                  onClose();
                }} 
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Barra Stepper di Navigazione (visibile in modalità a step) */}
          {viewMode === 'steps' && (
            <div className="bg-slate-950/95 border-b border-slate-800 px-2.5 sm:px-4 py-2 shrink-0 sticky top-[73px] z-10">
              <div 
                ref={stepperContainerRef}
                onWheel={(e) => {
                  if (e.deltaY !== 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
                className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-slate-900/50 [&::-webkit-scrollbar-thumb]:bg-slate-700/80 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-color:#334155_transparent]"
              >
                {currentStepsList.map((step) => {
                  const isActive = currentStep === step.id;
                  const isPast = currentStep > step.id;
                  const Icon = step.icon;

                  return (
                    <button
                      key={step.id}
                      ref={isActive ? activeStepBtnRef : null}
                      type="button"
                      onClick={() => setCurrentStep(step.id)}
                      title={`${step.id}. ${step.label}`}
                      className={`flex-1 min-w-[90px] sm:min-w-0 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                        isActive
                          ? tipoVerbale === 'DL'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-sm'
                            : tipoVerbale === 'RILIEVO'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                          : isPast
                            ? 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                            : 'bg-transparent text-slate-500 border-transparent hover:text-slate-400 hover:bg-slate-900/50'
                      }`}
                    >
                      <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isActive
                          ? tipoVerbale === 'DL'
                            ? 'bg-blue-500 text-slate-950'
                            : tipoVerbale === 'RILIEVO'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-amber-500 text-slate-950'
                          : isPast
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-slate-900 text-slate-500'
                      }`}>
                        {step.id}
                      </span>
                      <Icon className="w-3.5 h-3.5 shrink-0 hidden sm:inline-block" />
                      <span className="whitespace-nowrap sm:truncate">{step.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-slate-200">
            
            {/* STEP 1: SELETTORE TIPOLOGIA & DATI GENERALI (CANTIERE, DATA, ORA) */}
            {(viewMode === 'all' || currentStep === 1) && (
              <div className="space-y-6">
                {/* SELETTORE TIPOLOGIA ATTO (CSE | DL | RILIEVO) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="font-bold uppercase tracking-wider text-slate-300 text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-500" />
                  Ruolo / Tipologia Verbale:
                </label>
                {isEditMode && (
                  <div className="flex items-center gap-2">
                    {!isTipoUnlocked ? (
                      <button
                        type="button"
                        onClick={() => setIsTipoUnlocked(true)}
                        className="text-[11px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        title="Clicca per sbloccare la tipologia e passare a DL, CSE o Rilievo"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sblocca tipologia</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Tipologia sbloccata</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsTipoUnlocked(false)}
                          className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer ml-1"
                          title="Riblocca la tipologia per evitare cambi accidentali"
                        >
                          Riblocca
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isEditMode && isTipoUnlocked && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
                  <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Cambio tipologia abilitato:</strong> puoi selezionare un nuovo ruolo per questo verbale. I dati delle altre sezioni non verranno cancellati e resteranno conservati.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Opzione CSE */}
                <button
                  type="button"
                  disabled={isEditMode && !isTipoUnlocked}
                  onClick={() => setTipoVerbale('CSE')}
                  title={isEditMode && !isTipoUnlocked ? "Tipologia bloccata. Clicca su 'Sblocca tipologia' per modificarla." : undefined}
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                    isEditMode && !isTipoUnlocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                  } ${
                    tipoVerbale === 'CSE'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm shadow-amber-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${tipoVerbale === 'CSE' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                    <HardHat className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wide">CSE - Sicurezza</div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">Coordinamento, apprestamenti & prescrizioni (D.Lgs. 81/08)</p>
                  </div>
                </button>

                {/* Opzione DL */}
                <button
                  type="button"
                  disabled={isEditMode && !isTipoUnlocked}
                  onClick={() => setTipoVerbale('DL')}
                  title={isEditMode && !isTipoUnlocked ? "Tipologia bloccata. Clicca su 'Sblocca tipologia' per modificarla." : undefined}
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                    isEditMode && !isTipoUnlocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                  } ${
                    tipoVerbale === 'DL'
                      ? 'bg-blue-500/15 border-blue-500 text-white shadow-sm shadow-blue-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${tipoVerbale === 'DL' ? 'bg-blue-500 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}>
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wide">Direzione Lavori (DL)</div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">Avanzamento opere, meteo, maestranze & Ordini di Servizio</p>
                  </div>
                </button>

                {/* Opzione RILIEVO */}
                <button
                  type="button"
                  disabled={isEditMode && !isTipoUnlocked}
                  onClick={() => setTipoVerbale('RILIEVO')}
                  title={isEditMode && !isTipoUnlocked ? "Tipologia bloccata. Clicca su 'Sblocca tipologia' per modificarla." : undefined}
                  className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                    isEditMode && !isTipoUnlocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                  } ${
                    tipoVerbale === 'RILIEVO'
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-sm shadow-emerald-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${tipoVerbale === 'RILIEVO' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs uppercase tracking-wide">Sopralluogo / Rilievo</div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">Fascicolo fotografico per ambiente, quote e misure dimensionali</p>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Cantiere, Data e Ora */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 text-xs mb-1">Cantiere *</label>
                <select
                  required
                  value={cantiereId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCantiereId(val);
                    const selC = cantieri.find(c => c.id === val);
                    if (selC) {
                      setPresenze({
                        committente: { presente: false, nome: selC.committente || '' },
                        dl: { presente: false, nome: selC.direttore_lavori || '' },
                        progettista: { presente: false, nome: selC.progettista || '' },
                        cse: { presente: true, nome: selC.cse || 'arch. Cavalleri Michele' }
                      });
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Seleziona Cantiere --</option>
                  {cantieri.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 text-xs mb-1">Data *</label>
                <input
                  type="date"
                  required
                  value={dataSopralluogo}
                  onChange={(e) => setDataSopralluogo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 text-xs mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Ora Incontro
                </label>
                <input
                  type="time"
                  value={oraSopralluogo}
                  onChange={(e) => setOraSopralluogo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* SEZIONE CONDIZIONI METEO (SPECIFICA PER DL) */}
            {tipoVerbale === 'DL' && (
              <div className="bg-slate-950/60 border border-blue-500/30 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <label className="font-bold uppercase tracking-wider text-blue-400 text-xs flex items-center gap-1.5">
                    <CloudSun className="w-4 h-4 text-blue-400" />
                    Condizioni Meteo & Operatività Cantiere
                  </label>
                  <span className="text-xs text-slate-400">Accertamento climatico per il giornale dei lavori</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    'Sereno - Cantiere regolarmente operativo',
                    'Nuvoloso - Operativo',
                    'Pioggia - Sospese lavorazioni esterne',
                    'Vento Forte - Sospesi lavori in quota',
                    'Gelo / Neve - Cantiere fermo'
                  ].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCondizioniMeteo(m)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                        condizioniMeteo.startsWith(m.split(' - ')[0])
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 font-semibold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {m.split(' - ')[0]}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="Note meteo specifiche (es. Temperatura 14°C, asciutto, terreno praticabile)..."
                  value={condizioniMeteo}
                  onChange={(e) => setCondizioniMeteo(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
              </div>
            )}

            {/* STEP 2: SOGGETTI CONVENUTI, IMPRESE & FASI DI LAVORO (CSE/DL) / PREMESSE TECNICHE (RILIEVO) */}
            {(viewMode === 'all' || currentStep === 2) && (
              <div className="space-y-6">
                {/* NOTE GENERALI / FINALITÀ (SPECIFICA PER RILIEVO) */}
                {tipoVerbale === 'RILIEVO' && (
                  <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-4 space-y-2.5">
                    <label className="font-bold uppercase tracking-wider text-emerald-400 text-xs flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-emerald-400" />
                      Note Generali & Finalità del Rilievo Tecnico
                    </label>
                    <p className="text-xs text-slate-400">
                      Specifica la finalità (es. Stato di consistenza, SAL contabilità, accertamento difformità, rilievo strutturale/impiantistico).
                    </p>
                    <textarea
                      rows={3}
                      placeholder="Inserisci le premesse tecniche del rilievo, gli strumenti di misura impiegati..."
                      value={noteTecniche}
                      onChange={(e) => setNoteTecniche(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none leading-relaxed"
                    />
                  </div>
                )}

            {/* SOGGETTI CONVENUTI */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-300 text-xs flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-500" />
                  Soggetti Convenuti e Presenti {tipoVerbale === 'RILIEVO' ? 'al Sopralluogo' : 'alla Riunione'}
                </label>
                <span className="text-xs text-slate-500">
                  {tipoVerbale === 'RILIEVO' ? 'Spunta le figure presenti alle operazioni di rilievo' : 'Spunta le figure presenti e specifica per ciascuna impresa se opera in Appalto o Subappalto'}
                </span>
              </div>

              {/* Figure Principali (Committente, DL, Progettista, CSE) */}
              <div className="space-y-2.5 border-b border-slate-800 pb-4">
                {/* 1. Committente */}
                <div className="flex items-center gap-2.5">
                  <label className="flex items-center gap-2 w-44 text-slate-300 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={presenze.committente?.presente || false}
                      onChange={(e) => setPresenze(p => ({
                        ...p,
                        committente: { presente: e.target.checked, nome: p.committente?.nome || '' }
                      }))}
                      className="accent-amber-500 rounded w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold">1. Committente</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nome Committente..."
                    value={presenze.committente?.nome || ''}
                    onChange={(e) => setPresenze(p => ({
                      ...p,
                      committente: { presente: p.committente?.presente || false, nome: e.target.value }
                    }))}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                </div>

                {/* 2. Direttore Lavori */}
                <div className="flex items-center gap-2.5">
                  <label className="flex items-center gap-2 w-44 text-slate-300 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={presenze.dl?.presente || false}
                      onChange={(e) => setPresenze(p => ({
                        ...p,
                        dl: { presente: e.target.checked, nome: p.dl?.nome || '' }
                      }))}
                      className="accent-amber-500 rounded w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold">2. DL (Dir. Lavori)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nome Direttore dei Lavori..."
                    value={presenze.dl?.nome || ''}
                    onChange={(e) => setPresenze(p => ({
                      ...p,
                      dl: { presente: p.dl?.presente || false, nome: e.target.value }
                    }))}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                </div>

                {/* 3. Progettista */}
                <div className="flex items-center gap-2.5">
                  <label className="flex items-center gap-2 w-44 text-slate-300 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={presenze.progettista?.presente || false}
                      onChange={(e) => setPresenze(p => ({
                        ...p,
                        progettista: { presente: e.target.checked, nome: p.progettista?.nome || '' }
                      }))}
                      className="accent-amber-500 rounded w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold">3. Progettista</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nome Progettista..."
                    value={presenze.progettista?.nome || ''}
                    onChange={(e) => setPresenze(p => ({
                      ...p,
                      progettista: { presente: p.progettista?.presente || false, nome: e.target.value }
                    }))}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                </div>

                {/* 4. CSE */}
                <div className="flex items-center gap-2.5">
                  <label className="flex items-center gap-2 w-44 text-slate-300 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={presenze.cse?.presente ?? true}
                      onChange={(e) => setPresenze(p => ({
                        ...p,
                        cse: { presente: e.target.checked, nome: p.cse?.nome || 'arch. Cavalleri Michele' }
                      }))}
                      className="accent-amber-500 rounded w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-amber-400">4. CSE</span>
                  </label>
                  <input
                    type="text"
                    value={presenze.cse?.nome || 'arch. Cavalleri Michele'}
                    onChange={(e) => setPresenze(p => ({
                      ...p,
                      cse: { presente: true, nome: e.target.value }
                    }))}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white font-medium"
                  />
                </div>
              </div>

              {/* 5. GESTIONE IMPRESE: CROCETTA + SCELTA APPALTO / SUBAPPALTO + RIORDINO (NON RICHIESTO PER RILIEVO) */}
              {tipoVerbale !== 'RILIEVO' && (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                      5. Imprese ed Esecutori Presenti Oggi ({impresePresentiLista.length})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Scegli <strong className="text-amber-400">Appalto</strong> o <strong className="text-amber-400">Subappalto</strong> per ciascuna e ordina con le frecce
                    </span>
                  </div>

                {/* ELENCO DELLE IMPRESE PRESENTI */}
                {impresePresentiLista.length === 0 ? (
                  <div className="p-3.5 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
                    Nessuna impresa ancora inclusa tra i presenti. Spunta una delle imprese sotto o aggiungine una.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {impresePresentiLista.map((item, idx) => (
                      <div 
                        key={item.nome}
                        className="p-2.5 bg-slate-900 border border-amber-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm hover:border-amber-500 transition"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {/* Frecce Su/Giù */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              title="Sposta su"
                              disabled={idx === 0}
                              onClick={() => moveImpresaPresente(idx, 'up')}
                              className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Sposta giù"
                              disabled={idx === impresePresentiLista.length - 1}
                              onClick={() => moveImpresaPresente(idx, 'down')}
                              className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-slate-500 font-mono text-xs w-5 text-center ml-0.5">{idx + 1}.</span>
                          </div>

                          {/* Crocetta Spuntata + Nome + Badge Giuridico */}
                          <div 
                            onClick={() => rimuoviImpresaPresente(item.nome)}
                            className="flex items-center gap-2 cursor-pointer select-none text-slate-100 hover:text-amber-300 font-semibold text-xs sm:text-sm min-w-0 truncate"
                          >
                            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="truncate">{item.nome}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ${
                              item.tipo === 'lavoratore_autonomo'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}>
                              {item.tipo === 'lavoratore_autonomo' ? 'L.A.' : 'Impresa'}
                            </span>
                          </div>
                        </div>

                        {/* SELETTORE RUOLO NEL CANTIERE (APPALTO / SUBAPPALTO) + OPERAI SE DL */}
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                          {tipoVerbale === 'DL' && (
                            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs">
                              <span className="text-slate-400 text-[11px]">Operai:</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="N°"
                                value={item.operai_presenti ?? ''}
                                onChange={(e) => updateOperaiImpresa(item.nome, e.target.value ? Number(e.target.value) : undefined)}
                                className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-white font-mono text-xs focus:outline-none focus:border-blue-400"
                              />
                            </div>
                          )}

                          <select
                            value={item.ruolo_cantiere}
                            onChange={(e) => updateRuoloCantiere(item.nome, e.target.value as RuoloCantiere)}
                            className="bg-slate-950 border border-slate-700 text-amber-400 font-bold text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                          >
                            <option value="appalto">Appalto</option>
                            <option value="subappalto">Subappalto</option>
                          </select>

                          <button
                            type="button"
                            title="Rimuovi dal verbale"
                            onClick={() => rimuoviImpresaPresente(item.nome)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ALTRE IMPRESE DEL CANTIERE NON ANCORA SPUNTATE */}
                {altreImpreseDelCantiere.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                      Altre imprese registrate in questo cantiere (clicca la casella per includerle):
                    </span>
                    <div className="space-y-1">
                      {altreImpreseDelCantiere.map(imp => (
                        <div
                          key={imp.id}
                          onClick={() => aggiungiImpresaPresente(imp.ragione_sociale, 'appalto')}
                          className="p-2 bg-slate-900/60 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs text-slate-300 hover:text-white hover:bg-slate-800/50 cursor-pointer transition select-none"
                        >
                          <div className="flex items-center gap-2">
                            <Square className="w-4 h-4 text-slate-500" />
                            <span>{imp.ragione_sociale}</span>
                            <span className="text-[10px] text-slate-500 uppercase">
                              ({imp.tipo === 'lavoratore_autonomo' ? 'L.A.' : 'Impresa'})
                            </span>
                          </div>
                          <span className="text-[11px] text-amber-400/80 font-medium">+ Includi</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ASSOCIA DA ARCHIVIO O CREA NUOVA */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAssociaImpresaDallArchivio(e.target.value);
                      }
                    }}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">+ Associa impresa dall'archivio al cantiere...</option>
                    {altreImpreseArchivioGenerale.map(imp => (
                      <option key={imp.id} value={imp.ragione_sociale}>
                        {imp.ragione_sociale} {imp.tipo === 'lavoratore_autonomo' ? '(Lav. Autonomo)' : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setMostraAddImpresa(!mostraAddImpresa)}
                    className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 font-bold rounded-lg border border-amber-500/30 transition cursor-pointer text-xs flex items-center justify-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuovo Soggetto</span>
                  </button>
                </div>

                {/* Form nuovo soggetto */}
                {mostraAddImpresa && (
                  <div className="p-3 bg-slate-900 border border-amber-500/30 rounded-xl space-y-2 mt-1">
                    <span className="text-slate-300 font-bold text-xs block">Inserisci nuovo soggetto (verrà associato al cantiere):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Ragione Sociale o Nominativo..."
                        value={nuovaImpresaNome}
                        onChange={(e) => setNuovaImpresaNome(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                      <input
                        type="email"
                        placeholder="Email (opzionale)..."
                        value={nuovaEmail}
                        onChange={(e) => setNuovaEmail(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                      <div className="flex gap-2">
                        <select
                          value={nuovoTipo}
                          onChange={(e) => setNuovoTipo(e.target.value as TipoSoggetto)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white flex-1"
                        >
                          <option value="impresa">Impresa</option>
                          <option value="lavoratore_autonomo">Lavoratore Autonomo</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleVerificaECreaNuovaImpresa}
                          className="px-3.5 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg cursor-pointer text-xs shrink-0"
                        >
                          Salva e Includi
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FASI DI LAVORO (NON RICHIESTO PER RILIEVO) */}
          {tipoVerbale !== 'RILIEVO' && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-300 text-xs block">
                    Fasi di Lavoro in Svolgimento alla Data Odierna
                  </label>
                  <span className="text-xs text-slate-500">I nuovi inserimenti compaiono in cima. Usa le frecce per riordinare.</span>
                </div>
                <button
                  type="button"
                  onClick={addFaseLavoro}
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> + Aggiungi Lavorazione
                </button>
              </div>

              <div className="space-y-2.5">
                {fasiLavoro.map((fase, idx) => (
                  <div key={fase.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row gap-2.5 items-center">
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        title="Sposta su"
                        disabled={idx === 0}
                        onClick={() => moveFaseLavoro(idx, 'up')}
                        className="p-1.5 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Sposta giù"
                        disabled={idx === fasiLavoro.length - 1}
                        onClick={() => moveFaseLavoro(idx, 'down')}
                        className="p-1.5 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <span className="text-slate-500 font-mono text-xs w-6 text-center ml-1">{idx + 1}.</span>
                    </div>

                    <input
                      type="text"
                      placeholder="Descrizione lavorazione in corso (opzionale)..."
                      value={fase.descrizione}
                      onChange={(e) => updateFaseLavoro(fase.id, 'descrizione', e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm sm:text-base text-white focus:border-amber-500 focus:outline-none w-full"
                    />
                    
                    <select
                      value={fase.impresa || ''}
                      onChange={(e) => updateFaseLavoro(fase.id, 'impresa', e.target.value)}
                      className="w-full sm:w-60 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">-- Seleziona Soggetto --</option>
                      {impreseAssociateAlCantiere.map(imp => (
                        <option key={imp.id} value={imp.ragione_sociale}>
                          {imp.ragione_sociale} {imp.tipo === 'lavoratore_autonomo' ? '(Lav. Autonomo)' : ''}
                        </option>
                      ))}
                      {impresePresentiLista
                        .filter(p => !impreseAssociateAlCantiere.some(a => a.ragione_sociale === p.nome))
                        .map(p => (
                          <option key={p.nome} value={p.nome}>
                            {p.nome} (Presente nel verbale)
                          </option>
                        ))}
                    </select>

                    {fasiLavoro.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFaseLavoro(fase.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
              </div>
            )}

            {/* STEP 3 (CSE): DISPOSITIVI E APPRESTAMENTI */}
            {tipoVerbale === 'CSE' && (viewMode === 'all' || currentStep === 3) && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-300 text-xs flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-amber-500" />
                      Verifica ai Dispositivi e Apprestamenti
                    </span>
                    <p className="text-slate-400 text-xs">Seleziona i dispositivi controllati e inserisci le relative note</p>
                  </div>

                  <button
                    type="button"
                    onClick={addAltroDispositivo}
                    className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Aggiungi ALTRO
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  {dispositivi.map((disp, idx) => {
                    const isCustom = !DISPOSITIVI_PREDEFINITI.includes(disp.nome);
                    return (
                      <div key={disp.id || idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <div 
                            onClick={() => toggleDispositivo(idx)}
                            className="flex items-center gap-2.5 cursor-pointer select-none text-slate-200 hover:text-white font-medium text-sm"
                          >
                            {disp.selezionato ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}

                            {isCustom ? (
                              <input
                                type="text"
                                placeholder="Nome apprestamento (es. Gru, Quadro elettrico...)"
                                value={disp.nome}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateNomeDispositivo(idx, e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-amber-400 font-bold text-xs"
                              />
                            ) : (
                              <span className={disp.selezionato ? 'text-amber-400 font-bold' : ''}>
                                {disp.nome}
                              </span>
                            )}
                          </div>

                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => removeDispositivoCustom(idx)}
                              className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {disp.selezionato && (
                          <input
                            type="text"
                            placeholder={`Note e verifiche per ${disp.nome.toLowerCase()}...`}
                            value={disp.note || ''}
                            onChange={(e) => updateNotaDispositivo(idx, e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 4 (CSE): ARGOMENTI DISCUSSI */}
            {tipoVerbale === 'CSE' && (viewMode === 'all' || currentStep === 4) && (
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-200 text-xs sm:text-sm">
                  Nel Corso della Riunione Sono Stati Discussi i Seguenti Argomenti:
                </label>
                <textarea
                  rows={4}
                  value={argomentiDiscussi}
                  onChange={(e) => setArgomentiDiscussi(e.target.value)}
                  placeholder="Inserisci dettagliatamente gli argomenti trattati, le interferenze concordate, prescrizioni PSC..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm sm:text-base leading-relaxed text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none shadow-inner"
                />
              </div>
            )}

            {/* STEP 3 (DL): ORDINI DI SERVIZIO E DISPOSIZIONI DL */}
            {tipoVerbale === 'DL' && (viewMode === 'all' || currentStep === 3) && (
              <div className="bg-slate-950/60 border border-blue-500/30 rounded-xl p-4 space-y-2.5">
                <label className="font-bold uppercase tracking-wider text-blue-400 text-xs flex items-center gap-1.5">
                  <ScrollText className="w-4 h-4 text-blue-400" />
                  Ordini di Servizio & Disposizioni della Direzione Lavori
                </label>
                <p className="text-xs text-slate-400">
                  Prescrizioni operative all'appaltatore, verifica tracciamenti, campionature materiali, conformità al progetto approvato e rispetto del cronoprogramma.
                </p>
                <textarea
                  rows={4}
                  placeholder="Inserisci disposizioni operative della D.L., ordini di servizio, richiami agli elaborati contrattuali..."
                  value={ordiniServizio}
                  onChange={(e) => setOrdiniServizio(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none leading-relaxed"
                />
              </div>
            )}

            {/* RILIEVI VISIVI E FOTO (Step 5 per CSE, Step 4 per DL, Step 3 per RILIEVO) */}
            {(viewMode === 'all' ||
              (tipoVerbale === 'CSE' && currentStep === 5) ||
              (tipoVerbale === 'DL' && currentStep === 4) ||
              (tipoVerbale === 'RILIEVO' && currentStep === 3)
            ) && (
              <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-300 text-xs flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-amber-500" />
                    {tipoVerbale === 'RILIEVO' ? 'Rilievo fotografico' : 'Rilievi Visivi & Foto di Cantiere'}
                  </label>
                  <span className="text-xs text-slate-500">I nuovi rilievi compaiono in cima. Usa le frecce per riordinarli.</span>
                </div>
                <button
                  type="button"
                  onClick={addRilievo}
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> + Aggiungi Rilievo
                </button>
              </div>

              {rilievi.map((ril, index) => {
                const isDraggingThis = draggingRilievoId === ril.id;
                const stagedCount = filesPerRilievo[ril.id]?.length || 0;
                const existingCount = ril.foto_urls?.length || 0;
                const totalPhotos = stagedCount + existingCount;

                return (
                <div 
                  key={ril.id} 
                  tabIndex={0}
                  onFocus={() => setActiveRilievoId(ril.id)}
                  onClick={() => setActiveRilievoId(ril.id)}
                  onPaste={(e) => handlePaste(ril.id, e)}
                  onDragEnter={(e) => handleDragEnter(ril.id, e)}
                  onDragOver={(e) => handleDragOver(ril.id, e)}
                  onDragLeave={(e) => handleDragLeave(ril.id, e)}
                  onDrop={(e) => handleDrop(ril.id, e)}
                  className={`p-3.5 rounded-xl space-y-3 transition border ${
                    isDraggingThis 
                      ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30' 
                      : activeRilievoId === ril.id 
                        ? 'border-slate-700 bg-slate-950/90' 
                        : 'border-slate-800 bg-slate-950/70'
                  }`}
                >
                  {isDraggingThis && (
                    <div className="p-4 bg-amber-500/20 border-2 border-dashed border-amber-500 rounded-xl text-center text-amber-300 font-bold text-xs flex items-center justify-center gap-2 pointer-events-none animate-pulse">
                      <UploadCloud className="w-5 h-5 text-amber-400" />
                      <span>Rilascia qui le immagini per allegarle al Rilievo #{index + 1}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Sposta su"
                        disabled={index === 0}
                        onClick={() => moveRilievo(index, 'up')}
                        className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        title="Sposta giù"
                        disabled={index === rilievi.length - 1}
                        onClick={() => moveRilievo(index, 'down')}
                        className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <span className="font-semibold text-slate-300 ml-1.5 text-xs">Rilievo #{index + 1}</span>
                    </div>

                    {rilievi.length > 1 && (
                      <button type="button" onClick={() => removeRilievo(ril.id)} className="text-slate-500 hover:text-rose-400 cursor-pointer p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {tipoVerbale === 'RILIEVO' ? (
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-500" />
                          Ambiente / Piano / Posizione
                        </label>
                        <input
                          type="text"
                          value={ril.ambiente || ''}
                          onChange={(e) => updateRilievoAmbiente(ril.id, e.target.value)}
                          placeholder="Es. Piano Terra - Locale Tecnico, Prospetto Sud..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      {/* Tre campi misure opzionali */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[11px] font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                            <Maximize2 className="w-3 h-3 text-emerald-400" />
                            Misura 1 (opzionale)
                          </label>
                          <input
                            type="text"
                            value={ril.misura_1 || ''}
                            onChange={(e) => updateRilievoMisura(ril.id, 'misura_1', e.target.value)}
                            placeholder="Es. L=3.50m o H=2.70m"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                            <Maximize2 className="w-3 h-3 text-emerald-400" />
                            Misura 2 (opzionale)
                          </label>
                          <input
                            type="text"
                            value={ril.misura_2 || ''}
                            onChange={(e) => updateRilievoMisura(ril.id, 'misura_2', e.target.value)}
                            placeholder="Es. Spessore=30cm"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                            <Maximize2 className="w-3 h-3 text-emerald-400" />
                            Misura 3 (opzionale)
                          </label>
                          <input
                            type="text"
                            value={ril.misura_3 || ''}
                            onChange={(e) => updateRilievoMisura(ril.id, 'misura_3', e.target.value)}
                            placeholder="Es. Quota +1.20m s.l.m."
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-500" />
                          Ambiente / Piano / Posizione
                        </label>
                        <input
                          type="text"
                          value={ril.ambiente || ''}
                          onChange={(e) => updateRilievoAmbiente(ril.id, e.target.value)}
                          placeholder="Es. Piano Terra - Locale Tecnico, Prospetto Sud..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                          <Maximize2 className="w-3 h-3 text-emerald-400" />
                          Quote / Misure / Note Tecniche
                        </label>
                        <input
                          type="text"
                          value={ril.quote_note || ''}
                          onChange={(e) => updateRilievoQuote(ril.id, e.target.value)}
                          placeholder="Es. H=2.70m, spessore solaio 25cm..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <textarea
                    rows={3}
                    value={ril.descrizione}
                    onFocus={() => setActiveRilievoId(ril.id)}
                    onPaste={(e) => handlePaste(ril.id, e)}
                    onDragEnter={(e) => handleDragEnter(ril.id, e)}
                    onDragOver={(e) => handleDragOver(ril.id, e)}
                    onDrop={(e) => handleDrop(ril.id, e)}
                    onChange={(e) => updateRilievoTesto(ril.id, e.target.value)}
                    placeholder={tipoVerbale === 'RILIEVO' ? "Note / descrizione del rilievo fotografico (opzionale)..." : "Descrivi l'osservazione o rilievo riscontrato (opzionale)..."}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm sm:text-base leading-relaxed text-slate-100 focus:border-amber-500 focus:outline-none"
                  />

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-lg text-slate-200 text-xs font-medium transition cursor-pointer">
                      <Camera className="w-4 h-4 text-amber-400" />
                      <span>Aggiungi Foto</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFilesChange(ril.id, e)}
                        className="hidden"
                      />
                    </label>

                    <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800/80 px-2.5 py-1.5 rounded-lg">
                      <ClipboardPaste className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        Trascina qui o premi <strong className="text-slate-200">Ctrl+V</strong> (es. copia da Google Foto)
                      </span>
                    </div>

                    {totalPhotos > 0 && (
                      <span className="text-[11px] text-amber-400 font-semibold px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 ml-auto">
                        {totalPhotos} {totalPhotos === 1 ? 'fotografia allegata' : 'fotografie allegate'}
                      </span>
                    )}
                  </div>

                  {((ril.foto_urls && ril.foto_urls.length > 0) || (filesPerRilievo[ril.id] && filesPerRilievo[ril.id].length > 0)) && (
                    <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1.5">
                      <div className="flex flex-wrap gap-2.5">
                        {ril.foto_urls?.map((url, fIdx) => (
                          <div key={fIdx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-700 shadow">
                            <img src={url} alt="Foto rilievo" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              title="Elimina foto"
                              onClick={() => handleRemoveExistingPhoto(ril.id, url)}
                              className="absolute top-1 right-1 w-6 h-6 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md"
                            >
                              <X className="w-4 h-4 stroke-[3]" />
                            </button>
                          </div>
                        ))}

                        {filesPerRilievo[ril.id]?.map((file, fileIdx) => (
                          <StagedPhotoThumbnail
                            key={`new-${fileIdx}`}
                            file={file}
                            onRemove={() => handleRemoveStagedFile(ril.id, fileIdx)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
              </div>
            )}

            {/* STEP 6 (CSE): PRESCRIZIONI & SOSPENSIONE LAVORI */}
            {tipoVerbale === 'CSE' && (viewMode === 'all' || currentStep === 6) && (
              <div className="space-y-6">
                {/* PRESCRIZIONI */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <label className="font-bold uppercase tracking-wider text-slate-300 text-xs flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-amber-500" />
                        Misure Prescrittive & Adeguamenti Richiesti
                      </label>
                      <span className="text-xs text-slate-500">Le nuove prescrizioni compaiono in cima. Usa le frecce per riordinarle.</span>
                    </div>
                    <button
                      type="button"
                      onClick={addPrescrizione}
                      className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Aggiungi Prescrizione
                    </button>
                  </div>

                  {prescrizioni.map((p, idx) => (
                    <div key={p.id} className="p-3.5 bg-slate-950/70 border border-amber-500/20 rounded-xl space-y-2.5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Sposta su"
                            disabled={idx === 0}
                            onClick={() => movePrescrizione(idx, 'up')}
                            className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Sposta giù"
                            disabled={idx === prescrizioni.length - 1}
                            onClick={() => movePrescrizione(idx, 'down')}
                            className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-800 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <span className="font-semibold text-amber-400 ml-1.5 text-xs">Prescrizione #{idx + 1}</span>
                        </div>

                        <button type="button" onClick={() => removePrescrizione(p.id)} className="text-slate-500 hover:text-rose-400 cursor-pointer p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <input
                        type="text"
                        required
                        placeholder="Disposizione prescrittiva..."
                        value={p.testo}
                        onChange={(e) => updatePrescrizione(p.id, 'testo', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"
                      />

                      <div className="grid grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          placeholder="Impresa destinataria"
                          value={p.impresa_destinataria || ''}
                          onChange={(e) => updatePrescrizione(p.id, 'impresa_destinataria', e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                        />
                        <input
                          type="date"
                          value={p.data_scadenza || ''}
                          onChange={(e) => updatePrescrizione(p.id, 'data_scadenza', e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-200"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* SOSPENSIONE LAVORI */}
                <div className={`p-4 rounded-xl border ${
                  sospensione ? 'bg-rose-950/40 border-rose-500 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <AlertOctagon className={`w-5 h-5 ${sospensione ? 'text-rose-500' : 'text-slate-500'}`} />
                      <div>
                        <h4 className="font-bold text-white text-sm">Disponi Sospensione Lavori (Art. 92 c.1 lett. f)</h4>
                        <p className="text-xs text-slate-400">Solo per pericolo grave ed imminente</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSospensione(!sospensione)}
                      className={`px-3.5 py-2 rounded-lg font-bold text-xs cursor-pointer ${
                        sospensione ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {sospensione ? 'SOSPENSIONE ATTIVA' : 'Sospendi Lavori'}
                    </button>
                  </div>
                  {sospensione && (
                    <textarea
                      required
                      rows={3}
                      placeholder="Motivazione del pericolo grave e imminente..."
                      value={motivoSospensione}
                      onChange={(e) => setMotivoSospensione(e.target.value)}
                      className="w-full mt-3 bg-slate-950 border border-rose-500/40 rounded-xl p-3 text-sm text-white"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Footer Azioni con Navigazione Wizard Precedente / Successivo / Salva */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 sticky bottom-0 bg-slate-900 pb-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs sm:text-sm text-slate-400 hover:text-white cursor-pointer rounded-xl hover:bg-slate-800 transition"
                >
                  Annulla
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Precedente */}
                {viewMode === 'steps' && currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Precedente</span>
                  </button>
                )}

                {/* Passo Successivo */}
                {viewMode === 'steps' && currentStep < currentStepsList.length && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(prev => Math.min(currentStepsList.length, prev + 1))}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 hover:border-amber-500/50 text-amber-400 text-xs sm:text-sm font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                  >
                    <span>Passo Successivo</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {/* Salva Verbale (sempre disponibile e attivo da qualunque step) */}
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 text-xs sm:text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvataggio...</span>
                    </>
                  ) : (
                    <span>{isEditMode ? 'Aggiorna Verbale' : `Salva Verbale ${tipoVerbale}`}</span>
                  )}
                </button>
              </div>
            </div>

          </form>

          {/* Modal Conflitto Impresa */}
          {conflittoImpresa && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-2.5 text-amber-400 border-b border-slate-800 pb-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <h3 className="font-bold text-sm text-white">Soggetto già presente in archivio!</h3>
                </div>

                <p className="text-slate-300 text-xs leading-relaxed">
                  Il soggetto <strong className="text-amber-400">"{conflittoImpresa.nomeDigitato}"</strong> è già stato registrato in precedenza.
                </p>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Scheda Registrata:</span>
                  <p className="text-white font-semibold">{conflittoImpresa.impresaEsistente.ragione_sociale}</p>
                  <p className="text-slate-400">Tipo: {conflittoImpresa.impresaEsistente.tipo === 'lavoratore_autonomo' ? 'Lavoratore Autonomo' : 'Impresa'}</p>
                  <p className="text-slate-400">P.IVA: {conflittoImpresa.impresaEsistente.p_iva || 'Non indicata'}</p>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleUsaEsistente}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition cursor-pointer shadow-md"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Usa questo soggetto esistente (Consigliato)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCreaOmonimaComunque}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition cursor-pointer border border-slate-700"
                  >
                    <span>Crea comunque (Soggetto diverso con stesso nome)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConflittoImpresa(null)}
                    className="w-full py-1 text-slate-500 hover:text-slate-300 text-[11px] text-center cursor-pointer"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Anteprima PDF in tempo reale */}
      {isPreviewOpen && verbaleInAnteprima && (
        <VerbalePdfModal
          isOpen={isPreviewOpen}
          onClose={handleClosePreview}
          sopralluogo={verbaleInAnteprima}
          cantiere={cantieri.find(c => c.id === cantiereId) || (cantieri.length > 0 ? cantieri[0] : undefined)}
        />
      )}
    </>
  );
};

export default ModalSopralluogo;