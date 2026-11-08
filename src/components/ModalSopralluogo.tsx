import React, { useState, useEffect } from 'react';
import { 
  X, ClipboardCheck, Plus, Trash2, Camera, AlertOctagon, 
  Building2, Users, Loader2, Search, CheckSquare, Square, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { compressImage } from '../utils/imageCompressor';
import type { 
  Cantiere, Impresa, RilievoItem, PrescrizioneItem, 
  DispositivoApprestamento, Sopralluogo, FaseLavoro, PresenzeConvenuti 
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

  // 1. Presenze gerarchiche
  const [presenze, setPresenze] = useState<PresenzeConvenuti>({
    committente: { presente: false, nome: '' },
    dl: { presente: false, nome: '' },
    progettista: { presente: false, nome: '' },
    cse: { presente: true, nome: 'arch. Cavalleri Michele' }
  });

  // 2. Fasi di lavoro
  const [fasiLavoro, setFasiLavoro] = useState<FaseLavoro[]>([
    { id: crypto.randomUUID(), descrizione: '', impresa: '' }
  ]);

  // 3. Dispositivi e apprestamenti
  const [dispositivi, setDispositivi] = useState<DispositivoApprestamento[]>(
    DISPOSITIVI_PREDEFINITI.map(d => ({ nome: d, selezionato: false, note: '' }))
  );

  // 4. Imprese (FILTRATE RIGOROSAMENTE PER QUESTO CANTIERE)
  const [impreseDelCantiere, setImpreseDelCantiere] = useState<Impresa[]>([]);
  const [impreseSelezionate, setImpreseSelezionate] = useState<string[]>([]);
  const [filtroRicercaImpresa, setFiltroRicercaImpresa] = useState('');
  const [nuovaImpresaNome, setNuovaImpresaNome] = useState('');
  const [mostraAddImpresa, setMostraAddImpresa] = useState(false);

  // 5. Rilievi e foto
  const [rilievi, setRilievi] = useState<RilievoItem[]>([
    { id: crypto.randomUUID(), descrizione: '', foto_urls: [] }
  ]);
  const [filesPerRilievo, setFilesPerRilievo] = useState<Record<string, File[]>>({});

  // 6. Prescrizioni e sospensione
  const [prescrizioni, setPrescrizioni] = useState<PrescrizioneItem[]>([]);
  const [sospensione, setSospensione] = useState(false);
  const [motivoSospensione, setMotivoSospensione] = useState('');

  // Sincronizzazione cantiere e precompilazione dai dati dell'archivio cantiere
  useEffect(() => {
    if (sopralluogoToEdit) {
      setCantiereId(sopralluogoToEdit.cantiere_id);
      setDataSopralluogo(sopralluogoToEdit.data);
      setOraSopralluogo(sopralluogoToEdit.ora || '09:00');
      setArgomentiDiscussi(sopralluogoToEdit.argomenti_discussi || '');
      setImpreseSelezionate(sopralluogoToEdit.imprese_presenti || []);
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
      setImpreseSelezionate([]);
      setRilievi([{ id: crypto.randomUUID(), descrizione: '', foto_urls: [] }]);
      setFilesPerRilievo({});
      setPrescrizioni([]);
      setSospensione(false);
      setMotivoSospensione('');
      setDispositivi(DISPOSITIVI_PREDEFINITI.map(d => ({ nome: d, selezionato: false, note: '' })));
    }
  }, [sopralluogoToEdit, initialCantiereId, cantieri, isOpen]);

  // Carica SOLO le imprese assegnate a QUESTO cantiere
  useEffect(() => {
    const fetchImpreseCantiere = async () => {
      if (!cantiereId) {
        setImpreseDelCantiere([]);
        return;
      }
      const { data } = await supabase
        .from('imprese')
        .select('*')
        .eq('cantiere_id', cantiereId)
        .order('ragione_sociale');

      if (data) setImpreseDelCantiere(data);
    };

    if (isOpen && cantiereId) {
      fetchImpreseCantiere();
    }
  }, [isOpen, cantiereId]);

  if (!isOpen) return null;

  // Gestione Fasi Lavoro
  const addFaseLavoro = () => {
    setFasiLavoro(prev => [...prev, { id: crypto.randomUUID(), descrizione: '', impresa: '' }]);
  };

  const removeFaseLavoro = (id: string) => {
    setFasiLavoro(prev => prev.filter(f => f.id !== id));
  };

  const updateFaseLavoro = (id: string, field: 'descrizione' | 'impresa', value: string) => {
    setFasiLavoro(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
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

  // Imprese
  const toggleImpresa = (nome: string) => {
    setImpreseSelezionate(prev => 
      prev.includes(nome) ? prev.filter(i => i !== nome) : [...prev, nome]
    );
  };

  const handleCreaNuovaImpresa = async () => {
    const nome = nuovaImpresaNome.trim();
    if (!nome || !cantiereId) return;

    const giaPresente = impreseDelCantiere.find(
      i => i.ragione_sociale.toLowerCase() === nome.toLowerCase()
    );

    if (giaPresente) {
      alert(`L'impresa "${giaPresente.ragione_sociale}" è già associata a questo cantiere!`);
      if (!impreseSelezionate.includes(giaPresente.ragione_sociale)) {
        setImpreseSelezionate(prev => [...prev, giaPresente.ragione_sociale]);
      }
      setNuovaImpresaNome('');
      setMostraAddImpresa(false);
      return;
    }

    const { data, error } = await supabase.from('imprese').insert([{
      ragione_sociale: nome,
      cantiere_id: cantiereId,
      ruolo: 'esecutrice'
    }]).select().single();

    if (!error && data) {
      setImpreseDelCantiere(prev => [...prev, data]);
      setImpreseSelezionate(prev => [...prev, nome]);
      setNuovaImpresaNome('');
      setMostraAddImpresa(false);
    }
  };

  // Rilievi e foto
  const addRilievo = () => {
    setRilievi(prev => [...prev, { id: crypto.randomUUID(), descrizione: '', foto_urls: [] }]);
  };

  const removeRilievo = (id: string) => {
    setRilievi(prev => prev.filter(r => r.id !== id));
  };

  const updateRilievoTesto = (id: string, text: string) => {
    setRilievi(prev => prev.map(r => r.id === id ? { ...r, descrizione: text } : r));
  };

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
    setFilesPerRilievo(prev => ({
      ...prev,
      [rilievoId]: (prev[rilievoId] || []).filter((_, idx) => idx !== fileIndex)
    }));
  };

  const addPrescrizione = () => {
    setPrescrizioni(prev => [...prev, { id: crypto.randomUUID(), testo: '', impresa_destinataria: '', data_scadenza: '' }]);
  };

  const removePrescrizione = (id: string) => {
    setPrescrizioni(prev => prev.filter(p => p.id !== id));
  };

  const updatePrescrizione = (id: string, field: keyof PrescrizioneItem, val: string) => {
    setPrescrizioni(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));
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
        imprese_presenti: impreseSelezionate,
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

  const impreseFiltrate = impreseDelCantiere.filter(i => 
    i.ragione_sociale.toLowerCase().includes(filtroRicercaImpresa.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl my-auto text-xs">
        
        {/* Header Modale */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base sm:text-lg">
                {sopralluogoToEdit ? 'Modifica Verbale di Sopralluogo CSE' : 'Nuovo Verbale di Sopralluogo e Coordinamento'}
              </h2>
              <p className="text-slate-400">Arch. Michele Cavalleri &bull; Modello D.Lgs. 81/08</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Cantiere, Data e Ora */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Cantiere *</label>
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
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
              >
                <option value="">-- Seleziona Cantiere --</option>
                {cantieri.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Data *</label>
              <input
                type="date"
                required
                value={dataSopralluogo}
                onChange={(e) => setDataSopralluogo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Ora Incontro
              </label>
              <input
                type="time"
                value={oraSopralluogo}
                onChange={(e) => setOraSopralluogo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SOGGETTI CONVENUTI (Committente -> DL -> Progettista -> CSE -> Imprese del cantiere) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div>
              <label className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-500" />
                Soggetti Convenuti e Presenti alla Riunione
              </label>
              <span className="text-[11px] text-slate-500">Spunta chi è presente oggi al sopralluogo (i nominativi arrivano dal cantiere)</span>
            </div>

            <div className="space-y-2 border-b border-slate-800 pb-3">
              {/* 1. Committente */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 w-40 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={presenze.committente?.presente || false}
                    onChange={(e) => setPresenze(p => ({
                      ...p,
                      committente: { presente: e.target.checked, nome: p.committente?.nome || '' }
                    }))}
                    className="accent-amber-500 rounded"
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
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white"
                />
              </div>

              {/* 2. Direttore Lavori */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 w-40 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={presenze.dl?.presente || false}
                    onChange={(e) => setPresenze(p => ({
                      ...p,
                      dl: { presente: e.target.checked, nome: p.dl?.nome || '' }
                    }))}
                    className="accent-amber-500 rounded"
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
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white"
                />
              </div>

              {/* 3. Progettista */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 w-40 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={presenze.progettista?.presente || false}
                    onChange={(e) => setPresenze(p => ({
                      ...p,
                      progettista: { presente: e.target.checked, nome: p.progettista?.nome || '' }
                    }))}
                    className="accent-amber-500 rounded"
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
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white"
                />
              </div>

              {/* 4. CSE */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 w-40 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={presenze.cse?.presente ?? true}
                    onChange={(e) => setPresenze(p => ({
                      ...p,
                      cse: { presente: e.target.checked, nome: p.cse?.nome || 'arch. Cavalleri Michele' }
                    }))}
                    className="accent-amber-500 rounded"
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
                  className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white font-medium"
                />
              </div>
            </div>

            {/* 5. Imprese Assegnate a questo Cantiere */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-300">
                  5. Imprese del Cantiere Presenti Oggi ({impreseSelezionate.length})
                </span>
                <button
                  type="button"
                  onClick={() => setMostraAddImpresa(!mostraAddImpresa)}
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> + Aggiungi Impresa al Cantiere
                </button>
              </div>

              {mostraAddImpresa && (
                <div className="flex gap-2 p-2 bg-slate-900 border border-slate-800 rounded-lg">
                  <input
                    type="text"
                    placeholder="Ragione sociale nuova impresa..."
                    value={nuovaImpresaNome}
                    onChange={(e) => setNuovaImpresaNome(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white"
                  />
                  <button
                    type="button"
                    onClick={handleCreaNuovaImpresa}
                    className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded cursor-pointer"
                  >
                    Associa a questo Cantiere
                  </button>
                </div>
              )}

              {impreseDelCantiere.length > 5 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Filtra imprese..."
                    value={filtroRicercaImpresa}
                    onChange={(e) => setFiltroRicercaImpresa(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                {impreseFiltrate.map(imp => {
                  const sel = impreseSelezionate.includes(imp.ragione_sociale);
                  return (
                    <button
                      key={imp.id}
                      type="button"
                      onClick={() => toggleImpresa(imp.ragione_sociale)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition border cursor-pointer ${
                        sel ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold' : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {sel ? '✓ ' : '+ '} {imp.ragione_sociale}
                    </button>
                  );
                })}

                {impreseDelCantiere.length === 0 && (
                  <p className="text-slate-500 italic p-1">
                    Nessuna impresa ancora associata a questo cantiere. Clicca "+ Aggiungi Impresa al Cantiere".
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* FASI DI LAVORO (CON IMPRESA DEL CANTIERE SELEZIONABILE) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-300 block">
                  Fasi di Lavoro in Svolgimento alla Data Odierna
                </label>
                <span className="text-[11px] text-slate-500">Specifica le lavorazioni e assegna l'impresa tra quelle di questo cantiere</span>
              </div>
              <button
                type="button"
                onClick={addFaseLavoro}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> + Aggiungi Lavorazione
              </button>
            </div>

            <div className="space-y-2">
              {fasiLavoro.map((fase, idx) => (
                <div key={fase.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex flex-col sm:flex-row gap-2 items-center">
                  <span className="text-slate-500 font-mono text-[11px] w-6 shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    required
                    placeholder="Descrizione lavorazione (es. Posa parapetti, getto travi)..."
                    value={fase.descrizione}
                    onChange={(e) => updateFaseLavoro(fase.id, 'descrizione', e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none w-full"
                  />
                  
                  {/* Dropdown: SOLO le imprese di questo cantiere! */}
                  <select
                    value={fase.impresa || ''}
                    onChange={(e) => updateFaseLavoro(fase.id, 'impresa', e.target.value)}
                    className="w-full sm:w-56 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">-- Impresa di questo Cantiere --</option>
                    {impreseDelCantiere.map(imp => (
                      <option key={imp.id} value={imp.ragione_sociale}>
                        {imp.ragione_sociale}
                      </option>
                    ))}
                  </select>

                  {fasiLavoro.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFaseLavoro(fase.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* DISPOSITIVI E APPRESTAMENTI */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                  Verifica ai Dispositivi e Apprestamenti
                </span>
                <p className="text-slate-400 text-[11px]">Seleziona i dispositivi controllati e inserisci le relative note</p>
              </div>

              <button
                type="button"
                onClick={addAltroDispositivo}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> + Aggiungi ALTRO
              </button>
            </div>

            <div className="space-y-2 pt-1">
              {dispositivi.map((disp, idx) => {
                const isCustom = !DISPOSITIVI_PREDEFINITI.includes(disp.nome);
                return (
                  <div key={disp.id || idx} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <div 
                        onClick={() => toggleDispositivo(idx)}
                        className="flex items-center gap-2 cursor-pointer select-none text-slate-200 hover:text-white font-medium"
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
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-amber-400 font-bold"
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
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {disp.selezionato && (
                      <input
                        type="text"
                        placeholder={`Note e verifiche per ${disp.nome.toLowerCase()}...`}
                        value={disp.note || ''}
                        onChange={(e) => updateNotaDispositivo(idx, e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-100 focus:outline-none focus:border-amber-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Argomenti discussi */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Nel Corso della Riunione Sono Stati Discussi i Seguenti Argomenti:
            </label>
            <textarea
              rows={3}
              value={argomentiDiscussi}
              onChange={(e) => setArgomentiDiscussi(e.target.value)}
              placeholder="es. Coordinamento interferenze, tempistiche di sosta autobetoniere..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Rilievi visivi e foto */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-amber-500" />
                Rilievi Visivi & Foto di Cantiere
              </label>
              <button
                type="button"
                onClick={addRilievo}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> + Altro Rilievo con Foto
              </button>
            </div>

            {rilievi.map((ril, index) => (
              <div key={ril.id} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-400">Rilievo #{index + 1}</span>
                  {rilievi.length > 1 && (
                    <button type="button" onClick={() => removeRilievo(ril.id)} className="text-slate-500 hover:text-rose-400 cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <textarea
                  rows={2}
                  required
                  value={ril.descrizione}
                  onChange={(e) => updateRilievoTesto(ril.id, e.target.value)}
                  placeholder="Descrizione rilievo visivo..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 focus:border-amber-500 focus:outline-none"
                />

                <div className="flex items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 font-medium">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
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
                  <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/80 space-y-1.5">
                    <div className="flex flex-wrap gap-2">
                      {ril.foto_urls?.map((url, fIdx) => (
                        <div key={fIdx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-700">
                          <img src={url} alt="Foto rilievo" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            title="Elimina foto"
                            onClick={() => handleRemoveExistingPhoto(ril.id, url)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-rose-600/90 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md"
                          >
                            <X className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      ))}

                      {filesPerRilievo[ril.id]?.map((file, fileIdx) => (
                        <div key={`new-${fileIdx}`} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-amber-500/50 bg-slate-950 flex flex-col justify-end">
                          <img src={URL.createObjectURL(file)} alt="Nuova foto" className="w-full h-full object-cover opacity-80" />
                          <button
                            type="button"
                            title="Rimuovi"
                            onClick={() => handleRemoveStagedFile(ril.id, fileIdx)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md"
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

          {/* Prescrizioni */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-500" />
                Misure Prescrittive & Adeguamenti Richiesti
              </label>
              <button
                type="button"
                onClick={addPrescrizione}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> + Aggiungi Prescrizione
              </button>
            </div>

            {prescrizioni.map((p, idx) => (
              <div key={p.id} className="p-3 bg-slate-950/70 border border-amber-500/20 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-amber-400">Prescrizione #{idx + 1}</span>
                  <button type="button" onClick={() => removePrescrizione(p.id)} className="text-slate-500 hover:text-rose-400 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Disposizione prescrittiva..."
                  value={p.testo}
                  onChange={(e) => updatePrescrizione(p.id, 'testo', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Impresa destinataria"
                    value={p.impresa_destinataria || ''}
                    onChange={(e) => updatePrescrizione(p.id, 'impresa_destinataria', e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-slate-200"
                  />
                  <input
                    type="date"
                    value={p.data_scadenza || ''}
                    onChange={(e) => updatePrescrizione(p.id, 'data_scadenza', e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-slate-200"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Sospensione Lavori */}
          <div className={`p-3.5 rounded-xl border ${
            sospensione ? 'bg-rose-950/40 border-rose-500 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className={`w-5 h-5 ${sospensione ? 'text-rose-500' : 'text-slate-500'}`} />
                <div>
                  <h4 className="font-bold text-white text-sm">Disponi Sospensione Lavori (Art. 92 c.1 lett. f)</h4>
                  <p className="text-[11px] text-slate-400">Solo per pericolo grave ed imminente</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSospensione(!sospensione)}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer ${
                  sospensione ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {sospensione ? 'SOSPENSIONE ATTIVA' : 'Sospendi Lavori'}
              </button>
            </div>
            {sospensione && (
              <textarea
                required
                rows={2}
                placeholder="Motivazione del pericolo grave e imminente..."
                value={motivoSospensione}
                onChange={(e) => setMotivoSospensione(e.target.value)}
                className="w-full mt-2 bg-slate-950 border border-rose-500/40 rounded p-2 text-white"
              />
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-slate-900 pb-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer">
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvataggio...</span>
                </>
              ) : (
                <span>{sopralluogoToEdit ? 'Aggiorna Verbale' : 'Registra Verbale CSE'}</span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};