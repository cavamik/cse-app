import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Upload, Image as ImageIcon, Sliders, MoveVertical, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getCachedData, setCachedData, OFFLINE_KEYS, type ImpostazioniStudioCache } from '../lib/offlineStore';
import type { Sopralluogo, Cantiere } from '../types';

interface VerbalePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  sopralluogo: Sopralluogo;
  cantiere?: Cantiere;
}

export const VerbalePdfModal: React.FC<VerbalePdfModalProps> = ({
  isOpen,
  onClose,
  sopralluogo,
  cantiere
}) => {
  const [loadingAssets, setLoadingAssets] = useState(false);

  const [logoStudio, setLogoStudio] = useState<string | null>(null);
  const [timbroFirma, setTimbroFirma] = useState<string | null>(null);

  // Margini A4 in mm (Default: Top 10mm, Bottom 15mm, Laterali 10mm)
  const [marginTopMm, setMarginTopMm] = useState<number>(10);
  const [marginBottomMm, setMarginBottomMm] = useState<number>(15);
  const [marginLateralMm, setMarginLateralMm] = useState<number>(10);
  const [fotoHeightCm, setFotoHeightCm] = useState<number>(5.0);
  const [timbroHeightCm, setTimbroHeightCm] = useState<number>(4.0);
  const [timbroMarginMm, setTimbroMarginMm] = useState<number>(-8);

  // Zoom & Adattamento Responsive Schermo (Cruciale su Smartphone)
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [autoFitScale, setAutoFitScale] = useState<number>(1.0);

  // Paginazione a Fogli A4 separati
  const [pages, setPages] = useState<string[][]>([]);
  const measureContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const applySettings = (data: ImpostazioniStudioCache) => {
      if (data.logo_url) setLogoStudio(data.logo_url);
      if (data.timbro_url) setTimbroFirma(data.timbro_url);
      if (data.margin_top_mm !== null && data.margin_top_mm !== undefined) setMarginTopMm(Number(data.margin_top_mm));
      if (data.margin_bottom_mm !== null && data.margin_bottom_mm !== undefined) setMarginBottomMm(Number(data.margin_bottom_mm));
      if (data.margin_lateral_mm !== null && data.margin_lateral_mm !== undefined) setMarginLateralMm(Number(data.margin_lateral_mm));
      if (data.foto_height_cm !== null && data.foto_height_cm !== undefined) setFotoHeightCm(Number(data.foto_height_cm));
      if (data.timbro_height_cm !== null && data.timbro_height_cm !== undefined) setTimbroHeightCm(Number(data.timbro_height_cm));
      if (data.timbro_margin_mm !== null && data.timbro_margin_mm !== undefined) setTimbroMarginMm(Number(data.timbro_margin_mm));
    };

    const fetchStudioSettings = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          const { data, error } = await supabase
            .from('impostazioni_studio')
            .select('*')
            .eq('id', 'principale')
            .maybeSingle();

          if (!error && data) {
            applySettings(data);
            await setCachedData(OFFLINE_KEYS.IMPOSTAZIONI_STUDIO, data);
            return;
          }
        }

        // Fallback offline su IndexedDB
        const cached = await getCachedData<ImpostazioniStudioCache>(OFFLINE_KEYS.IMPOSTAZIONI_STUDIO);
        if (cached) {
          applySettings(cached);
        }
      } catch (err) {
        console.warn('Recupero impostazioni da cache offline:', err);
        const cached = await getCachedData<ImpostazioniStudioCache>(OFFLINE_KEYS.IMPOSTAZIONI_STUDIO);
        if (cached) applySettings(cached);
      }
    };

    if (isOpen) {
      fetchStudioSettings();
    }
  }, [isOpen]);

  // Calcolo automatico dello zoom "Adatta allo Schermo" su mobile e tablet
  useEffect(() => {
    if (!isOpen) return;

    const calcFit = () => {
      if (typeof window !== 'undefined') {
        const sw = window.innerWidth;
        // 794px è la larghezza nativa di un A4 a 96 DPI (210mm)
        const pad = sw < 640 ? 20 : 48;
        const fit = Math.min(1.0, Math.max(0.3, Number(((sw - pad) / 794).toFixed(3))));
        setAutoFitScale(fit);
        // Su mobile (< 768px), apre automaticamente a schermo intero adattato (100% leggibile, zero tagli!)
        if (sw < 768) {
          setZoomScale(fit);
        } else {
          setZoomScale(1.0);
        }
      }
    };

    calcFit();
    window.addEventListener('resize', calcFit);
    return () => window.removeEventListener('resize', calcFit);
  }, [isOpen]);

  const handlePrint = () => {
    window.print();
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingAssets(true);
    try {
      const ext = file.name.split('.').pop() || 'svg';
      const path = `studio/logo_studio_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('foto-sopralluoghi')
        .upload(path, file, {
          contentType: file.type || 'image/svg+xml',
          upsert: true
        });

      if (upErr) throw upErr;

      const { data: pData } = supabase.storage.from('foto-sopralluoghi').getPublicUrl(path);
      const url = pData.publicUrl;

      const { error: dbErr } = await supabase
        .from('impostazioni_studio')
        .upsert({ id: 'principale', logo_url: url, updated_at: new Date().toISOString() });

      if (dbErr) throw dbErr;

      setLogoStudio(url);
      alert('Logo salvato su Supabase Cloud con successo!');
    } catch (err: any) {
      alert('Errore caricamento logo: ' + err.message);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoStudio(null);
    await supabase
      .from('impostazioni_studio')
      .upsert({ id: 'principale', logo_url: null, updated_at: new Date().toISOString() });
  };

  const handleUploadTimbro = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingAssets(true);
    try {
      const path = `studio/timbro_firma_${Date.now()}.png`;

      const { error: upErr } = await supabase.storage
        .from('foto-sopralluoghi')
        .upload(path, file, {
          contentType: 'image/png',
          upsert: true
        });

      if (upErr) throw upErr;

      const { data: pData } = supabase.storage.from('foto-sopralluoghi').getPublicUrl(path);
      const url = pData.publicUrl;

      const { error: dbErr } = await supabase
        .from('impostazioni_studio')
        .upsert({ id: 'principale', timbro_url: url, updated_at: new Date().toISOString() });

      if (dbErr) throw dbErr;

      setTimbroFirma(url);
      alert('Timbro salvato su Supabase Cloud con successo!');
    } catch (err: any) {
      alert('Errore caricamento timbro: ' + err.message);
    } finally {
      setLoadingAssets(false);
    }
  };

  const updateSettingInDb = async (field: string, value: number) => {
    await supabase
      .from('impostazioni_studio')
      .upsert({ id: 'principale', [field]: value, updated_at: new Date().toISOString() });
  };

  const handleMarginTopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
    setMarginTopMm(val);
    updateSettingInDb('margin_top_mm', val);
  };

  const handleMarginBottomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
    setMarginBottomMm(val);
    updateSettingInDb('margin_bottom_mm', val);
  };

  const handleMarginLateralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
    setMarginLateralMm(val);
    updateSettingInDb('margin_lateral_mm', val);
  };

  const handleTimbroMarginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setTimbroMarginMm(val);
    updateSettingInDb('timbro_margin_mm', val);
  };

  const handleTimbroHeightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseFloat(e.target.value);
    setTimbroHeightCm(val);
    updateSettingInDb('timbro_height_cm', val);
  };

  const handleFotoHeightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseFloat(e.target.value);
    setFotoHeightCm(val);
    updateSettingInDb('foto_height_cm', val);
  };

  const tipo = sopralluogo.tipo_verbale || 'CSE';
  const isCSE = tipo === 'CSE';
  const isDL = tipo === 'DL';
  const isRilievo = tipo === 'RILIEVO';

  const pres = sopralluogo.presenze;
  const committentePres = Boolean(pres?.committente?.presente);
  const committenteNome = pres?.committente?.nome || cantiere?.committente;

  const dlPres = Boolean(pres?.dl?.presente);
  const dlNome = pres?.dl?.nome || cantiere?.direttore_lavori || 'arch. Cavalleri Michele';

  const progettistaPres = Boolean(pres?.progettista?.presente);
  const progettistaNome = pres?.progettista?.nome || cantiere?.progettista;

  const csePres = Boolean(pres?.cse?.presente);
  const cseNome = pres?.cse?.nome || cantiere?.cse || 'arch. Cavalleri Michele';

  const fasiAttive = sopralluogo.fasi_lavoro && sopralluogo.fasi_lavoro.length > 0
    ? sopralluogo.fasi_lavoro.filter(f => f.descrizione && f.descrizione.trim())
    : [];

  const haLavorazioniInCorso = Boolean(sopralluogo.lavorazioni_in_corso && sopralluogo.lavorazioni_in_corso.trim());

  const dispositiviSelezionati = isCSE && sopralluogo.dispositivi_apprestamenti
    ? sopralluogo.dispositivi_apprestamenti.filter(d => d.selezionato)
    : [];

  const paragrafiArgomenti = isCSE && sopralluogo.argomenti_discussi
    ? sopralluogo.argomenti_discussi.split('\n').filter(p => p.trim())
    : [];

  const prescrizioniValide = isCSE && sopralluogo.prescrizioni_lista
    ? sopralluogo.prescrizioni_lista.filter(p => p.testo && p.testo.trim())
    : [];

  const rilieviValidi = (sopralluogo.rilievi || []).filter(r => 
    (r.descrizione && r.descrizione.trim().length > 0) || 
    (r.foto_urls && r.foto_urls.length > 0) ||
    (r.ambiente && r.ambiente.trim().length > 0) ||
    (r.misura_1 && r.misura_1.trim().length > 0) ||
    (r.misura_2 && r.misura_2.trim().length > 0) ||
    (r.misura_3 && r.misura_3.trim().length > 0) ||
    (r.quote_note && r.quote_note.trim().length > 0)
  );

  // Genera la sequenza ordinata di tutti i blocchi logici del documento
  const allBlockIds = useMemo(() => {
    const list: string[] = ['header'];

    if (!isRilievo && (fasiAttive.length > 0 || haLavorazioniInCorso)) {
      list.push('fasi');
    }

    if (isCSE && dispositiviSelezionati.length > 0) {
      list.push('dispositivi');
    }

    if (isCSE && paragrafiArgomenti.length > 0) {
      list.push('argomenti');
    }

    if (isDL && sopralluogo.ordini_servizio?.trim()) {
      list.push('ordini');
    }

    if (isCSE && sopralluogo.sospensione_lavori && sopralluogo.motivo_sospensione?.trim()) {
      list.push('sospensione');
    }

    if (isCSE && prescrizioniValide.length > 0) {
      list.push('prescrizioni');
    }

    if (rilieviValidi.length > 0) {
      list.push('rilievi_header');
      rilieviValidi.forEach((_, idx) => {
        list.push(`rilievo_${idx}`);
      });
    }

    list.push('firma');
    return list;
  }, [
    isRilievo,
    fasiAttive.length,
    haLavorazioniInCorso,
    isCSE,
    dispositiviSelezionati.length,
    paragrafiArgomenti.length,
    isDL,
    sopralluogo.ordini_servizio,
    sopralluogo.sospensione_lavori,
    sopralluogo.motivo_sospensione,
    prescrizioniValide.length,
    rilieviValidi
  ]);

  // Motore di misurazione e paginazione dinamica con protezione anti-titoletti orfani
  useEffect(() => {
    if (!isOpen || !measureContainerRef.current) return;

    const container = measureContainerRef.current;
    const elements = container.querySelectorAll<HTMLElement>('[data-block-id]');
    const heightsMap: Record<string, number> = {};

    elements.forEach(el => {
      const id = el.getAttribute('data-block-id');
      if (id) {
        heightsMap[id] = el.getBoundingClientRect().height;
      }
    });

    const pxPerMm = 794 / 210; // ~3.78 px/mm
    // Altezza stampabile utile per foglio (297mm meno margini sup e inf con buffer di sicurezza 16px)
    const printableHeightPx = Math.max(200, (297 - marginTopMm - marginBottomMm) * pxPerMm - 16);

    const computedPages: string[][] = [[]];
    let currentH = 0;

    for (let i = 0; i < allBlockIds.length; i++) {
      const bId = allBlockIds[i];
      const bH = heightsMap[bId] || 0;

      // 1. PROTEZIONE ANTI-TITOLETTO ORFANO PER RILIEVI FOTOGRAFICI:
      // Se il titolo della sezione fotografica non ci sta insieme alla prima scheda foto, spostali entrambi nel nuovo foglio!
      if (bId === 'rilievi_header' && allBlockIds[i + 1]?.startsWith('rilievo_')) {
        const firstRilievoH = heightsMap[allBlockIds[i + 1]] || 0;
        if (currentH > 0 && currentH + bH + firstRilievoH > printableHeightPx) {
          computedPages.push([]);
          currentH = 0;
        }
      }

      // 2. Se il blocco sfora lo spazio rimanente della pagina attuale, apri un nuovo foglio
      if (currentH > 0 && currentH + bH > printableHeightPx) {
        computedPages.push([]);
        currentH = 0;
      }

      computedPages[computedPages.length - 1].push(bId);
      currentH += bH;
    }

    setPages(computedPages);
  }, [
    isOpen,
    sopralluogo,
    cantiere,
    logoStudio,
    timbroFirma,
    marginTopMm,
    marginBottomMm,
    marginLateralMm,
    fotoHeightCm,
    timbroHeightCm,
    timbroMarginMm,
    allBlockIds
  ]);

  if (!isOpen) return null;

  // Funzione di render modulare per ciascun blocco logico del verbale
  const renderBlock = (blockId: string) => {
    switch (blockId) {
      case 'header':
        return (
          <div className="mb-4">
            {/* LOGO STUDIO */}
            {logoStudio && (
              <div className="w-full mb-4 text-center mt-0 pt-0">
                <img 
                  src={logoStudio} 
                  alt="Logo Studio" 
                  className="w-full max-h-28 object-contain mx-auto block mt-0 pt-0"
                />
              </div>
            )}

            {/* TITOLO VERBALE CALIBRATO SUL RUOLO */}
            <div className="text-center mb-4">
              <h1 className="text-base sm:text-lg font-black tracking-wide uppercase border-b-2 border-neutral-900 inline-block pb-1">
                {isDL 
                  ? 'Verbale di Sopralluogo della Direzione Lavori'
                  : isRilievo
                    ? 'Sopralluogo/Rilievo'
                    : 'Verbale di Sopralluogo e Coordinamento della Sicurezza'}
              </h1>
              <p className="text-[8.5pt] text-neutral-600 font-semibold uppercase tracking-wider mt-1">
                {isDL
                  ? 'Accertamento dello stato delle opere, andamento del cantiere e disposizioni di servizio'
                  : isRilievo
                    ? 'Documentazione dello stato dei luoghi, accertamenti dimensionali e rilievi visivi'
                    : 'D.Lgs. 9 aprile 2008, n. 81 e s.m.i. - Art. 92'}
              </p>
            </div>

            {/* DATI CANTIERE */}
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-6 text-[9.5pt] mb-4 bg-neutral-50 p-3 border border-neutral-300 rounded">
              <div>
                <span className="font-bold text-neutral-600 block text-[8.5pt]">Cantiere:</span>
                <span className="font-bold text-neutral-900 text-[10pt]">{cantiere?.nome || 'Cantiere'}</span>
                {cantiere?.indirizzo && (
                  <p className="text-[8.5pt] text-neutral-500 mt-0.5">{cantiere.indirizzo}</p>
                )}
              </div>
              <div>
                <span className="font-bold text-neutral-600 block text-[8.5pt]">Data:</span>
                <span className="font-bold text-neutral-900">{sopralluogo.data || '—'}</span>
              </div>
              {cantiere?.committente && (
                <div>
                  <span className="font-bold text-neutral-600 block text-[8.5pt]">Committente:</span>
                  <span className="font-semibold text-neutral-900">{cantiere.committente}</span>
                </div>
              )}
              {sopralluogo.ora && (
                <div>
                  <span className="font-bold text-neutral-600 block text-[8.5pt]">Ora:</span>
                  <span className="font-semibold text-neutral-900">{sopralluogo.ora}</span>
                </div>
              )}
            </div>

            {/* CONDIZIONI METEO (SPECIFICO DL) */}
            {isDL && sopralluogo.condizioni_meteo?.trim() && (
              <div className="mb-3.5 p-2 bg-blue-50/60 border border-blue-200 rounded text-[9pt]">
                <span className="font-bold text-blue-900 uppercase text-[8.5pt] block mb-0.5">
                  Condizioni Meteo & Operatività Cantiere:
                </span>
                <p className="text-neutral-800">{sopralluogo.condizioni_meteo}</p>
              </div>
            )}

            {/* NOTE GENERALI RILIEVO (SPECIFICO RILIEVO) */}
            {isRilievo && sopralluogo.note_tecniche?.trim() && (
              <div className="mb-3.5 p-2 bg-emerald-50/60 border border-emerald-200 rounded text-[9pt]">
                <span className="font-bold text-emerald-900 uppercase text-[8.5pt] block mb-0.5">
                  Premesse e Finalità del Rilievo Tecnico:
                </span>
                <p className="text-neutral-800 whitespace-pre-wrap">{sopralluogo.note_tecniche}</p>
              </div>
            )}

            {/* FORMULA INTRODUTTIVA */}
            <p className="text-[8.5pt] text-neutral-700 italic mb-3 leading-normal">
              {isDL
                ? "In data odierna il Direttore dei Lavori ha effettuato il sopralluogo in cantiere alla presenza delle seguenti persone:"
                : isRilievo
                  ? "In data odierna sono state effettuate le operazioni di rilievo visivo e dimensionale con la presenza dei seguenti soggetti:"
                  : "Al fine di promuovere il coordinamento, nonché di assicurare l'applicazione delle disposizioni contenute nel piano di sicurezza e coordinamento e delle relative procedure di lavoro ai sensi del D.Lgs. 81/2008 sono convenute le seguenti persone:"}
            </p>

            {/* SOGGETTI CONVENUTI */}
            <div className="space-y-0.5 text-[9pt] mb-3 pl-3 border-l-2 border-neutral-400">
              {isDL && <p><strong>Direttore dei Lavori (DL):</strong> {dlNome}</p>}
              {isCSE && <p><strong>Coordinatore Sicurezza (CSE):</strong> {cseNome}</p>}
              {isRilievo && <p><strong>Tecnico Incaricato del Rilievo:</strong> {cseNome || dlNome}</p>}
              {committentePres && <p><strong>Committente:</strong> {committenteNome}</p>}
              {!isDL && dlPres && <p><strong>Direttore dei Lavori (DL):</strong> {dlNome}</p>}
              {progettistaPres && <p><strong>Progettista:</strong> {progettistaNome}</p>}
              {!isCSE && csePres && <p><strong>Coordinatore Sicurezza (CSE):</strong> {cseNome}</p>}

              {!isRilievo && sopralluogo.imprese_presenti && sopralluogo.imprese_presenti.length > 0 && (
                <div className="pt-1">
                  <span className="font-bold block text-neutral-800 mb-0.5">
                    {isDL ? 'Imprese e Maestranze presenti in cantiere:' : 'Imprese ed Esecutori presenti:'}
                  </span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pl-1">
                    {sopralluogo.imprese_presenti.map((impString, idx) => (
                      <div key={idx} className="truncate">&bull; {impString}</div>
                    ))}
                  </div>
                  {isDL && sopralluogo.operai_totali ? (
                    <div className="text-[8.5pt] font-semibold text-blue-900 mt-0.5 pl-1">
                      Maestranze totali presenti: {sopralluogo.operai_totali} operai
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        );

      case 'fasi':
        return (
          <div className="mb-4">
            <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
              {isDL
                ? 'Avanzamento opere e lavorazioni in corso:'
                : isRilievo
                  ? 'Lavorazioni in svolgimento al momento del rilievo:'
                  : 'Le fasi di lavoro in svolgimento alla data odierna sono:'}
            </h3>
            {fasiAttive.length > 0 ? (
              <div className="space-y-1 text-[9.5pt] pl-2">
                {fasiAttive.map((f, idx) => (
                  <div key={f.id || idx}>
                    <span>&bull; {f.descrizione}</span>
                    {f.impresa && <span className="text-neutral-600 font-semibold ml-2">— {f.impresa}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9.5pt] text-neutral-800 whitespace-pre-wrap pl-2 leading-relaxed">
                {sopralluogo.lavorazioni_in_corso}
              </p>
            )}
          </div>
        );

      case 'dispositivi':
        return (
          <div className="mb-4">
            <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
              Verifica ai dispositivi e apprestamenti di sicurezza:
            </h3>
            <div className="space-y-1 text-[9.5pt]">
              {dispositiviSelezionati.map((disp, idx) => (
                <div key={disp.id || idx} className="flex items-start gap-2 pl-2">
                  <span className="font-mono text-sm leading-none">☒</span>
                  <div>
                    <span className="font-semibold text-neutral-900">{disp.nome}</span>
                    {disp.note && <span className="text-neutral-700 ml-2">&bull; {disp.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'argomenti':
        return (
          <div className="mb-4">
            <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
              Nel corso della riunione sono stati discussi i seguenti argomenti:
            </h3>
            <div className="space-y-1 text-[9.5pt] pl-2 leading-relaxed text-neutral-800 whitespace-pre-wrap">
              {paragrafiArgomenti.map((par, pIdx) => (
                <p key={pIdx}>{par}</p>
              ))}
            </div>
          </div>
        );

      case 'ordini':
        return (
          <div className="mb-4 p-3 bg-neutral-50 border border-neutral-300 rounded">
            <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
              Ordini di Servizio & Disposizioni della Direzione Lavori:
            </h3>
            <p className="text-[9.5pt] text-neutral-800 whitespace-pre-wrap pl-2 leading-relaxed">
              {sopralluogo.ordini_servizio}
            </p>
          </div>
        );

      case 'sospensione':
        return (
          <div className="mb-4 p-3 bg-neutral-100 border-2 border-neutral-900 text-xs">
            <h4 className="font-black uppercase text-neutral-900 mb-1">
              DISPOSIZIONE DI SOSPENSIONE DEI LAVORI (Art. 92 c.1 lett. f D.Lgs. 81/08):
            </h4>
            <p>{sopralluogo.motivo_sospensione}</p>
          </div>
        );

      case 'prescrizioni':
        return (
          <div className="mb-4">
            <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
              Disposizioni e Misure Prescrittive Impartite dal CSE:
            </h3>
            <div className="space-y-1 text-[9.5pt] pl-2">
              {prescrizioniValide.map((p, idx) => (
                <div key={p.id || idx} className="flex justify-between items-baseline border-b border-neutral-200 pb-0.5">
                  <span>
                    &bull; {p.testo}{' '}
                    {p.impresa_destinataria ? `(Destinatario: ${p.impresa_destinataria})` : ''}
                  </span>
                  {p.data_scadenza && (
                    <span className="text-[8.5pt] text-neutral-600 font-mono">
                      Termine: {p.data_scadenza}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'rilievi_header':
        return (
          <div className="mb-3">
            <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
              {isRilievo
                ? 'Rilievo fotografico'
                : isDL
                  ? 'Documentazione Fotografica di Avanzamento Opere:'
                  : 'Rilievi Visivi e Documentazione Fotografica:'}
            </h3>
          </div>
        );

      case 'firma':
        return (
          <div className="pt-6 mt-6 border-t border-neutral-300 flex justify-end">
            <div className="text-center min-w-[260px]">
              <p className="font-bold text-[9.5pt] text-neutral-900 leading-none">
                {sopralluogo.tipo_verbale === 'DL'
                  ? 'Il Direttore dei Lavori (DL)'
                  : sopralluogo.tipo_verbale === 'RILIEVO'
                    ? 'Il Tecnico Incaricato del Rilievo'
                    : 'Il Coordinatore per la Sicurezza (CSE)'}
              </p>
              
              <div 
                style={{ marginTop: `${timbroMarginMm}mm` }} 
                className="flex items-center justify-center transition-all"
              >
                {timbroFirma ? (
                  <img 
                    src={timbroFirma} 
                    alt="Timbro e Firma" 
                    style={{ height: `${timbroHeightCm}cm`, width: 'auto' }}
                    className="max-w-[280px] object-contain mx-auto block"
                  />
                ) : (
                  <div className="border-b border-neutral-400 w-48 mx-auto mt-6"></div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        if (blockId.startsWith('rilievo_')) {
          const idx = parseInt(blockId.replace('rilievo_', ''), 10);
          const r = rilieviValidi[idx];
          if (!r) return null;

          return (
            <div className="text-[9.5pt] mb-3 p-2.5 rounded border border-neutral-200 bg-neutral-50/50">
              {r.ambiente?.trim() && (
                <div className="font-bold text-neutral-900 text-[9pt] uppercase tracking-wide mb-1.5 text-amber-800">
                  Ambiente / Posizione: {r.ambiente.trim()}
                </div>
              )}

              {/* Misure Opzionali */}
              {(r.misura_1?.trim() || r.misura_2?.trim() || r.misura_3?.trim() || r.quote_note?.trim()) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9pt] text-neutral-700 bg-neutral-100 px-2.5 py-1 rounded border border-neutral-200 mb-2">
                  <span className="font-bold text-neutral-900 uppercase text-[8pt]">Misure:</span>
                  {r.misura_1?.trim() && (
                    <span><strong className="text-neutral-800">1:</strong> {r.misura_1.trim()}</span>
                  )}
                  {r.misura_2?.trim() && (
                    <span><strong className="text-neutral-800">2:</strong> {r.misura_2.trim()}</span>
                  )}
                  {r.misura_3?.trim() && (
                    <span><strong className="text-neutral-800">3:</strong> {r.misura_3.trim()}</span>
                  )}
                  {!r.misura_1?.trim() && !r.misura_2?.trim() && !r.misura_3?.trim() && r.quote_note?.trim() && (
                    <span>{r.quote_note.trim()}</span>
                  )}
                </div>
              )}

              {r.descrizione?.trim() && (
                <p className="font-medium text-neutral-800 mb-2">&bull; {r.descrizione.trim()}</p>
              )}

              {r.foto_urls && r.foto_urls.length > 0 && (
                <div className="flex flex-wrap items-start gap-3">
                  {r.foto_urls.map((url, fIdx) => (
                    <img 
                      key={fIdx} 
                      src={url} 
                      alt="Foto allegata" 
                      style={{ height: `${fotoHeightCm}cm`, width: 'auto' }}
                      className="max-w-full rounded border border-neutral-300 object-contain shadow-xs inline-block"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        }
        return null;
    }
  };

  const activePages = pages.length > 0 ? pages : [allBlockIds];

  // UTILIZZO DI REACT PORTAL: il modale viene renderizzato direttamente in document.body
  return createPortal(
    <div id="print-portal-root">
      {/* REGOLE DI STAMPA A4: ISOLAMENTO ASSOLUTO DALL'APPLICAZIONE */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: ${marginTopMm}mm ${marginLateralMm}mm ${marginBottomMm}mm ${marginLateralMm}mm !important;
        }

        @media print {
          /* 1. NASCONDE TOTALMENTE TUTTA L'APPLICAZIONE REACT E LA TOOLBAR */
          #root, .print-hidden {
            display: none !important;
          }

          /* 2. Mostra esclusivamente il portale del verbale */
          #print-portal-root {
            display: block !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #111 !important;
            overflow: visible !important;
          }

          html, body {
            background: white !important;
            color: #111 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-modal-wrapper {
            position: static !important;
            display: block !important;
            background: white !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .sheet-scaler-wrapper {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .sheet-outer-crop {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-sheet-a4 {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            height: auto !important;
            transform: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            font-size: 10pt !important;
            line-height: 1.5 !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          /* L'ultimo foglio non deve generare una pagina bianca vuota alla fine */
          .sheet-scaler-wrapper:last-child .print-sheet-a4 {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>

      {/* ANTEPRIMA A MONITOR A SCHERMO INTERO */}
      <div className="fixed inset-0 bg-slate-950/95 z-[9999] flex flex-col items-center overflow-y-auto print-modal-wrapper">
        
        {/* BARRA DEGLI STRUMENTI (Nascosta in stampa) */}
        <header className="sticky top-0 left-0 right-0 z-[10000] w-full bg-slate-900 border-b border-slate-800 shadow-xl px-3 sm:px-4 py-2 print-hidden backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 text-xs">
            
            {/* Controlli Personalizzazione Documento */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Carica Logo */}
              <label className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 cursor-pointer transition text-xs">
                {loadingAssets ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> : <Upload className="w-3.5 h-3.5 text-amber-400" />}
                <span>{logoStudio ? 'Cambia Logo' : 'Carica Logo'}</span>
                <input 
                  type="file" 
                  accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" 
                  onChange={handleUploadLogo} 
                  disabled={loadingAssets}
                  className="hidden" 
                />
              </label>

              {logoStudio && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer text-xs"
                >
                  Rimuovi Logo
                </button>
              )}

              {/* Carica Timbro PNG */}
              <label className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 cursor-pointer transition text-xs">
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>{timbroFirma ? 'Cambia Timbro' : 'Carica Timbro'}</span>
                <input 
                  type="file" 
                  accept="image/png,image/webp" 
                  onChange={handleUploadTimbro} 
                  disabled={loadingAssets}
                  className="hidden" 
                />
              </label>

              {/* Margini */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-slate-300">
                <span className="font-bold text-amber-400">Margini:</span>
                <label className="flex items-center gap-0.5">
                  <span className="text-slate-400 text-[11px]">S</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={marginTopMm}
                    onChange={handleMarginTopChange}
                    className="w-8 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-white font-mono text-[11px]"
                  />
                </label>
                <label className="flex items-center gap-0.5">
                  <span className="text-slate-400 text-[11px]">I</span>
                  <input
                    type="number"
                    min="0"
                    max="35"
                    value={marginBottomMm}
                    onChange={handleMarginBottomChange}
                    className="w-8 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-white font-mono text-[11px]"
                  />
                </label>
                <label className="flex items-center gap-0.5">
                  <span className="text-slate-400 text-[11px]">L</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={marginLateralMm}
                    onChange={handleMarginLateralChange}
                    className="w-8 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-white font-mono text-[11px]"
                  />
                </label>
                <span className="text-slate-500 text-[10px]">mm</span>
              </div>

              {/* Distanza Timbro */}
              {timbroFirma && (
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-slate-300">
                  <MoveVertical className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px]">Firma:</span>
                  <input
                    type="range"
                    min="-25"
                    max="15"
                    step="1"
                    value={timbroMarginMm}
                    onChange={handleTimbroMarginChange}
                    className="w-14 accent-amber-500 cursor-pointer"
                  />
                  <span className="font-mono text-white text-[10px] w-7 text-right">{timbroMarginMm}mm</span>
                </div>
              )}

              {/* Dimensione Timbro */}
              {timbroFirma && (
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-slate-300">
                  <span className="text-[11px]">H.Timbro:</span>
                  <select
                    value={timbroHeightCm}
                    onChange={handleTimbroHeightChange}
                    className="bg-slate-900 text-white font-bold text-xs p-0.5 rounded border border-slate-700 cursor-pointer"
                  >
                    <option value="3">3cm</option>
                    <option value="4">4cm</option>
                    <option value="5">5cm</option>
                    <option value="6">6cm</option>
                  </select>
                </div>
              )}

              {/* Altezza Foto */}
              <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-slate-300">
                <Sliders className="w-3 h-3 text-emerald-400" />
                <span className="text-[11px]">H.Foto:</span>
                <select
                  value={fotoHeightCm}
                  onChange={handleFotoHeightChange}
                  className="bg-slate-900 text-white font-bold text-xs p-0.5 rounded border border-slate-700 cursor-pointer"
                >
                  <option value="4">4cm</option>
                  <option value="5">5cm</option>
                  <option value="6">6cm</option>
                </select>
              </div>
            </div>

            {/* Controlli Zoom Schermo & Azioni di Stampa */}
            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              {/* Controlli Zoom (Salva-vita su smartphone) */}
              <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-slate-300">
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.max(0.3, Number((prev - 0.1).toFixed(2))))}
                  className="p-1 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
                  title="Rimpicciolisci zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(autoFitScale)}
                  className={`px-2 py-0.5 text-[11px] rounded transition font-semibold cursor-pointer ${
                    Math.abs(zoomScale - autoFitScale) < 0.05
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'hover:text-white hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Adatta larghezza foglio allo schermo"
                >
                  Adatta
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(1.0)}
                  className={`px-2 py-0.5 text-[11px] rounded transition font-semibold cursor-pointer ${
                    Math.abs(zoomScale - 1.0) < 0.05
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'hover:text-white hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Dimensione reale 100%"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.min(1.8, Number((prev + 0.1).toFixed(2))))}
                  className="p-1 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
                  title="Ingrandisci zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-slate-400 font-mono w-9 text-right hidden xs:inline-block">
                  {Math.round(zoomScale * 100)}%
                </span>
              </div>

              {/* Pulsante Stampa / Salva in PDF */}
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center gap-1.5 shadow-lg transition cursor-pointer text-xs"
                title="Apre la finestra ufficiale di stampa con i fogli A4 separati e salva in PDF"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Stampa / Salva in PDF</span>
                <span className="sm:hidden">Stampa PDF</span>
              </button>

              {/* Pulsante Chiudi */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

          </div>
        </header>

        {/* FOGLI A4 SEPARATI CON CORRISPONDENZA 1:1 ALLA STAMPA */}
        <div className="w-full flex-1 flex flex-col items-center py-6 px-2 sm:px-4">
          {activePages.map((pageBlockIds, pageIdx) => (
            <div 
              key={pageIdx} 
              className="sheet-scaler-wrapper flex flex-col items-center"
              style={{
                width: `${794 * zoomScale}px`,
                marginBottom: `${32 * zoomScale}px`,
              }}
            >
              {/* BADGE NUMERO DI PAGINA SOPRA IL FOGLIO A MONITOR */}
              <div 
                className="w-full flex justify-between items-center mb-1.5 px-1 text-slate-400 text-xs font-mono print-hidden select-none"
              >
                <span className="font-semibold text-slate-300">Foglio {pageIdx + 1} di {activePages.length}</span>
                <span className="text-[11px] text-slate-500">Formato A4 (210 &times; 297 mm)</span>
              </div>

              {/* CONTENITORE DI SCALA FISICO PER VISUALIZZAZIONE SCHERMO */}
              <div
                style={{
                  width: `${794 * zoomScale}px`,
                  height: `${1123 * zoomScale}px`,
                  overflow: 'hidden',
                }}
                className="sheet-outer-crop relative shadow-2xl rounded-sm"
              >
                <div
                  style={{
                    width: '794px',
                    height: '1123px',
                    paddingTop: `${marginTopMm}mm`,
                    paddingBottom: `${marginBottomMm}mm`,
                    paddingLeft: `${marginLateralMm}mm`,
                    paddingRight: `${marginLateralMm}mm`,
                    transform: `scale(${zoomScale})`,
                    transformOrigin: 'top left',
                  }}
                  className="print-sheet-a4 bg-white text-neutral-900 text-[10pt] leading-relaxed font-sans relative"
                >
                  {/* Blocchi assegnati a questo foglio */}
                  {pageBlockIds.map(blockId => (
                    <React.Fragment key={blockId}>
                      {renderBlock(blockId)}
                    </React.Fragment>
                  ))}

                  {/* Numero di pagina in calce */}
                  <div 
                    className="absolute right-4 text-[8pt] text-neutral-400 font-mono select-none"
                    style={{ bottom: `${Math.max(4, marginBottomMm / 2)}mm` }}
                  >
                    Pag. {pageIdx + 1} di {activePages.length}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CONTENITORE NASCOSTO DI MISURAZIONE CALIBRATO SU LARGHEZZA UTILE A4 */}
        <div
          ref={measureContainerRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: '-9999px',
            width: '794px',
            visibility: 'hidden',
            pointerEvents: 'none',
            paddingLeft: `${marginLateralMm}mm`,
            paddingRight: `${marginLateralMm}mm`,
          }}
          className="font-sans text-[10pt] leading-relaxed"
        >
          {allBlockIds.map(blockId => (
            <div key={blockId} data-block-id={blockId} className="w-full">
              {renderBlock(blockId)}
            </div>
          ))}
        </div>

      </div>
    </div>,
    document.body
  );
};

export default VerbalePdfModal;
