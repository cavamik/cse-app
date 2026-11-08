import React, { useState } from 'react';
import { X, Building2, Plus, Loader2, UserCheck, HardHat } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import type { StatoCantiere } from '../types';

interface ModalCantiereProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ModalCantiere: React.FC<ModalCantiereProps> = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [denominazione, setDenominazione] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [committente, setCommittente] = useState('');
  const [direttoreLavori, setDirettoreLavori] = useState('');
  const [progettista, setProgettista] = useState('');
  const [cse, setCse] = useState('arch. Cavalleri Michele');
  const [status, setStatus] = useState<StatoCantiere>('in_corso');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!denominazione.trim()) {
      alert('Inserisci la denominazione del cantiere');
      return;
    }

    setLoading(true);
    const codiceGenerato = `CANT-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const { error } = await supabase.from('cantieri').insert([
        {
          codice: codiceGenerato,
          denominazione: denominazione.trim(),
          indirizzo: indirizzo.trim() || 'Non specificato',
          committente: committente.trim() || 'N.D.',
          direttore_lavori: direttoreLavori.trim() || '',
          progettista: progettista.trim() || '',
          cse: cse.trim() || 'arch. Cavalleri Michele',
          status: status,
        }
      ]);

      if (error) throw error;

      setDenominazione('');
      setIndirizzo('');
      setCommittente('');
      setDirettoreLavori('');
      setProgettista('');
      setStatus('in_corso');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Errore salvataggio cantiere: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-auto text-xs">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/40">
          <div className="flex items-center gap-2 text-amber-500">
            <Building2 className="w-5 h-5" />
            <h3 className="font-bold text-sm text-white">Anagrafica Nuovo Cantiere (D.Lgs. 81/08)</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Denominazione Cantiere *</label>
            <input
              type="text"
              required
              placeholder="es. Ristrutturazione Scuola Manzoni"
              value={denominazione}
              onChange={(e) => setDenominazione(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Indirizzo Cantiere</label>
            <input
              type="text"
              placeholder="es. Via Roma 12, Milano"
              value={indirizzo}
              onChange={(e) => setIndirizzo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* FIGURE DI CANTIERE MEMORIZZATE NELL'ARCHIVIO CANTIERE */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
            <span className="font-bold text-slate-300 uppercase tracking-wider block text-[11px] flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              Figure di Riferimento del Cantiere
            </span>

            <div>
              <label className="block text-slate-400 mb-0.5">Committente / Stazione Appaltante</label>
              <input
                type="text"
                placeholder="es. Immobiliare Futura S.p.A. o Mario Rossi"
                value={committente}
                onChange={(e) => setCommittente(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-0.5">Direttore Lavori (DL)</label>
                <input
                  type="text"
                  placeholder="Nome e cognome DL"
                  value={direttoreLavori}
                  onChange={(e) => setDirettoreLavori(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">Progettista</label>
                <input
                  type="text"
                  placeholder="Nome e cognome Progettista"
                  value={progettista}
                  onChange={(e) => setProgettista(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-0.5">Coordinatore Sicurezza (CSE)</label>
              <input
                type="text"
                value={cse}
                onChange={(e) => setCse(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-amber-400 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Stato Operativo</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatoCantiere)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
            >
              <option value="in_corso">In Corso (Attivo)</option>
              <option value="sospeso">Sospeso</option>
              <option value="completato">Completato</option>
            </select>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-slate-400 hover:text-white">
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Salva Cantiere</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalCantiere;