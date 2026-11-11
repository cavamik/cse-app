import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { ModalCantiere } from './components/ModalCantiere';
import { ModalSopralluogo } from './components/ModalSopralluogo';
import { SopralluoghiView } from './components/SopralluoghiView';
import { ImpreseView } from './components/ImpreseView';
import { VerbalePdfModal } from './components/VerbalePdfModal';
import type { Cantiere, Sopralluogo, Impresa, DashboardStats, NavTab } from './types';
import { supabase } from './lib/supabaseClient';

export const App: React.FC = () => {
  // Tab iniziale: cantieri
  const [activeTab, setActiveTab] = useState<NavTab>('cantieri');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isModalCantiereOpen, setIsModalCantiereOpen] = useState<boolean>(false);
  const [isModalSopralluogoOpen, setIsModalSopralluogoOpen] = useState<boolean>(false);

  const [sopralluogoToEdit, setSopralluogoToEdit] = useState<Sopralluogo | null>(null);
  const [sopralluogoForPdf, setSopralluogoForPdf] = useState<Sopralluogo | null>(null);
  const [selectedCantiereId, setSelectedCantiereId] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats>({
    cantieriAttivi: 0,
    sopralluoghiMese: 0,
    prescrizioniAperte: 0,
  });

  const [cantieri, setCantieri] = useState<Cantiere[]>([]);
  const [sopralluoghi, setSopralluoghi] = useState<Sopralluogo[]>([]);
  const [imprese, setImprese] = useState<Impresa[]>([]);

  const fetchData = useCallback(async () => {
    try {
      // 1. Cantieri
      const { data: cData } = await supabase
        .from('cantieri')
        .select('*')
        .order('created_at', { ascending: false });

      setIsConnected(true);

      const mappedCantieri: Cantiere[] = (cData || []).map((item: any) => ({
        id: item.id,
        nome: item.denominazione || item.codice,
        indirizzo: item.indirizzo || 'Non specificato',
        committente: item.committente || 'N.D.',
        direttore_lavori: item.direttore_lavori || '',
        progettista: item.progettista || '',
        cse: item.cse || 'arch. Cavalleri Michele',
        stato: item.status === 'sospeso' ? 'sospeso' : item.status === 'completato' ? 'completato' : 'in_corso',
        created_at: item.created_at,
      }));
      setCantieri(mappedCantieri);

// 2. Sopralluoghi ordinati per data decrescente
      const { data: sData } = await supabase
        .from('sopralluoghi')
        .select('*')
        .order('data', { ascending: false })
        .order('ora', { ascending: false });

      const mappedSopralluoghi: Sopralluogo[] = (sData || []).map((item: any) => ({
        id: item.id,
        cantiere_id: item.cantiere_id,
        data: item.data || new Date().toISOString().split('T')[0],
        ora: item.ora || '09:00',
        lavorazioni_in_corso: item.lavorazioni_in_corso || '',
        fasi_lavoro: item.fasi_lavoro || [],
        imprese_presenti: item.imprese_presenti || [],
        presenze: item.presenze || {},
        dispositivi_apprestamenti: item.dispositivi_apprestamenti || [],
        argomenti_discussi: item.argomenti_discussi || '',
        rilievi: item.rilievi || [],
        prescrizioni_lista: item.prescrizioni_lista || [],
        sospensione_lavori: item.sospensione_lavori || false,
        motivo_sospensione: item.motivo_sospensione || '',
      }));
      setSopralluoghi(mappedSopralluoghi);

      // 3. Imprese
      const { data: iData } = await supabase
        .from('imprese')
        .select('*')
        .order('ragione_sociale', { ascending: true });

      const mappedImprese: Impresa[] = (iData || []).map((item: any) => ({
        id: item.id,
        cantiere_id: item.cantiere_id,
        ragione_sociale: item.ragione_sociale,
        p_iva: item.p_iva || '',
        referente: item.referente_nome || item.referente || '',
        telefono: item.telefono || '',
        ruolo: item.ruolo || 'esecutrice',
      }));
      setImprese(mappedImprese);

      const totalePrescrizioni = mappedSopralluoghi.reduce(
        (acc, s) => acc + (s.prescrizioni_lista?.length || 0), 0
      );

      setStats({
        cantieriAttivi: mappedCantieri.filter(c => c.stato === 'in_corso').length,
        sopralluoghiMese: mappedSopralluoghi.length,
        prescrizioniAperte: totalePrescrizioni,
      });

    } catch (err) {
      console.error(err);
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteCantiere = async (id: string, nome: string) => {
    if (!window.confirm(`Eliminare il cantiere "${nome}" e tutti i relativi dati?`)) return;
    await supabase.from('cantieri').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteSopralluogo = async (id: string) => {
    if (!window.confirm('Eliminare questo verbale di sopralluogo?')) return;
    await supabase.from('sopralluoghi').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteImpresa = async (id: string) => {
    if (!window.confirm("Eliminare quest'impresa dall'archivio?")) return;
    await supabase.from('imprese').delete().eq('id', id);
    fetchData();
  };

  const handleOpenSopralluoghiCantiere = (cantiereId: string) => {
    setSelectedCantiereId(cantiereId);
    setActiveTab('sopralluoghi');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      <Navbar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab !== 'sopralluoghi') setSelectedCantiereId(null);
          setActiveTab(tab);
        }}
        isConnected={isConnected}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* 1. Scheda Cantieri Attivi (ordinata per ultimo sopralluogo) */}
        {activeTab === 'cantieri' && (
          <Dashboard
            stats={stats}
            cantieri={cantieri}
            sopralluoghi={sopralluoghi}
            onNewCantiere={() => setIsModalCantiereOpen(true)}
            onSelectCantiere={handleOpenSopralluoghiCantiere}
          />
        )}

        {/* 2. Scheda Sopralluoghi */}
        {activeTab === 'sopralluoghi' && (
          <SopralluoghiView
            sopralluoghi={sopralluoghi}
            cantieri={cantieri}
            selectedCantiereId={selectedCantiereId}
            onSelectCantiereFilter={(id) => setSelectedCantiereId(id)}
            onNewSopralluogo={() => {
              setSopralluogoToEdit(null);
              setIsModalSopralluogoOpen(true);
            }}
            onEditSopralluogo={(sopr) => {
              setSopralluogoToEdit(sopr);
              setIsModalSopralluogoOpen(true);
            }}
            onPrintSopralluogo={(sopr) => {
              setSopralluogoForPdf(sopr);
            }}
            onDeleteSopralluogo={handleDeleteSopralluogo}
          />
        )}

        {/* 3. Scheda Imprese */}
        {activeTab === 'imprese' && (
          <ImpreseView
            imprese={imprese}
            cantieri={cantieri}
            sopralluoghi={sopralluoghi}
            onOpenSopralluoghiCantiere={handleOpenSopralluoghiCantiere}
            onDeleteImpresa={handleDeleteImpresa}
            onRefresh={fetchData}
          />
        )}
      </main>

      {/* Modale Nuovo Cantiere */}
      <ModalCantiere
        isOpen={isModalCantiereOpen}
        onClose={() => setIsModalCantiereOpen(false)}
        onSuccess={fetchData}
      />

      {/* Modale Sopralluogo */}
      <ModalSopralluogo
        isOpen={isModalSopralluogoOpen}
        onClose={() => {
          setIsModalSopralluogoOpen(false);
          setSopralluogoToEdit(null);
        }}
        cantieri={cantieri}
        initialCantiereId={selectedCantiereId || undefined}
        sopralluogoToEdit={sopralluogoToEdit}
        onSuccess={fetchData}
      />

      {/* Modale PDF con Esportazione Diretta */}
      {sopralluogoForPdf && (
        <VerbalePdfModal
          isOpen={Boolean(sopralluogoForPdf)}
          onClose={() => setSopralluogoForPdf(null)}
          sopralluogo={sopralluogoForPdf}
          cantiere={cantieri.find(c => c.id === sopralluogoForPdf.cantiere_id)}
        />
      )}

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-400 mt-12 print:hidden">
        cse-app &bull; Arch. Michele Cavalleri &bull; Coordinamento Sicurezza D.Lgs. 81/08
      </footer>
    </div>
  );
};

export default App;