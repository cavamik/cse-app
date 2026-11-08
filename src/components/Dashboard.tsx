import React from 'react';
import { 
  Building2, 
  Plus, 
  MapPin, 
  UserCheck, 
  ArrowRight,
  FolderOpen
} from 'lucide-react';
import type { Cantiere, DashboardStats } from '../types';

interface DashboardProps {
  stats: DashboardStats;
  cantieri: Cantiere[];
  onNewCantiere: () => void;
  onSelectCantiere: (cantiereId: string) => void;
  onNavigateToSopralluoghi?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  cantieri,
  onNewCantiere,
  onSelectCantiere,
}) => {
  // Filtra solo i cantieri in corso/attivi
  const cantieriAttivi = cantieri.filter((c) => c.stato === 'in_corso');

  return (
    <div className="space-y-6 pb-12">
      {/* Header Vista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-amber-500" />
            <span>Cantieri Attivi</span>
            <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {cantieriAttivi.length} in corso
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Supervisione operativa e coordinamento sicurezza ai sensi del D.Lgs. 81/08
          </p>
        </div>

        <button
          type="button"
          onClick={onNewCantiere}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nuovo Cantiere</span>
        </button>
      </div>

      {/* Elenco Cantieri Attivi */}
      {cantieriAttivi.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">Nessun cantiere attivo al momento</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Crea un nuovo cantiere con lo stato "In Corso" per gestirne i verbali e i sopralluoghi.
          </p>
          <button
            type="button"
            onClick={onNewCantiere}
            className="mt-2 px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-amber-400 transition cursor-pointer"
          >
            Crea Primo Cantiere
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cantieriAttivi.map((cantiere) => (
            <div
              key={cantiere.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-base font-bold text-white hover:text-amber-400 transition">
                    {cantiere.nome}
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
                    In Corso
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-400">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{cantiere.indirizzo || 'Indirizzo non specificato'}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Committente: <strong className="text-slate-300 font-medium">{cantiere.committente || 'N.D.'}</strong></span>
                  </p>
                </div>
              </div>

              {/* Pulsante Apri Cartella Sopralluoghi */}
              <button
                type="button"
                onClick={() => onSelectCantiere(cantiere.id)}
                className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-amber-500 text-slate-200 hover:text-slate-950 text-xs font-bold transition border border-slate-800 hover:border-amber-500 cursor-pointer group"
              >
                <FolderOpen className="w-4 h-4 text-amber-400 group-hover:text-slate-950" />
                <span>Apri Cartella Sopralluoghi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;