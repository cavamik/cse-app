import React, { useState, useEffect } from 'react';
import { 
  X, ClipboardCheck, Plus, Trash2, Camera, AlertOctagon, 
  Building2, Users, Loader2, CheckSquare, Square, Clock,
  ArrowUp, ArrowDown, AlertTriangle, Check, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { compressImage } from '../utils/imageCompressor';
import { VerbalePdfModal } from './VerbalePdfModal';
import type { 
  Cantiere, Impresa, RilievoItem, PrescrizioneItem, 
  DispositivoApprestamento, Sopralluogo, FaseLavoro, PresenzeConvenuti,
  ImpresaPresenteItem, RuoloCantiere, TipoSoggetto
} from '../types';

interface ModalSopralluogoProps {
  isOpen: boolean;
  onClose: () => void;
  cantieri: Cantiere[];
  initialCantiereId?: string;
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

export const ModalSopralluogo: React.FC<ModalSopralluogoProps> = ({ 
  isOpen, 
  onClose, 
  cantieri, 
  initialCantiereId,
  sopralluogoToEdit,
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [cantiereId, setCantiereId] = useState('');
  const [dataSopralluogo, setDataSopralluogo] = useState(new Date().toISOString().split('T')[0]);
  const [oraSopralluogo, setOraSopralluogo] = useState('09:00');
  const [argomentiDiscussi, setArgomentiDiscussi] = useState('');

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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

  const [prescrizioni, setPrescrizioni] = useState<PrescrizioneItem[]>([]);
  const [sospensione, setSospensione] = useState(false);
  const [motivoSospensione, setMotivoSospensione] = useState('');

  useEffect(() => {
    if (sopralluogoToEdit) {
      setCantiereId(sopralluogoToEdit.cantiere_id);
      setDataSopralluogo(sopralluogoToEdit.data);
      setOraSopralluogo(sopralluogoToEdit.ora || '09:00');
      setArgomentiDiscussi(sopralluogoToEdit.argomenti_discussi || '');
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
      setImpresePresentiLista([]);
      setRilievi([{ id: crypto.randomUUID(), descrizione: '', foto_urls: [] }]);
      setFilesPerRilievo({});
      setPrescrizioni([]);
      setSospensione(false);
      setMotivoSospensione('');
      setDispositivi(DISPOSITIVI_PREDEFINITI.map(d => ({ nome: d, selezionato: false, note: '' })));
    }
  }, [sopralluogoToEdit, initialCantiereId, cantieri, isOpen]);

  // Caricamento archivio completo imprese
  const fetchTutteLeImprese = async () => {
    try {
      const { data, error } = await supabase
        .from('imprese')
        .select('*')
        .order('ragione_sociale');

      if (!error && data) {
        setTutteLeImpreseDB(data);
      }
    } catch (err) {
      console.error('Errore caricamento archivio imprese:', err);
    }
  };

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

  // Verbale dal vivo per anteprima
  const verbaleInAnteprima: Sopralluogo = {
    id: sopralluogoToEdit?.id || 'anteprima-live',
    cantiere_id: cantiereId,
    data: dataSopralluogo,
    ora: oraSopralluogo,
    lavorazioni_in_corso: fasiLavoro
      .filter(f => f.descrizione.trim())
      .map(f => `${f.descrizione}${f.impresa ? ` (${f.impresa})` : ''}`)
      .join('; '),
    fasi_lavoro: fasiLavoro,
    imprese_presenti: arrayStringheImpresePresenti,
    imprese_dettaglio: impresePresentiLista,
    presenze: presenze,
    dispositivi_apprestamenti: dispositivi,
    argomenti_discussi: argomentiDiscussi,
    rilievi: rilievi.map(r => ({
      id: r.id,
      descrizione: r.descrizione,
      foto_urls: [
        ...(r.foto_urls || []),
        ...(filesPerRilievo[r.id] ? filesPerRilievo[r.id].map(f => URL.createObjectURL(f)) : [])
      ]
    })),
    prescrizioni_lista: prescrizioni,
    sospensione_lavori: sospensione,
    motivo_sospensione: sospensione ? motivoSospensione : undefined,
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
  const addRilievo = () => setRilievi(prev => [{ id: crypto.randomUUID(), descrizione: '', foto_urls: [] }, ...prev]);
  const removeRilievo = (id: string) => setRilievi(prev => prev.filter(r => r.id !== id));
  const updateRilievoTesto = (id: string, text: string) => setRilievi(prev => prev.map(r => r.id === id ? { ...r, descrizione: text } : r));
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

  const moveImpresaPresente = (index: number, direction: 'up' | 'down') => {
    setImpresePresentiLista(prev => moveItem(prev, index, direction));
  };

  const nomiSelezionati = impresePresentiLista.map(i => i.nome);

  const altreImpreseDelCantiere = tutteLeImpreseDB.filter(
    imp => imp.cantiere_id === cantiereId && !nomiSelezionati.includes(imp.ragione_sociale)
  );

  const altreImpreseArchivioGenerale = tutteLeImpreseDB.filter(
    imp => imp.cantiere_id !== cantiereId && !nomiSelezionati.includes(imp.ragione_sociale)
  );

  // Creazione nuova impresa
  const handleVerificaECreaNuovaImpresa = async () => {
    const nome = nuovaImpresaNome.trim();
    if (!nome) return;

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

    await procediCreazioneImpresa(nome, nuovoTipo);
  };

  const handleUsaEsistente = () => {
    if (!conflittoImpresa) return;
    const nomeEsistente = conflittoImpresa.impresaEsistente.ragione_sociale;
    aggiungiImpresaPresente(nomeEsistente, 'appalto');
    setNuovaImpresaNome('');
    setMostraAddImpresa(false);
    setConflittoImpresa(null);
  };

  const handleCreaOmonimaComunque = async () => {
    if (!conflittoImpresa) return;
    const nome = conflittoImpresa.nomeDigitato;
    setConflittoImpresa(null);
    await procediCreazioneImpresa(nome, nuovoTipo);
  };

  const procediCreazioneImpresa = async (nome: string, tipoSogg: TipoSoggetto) => {
    const { data, error } = await supabase.from('imprese').insert([{
      ragione_sociale: nome,
      tipo: tipoSogg,
      cantiere_id: cantiereId || null,
    }]).select().single();

    if (!error && data) {
      setTutteLeImpreseDB(prev => [...prev, data]);
      aggiungiImpresaPresente(nome, 'appalto');
      setNuovaImpresaNome('');
      setMostraAddImpresa(false);
    } else if (error) {
      alert('Errore salvataggio: ' + error.message);
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

  // Upload foto
  const handleFilesChange = (rilievoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setFilesPerRilievo(prev => ({ ...prev, [rilievoId]: [...(prev[rilievoId] || []), ...files] }));
  };
  const handleRemoveExistingPhoto = (rilievoId: string, urlToRemove: string) => {
    setRilievi(prev => prev.map(r => {
      if (r.id === rilievoId) {
        return { ...r, foto_urls: (r.foto_urls || []).filter(url => url !== urlToRemove) };
      }
      return r;
    }));
  };
  const handleRemoveStagedFile = (rilievoId: string, fileIndex: number) => {
    setFilesPerRilievo(prev => ({ ...prev, [rilievoId]: (prev[rilievoId] || []).filter((_, idx) => idx !== fileIndex) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cantiereId) {
      alert('Seleziona un cantiere.');
      return;
    }

    setLoading(true);

    try {
      const rilieviFinali: RilievoItem[] = [];

      for (const ril of rilievi) {
        const fileList = filesPerRilievo[ril.id] || [];
        const uploadedUrls: string[] = [...(ril.foto_urls || [])];

        for (const file of fileList) {
          const fileCompresso = await compressImage(file, 200);
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
          const path = `sopralluoghi/${cantiereId}/${fileName}`;
          
          const { error: upErr } = await supabase.storage
            .from('foto-sopralluoghi')
            .upload(path, fileCompresso, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (!upErr) {
            const { data } = supabase.storage.from('foto-sopralluoghi').getPublicUrl(path);
            if (data?.publicUrl) uploadedUrls.push(data.publicUrl);
          }
        }

        rilieviFinali.push({
          id: ril.id,
          descrizione: ril.descrizione,
          foto_urls: uploadedUrls,
        });
      }

      const lavorazioniSintetiche = fasiLavoro
        .filter(f => f.descrizione.trim())
        .map(f => `${f.descrizione}${f.impresa ? ` (${f.impresa})` : ''}`)
        .join('; ');

      const payload = {
        cantiere_id: cantiereId,
        data: dataSopralluogo,
        ora: oraSopralluogo,
        lavorazioni_in_corso: lavorazioniSintetiche,
        fasi_lavoro: fasiLavoro,
        imprese_presenti: arrayStringheImpresePresenti,
        imprese_dettaglio: impresePresentiLista,
        presenze: presenze,
        dispositivi_apprestamenti: dispositivi,
        argomenti_discussi: argomentiDiscussi,
        rilievi: rilieviFinali,
        prescrizioni_lista: prescrizioni,
        sospensione_lavori: sospensione,
        motivo_sospensione: sospensione ? motivoSospensione : null,
      };

      if (sopralluogoToEdit) {
        const { error } = await supabase.from('sopralluoghi').update(payload).eq('id', sopralluogoToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sopralluoghi').insert([payload]);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Errore salvataggio verbale: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl my-auto text-sm relative">
          
          {/* Header Modale */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/70 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base sm:text-lg">
                  {sopralluogoToEdit ? 'Modifica Verbale di Sopralluogo CSE' : 'Nuovo Verbale di Sopralluogo e Coordinamento'}
                </h2>
                <p className="text-xs text-slate-400">Arch. Michele Cavalleri &bull; D.Lgs. 81/08</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl border border-amber-500/30 flex items-center gap-1.5 shadow-sm transition cursor-pointer text-xs"
                title="Vedi l'anteprima del verbale impaginato prima di salvare"
              >
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Anteprima PDF</span>
              </button>

              <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1 text-slate-200">
            
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

            {/* SOGGETTI CONVENUTI */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-300 text-xs flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-500" />
                  Soggetti Convenuti e Presenti alla Riunione
                </label>
                <span className="text-xs text-slate-500">Spunta le figure presenti e specifica per ciascuna impresa se opera in Appalto o Subappalto</span>
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

              {/* 5. GESTIONE IMPRESE: CROCETTA + SCELTA APPALTO / SUBAPPALTO + RIORDINO */}
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

                        {/* SELETTORE RUOLO NEL CANTIERE (APPALTO / SUBAPPALTO) */}
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
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

                {/* AGGIUNGI DA ARCHIVIO O CREA NUOVA */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        aggiungiImpresaPresente(e.target.value, 'appalto');
                      }
                    }}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">+ Aggiungi da Archivio Generale...</option>
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
                    <span className="text-slate-300 font-bold text-xs block">Inserisci nuovo soggetto:</span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Ragione Sociale o Nominativo..."
                        value={nuovaImpresaNome}
                        onChange={(e) => setNuovaImpresaNome(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                      <select
                        value={nuovoTipo}
                        onChange={(e) => setNuovoTipo(e.target.value as TipoSoggetto)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
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
                )}
              </div>
            </div>

            {/* FASI DI LAVORO */}
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
                      required
                      placeholder="Descrizione lavorazione in corso..."
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
                      {tutteLeImpreseDB.map(imp => (
                        <option key={imp.id} value={imp.ragione_sociale}>
                          {imp.ragione_sociale}
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

            {/* DISPOSITIVI E APPRESTAMENTI */}
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

            {/* ARGOMENTI DISCUSSI */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-200 text-xs sm:text-sm">
                Nel Corso della Riunione Sono Stati Discussi i Seguenti Argomenti:
              </label>
              <textarea
                rows={5}
                value={argomentiDiscussi}
                onChange={(e) => setArgomentiDiscussi(e.target.value)}
                placeholder="Inserisci dettagliatamente gli argomenti trattati, le interferenze concordate, prescrizioni PSC..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm sm:text-base leading-relaxed text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none shadow-inner"
              />
            </div>

            {/* RILIEVI VISIVI E FOTO */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-300 text-xs flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-amber-500" />
                    Rilievi Visivi & Foto di Cantiere
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

              {rilievi.map((ril, index) => (
                <div key={ril.id} className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
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

                  <textarea
                    rows={3}
                    required
                    value={ril.descrizione}
                    onChange={(e) => updateRilievoTesto(ril.id, e.target.value)}
                    placeholder="Descrivi dettagliatamente l'osservazione o non conformità riscontrata..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm sm:text-base leading-relaxed text-slate-100 focus:border-amber-500 focus:outline-none"
                  />

                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 text-xs font-medium transition">
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
                          <div key={`new-${fileIdx}`} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-amber-500/50 bg-slate-950 flex flex-col justify-end shadow">
                            <img src={URL.createObjectURL(file)} alt="Nuova foto" className="w-full h-full object-cover opacity-80" />
                            <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-slate-950 text-[10px] font-bold text-center">Nuova</span>
                            <button
                              type="button"
                              title="Rimuovi"
                              onClick={() => handleRemoveStagedFile(ril.id, fileIdx)}
                              className="absolute top-1 right-1 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md"
                            >
                              <X className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

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

            {/* Sospensione Lavori */}
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

            {/* Footer */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 bg-slate-900 pb-1">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl border border-amber-500/30 flex items-center gap-2 cursor-pointer transition text-xs"
              >
                <Eye className="w-4 h-4 text-amber-400" />
                <span>Anteprima PDF dal Vivo</span>
              </button>

              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white cursor-pointer">
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvataggio...</span>
                    </>
                  ) : (
                    <span>{sopralluogoToEdit ? 'Aggiorna Verbale' : 'Registra Verbale CSE'}</span>
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
      {isPreviewOpen && (
        <VerbalePdfModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          sopralluogo={verbaleInAnteprima}
          cantiere={cantieri.find(c => c.id === cantiereId)}
        />
      )}
    </>
  );
};

export default ModalSopralluogo;