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
  Printer
} from 'lucide-react';
import type { Sopralluogo, Cantiere } from '../types';

interface SopralluoghiViewProps {
  sopralluoghi: Sopralluogo[];
  cantieri: Cantiere[];
  selectedCantiereId: string | null;
  onSelectCantiereFilter: (cantiereId: string | null) => void;
  onNewSopralluogo: () => void;
  onEditSopralluogo: (sopralluogo: Sopralluogo) => void;
  onPrintSopralluogo: (sopralluogo: Sopralluogo) => void;
  onDeleteSopralluogo: (id: string) => void;
}

export const SopralluoghiView: React.FC<SopralluoghiViewProps> = ({
  sopralluoghi,
  cantieri,
  selectedCantiereId,
  onSelectCantiereFilter,
  onNewSopralluogo,
  onEditSopralluogo,
  onPrintSopralluogo,
  onDeleteSopralluogo,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 1. Filtro per cantiere
  const listaFiltrata = selectedCantiereId
    ? sopralluoghi.filter((s) => s.cantiere_id === selectedCantiereId)
    : sopralluoghi;

  // 2. ORDINAMENTO CRONOLOGICO: dal più recente in alto al più vecchio in basso
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

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Registro Sopralluoghi CSE</h1>
          <p className="text-xs text-slate-400 mt-0.5">Elenco cronologico delle ispezioni di sicurezza (D.Lgs. 81/08)</p>
        </div>

        <button
          type="button"
          onClick={onNewSopralluogo}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuovo Sopralluogo</span>
        </button>
      </div>

      {/* Menu a tendina per Filtrare per Cantiere */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
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
            Azzera filtro
          </button>
        )}
      </div>

      {/* Lista dei Sopralluoghi in Ordine Cronologico Decrescente */}
      {listaOrdinata.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">Nessun verbale trovato</h3>
          <p className="text-xs text-slate-400">
            {selectedCantiereId ? 'Nessun sopralluogo registrato per il cantiere selezionato.' : 'Inizia compilando il primo verbale di ispezione.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800">
          {listaOrdinata.map((s) => {
            const isExpanded = expandedId === s.id;
            const hasPrescrizioni = Boolean(s.prescrizioni_lista && s.prescrizioni_lista.length > 0);

            return (
              <div key={s.id} className="transition-colors hover:bg-slate-800/30">
                {/* RIGA COMPATTA */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-500 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">
                        {getCantiereNome(s.cantiere_id)}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                        <span>Data: <strong>{s.data}</strong></span>
                        {s.ora && <span>Ore: {s.ora}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Esito e Azioni */}
                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    {s.sospensione_lavori ? (
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
                    {s.sospensione_lavori && s.motivo_sospensione && (
                      <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-xl text-rose-200">
                        <strong className="block text-rose-300 font-bold uppercase mb-1">
                          Motivo Sospensione Lavori (Art. 92):
                        </strong>
                        <p>{s.motivo_sospensione}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Fasi di lavoro in svolgimento:
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
                          Imprese presenti:
                        </span>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 rounded-lg border border-slate-800 min-h-[38px] items-center">
                          {s.imprese_presenti && s.imprese_presenti.length > 0 ? (
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

                    {/* Dispositivi e apprestamenti controllati */}
                    {s.dispositivi_apprestamenti && s.dispositivi_apprestamenti.some(d => d.selezionato) && (
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

                    {/* Argomenti discussi */}
                    {s.argomenti_discussi && (
                      <div className="pt-2 border-t border-slate-800">
                        <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Argomenti discussi:
                        </span>
                        <p className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-slate-200">
                          {s.argomenti_discussi}
                        </p>
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