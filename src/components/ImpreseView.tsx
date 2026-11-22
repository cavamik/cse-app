import React, { useState } from 'react';
import { 
  Building2, Plus, 
  FolderOpen, ArrowRight, X, Trash2, Edit,
  Mail, Link as LinkIcon, Unlink, Search, Phone, UserCheck,
  Calendar, FileText, Printer, Compass, Camera, HardHat
} from 'lucide-react';
import type { Impresa, Cantiere, Sopralluogo, TipoSoggetto } from '../types';
import { supabase } from '../lib/supabaseClient';
import { isUUID } from '../lib/offlineStore';
import { 
  getImpreseDelCantiere, 
  associaImpresaACantiere, 
  scollegaImpresaDaCantiere, 
  isValidEmail 
} from '../utils/cantiereImprese';

interface ImpreseViewProps {
  imprese: Impresa[];
  cantieri: Cantiere[];
  sopralluoghi: Sopralluogo[];
  onOpenSopralluoghiCantiere: (cantiereId: string) => void;
  onEditSopralluogo?: (sopralluogo: Sopralluogo) => void;
  onPrintSopralluogo?: (sopralluogo: Sopralluogo) => void;
  onDeleteImpresa: (impresaId: string) => void;
  onRefresh: () => void;
}

export const ImpreseView: React.FC<ImpreseViewProps> = ({
  imprese,
  cantieri,
  sopralluoghi,
  onOpenSopralluoghiCantiere,
  onEditSopralluogo,
  onPrintSopralluogo,
  onDeleteImpresa,
  onRefresh,
}) => {
  const [selectedImpresa, setSelectedImpresa] = useState<Impresa | null>(null);
  const [selectedCantiereFilter, setSelectedCantiereFilter] = useState<string>('TUTTI');
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalAddOpen, setIsModalAddOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  const [isModalAssociaOpen, setIsModalAssociaOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Campi form
  const [editId, setEditId] = useState('');
  const [ragioneSociale, setRagioneSociale] = useState('');
  const [tipo, setTipo] = useState<TipoSoggetto>('impresa');
  const [pIva, setPIva] = useState('');
  const [email, setEmail] = useState('');
  const [referente, setReferente] = useState('');
  const [telefono, setTelefono] = useState('');

  // Identificazione cantiere selezionato per il filtro
  const cantiereSelezionato = selectedCantiereFilter === 'TUTTI'
    ? null
    : cantieri.find(c => c.id === selectedCantiereFilter);

  // Calcolo imprese associate al cantiere o archivio generale
  const impreseAssociate = cantiereSelezionato
    ? getImpreseDelCantiere(cantiereSelezionato, imprese, sopralluoghi)
    : imprese;

  // Imprese dell'archivio generale non ancora associate al cantiere filtrato
  const impreseDisponibiliDaAssociare = cantiereSelezionato
    ? imprese.filter(imp => !impreseAssociate.some(a => a.id === imp.id))
    : [];

  // Applicazione eventuale ricerca testuale
  const impreseVisualizzate = impreseAssociate.filter(imp => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      imp.ragione_sociale.toLowerCase().includes(q) ||
      (imp.p_iva && imp.p_iva.toLowerCase().includes(q)) ||
      (imp.email && imp.email.toLowerCase().includes(q)) ||
      (imp.referente && imp.referente.toLowerCase().includes(q))
    );
  });

  const getCantieriImpresa = (impresa: Impresa): Cantiere[] => {
    return cantieri.filter(c => {
      const imps = getImpreseDelCantiere(c, imprese, sopralluoghi);
      return imps.some(i => i.id === impresa.id);
    });
  };

  const getVerbaliImpresa = (impresa: Impresa): Sopralluogo[] => {
    const nomeLower = (impresa.ragione_sociale || '').trim().toLowerCase();
    if (!nomeLower) return [];
    const list = sopralluoghi.filter(s => {
      const inPresenti = s.imprese_presenti?.some(n => n.toLowerCase().includes(nomeLower));
      const inDettaglio = s.imprese_dettaglio?.some(d => d.nome.toLowerCase() === nomeLower);
      const inFasi = s.fasi_lavoro?.some(f => (f.impresa || '').toLowerCase() === nomeLower);
      const inPrescrizioni = s.prescrizioni_lista?.some(p => (p.impresa_destinataria || '').toLowerCase() === nomeLower);
      return inPresenti || inDettaglio || inFasi || inPrescrizioni;
    });
    const filtered = selectedCantiereFilter !== 'TUTTI'
      ? list.filter(s => s.cantiere_id === selectedCantiereFilter)
      : list;
    return filtered.sort((a, b) => {
      const cmpDate = (b.data || '').localeCompare(a.data || '');
      if (cmpDate !== 0) return cmpDate;
      return (b.ora || '').localeCompare(a.ora || '');
    });
  };

  const handleOpenEdit = (imp: Impresa) => {
    setEditId(imp.id);
    setRagioneSociale(imp.ragione_sociale);
    setTipo(imp.tipo || (imp.ruolo === 'lavoratore_autonomo' ? 'lavoratore_autonomo' : 'impresa'));
    setPIva(imp.p_iva || '');
    setEmail(imp.email || '');
    setReferente(imp.referente || '');
    setTelefono(imp.telefono || '');
    setIsModalEditOpen(true);
  };

  const handleCreaImpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = ragioneSociale.trim();
    if (!nomePulito) return;

    if (email.trim() && !isValidEmail(email)) {
      alert('Inserisci un indirizzo email valido (es. info@impresa.it) oppure lascia il campo vuoto.');
      return;
    }

    const giaPresente = imprese.find(
      i => i.ragione_sociale.trim().toLowerCase() === nomePulito.toLowerCase()
    );

    if (giaPresente) {
      const conferma = window.confirm(
        `Attenzione!\n"${nomePulito}" è già presente in archivio (P.IVA: ${giaPresente.p_iva || 'N.D.'}).\n\nVuoi procedere creando comunque una seconda voce omonima distinta?`
      );
      if (!conferma) return;
    }

    setLoading(true);
    try {
      const payload: any = {
        ragione_sociale: nomePulito,
        tipo: tipo,
        p_iva: pIva.trim() || null,
        email: email.trim() || null,
        referente_nome: referente.trim() || null,
        telefono: telefono.trim() || null,
      };

      // Se c'è un cantiere filtrato, assegna anche legacy cantiere_id
      if (cantiereSelezionato) {
        payload.cantiere_id = cantiereSelezionato.id;
      }

      const { data, error } = await supabase
        .from('imprese')
        .insert([payload])
        .select();

      if (error) throw error;

      // Se c'è un cantiere filtrato, aggiorna anche imprese_ids sul cantiere
      if (cantiereSelezionato && data && data[0]) {
        await associaImpresaACantiere(
          cantiereSelezionato, 
          data[0].id, 
          [...imprese, data[0]], 
          sopralluoghi
        );
      }

      setRagioneSociale('');
      setTipo('impresa');
      setPIva('');
      setEmail('');
      setReferente('');
      setTelefono('');
      setIsModalAddOpen(false);
      onRefresh();
    } catch (err: any) {
      alert('Errore salvataggio: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAggiornaImpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = ragioneSociale.trim();
    if (!nomePulito || !editId) return;

    if (email.trim() && !isValidEmail(email)) {
      alert('Inserisci un indirizzo email valido (es. info@impresa.it) oppure lascia il campo vuoto.');
      return;
    }

    const impresaCorrente = imprese.find(i => i.id === editId);
    const vecchioNome = impresaCorrente?.ragione_sociale;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('imprese')
        .update({
          ragione_sociale: nomePulito,
          tipo: tipo,
          p_iva: pIva.trim() || null,
          email: email.trim() || null,
          referente_nome: referente.trim() || null,
          telefono: telefono.trim() || null,
        })
        .eq('id', editId);

      if (error) throw error;

      // Aggiornamento a cascata sui vecchi verbali se il nome è cambiato
      if (vecchioNome && vecchioNome !== nomePulito) {
        const verbaliCoinvolti = sopralluoghi.filter(s =>
          s.imprese_presenti?.some(n => n.includes(vecchioNome)) ||
          s.fasi_lavoro?.some(f => f.impresa === vecchioNome)
        );

        for (const verbale of verbaliCoinvolti) {
          if (!isUUID(verbale.id)) continue; // Evita chiamate su id 'pending_...' non ancora sincronizzati nel DB

          const nuoveImprese = (verbale.imprese_presenti || []).map(n => n.replace(vecchioNome, nomePulito));
          const nuoveFasi = (verbale.fasi_lavoro || []).map(f => f.impresa === vecchioNome ? { ...f, impresa: nomePulito } : f);
          const nuovoDettaglio = (verbale.imprese_dettaglio || []).map(d => d.nome === vecchioNome ? { ...d, nome: nomePulito } : d);

          await supabase
            .from('sopralluoghi')
            .update({
              imprese_presenti: nuoveImprese,
              fasi_lavoro: nuoveFasi,
              imprese_dettaglio: nuovoDettaglio,
            })
            .eq('id', verbale.id);
        }
      }

      setIsModalEditOpen(false);
      onRefresh();

      if (selectedImpresa?.id === editId) {
        setSelectedImpresa({
          ...selectedImpresa,
          ragione_sociale: nomePulito,
          tipo: tipo,
          p_iva: pIva.trim() || undefined,
          email: email.trim() || undefined,
          referente: referente.trim() || undefined,
          telefono: telefono.trim() || undefined,
        });
      }
    } catch (err: any) {
      alert('Errore aggiornamento: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScollega = async (cantiereTarget: Cantiere, impresaTarget: Impresa) => {
    const conferma = window.confirm(
      `Vuoi scollegare "${impresaTarget.ragione_sociale}" dal cantiere "${cantiereTarget.nome}"?\n\nIl soggetto rimarrà registrato nell'archivio generale dello studio.`
    );
    if (!conferma) return;

    setLoading(true);
    try {
      await scollegaImpresaDaCantiere(cantiereTarget, impresaTarget.id, imprese, sopralluoghi);
      if (selectedImpresa?.id === impresaTarget.id && selectedCantiereFilter === cantiereTarget.id) {
        setSelectedImpresa(null);
      }
      onRefresh();
    } catch (err: any) {
      alert('Errore scollegamento impresa: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssociaImpresaEsistente = async (impresaId: string) => {
    if (!cantiereSelezionato || !impresaId) return;

    setLoading(true);
    try {
      await associaImpresaACantiere(cantiereSelezionato, impresaId, imprese, sopralluoghi);
      setIsModalAssociaOpen(false);
      onRefresh();
    } catch (err: any) {
      alert('Errore associazione impresa: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header Pagina */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Archivio Imprese & Lavoratori Autonomi</h1>
          <p className="text-xs text-slate-400 mt-1">
            Anagrafica completa con contatti email, telefono e associazione per singolo cantiere
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRagioneSociale('');
            setTipo('impresa');
            setPIva('');
            setEmail('');
            setReferente('');
            setTelefono('');
            setIsModalAddOpen(true);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition cursor-pointer shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{cantiereSelezionato ? 'Nuovo Soggetto nel Cantiere' : 'Nuovo Soggetto in Archivio'}</span>
        </button>
      </div>

      {/* Barra Filtri: Cantiere e Ricerca */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
            <Building2 className="w-4 h-4 text-amber-500" />
            Filtra per Cantiere:
          </label>
          <select
            value={selectedCantiereFilter}
            onChange={(e) => {
              setSelectedCantiereFilter(e.target.value);
              setSelectedImpresa(null);
            }}
            className="bg-slate-950 border border-slate-800 text-xs text-white rounded-lg px-3 py-2 focus:border-amber-500 focus:outline-none w-full sm:max-w-md cursor-pointer font-medium"
          >
            <option value="TUTTI">Tutti i cantieri (Archivio generale - {imprese.length} soggetti)</option>
            {cantieri.map(c => {
              const count = getImpreseDelCantiere(c, imprese, sopralluoghi).length;
              return (
                <option key={c.id} value={c.id}>
                  {c.nome} ({count} {count === 1 ? 'soggetto assegnato' : 'soggetti assegnati'})
                </option>
              );
            })}
          </select>

          {/* Ricerca testuale */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Cerca per nome, P.IVA o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Azione rapida associazione dall'archivio (se cantiere selezionato) */}
        {cantiereSelezionato && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsModalAssociaOpen(true)}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 font-bold rounded-lg border border-amber-500/30 text-xs flex items-center gap-1.5 transition cursor-pointer"
              title="Associa un'impresa già registrata nell'archivio generale a questo cantiere"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>+ Associa dall'Archivio</span>
            </button>
          </div>
        )}
      </div>

      {/* Banner Cantiere Selezionato */}
      {cantiereSelezionato && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              Stai visualizzando le imprese associate al cantiere: <strong>{cantiereSelezionato.nome}</strong> ({impreseAssociate.length} soggetti)
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCantiereFilter('TUTTI');
              setSelectedImpresa(null);
            }}
            className="text-[11px] text-amber-400 hover:text-white underline cursor-pointer ml-2 shrink-0"
          >
            Mostra tutti i cantieri
          </button>
        </div>
      )}

      {/* Griglia a 2 Colonne */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Elenco a sinistra */}
        <div className="lg:col-span-1 space-y-2">
          {impreseVisualizzate.length === 0 ? (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
              {cantiereSelezionato
                ? 'Nessun soggetto ancora assegnato a questo cantiere. Clicca "+ Associa dall\'Archivio" o creane uno nuovo.'
                : 'Nessun soggetto trovato.'}
            </div>
          ) : (
            impreseVisualizzate.map((imp) => {
              const isSelected = selectedImpresa?.id === imp.id;
              const cantieriCount = getCantieriImpresa(imp).length;
              const isLavAutonomo = imp.tipo === 'lavoratore_autonomo' || imp.ruolo === 'lavoratore_autonomo';

              return (
                <div
                  key={imp.id}
                  onClick={() => setSelectedImpresa(imp)}
                  className={`p-4 rounded-xl border transition cursor-pointer group ${
                    isSelected ? 'bg-amber-500/10 border-amber-500 shadow-sm' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition truncate">
                      {imp.ragione_sociale}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                        isLavAutonomo 
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {isLavAutonomo ? 'Lav. Autonomo' : 'Impresa'}
                      </span>
                      
                      <button
                        type="button"
                        title="Modifica anagrafica"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(imp);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Se siamo in vista cantiere specifico, pulsante Scollega */}
                      {cantiereSelezionato ? (
                        <button
                          type="button"
                          title={`Scollega ${imp.ragione_sociale} da questo cantiere`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleScollega(cantiereSelezionato, imp);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Elimina dall'archivio generale"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteImpresa(imp.id);
                            if (selectedImpresa?.id === imp.id) setSelectedImpresa(null);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Info rapide (P.IVA, Email, Cantieri) */}
                  <div className="mt-2 space-y-1 text-xs text-slate-400">
                    <div className="flex justify-between items-center">
                      <span>{imp.p_iva ? `P.IVA: ${imp.p_iva}` : 'P.IVA N.D.'}</span>
                      <span className="text-amber-400 font-medium">{cantieriCount} cantieri</span>
                    </div>
                    {imp.email && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                        <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{imp.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Scheda dettaglio a destra */}
        <div className="lg:col-span-2">
          {selectedImpresa ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="border-b border-slate-800 pb-3 flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold uppercase text-amber-500">
                    {selectedImpresa.tipo === 'lavoratore_autonomo' ? 'Lavoratore Autonomo' : 'Impresa Esecutrice'}
                  </span>
                  <h2 className="text-xl font-bold text-white mt-0.5">{selectedImpresa.ragione_sociale}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tipologia giuridica: <strong className="text-slate-200 capitalize">
                      {selectedImpresa.tipo === 'lavoratore_autonomo' ? 'Lavoratore Autonomo' : 'Impresa'}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {cantiereSelezionato && (
                    <button
                      type="button"
                      onClick={() => handleScollega(cantiereSelezionato, selectedImpresa)}
                      className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      title="Scollega dal cantiere attivo"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Scollega da {cantiereSelezionato.nome}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedImpresa)}
                    className="p-2 rounded-lg bg-slate-950 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Modifica Dati</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDeleteImpresa(selectedImpresa.id);
                      setSelectedImpresa(null);
                    }}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Elimina</span>
                  </button>
                </div>
              </div>

              {/* Grid Dati Anagrafici (incluso Email) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-0.5">P.IVA / C.F.</span>
                  <span className="font-mono text-slate-200">{selectedImpresa.p_iva || 'N.D.'}</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-amber-500" />
                    Email
                  </span>
                  {selectedImpresa.email ? (
                    <a 
                      href={`mailto:${selectedImpresa.email}`}
                      className="text-amber-400 hover:underline font-medium truncate block"
                      title={selectedImpresa.email}
                    >
                      {selectedImpresa.email}
                    </a>
                  ) : (
                    <span className="text-slate-400">N.D.</span>
                  )}
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-amber-500" />
                    Referente
                  </span>
                  <span className="text-slate-200 font-medium truncate block">{selectedImpresa.referente || 'N.D.'}</span>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block mb-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-amber-500" />
                    Telefono
                  </span>
                  {selectedImpresa.telefono ? (
                    <a 
                      href={`tel:${selectedImpresa.telefono}`}
                      className="text-slate-200 hover:text-amber-400 font-medium truncate block"
                    >
                      {selectedImpresa.telefono}
                    </a>
                  ) : (
                    <span className="text-slate-400">N.D.</span>
                  )}
                </div>
              </div>

              {/* Sezione Cantieri in cui opera */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-500" />
                    Cantieri in cui opera ({getCantieriImpresa(selectedImpresa).length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {getCantieriImpresa(selectedImpresa).map(c => (
                    <div key={c.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-white text-sm">{c.nome}</h4>
                          <button
                            type="button"
                            title={`Scollega da ${c.nome}`}
                            onClick={() => handleScollega(c, selectedImpresa)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{c.indirizzo}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenSopralluoghiCantiere(c.id)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 font-bold text-xs rounded-lg transition border border-amber-500/30 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>Apri Sopralluoghi Cantiere</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {getCantieriImpresa(selectedImpresa).length === 0 && (
                    <p className="text-xs text-slate-500 italic p-3 col-span-2">
                      Nessun cantiere attualmente associato a questo soggetto.
                    </p>
                  )}
                </div>
              </div>

              {/* Sezione Verbali in cui è presente */}
              {(() => {
                const verbaliCollegati = getVerbaliImpresa(selectedImpresa);
                return (
                  <div className="space-y-3 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-500" />
                        Verbali in cui è presente ({verbaliCollegati.length})
                      </h3>
                      {cantiereSelezionato && (
                        <span className="text-[11px] text-amber-400 font-medium">
                          filtrati per {cantiereSelezionato.nome}
                        </span>
                      )}
                    </div>

                    {verbaliCollegati.length > 0 ? (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {verbaliCollegati.map(v => {
                          const cRef = cantieri.find(c => c.id === v.cantiere_id);
                          const tipo = v.tipo_verbale || 'CSE';
                          const isDL = tipo === 'DL';
                          const isRilievo = tipo === 'RILIEVO';

                          return (
                            <div
                              key={v.id}
                              className="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                            >
                              <div className="flex items-start sm:items-center gap-3 min-w-0">
                                {/* Badge Tipologia */}
                                <span
                                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5 ${
                                    isDL
                                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                      : isRilievo
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                  }`}
                                >
                                  {isDL ? (
                                    <>
                                      <Compass className="w-3 h-3 text-blue-400" />
                                      DL
                                    </>
                                  ) : isRilievo ? (
                                    <>
                                      <Camera className="w-3 h-3 text-emerald-400" />
                                      RILIEVO
                                    </>
                                  ) : (
                                    <>
                                      <HardHat className="w-3 h-3 text-amber-400" />
                                      CSE
                                    </>
                                  )}
                                </span>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>
                                      {v.data ? new Date(v.data).toLocaleDateString('it-IT') : 'Data non specificata'}
                                    </span>
                                    {v.ora && (
                                      <span className="text-slate-500 text-[11px] font-normal font-mono">
                                        ore {v.ora}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                                    <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span className="truncate">{cRef?.nome || 'Cantiere non specificato'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Azioni Rapide */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                {onPrintSopralluogo && (
                                  <button
                                    type="button"
                                    onClick={() => onPrintSopralluogo(v)}
                                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs flex items-center gap-1.5 transition cursor-pointer"
                                    title="Anteprima e Stampa PDF Verbale"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="hidden sm:inline text-[11px]">Anteprima PDF</span>
                                  </button>
                                )}

                                {onEditSopralluogo && (
                                  <button
                                    type="button"
                                    onClick={() => onEditSopralluogo(v)}
                                    className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 font-bold border border-amber-500/30 text-xs flex items-center gap-1.5 transition cursor-pointer"
                                    title="Modifica Verbale"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline text-[11px]">Modifica</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-950/50 rounded-xl border border-slate-800/60">
                        Nessun verbale registrato per questa impresa{cantiereSelezionato ? ` nel cantiere "${cantiereSelezionato.nome}"` : ''}.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
              Seleziona un'impresa o un lavoratore autonomo dall'elenco a sinistra per visualizzarne o modificarne i dettagli.
            </div>
          )}
        </div>
      </div>

      {/* Modal Associa Impresa da Archivio Generale a Cantiere */}
      {isModalAssociaOpen && cantiereSelezionato && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-sm">Associa Impresa dall'Archivio Generale</h3>
                <p className="text-xs text-slate-400">
                  Cantiere: <strong className="text-amber-400">{cantiereSelezionato.nome}</strong>
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalAssociaOpen(false)} 
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {impreseDisponibiliDaAssociare.length === 0 ? (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
                Tutte le imprese dell'archivio generale risultano già associate a questo cantiere.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {impreseDisponibiliDaAssociare.map(imp => (
                  <div
                    key={imp.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-amber-500/50 transition"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-xs truncate">{imp.ragione_sociale}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{imp.p_iva ? `P.IVA ${imp.p_iva}` : 'P.IVA N.D.'}</span>
                        {imp.email && <span className="truncate">&bull; {imp.email}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAssociaImpresaEsistente(imp.id)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      + Associa
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalAssociaOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Creazione / Modifica */}
      {(isModalAddOpen || isModalEditOpen) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-3.5 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-sm">
                  {isModalEditOpen ? 'Modifica Anagrafica Soggetto' : 'Nuovo Soggetto in Archivio'}
                </h3>
                {cantiereSelezionato && !isModalEditOpen && (
                  <p className="text-[11px] text-amber-400 mt-0.5">
                    Verrà associato automaticamente a: {cantiereSelezionato.nome}
                  </p>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setIsModalAddOpen(false);
                  setIsModalEditOpen(false);
                }} 
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={isModalEditOpen ? handleAggiornaImpresa : handleCreaImpresa} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Ragione Sociale / Nominativo *</label>
                <input
                  type="text"
                  required
                  placeholder="es. Edilizia Moderna S.r.l. oppure Mario Rossi"
                  value={ragioneSociale}
                  onChange={(e) => setRagioneSociale(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Scelta Tipologia Giuridica */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tipologia Giuridica *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipo('impresa')}
                    className={`py-2 px-3 rounded-lg border font-bold transition text-xs cursor-pointer ${
                      tipo === 'impresa'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    🏢 Impresa
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo('lavoratore_autonomo')}
                    className={`py-2 px-3 rounded-lg border font-bold transition text-xs cursor-pointer ${
                      tipo === 'lavoratore_autonomo'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    👤 Lavoratore Autonomo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Partita IVA / Codice Fiscale</label>
                  <input
                    type="text"
                    placeholder="Partita IVA o C.F."
                    value={pIva}
                    onChange={(e) => setPIva(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3 text-amber-500" />
                    Email (opzionale)
                  </label>
                  <input
                    type="email"
                    placeholder="es. info@impresa.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Referente / Preposto</label>
                  <input
                    type="text"
                    placeholder="Nome referente"
                    value={referente}
                    onChange={(e) => setReferente(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Telefono / Recapito</label>
                  <input
                    type="text"
                    placeholder="Cellulare"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsModalAddOpen(false);
                    setIsModalEditOpen(false);
                  }} 
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Annulla
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Salvataggio...' : (isModalEditOpen ? 'Salva Modifiche' : 'Salva in Archivio')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImpreseView;
