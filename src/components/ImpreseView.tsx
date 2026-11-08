import React, { useState } from 'react';
import { 
  Users, Building2, Plus, Phone, UserCheck, 
  FolderOpen, ArrowRight, ShieldCheck, X, Trash2 
} from 'lucide-react';
import type { Impresa, Cantiere, Sopralluogo } from '../types';
import { supabase } from '../lib/supabaseClient';

interface ImpreseViewProps {
  imprese: Impresa[];
  cantieri: Cantiere[];
  sopralluoghi: Sopralluogo[];
  onOpenSopralluoghiCantiere: (cantiereId: string) => void;
  onDeleteImpresa: (impresaId: string) => void;
  onRefresh: () => void;
}

export const ImpreseView: React.FC<ImpreseViewProps> = ({
  imprese,
  cantieri,
  sopralluoghi,
  onOpenSopralluoghiCantiere,
  onDeleteImpresa,
  onRefresh,
}) => {
  const [selectedImpresa, setSelectedImpresa] = useState<Impresa | null>(null);
  const [isModalAddOpen, setIsModalAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [ragioneSociale, setRagioneSociale] = useState('');
  const [pIva, setPIva] = useState('');
  const [referente, setReferente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ruolo, setRuolo] = useState('esecutrice');

  const getCantieriImpresa = (impresa: Impresa): Cantiere[] => {
    const ids = new Set<string>();
    if (impresa.cantiere_id) ids.add(impresa.cantiere_id);
    sopralluoghi.forEach(s => {
      if (s.imprese_presenti && s.imprese_presenti.includes(impresa.ragione_sociale)) {
        ids.add(s.cantiere_id);
      }
    });
    return cantieri.filter(c => ids.has(c.id));
  };

  const handleCreaImpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = ragioneSociale.trim();
    if (!nomePulito) return;

    const esisteGia = imprese.some(
      i => i.ragione_sociale.trim().toLowerCase() === nomePulito.toLowerCase()
    );

    if (esisteGia) {
      alert(`Un'impresa con ragione sociale "${nomePulito}" è già presente in archivio!`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('imprese').insert([{
        ragione_sociale: nomePulito,
        p_iva: pIva.trim() || null,
        referente_nome: referente.trim() || null,
        telefono: telefono.trim() || null,
        ruolo: ruolo,
      }]);

      if (error) throw error;

      setRagioneSociale('');
      setPIva('');
      setReferente('');
      setTelefono('');
      setIsModalAddOpen(false);
      onRefresh();
    } catch (err: any) {
      alert('Errore salvataggio impresa: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Archivio Imprese & Esecutori</h1>
          <p className="text-xs text-slate-400 mt-1">Idoneità tecnico-professionale e cantieri in cui opera ciascuna impresa</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalAddOpen(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nuova Impresa</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Elenco Imprese con Tasto Elimina Visibile */}
        <div className="lg:col-span-1 space-y-2">
          {imprese.map((imp) => {
            const isSelected = selectedImpresa?.id === imp.id;
            const count = getCantieriImpresa(imp).length;
            return (
              <div
                key={imp.id}
                onClick={() => setSelectedImpresa(imp)}
                className={`p-4 rounded-xl border transition cursor-pointer group ${
                  isSelected ? 'bg-amber-500/10 border-amber-500' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition">{imp.ragione_sociale}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-semibold uppercase">{imp.ruolo || 'Esecutrice'}</span>
                    <button
                      type="button"
                      title="Elimina impresa"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteImpresa(imp.id);
                        if (selectedImpresa?.id === imp.id) setSelectedImpresa(null);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-400">
                  <span>{imp.p_iva ? `P.IVA: ${imp.p_iva}` : 'P.IVA N.D.'}</span>
                  <span className="text-amber-400 font-medium">{count} cantieri attivi</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scheda Dettaglio Impresa */}
        <div className="lg:col-span-2">
          {selectedImpresa ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="border-b border-slate-800 pb-3 flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold uppercase text-amber-500">Scheda Impresa</span>
                  <h2 className="text-xl font-bold text-white mt-0.5">{selectedImpresa.ragione_sociale}</h2>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteImpresa(selectedImpresa.id);
                      setSelectedImpresa(null);
                    }}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Elimina Definitivamente</span>
                  </button>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block">P.IVA</span>
                  <span className="font-mono text-slate-200">{selectedImpresa.p_iva || 'N.D.'}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block">Referente</span>
                  <span className="text-slate-200">{selectedImpresa.referente || 'N.D.'}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block">Telefono</span>
                  <span className="text-slate-200">{selectedImpresa.telefono || 'N.D.'}</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-500" />
                  Cantieri in cui opera l'Impresa
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {getCantieriImpresa(selectedImpresa).map(c => (
                    <div key={c.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">{c.nome}</h4>
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
                    <p className="text-xs text-slate-500 italic p-3">Nessun cantiere associato a quest'impresa.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
              Seleziona un'impresa dall'elenco a sinistra per visualizzarne i dati e i cantieri attivi.
            </div>
          )}
        </div>
      </div>

      {isModalAddOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm">Nuova Impresa</h3>
              <button type="button" onClick={() => setIsModalAddOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreaImpresa} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Ragione Sociale *"
                value={ragioneSociale}
                onChange={(e) => setRagioneSociale(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Partita IVA"
                value={pIva}
                onChange={(e) => setPIva(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Referente"
                  value={referente}
                  onChange={(e) => setReferente(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Telefono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalAddOpen(false)} className="px-3 py-1.5 text-xs text-slate-400">Annulla</button>
                <button type="submit" disabled={loading} className="px-4 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg">
                  {loading ? 'Salvataggio...' : 'Salva Impresa'}
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