import React, { useState } from 'react';
import { 
  Building2, 
  Calendar, 
  AlertOctagon, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  FileText,
  Edit,
  Printer,
  CloudOff,
  CloudUpload,
  RefreshCw,
  HardHat,
  Compass,
  Camera,
  Copy,
  Layers,
  CloudSun,
  Users
} from 'lucide-react';
import type { Sopralluogo, Cantiere, TipoVerbale } from '../types';

interface SopralluoghiViewProps {
  sopralluoghi: Sopralluogo[];
  cantieri: Cantiere[];
  selectedCantiereId: string | null;
  pendingCount?: number;
  isOnline?: boolean;
  isSyncing?: boolean;
  onSync?: () => void;
  onSelectCantiereFilter: (cantiereId: string | null) => void;
  onNewSopralluogo: () => void;
  onEditSopralluogo: (sopralluogo: Sopralluogo) => void;
  onPrintSopralluogo: (sopralluogo: Sopralluogo) => void;
  onDeleteSopralluogo: (id: string) => void;
  onDuplicateAs?: (source: Sopralluogo, targetTipo: TipoVerbale) => void;
}

export const SopralluoghiView: React.FC<SopralluoghiViewProps> = ({
  sopralluoghi,
  cantieri,
  selectedCantiereId,
  pendingCount = 0,
  isOnline = true,
  isSyncing = false,
  onSync,
  onSelectCantiereFilter,
  onNewSopralluogo,
  onEditSopralluogo,
  onPrintSopralluogo,
  onDeleteSopralluogo,
  onDuplicateAs,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterTipo, setFilterTipo] = useState<'TUTTI' | TipoVerbale>('TUTTI');

  // 1. Filtro per cantiere
  const listaPerCantiere = selectedCantiereId
    ? sopralluoghi.filter((s) => s.cantiere_id === selectedCantiereId)
    : sopralluoghi;

  // 2. Filtro per tipo verbale
  const listaFiltrata = filterTipo === 'TUTTI'
    ? listaPerCantiere
    : listaPerCantiere.filter((s) => (s.tipo_verbale || 'CSE') === filterTipo);

  // 3. ORDINAMENTO CRONOLOGICO: dal più recente in alto al più vecchio in basso
  const listaOrdinata = [...listaFiltrata].sort((a, b) => {
    const timeA = new Date(`${a.data}T${a.ora || '00:00'}`).getTime();
    const timeB = new Date(`${b.data}T${b.ora || '00:00'}`).getTime();

    if (!isNaN(timeA) && !isNaN(timeB)) {
      return timeB - timeA; // Decrescente (newest first)
    }

    // Fallback su stringa data (YYYY-MM-DD)
    return (b.data || '').localeCompare(a.data || '');
  });

  const getCantiereNome = (id: string) => {
    return cantieri.find((c) => c.id === id)?.nome || 'Cantiere N.D.';
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const countCSE = listaPerCantiere.filter(s => (s.tipo_verbale || 'CSE') === 'CSE').length;
  const countDL = listaPerCantiere.filter(s => s.tipo_verbale === 'DL').length;
  const countRilievo = listaPerCantiere.filter(s => s.tipo_verbale === 'RILIEVO').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Registro Verbali & Sopralluoghi</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Archivio cronologico atti di cantiere: Sicurezza CSE (D.Lgs. 81/08), Direzione Lavori e Rilievi fotografici
          </p>
        </div>

        <button
          type="button"
          onClick={onNewSopralluogo}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuovo Verbale</span>
        </button>
      </div>

      {/* Banner Sincronizzazione Offline */}
      {pendingCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-amber-300">
            <CloudUpload className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold">
                {pendingCount === 1 
                  ? '1 verbale salvato in locale sul dispositivo in attesa di sincronizzazione cloud.' 
                  : `${pendingCount} verbali salvati in locale sul dispositivo in attesa di sincronizzazione cloud.`}
              </p>
              <p className="text-[11px] text-slate-400">
                I dati e le immagini WebP sono archiviati in sicurezza nella memoria locale e saranno inviati a Supabase non appena tornerà la connessione.
              </p>
            </div>
          </div>
          {isOnline && onSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition cursor-pointer self-start sm:self-auto shrink-0 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizzazione...' : 'Sincronizza ora'}</span>
            </button>
          )}
        </div>
      )}

      {/* Barra Filtri: Cantiere e Tipologia Verbale */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
        {/* Filtro per Cantiere */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-2 whitespace-nowrap">
            <Building2 className="w-4 h-4 text-amber-500" />
            Filtra per Cantiere:
          </label>
          <select
            value={selectedCantiereId || ''}
            onChange={(e) => onSelectCantiereFilter(e.target.value || null)}
            className="w-full sm:max-w-md bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="">Tutti i Cantieri ({sopralluoghi.length} verbali totali)</option>
            {cantieri.map((c) => {
              const count = sopralluoghi.filter((s) => s.cantiere_id === c.id).length;
              return (
                <option key={c.id} value={c.id}>
                  {c.nome} ({count} verbali)
                </option>
              );
            })}
          </select>
          {selectedCantiereId && (
            <button
              type="button"
              onClick={() => onSelectCantiereFilter(null)}
              className="text-xs text-amber-400 hover:underline self-start sm:self-auto cursor-pointer"
            >
              Azzera filtro cantiere
            </button>
          )}
        </div>

        {/* Filtro Pill per Tipologia Verbale (TUTTI | CSE | DL | RILIEVO) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5 mr-1">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            Tipologia Atto:
          </span>

          <button
            type="button"
            onClick={() => setFilterTipo('TUTTI')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              filterTipo === 'TUTTI'
                ? 'bg-slate-100 text-slate-950 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>Tutti</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterTipo === 'TUTTI' ? 'bg-slate-300 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
              {listaPerCantiere.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTipo('CSE')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              filterTipo === 'CSE'
                ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                : 'bg-slate-950 text-amber-400/90 hover:text-amber-300 border border-slate-800'
            }`}
          >
            <HardHat className="w-3.5 h-3.5" />
            <span>CSE - Sicurezza</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterTipo === 'CSE' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}>
              {countCSE}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTipo('DL')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              filterTipo === 'DL'
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                : 'bg-slate-950 text-blue-400/90 hover:text-blue-300 border border-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Direzione Lavori (DL)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterTipo === 'DL' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}>
              {countDL}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTipo('RILIEVO')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              filterTipo === 'RILIEVO'
                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                : 'bg-slate-950 text-emerald-400/90 hover:text-emerald-300 border border-slate-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Sopralluogo / Rilievo</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterTipo === 'RILIEVO' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}>
              {countRilievo}
            </span>
          </button>
        </div>
      </div>

      {/* Lista dei Sopralluoghi in Ordine Cronologico Decrescente */}
      {listaOrdinata.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">Nessun verbale trovato</h3>
          <p className="text-xs text-slate-400">
            {selectedCantiereId 
              ? 'Nessun verbale registrato per il cantiere o la tipologia selezionata.' 
              : 'Inizia registrando il primo verbale di cantiere.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800">
          {listaOrdinata.map((s) => {
            const isExpanded = expandedId === s.id;
            const tipo = s.tipo_verbale || 'CSE';
            const hasPrescrizioni = Boolean(s.prescrizioni_lista && s.prescrizioni_lista.length > 0);
            const totalFotos = (s.rilievi || []).reduce((acc, r) => acc + (r.foto_urls?.length || 0), 0);

            return (
              <div key={s.id} className="transition-colors hover:bg-slate-800/30">
                {/* RIGA COMPATTA */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      tipo === 'DL'
                        ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
                        : tipo === 'RILIEVO'
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/25 text-amber-500'
                    }`}>
                      {tipo === 'DL' ? (
                        <Compass className="w-4 h-4" />
                      ) : tipo === 'RILIEVO' ? (
                        <Camera className="w-4 h-4" />
                      ) : (
                        <HardHat className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-white truncate">
                          {getCantiereNome(s.cantiere_id)}
                        </h3>

                        {/* Badge Ruolo */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase ${
                          tipo === 'DL'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : tipo === 'RILIEVO'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}>
                          {tipo === 'DL' ? 'Direzione Lavori' : tipo === 'RILIEVO' ? 'Sopralluogo / Rilievo' : 'CSE Sicurezza'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <strong>{s.data}</strong>
                        </span>
                        {s.ora && <span>ore {s.ora}</span>}
                        {totalFotos > 0 && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Camera className="w-3 h-3 text-slate-500" />
                            {totalFotos} foto
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Esito e Azioni Rapide */}
                  <div className="flex items-center space-x-2 self-end sm:self-auto flex-wrap justify-end gap-y-1">
                    {/* Badge Offline / Pending */}
                    {s.is_pending && (
                      <span 
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.pending_status === 'error'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : s.pending_status === 'syncing'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                        title={s.pending_error || 'Salvato in locale, in attesa di connessione'}
                      >
                        <CloudOff className="w-3 h-3 mr-1" />
                        {s.pending_status === 'error' ? 'Errore Sync' : s.pending_status === 'syncing' ? 'Sync in corso...' : 'In attesa di sync'}
                      </span>
                    )}

                    {/* Stato di conformità / Esito (specifico per CSE) */}
                    {tipo === 'CSE' && (
                      s.sospensione_lavori ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500 text-white animate-pulse">
                          <AlertOctagon className="w-3 h-3 mr-1" />
                          SOSPESO
                        </span>
                      ) : hasPrescrizioni ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {s.prescrizioni_lista.length} prescrizioni
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Regolare
                        </span>
                      )
                    )}

                    {/* Badge per Ordini di Servizio DL */}
                    {tipo === 'DL' && s.ordini_servizio && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <FileText className="w-3 h-3 mr-1" />
                        OdS Emesso
                      </span>
                    )}

                    {/* Pulsante Rapido: "Duplica come..." (DL <-> CSE) */}
                    {onDuplicateAs && (
                      tipo === 'DL' ? (
                        <button
                          type="button"
                          onClick={() => onDuplicateAs(s, 'CSE')}
                          title="Duplica i dati base come nuovo Verbale CSE (Sicurezza)"
                          className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Duplica come</span> CSE
                        </button>
                      ) : tipo === 'CSE' ? (
                        <button
                          type="button"
                          onClick={() => onDuplicateAs(s, 'DL')}
                          title="Duplica i dati base come nuovo Verbale Direzione Lavori (DL)"
                          className="px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Duplica come</span> DL
                        </button>
                      ) : null
                    )}

                    {/* Stampa / Output PDF */}
                    <button
                      type="button"
                      onClick={() => onPrintSopralluogo(s)}
                      title="Stampa o Salva PDF del Verbale"
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 transition cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {/* Modifica Verbale */}
                    <button
                      type="button"
                      onClick={() => onEditSopralluogo(s)}
                      title="Modifica questo verbale"
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-blue-400 border border-slate-800 transition cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {/* Espandi / Comprimi Dettagli */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(s.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1 cursor-pointer transition"
                    >
                      <span>{isExpanded ? 'Chiudi' : 'Dettagli'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {/* Elimina Verbale */}
                    <button
                      type="button"
                      onClick={() => onDeleteSopralluogo(s.id)}
                      title="Elimina questo verbale"
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* DETTAGLI EXPANDED */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 bg-slate-950/60 border-t border-slate-800/80 space-y-4 text-xs">
                    {/* Dettagli specifici CSE: Sospensione */}
                    {s.sospensione_lavori && s.motivo_sospensione && (
                      <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-xl text-rose-200">
                        <strong className="block text-rose-300 font-bold uppercase mb-1">
                          Motivo Sospensione Lavori (Art. 92):
                        </strong>
                        <p>{s.motivo_sospensione}</p>
                      </div>
                    )}

                    {/* Dettagli specifici DL: Meteo e Operai */}
                    {tipo === 'DL' && (s.condizioni_meteo || s.operai_totali) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-950/20 border border-blue-500/30 rounded-xl text-blue-200">
                        {s.condizioni_meteo && (
                          <div className="flex items-start gap-2">
                            <CloudSun className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold block text-blue-300 uppercase text-[10px] tracking-wider">Meteo & Operatività</span>
                              <span>{s.condizioni_meteo}</span>
                            </div>
                          </div>
                        )}
                        {s.operai_totali ? (
                          <div className="flex items-start gap-2">
                            <Users className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold block text-blue-300 uppercase text-[10px] tracking-wider">Maestranze Totali</span>
                              <span>{s.operai_totali} operai presenti in cantiere</span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Dettagli specifici DL: Ordini di Servizio */}
                    {tipo === 'DL' && s.ordini_servizio && (
                      <div className="p-3 bg-slate-900 border border-blue-500/40 rounded-xl">
                        <strong className="block text-blue-400 font-bold uppercase mb-1 flex items-center gap-1.5">
                          <FileText className="w-4 h-4" />
                          Ordini di Servizio / Disposizioni DL:
                        </strong>
                        <p className="whitespace-pre-line text-slate-200">{s.ordini_servizio}</p>
                      </div>
                    )}

                    {/* Dettagli specifici RILIEVO: Note Tecniche */}
                    {tipo === 'RILIEVO' && s.note_tecniche && (
                      <div className="p-3 bg-slate-900 border border-emerald-500/40 rounded-xl">
                        <strong className="block text-emerald-400 font-bold uppercase mb-1 flex items-center gap-1.5">
                          <Camera className="w-4 h-4" />
                          Note e Premesse Tecniche al Rilievo:
                        </strong>
                        <p className="whitespace-pre-line text-slate-200">{s.note_tecniche}</p>
                      </div>
                    )}

                    {/* Lavorazioni e Imprese */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Lavorazioni / Fasi in corso:
                        </span>
                        {s.fasi_lavoro && s.fasi_lavoro.length > 0 ? (
                          <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
                            {s.fasi_lavoro.map((f, idx) => (
                              <p key={idx} className="text-slate-200">
                                &bull; {f.descrizione} {f.impresa && <span className="text-amber-400">({f.impresa})</span>}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-slate-200">
                            {s.lavorazioni_in_corso || 'Nessuna specifica.'}
                          </p>
                        )}
                      </div>

                      <div>
                        <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Imprese e Maestranze presenti:
                        </span>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 rounded-lg border border-slate-800 min-h-[38px] items-center">
                          {s.imprese_dettaglio && s.imprese_dettaglio.length > 0 ? (
                            s.imprese_dettaglio.map((imp, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px] font-medium flex items-center gap-1">
                                <span>{imp.nome}</span>
                                {imp.operai_presenti ? (
                                  <span className="text-blue-300 font-bold">({imp.operai_presenti} op.)</span>
                                ) : null}
                              </span>
                            ))
                          ) : s.imprese_presenti && s.imprese_presenti.length > 0 ? (
                            s.imprese_presenti.map((imp, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px] font-medium">
                                {imp}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500">Nessuna impresa annotata.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dispositivi e apprestamenti controllati (CSE) */}
                    {tipo === 'CSE' && s.dispositivi_apprestamenti && s.dispositivi_apprestamenti.some(d => d.selezionato) && (
                      <div className="pt-2 border-t border-slate-800">
                        <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          Verifica dispositivi e apprestamenti:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {s.dispositivi_apprestamenti.filter(d => d.selezionato).map((d, i) => (
                            <div key={i} className="p-2 bg-slate-900 rounded border border-slate-800">
                              <span className="font-bold text-amber-400">{d.nome}</span>
                              {d.note && <p className="text-slate-300 mt-0.5">{d.note}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prescrizioni CSE */}
                    {tipo === 'CSE' && s.prescrizioni_lista && s.prescrizioni_lista.length > 0 && (
                      <div className="pt-2 border-t border-slate-800">
                        <span className="font-bold text-amber-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          Prescrizioni operative impartite:
                        </span>
                        <div className="space-y-1.5">
                          {s.prescrizioni_lista.map((p, idx) => (
                            <div key={p.id || idx} className="p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-slate-200">
                              <p className="font-semibold text-amber-300">&bull; {p.testo}</p>
                              {(p.impresa_destinataria || p.data_scadenza) && (
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {p.impresa_destinataria && <span>Destinatario: <strong>{p.impresa_destinataria}</strong> </span>}
                                  {p.data_scadenza && <span>| Entro il: <strong>{p.data_scadenza}</strong></span>}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rilievi Fotografici sintesi */}
                    {s.rilievi && s.rilievi.length > 0 && (
                      <div className="pt-2 border-t border-slate-800">
                        <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-slate-500" />
                          Rilievi Fotografici ({totalFotos} foto complessive):
                        </span>
                        <div className="space-y-2">
                          {s.rilievi.map((r, idx) => (
                            <div key={r.id || idx} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="space-y-0.5">
                                <p className="text-slate-200 font-medium">
                                  {r.descrizione || 'Rilievo fotografico'}
                                </p>
                                {(r.ambiente || r.quote_note) && (
                                  <p className="text-[11px] text-slate-400">
                                    {r.ambiente && <span>Ambiente: <strong className="text-emerald-400">{r.ambiente}</strong> </span>}
                                    {r.quote_note && <span>| Quote/Note: <em>{r.quote_note}</em></span>}
                                  </p>
                                )}
                              </div>
                              {r.foto_urls && r.foto_urls.length > 0 && (
                                <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto py-1">
                                  {r.foto_urls.map((url, fIdx) => (
                                    <img
                                      key={fIdx}
                                      src={url}
                                      alt={`Foto ${fIdx + 1}`}
                                      className="w-10 h-10 object-cover rounded border border-slate-700 bg-slate-950"
                                      loading="lazy"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SopralluoghiView;
