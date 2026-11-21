import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { ModalCantiere } from './components/ModalCantiere';
import { ModalSopralluogo } from './components/ModalSopralluogo';
import { SopralluoghiView } from './components/SopralluoghiView';
import { ImpreseView } from './components/ImpreseView';
import { VerbalePdfModal } from './components/VerbalePdfModal';
import type { Cantiere, Sopralluogo, Impresa, DashboardStats, NavTab, PendingSopralluogo } from './types';
import { supabase } from './lib/supabaseClient';
import { 
  getCachedData, 
  setCachedData, 
  getPendingSopralluoghi, 
  removePendingSopralluogo, 
  syncPendingSopralluoghi, 
  extractStoragePath,
  OFFLINE_KEYS 
} from './lib/offlineStore';

export const App: React.FC = () => {
  // Tab attiva
  const [activeTab, setActiveTab] = useState<NavTab>('cantieri');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

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

  // Ref per evitare sync concorrenti e cicli tra callback
  const syncingRef = useRef(false);
  const fetchDataRef = useRef<() => Promise<void>>(async () => {});
  // Tracciamento dei blob URL attivi creati dai file salvati in IndexedDB
  const pendingBlobUrlsRef = useRef<string[]>([]);

  const revokePendingBlobUrls = () => {
    pendingBlobUrlsRef.current.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignora se già deallocato
      }
    });
    pendingBlobUrlsRef.current = [];
  };

  useEffect(() => {
    return () => {
      revokePendingBlobUrls();
    };
  }, []);

  // Mappa gli elementi della coda IndexedDB in oggetti Sopralluogo rigenerando i blob URL locali
  const mapPendingToSopralluogo = (pendingList: PendingSopralluogo[]): Sopralluogo[] => {
    revokePendingBlobUrls();

    return pendingList.map(p => {
      // Mappa delle nuove URL locali generate per ciascun rilievo
      const localUrlsByRilievo: Record<string, string[]> = {};
      if (Array.isArray(p.pendingFotos)) {
        for (const foto of p.pendingFotos) {
          if (foto.fileBlob instanceof Blob) {
            try {
              const freshBlobUrl = URL.createObjectURL(foto.fileBlob);
              pendingBlobUrlsRef.current.push(freshBlobUrl);
              if (!localUrlsByRilievo[foto.rilievoId]) {
                localUrlsByRilievo[foto.rilievoId] = [];
              }
              localUrlsByRilievo[foto.rilievoId].push(freshBlobUrl);
            } catch (err) {
              console.warn('[App] Errore creazione blob URL per foto offline:', err);
            }
          }
        }
      }

      const rilieviConBlob = (p.payload.rilievi || []).map(r => {
        const freshUrls = localUrlsByRilievo[r.id] || [];
        // Filtriamo eventuali vecchi blob URL scaduti rimasti salvati
        const validUrls = (r.foto_urls || []).filter(u => !u.startsWith('blob:'));
        return {
          ...r,
          foto_urls: [...validUrls, ...freshUrls],
        };
      });

      return {
        id: p.tempId,
        temp_id: p.tempId,
        cantiere_id: p.cantiere_id,
        data: p.payload.data || new Date().toISOString().split('T')[0],
        ora: p.payload.ora || '09:00',
        lavorazioni_in_corso: p.payload.lavorazioni_in_corso || '',
        fasi_lavoro: p.payload.fasi_lavoro || [],
        imprese_presenti: p.payload.imprese_presenti || [],
        imprese_dettaglio: p.payload.imprese_dettaglio || [],
        presenze: p.payload.presenze || {},
        dispositivi_apprestamenti: p.payload.dispositivi_apprestamenti || [],
        argomenti_discussi: p.payload.argomenti_discussi || '',
        rilievi: rilieviConBlob,
        prescrizioni_lista: p.payload.prescrizioni_lista || [],
        sospensione_lavori: p.payload.sospensione_lavori || false,
        motivo_sospensione: p.payload.motivo_sospensione || '',
        is_pending: true,
        pending_status: p.status,
        pending_error: p.errorMessage,
      };
    });
  };

  // Carica i dati locali da IndexedDB (cache + pending)
  const loadLocalData = useCallback(async () => {
    try {
      const [cachedCantieri, cachedImprese, cachedSopr, pendingList] = await Promise.all([
        getCachedData<Cantiere[]>(OFFLINE_KEYS.CANTIERI),
        getCachedData<Impresa[]>(OFFLINE_KEYS.IMPRESE),
        getCachedData<Sopralluogo[]>(OFFLINE_KEYS.SOPRALLUOGHI),
        getPendingSopralluoghi(),
      ]);

      if (cachedCantieri && cachedCantieri.length > 0) {
        setCantieri(cachedCantieri);
      }
      if (cachedImprese && cachedImprese.length > 0) {
        setImprese(cachedImprese);
      }

      setPendingCount(pendingList.length);
      const pendingMapped = mapPendingToSopralluogo(pendingList);

      const allSopralluoghi = [...pendingMapped, ...(cachedSopr || [])];
      setSopralluoghi(allSopralluoghi);

      const cantieriValidi = cachedCantieri || [];
      const totalePrescrizioni = allSopralluoghi.reduce(
        (acc, s) => acc + (s.prescrizioni_lista?.length || 0), 0
      );

      setStats({
        cantieriAttivi: cantieriValidi.filter(c => c.stato === 'in_corso').length,
        sopralluoghiMese: allSopralluoghi.length,
        prescrizioniAperte: totalePrescrizioni,
      });
    } catch (e) {
      console.warn('[App] Errore lettura cache IndexedDB:', e);
    }
  }, []);

  // Motore di sincronizzazione
  const triggerSync = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const res = await syncPendingSopralluoghi(supabase);
      if (res.success > 0) {
        // Ricarica dati remoti
        await fetchDataRef.current();
      }
    } catch (err) {
      console.error('[App] Errore sincronizzazione automatica:', err);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      const remaining = await getPendingSopralluoghi();
      setPendingCount(remaining.length);
    }
  }, []);

  // Fetch principale con sincronizzazione e caching
  const fetchData = useCallback(async () => {
    // 1. Inizializza istantaneamente da IndexedDB
    await loadLocalData();

    // 2. Se siamo offline, ci fermiamo qui
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsConnected(false);
      return;
    }

    try {
      // 1. Cantieri
      const { data: cData, error: cErr } = await supabase
        .from('cantieri')
        .select('*')
        .order('created_at', { ascending: false });

      if (cErr) throw cErr;

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
      await setCachedData(OFFLINE_KEYS.CANTIERI, mappedCantieri);

      // 2. Sopralluoghi
      const { data: sData, error: sErr } = await supabase
        .from('sopralluoghi')
        .select('*')
        .order('data', { ascending: false })
        .order('ora', { ascending: false });

      if (sErr) throw sErr;

      const mappedSopralluoghi: Sopralluogo[] = (sData || []).map((item: any) => ({
        id: item.id,
        cantiere_id: item.cantiere_id,
        data: item.data || new Date().toISOString().split('T')[0],
        ora: item.ora || '09:00',
        lavorazioni_in_corso: item.lavorazioni_in_corso || '',
        fasi_lavoro: item.fasi_lavoro || [],
        imprese_presenti: item.imprese_presenti || [],
        imprese_dettaglio: item.imprese_dettaglio || [],
        presenze: item.presenze || {},
        dispositivi_apprestamenti: item.dispositivi_apprestamenti || [],
        argomenti_discussi: item.argomenti_discussi || '',
        rilievi: item.rilievi || [],
        prescrizioni_lista: item.prescrizioni_lista || [],
        sospensione_lavori: item.sospensione_lavori || false,
        motivo_sospensione: item.motivo_sospensione || '',
      }));

      await setCachedData(OFFLINE_KEYS.SOPRALLUOGHI, mappedSopralluoghi);

      // Includi i verbali pending in cima alla lista
      const pendingList = await getPendingSopralluoghi();
      setPendingCount(pendingList.length);
      const pendingMapped = mapPendingToSopralluogo(pendingList);

      const allSopralluoghi = [...pendingMapped, ...mappedSopralluoghi];
      setSopralluoghi(allSopralluoghi);

      // 3. Imprese
      const { data: iData, error: iErr } = await supabase
        .from('imprese')
        .select('*')
        .order('ragione_sociale', { ascending: true });

      if (iErr) throw iErr;

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
      await setCachedData(OFFLINE_KEYS.IMPRESE, mappedImprese);

      // 4. Cache Impostazioni Studio
      const { data: stData } = await supabase
        .from('impostazioni_studio')
        .select('*')
        .eq('id', 'principale')
        .maybeSingle();

      if (stData) {
        await setCachedData(OFFLINE_KEYS.IMPOSTAZIONI_STUDIO, stData);
      }

      // Calcolo metriche
      const totalePrescrizioni = allSopralluoghi.reduce(
        (acc, s) => acc + (s.prescrizioni_lista?.length || 0), 0
      );

      setStats({
        cantieriAttivi: mappedCantieri.filter(c => c.stato === 'in_corso').length,
        sopralluoghiMese: allSopralluoghi.length,
        prescrizioniAperte: totalePrescrizioni,
      });

      // Se ci sono elementi pending e abbiamo linea, avvia la sincronizzazione automatica
      if (pendingList.length > 0 && !syncingRef.current) {
        triggerSync();
      }

    } catch (err) {
      console.error('[App] Errore connessione Supabase, utilizzo dati offline:', err);
      setIsConnected(false);
    }
  }, [loadLocalData, triggerSync]);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Listener eventi di rete window 'online' e 'offline'
  useEffect(() => {
    fetchData();

    const handleOnline = () => {
      setIsOnline(true);
      fetchData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData]);

  const handleDeleteSopralluogo = async (id: string) => {
    if (!window.confirm('Eliminare questo verbale di sopralluogo e tutte le relative fotografie?')) return;

    // Se è un verbale pending in coda locale
    if (id.startsWith('pending_')) {
      await removePendingSopralluogo(id);
      await loadLocalData();
      return;
    }

    if (navigator.onLine) {
      // 1. Individua il verbale per estrarre tutti i file fotografici salvati nel bucket
      const verbale = sopralluoghi.find(s => s.id === id);
      const pathsToDelete: string[] = [];

      if (verbale?.rilievi) {
        for (const r of verbale.rilievi) {
          for (const url of (r.foto_urls || [])) {
            const storagePath = extractStoragePath(url, 'foto-sopralluoghi');
            if (storagePath) pathsToDelete.push(storagePath);
          }
        }
      }

      // 2. Rimuovi fisicamente i file dal bucket Supabase Storage
      if (pathsToDelete.length > 0) {
        try {
          console.log('[App] Eliminazione file da Storage foto-sopralluoghi:', pathsToDelete);
          const { error: remErr } = await supabase.storage
            .from('foto-sopralluoghi')
            .remove(pathsToDelete);
          if (remErr) {
            console.warn('[App] Avviso eliminazione foto da storage:', remErr.message);
          }
        } catch (storageErr) {
          console.warn('[App] Errore cancellazione file da storage:', storageErr);
        }
      }

      // 3. Elimina il record dal database
      const { error: dbErr } = await supabase.from('sopralluoghi').delete().eq('id', id);
      if (dbErr) {
        alert('Errore eliminazione verbale: ' + dbErr.message);
        return;
      }

      fetchData();
    } else {
      alert('Non è possibile eliminare verbali già sincronizzati nel cloud mentre sei offline.');
    }
  };

  const handleDeleteImpresa = async (id: string) => {
    if (!window.confirm("Eliminare quest'impresa dall'archivio?")) return;
    if (navigator.onLine) {
      await supabase.from('imprese').delete().eq('id', id);
      fetchData();
    } else {
      alert('Non è possibile eliminare anagrafiche imprese mentre sei offline.');
    }
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
        isOnline={isOnline}
        pendingCount={pendingCount}
        isSyncing={isSyncing}
        onSync={triggerSync}
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
            pendingCount={pendingCount}
            isOnline={isOnline}
            isSyncing={isSyncing}
            onSync={triggerSync}
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
        imprese={imprese}
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
        cse-app &bull; Arch. Michele Cavalleri &bull; Coordinamento Sicurezza D.Lgs. 81/08 &bull; Offline-First Engine
      </footer>
    </div>
  );
};

export default App;
