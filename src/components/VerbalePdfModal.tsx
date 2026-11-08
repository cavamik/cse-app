import React, { useState } from 'react';
import { X, Printer, Upload, Image as ImageIcon, Sliders, MoveVertical } from 'lucide-react';
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
  // Logo Studio
  const [logoStudio, setLogoStudio] = useState<string | null>(() => {
    try {
      return localStorage.getItem('cse_logo_studio') || null;
    } catch {
      return null;
    }
  });

  // Timbro e Firma PNG
  const [timbroFirma, setTimbroFirma] = useState<string | null>(() => {
    try {
      return localStorage.getItem('cse_timbro_firma') || null;
    } catch {
      return null;
    }
  });

  // Margini di stampa in mm (Default: Top 10mm, Bottom 15mm, Laterali 10mm)
  const [marginTopMm, setMarginTopMm] = useState<number>(() => {
    const s = localStorage.getItem('cse_margin_top');
    return s ? parseInt(s, 10) : 10;
  });

  const [marginBottomMm, setMarginBottomMm] = useState<number>(() => {
    const s = localStorage.getItem('cse_margin_bottom');
    return s ? parseInt(s, 10) : 15;
  });

  const [marginLateralMm, setMarginLateralMm] = useState<number>(() => {
    const s = localStorage.getItem('cse_margin_lateral');
    return s ? parseInt(s, 10) : 10;
  });

  // Altezza Foto in cm (default 5 cm)
  const [fotoHeightCm, setFotoHeightCm] = useState<number>(() => {
    const saved = localStorage.getItem('cse_foto_height_cm');
    return saved ? parseFloat(saved) : 5.0;
  });

  // Altezza Timbro in cm (default 4 cm)
  const [timbroHeightCm, setTimbroHeightCm] = useState<number>(() => {
    const saved = localStorage.getItem('cse_timbro_height_cm');
    return saved ? parseFloat(saved) : 4.0;
  });

  // Distanza Timbro dal testo in mm (default -8mm per annullare il bordo trasparente)
  const [timbroMarginMm, setTimbroMarginMm] = useState<number>(() => {
    const saved = localStorage.getItem('cse_timbro_margin_mm');
    return saved ? parseInt(saved, 10) : -8;
  });

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setLogoStudio(url);
        try {
          localStorage.setItem('cse_logo_studio', url);
        } catch (err) {
          console.warn('Spazio localStorage limitato', err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoStudio(null);
    localStorage.removeItem('cse_logo_studio');
  };

  const handleUploadTimbro = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setTimbroFirma(url);
        try {
          localStorage.setItem('cse_timbro_firma', url);
        } catch (err) {
          console.warn('Spazio localStorage limitato', err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMarginTopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
    setMarginTopMm(val);
    localStorage.setItem('cse_margin_top', val.toString());
  };

  const handleMarginBottomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
    setMarginBottomMm(val);
    localStorage.setItem('cse_margin_bottom', val.toString());
  };

  const handleMarginLateralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
    setMarginLateralMm(val);
    localStorage.setItem('cse_margin_lateral', val.toString());
  };

  const handleTimbroMarginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setTimbroMarginMm(val);
    localStorage.setItem('cse_timbro_margin_mm', val.toString());
  };

  const handleTimbroHeightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseFloat(e.target.value);
    setTimbroHeightCm(val);
    localStorage.setItem('cse_timbro_height_cm', val.toString());
  };

  const handleFotoHeightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseFloat(e.target.value);
    setFotoHeightCm(val);
    localStorage.setItem('cse_foto_height_cm', val.toString());
  };

  // Lettura e risoluzione presenze
  const pres = sopralluogo.presenze;
  const committentePres = pres?.committente?.presente;
  const committenteNome = pres?.committente?.nome || cantiere?.committente;
  const dlPres = pres?.dl?.presente;
  const dlNome = pres?.dl?.nome || cantiere?.direttore_lavori;
  const progettistaPres = pres?.progettista?.presente;
  const progettistaNome = pres?.progettista?.nome || cantiere?.progettista;
  const cseNome = pres?.cse?.nome || cantiere?.cse || 'arch. Cavalleri Michele';

  // Divisione paragrafi argomenti discussi
  const paragrafiArgomenti = sopralluogo.argomenti_discussi
    ? sopralluogo.argomenti_discussi.split('\n').filter(p => p.trim())
    : [];

  // Fasi di lavoro attive
  const fasiAttive = sopralluogo.fasi_lavoro && sopralluogo.fasi_lavoro.length > 0
    ? sopralluogo.fasi_lavoro.filter(f => f.descrizione.trim())
    : [];

  // Dispositivi attivi
  const dispositiviAttivi = sopralluogo.dispositivi_apprestamenti || [];

  return (
    <>
      {/* REGOLE DI STAMPA A4: MARGINI BLINDATI E ANTI-ORFANO GLOBALE */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: ${marginTopMm}mm ${marginLateralMm}mm ${marginBottomMm}mm ${marginLateralMm}mm !important;
        }

        @media print {
          header, nav, main, footer, .print-hidden {
            display: none !important;
          }

          html, body, #root {
            background: white !important;
            color: #111 !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Impedisce la rottura di pagina immediatamente successiva a qualsiasi titolo */
          h1, h2, h3, h4, h5, h6 {
            break-after: avoid !important;
            page-break-after: avoid !important;
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

          .print-sheet-a4 {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            font-size: 10pt !important;
            line-height: 1.5 !important;
          }

          /* Blocco vincolato indivisibile */
          .avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* ANTEPRIMA A MONITOR A SCHERMO INTERO */}
      <div className="fixed inset-0 bg-slate-950/90 z-50 flex flex-col items-center overflow-y-auto print-modal-wrapper">
        
        {/* BARRA DEGLI STRUMENTI (Nascosta in stampa) */}
        <header className="sticky top-0 left-0 right-0 z-50 w-full bg-slate-900 border-b border-slate-800 shadow-xl px-4 py-2.5 print-hidden backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Carica Logo */}
              <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 cursor-pointer transition">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>{logoStudio ? 'Sostituisci Logo' : 'Carica Logo (SVG)'}</span>
                <input 
                  type="file" 
                  accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" 
                  onChange={handleUploadLogo} 
                  className="hidden" 
                />
              </label>

              {logoStudio && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="px-2 py-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                >
                  Rimuovi Logo
                </button>
              )}

              {/* Carica Timbro */}
              <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 cursor-pointer transition">
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>{timbroFirma ? 'Cambia Timbro PNG' : 'Carica Timbro PNG'}</span>
                <input 
                  type="file" 
                  accept="image/png,image/webp" 
                  onChange={handleUploadTimbro} 
                  className="hidden" 
                />
              </label>

              {/* CONTROLLO MARGINI FOGLIO A4 (in mm) */}
              <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                <span className="font-bold text-amber-400">Margini:</span>
                <label className="flex items-center gap-1">
                  <span className="text-slate-400">Sup</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={marginTopMm}
                    onChange={handleMarginTopChange}
                    className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-white font-mono"
                    title="Margine superiore in millimetri"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-slate-400">Inf</span>
                  <input
                    type="number"
                    min="0"
                    max="35"
                    value={marginBottomMm}
                    onChange={handleMarginBottomChange}
                    className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-white font-mono"
                    title="Margine inferiore in millimetri"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-slate-400">Lat</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={marginLateralMm}
                    onChange={handleMarginLateralChange}
                    className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-white font-mono"
                    title="Margine sinistro e destro in millimetri"
                  />
                </label>
                <span className="text-slate-500 text-[10px]">mm</span>
              </div>

              {/* Distanza Timbro */}
              {timbroFirma && (
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                  <MoveVertical className="w-3.5 h-3.5 text-amber-400" />
                  <span>Firma:</span>
                  <input
                    type="range"
                    min="-25"
                    max="15"
                    step="1"
                    value={timbroMarginMm}
                    onChange={handleTimbroMarginChange}
                    className="w-16 accent-amber-500 cursor-pointer"
                  />
                  <span className="font-mono text-white text-[11px] w-9 text-right">{timbroMarginMm}mm</span>
                </div>
              )}

              {/* Dimensione Timbro */}
              {timbroFirma && (
                <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                  <span>H. Timbro:</span>
                  <select
                    value={timbroHeightCm}
                    onChange={handleTimbroHeightChange}
                    className="bg-slate-900 text-white font-bold text-xs p-1 rounded border border-slate-700 cursor-pointer"
                  >
                    <option value="3">3 cm</option>
                    <option value="4">4 cm</option>
                    <option value="5">5 cm</option>
                    <option value="6">6 cm</option>
                  </select>
                </div>
              )}

              {/* Altezza Foto */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                <Sliders className="w-3 h-3 text-emerald-400" />
                <span>H. Foto:</span>
                <select
                  value={fotoHeightCm}
                  onChange={handleFotoHeightChange}
                  className="bg-slate-900 text-white font-bold text-xs p-1 rounded border border-slate-700 cursor-pointer"
                >
                  <option value="4">4 cm</option>
                  <option value="5">5 cm</option>
                  <option value="6">6 cm</option>
                </select>
              </div>
            </div>

            {/* Pulsante Stampa */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center gap-1.5 shadow-lg transition cursor-pointer"
                title="Stampa o Salva in formato PDF"
              >
                <Printer className="w-4 h-4" />
                <span>Stampa / Salva in PDF</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

          </div>
        </header>

        {/* FOGLIO A4 CON MARGINI CORRISPONDENTI (100% Fedele al PDF) */}
        <div className="w-full flex-1 flex justify-center py-6 px-4">
          <div 
            id="foglio-verbale-stampa"
            className="print-sheet-a4 bg-white text-neutral-900 w-[210mm] min-h-[297mm] shadow-2xl rounded-sm text-[10pt] leading-relaxed font-sans"
            style={{
              paddingTop: `${marginTopMm}mm`,
              paddingBottom: `${marginBottomMm}mm`,
              paddingLeft: `${marginLateralMm}mm`,
              paddingRight: `${marginLateralMm}mm`,
            }}
          >
            
            {/* 1. LOGO A TUTTA LARGHEZZA A FILO DEL MARGINE SUPERIORE */}
            {logoStudio && (
              <div className="w-full mb-5 avoid-break text-center mt-0 pt-0">
                <img 
                  src={logoStudio} 
                  alt="Logo Studio" 
                  className="w-full max-h-32 object-contain mx-auto block mt-0 pt-0"
                />
              </div>
            )}

            {/* 2. TITOLO VERBALE */}
            <div className="text-center mb-5 avoid-break">
              <h1 className="text-base sm:text-lg font-black tracking-wide uppercase border-b-2 border-neutral-900 inline-block pb-1">
                VERBALE DI SOPRALLUOGO E COORDINAMENTO
              </h1>
            </div>

            {/* 3. DATI CANTIERE */}
            <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-[9.5pt] mb-5 bg-neutral-50 p-3.5 border border-neutral-300 rounded avoid-break">
              <div>
                <span className="font-bold text-neutral-600 block text-[9pt]">Cantiere:</span>
                <span className="font-bold text-neutral-900 text-[10.5pt]">{cantiere?.nome || 'N.D.'}</span>
                <p className="text-[9pt] text-neutral-500 mt-0.5">{cantiere?.indirizzo}</p>
              </div>
              <div>
                <span className="font-bold text-neutral-600 block text-[9pt]">Data:</span>
                <span className="font-bold text-neutral-900">{sopralluogo.data}</span>
              </div>
              <div>
                <span className="font-bold text-neutral-600 block text-[9pt]">Committente:</span>
                <span className="font-semibold text-neutral-900">{cantiere?.committente || 'N.D.'}</span>
              </div>
              <div>
                <span className="font-bold text-neutral-600 block text-[9pt]">Ora:</span>
                <span className="font-semibold text-neutral-900">{sopralluogo.ora || 'N.D.'}</span>
              </div>
            </div>

            {/* 4. FORMULA NORMATIVA */}
            <p className="text-[9pt] text-neutral-700 italic mb-4 leading-normal avoid-break">
              Al fine di promuovere il coordinamento, nonché di assicurare l'applicazione delle disposizioni contenute nel piano di sicurezza e coordinamento e delle relative procedure di lavoro sono convenute le seguenti persone:
            </p>

            {/* 5. SOGGETTI CONVENUTI (Committente -> DL -> Progettista -> CSE -> Imprese in 2 colonne) */}
            <div className="space-y-1 text-[9.5pt] mb-5 pl-3 border-l-2 border-neutral-400 avoid-break">
              {committentePres && (
                <p><strong>Committente:</strong> {committenteNome}</p>
              )}

              {dlPres && (
                <p><strong>Direttore dei Lavori (DL):</strong> {dlNome}</p>
              )}

              {progettistaPres && (
                <p><strong>Progettista:</strong> {progettistaNome}</p>
              )}

              <p><strong>CSE:</strong> {cseNome}</p>

              <div className="pt-1">
                <span className="font-bold block text-neutral-800 mb-0.5">Imprese ed Esecutori presenti:</span>
                {sopralluogo.imprese_presenti && sopralluogo.imprese_presenti.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pl-1">
                    {sopralluogo.imprese_presenti.map((imp, idx) => (
                      <div key={idx} className="truncate">
                        &bull; {imp}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-neutral-500 italic pl-1">Nessuna impresa annotata</span>
                )}
              </div>
            </div>

            {/* 6. FASI DI LAVORO (TITOLO LEGATO ALLA PRIMA LAVORAZIONE) */}
            <div className="mb-5">
              {fasiAttive.length > 0 ? (
                <>
                  {/* Blocco indivisibile: Titolo + prima lavorazione */}
                  <div className="avoid-break mb-1">
                    <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
                      Le fasi di lavoro in svolgimento alla data odierna sono:
                    </h3>
                    <div className="text-[9.5pt] pl-2">
                      <span>&bull; {fasiAttive[0].descrizione}</span>
                      {fasiAttive[0].impresa && (
                        <span className="text-neutral-600 font-semibold ml-2">
                          — Impresa: {fasiAttive[0].impresa}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lavorazioni successive */}
                  {fasiAttive.slice(1).map((f, idx) => (
                    <div key={f.id || idx + 1} className="text-[9.5pt] pl-2 mt-1 avoid-break">
                      <span>&bull; {f.descrizione}</span>
                      {f.impresa && (
                        <span className="text-neutral-600 font-semibold ml-2">
                          — Impresa: {f.impresa}
                        </span>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="avoid-break">
                  <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
                    Le fasi di lavoro in svolgimento alla data odierna sono:
                  </h3>
                  <p className="text-[9.5pt] text-neutral-800 whitespace-pre-wrap pl-2 leading-relaxed">
                    {sopralluogo.lavorazioni_in_corso || 'Nessuna fase specifica annotata.'}
                  </p>
                </div>
              )}
            </div>

            {/* 7. DISPOSITIVI E APPRESTAMENTI (TITOLO LEGATO AL PRIMO DISPOSITIVO) */}
            <div className="mb-5">
              {dispositiviAttivi.length > 0 ? (
                <>
                  {/* Blocco indivisibile: Titolo + primo apprestamento */}
                  <div className="avoid-break mb-1.5">
                    <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
                      Verifica ai dispositivi e apprestamenti:
                    </h3>
                    <div className="flex items-start gap-2 pl-2 text-[9.5pt]">
                      <span className="font-mono text-sm leading-none">
                        {dispositiviAttivi[0].selezionato ? '☒' : '☐'}
                      </span>
                      <div>
                        <span className={`font-semibold ${dispositiviAttivi[0].selezionato ? 'text-neutral-900' : 'text-neutral-600'}`}>
                          {dispositiviAttivi[0].nome}
                        </span>
                        {dispositiviAttivi[0].selezionato && dispositiviAttivi[0].note && (
                          <span className="text-neutral-700 ml-2">&bull; {dispositiviAttivi[0].note}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Apprestamenti successivi */}
                  <div className="space-y-1.5 text-[9.5pt]">
                    {dispositiviAttivi.slice(1).map((disp, idx) => (
                      <div key={disp.id || idx + 1} className="flex items-start gap-2 pl-2 avoid-break">
                        <span className="font-mono text-sm leading-none">{disp.selezionato ? '☒' : '☐'}</span>
                        <div>
                          <span className={`font-semibold ${disp.selezionato ? 'text-neutral-900' : 'text-neutral-600'}`}>
                            {disp.nome}
                          </span>
                          {disp.selezionato && disp.note && (
                            <span className="text-neutral-700 ml-2">&bull; {disp.note}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="avoid-break">
                  <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
                    Verifica ai dispositivi e apprestamenti:
                  </h3>
                  <p className="text-neutral-500 text-xs pl-2">Nessun apprestamento specifico verificato.</p>
                </div>
              )}
            </div>

            {/* 8. ARGOMENTI DISCUTI (TITOLO LEGATO AL PRIMO PARAGRAFO DEL TESTO) */}
            {paragrafiArgomenti.length > 0 && (
              <div className="mb-5">
                {/* Blocco indivisibile: Titolo + primo paragrafo del testo */}
                <div className="avoid-break mb-1">
                  <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
                    Nel corso della riunione sono stati discussi i seguenti argomenti:
                  </h3>
                  <p className="text-[9.5pt] text-neutral-800 whitespace-pre-wrap pl-2 leading-relaxed">
                    {paragrafiArgomenti[0]}
                  </p>
                </div>

                {/* Eventuali paragrafi successivi possono scorrere fluidamente sulle pagine seguenti */}
                {paragrafiArgomenti.slice(1).map((par, pIdx) => (
                  <p key={pIdx + 1} className="text-[9.5pt] text-neutral-800 whitespace-pre-wrap pl-2 leading-relaxed mt-1.5">
                    {par}
                  </p>
                ))}
              </div>
            )}

            {/* 9. SOSPENSIONE LAVORI (BLOCCO INDIVISIBILE) */}
            {sopralluogo.sospensione_lavori && (
              <div className="mb-5 p-3.5 bg-neutral-100 border-2 border-neutral-900 text-xs avoid-break">
                <h4 className="font-black uppercase text-neutral-900 mb-1">
                  DISPOSIZIONE DI SOSPENSIONE DEI LAVORI (Art. 92 c.1 lett. f D.Lgs. 81/08):
                </h4>
                <p>{sopralluogo.motivo_sospensione}</p>
              </div>
            )}

            {/* 10. PRESCRIZIONI (TITOLO LEGATO ALLA PRIMA PRESCRIZIONE) */}
            {sopralluogo.prescrizioni_lista && sopralluogo.prescrizioni_lista.length > 0 && (
              <div className="mb-5">
                {/* Blocco indivisibile: Titolo + prima prescrizione */}
                <div className="avoid-break mb-1">
                  <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-2">
                    Disposizioni e Misure Prescrittive Impartite dal CSE:
                  </h3>
                  <div className="flex justify-between items-baseline border-b border-neutral-200 pb-0.5 text-[9.5pt] pl-2">
                    <span>
                      &bull; {sopralluogo.prescrizioni_lista[0].testo}{' '}
                      {sopralluogo.prescrizioni_lista[0].impresa_destinataria ? `(Destinatario: ${sopralluogo.prescrizioni_lista[0].impresa_destinataria})` : ''}
                    </span>
                    {sopralluogo.prescrizioni_lista[0].data_scadenza && (
                      <span className="text-[8.5pt] text-neutral-600 font-mono">
                        Termine: {sopralluogo.prescrizioni_lista[0].data_scadenza}
                      </span>
                    )}
                  </div>
                </div>

                {/* Prescrizioni successive */}
                <div className="space-y-1 text-[9.5pt] pl-2">
                  {sopralluogo.prescrizioni_lista.slice(1).map((p, idx) => (
                    <div key={idx + 1} className="flex justify-between items-baseline border-b border-neutral-200 pb-0.5 avoid-break">
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
            )}

            {/* 11. RILIEVI FOTOGRAFICI (TITOLO LEGATO ALLA PRIMA FOTO) */}
            {sopralluogo.rilievi && sopralluogo.rilievi.length > 0 && (
              <div className="mb-6">
                {/* Blocco indivisibile: Titolo + primo rilievo con foto */}
                <div className="avoid-break mb-3">
                  <h3 className="font-bold text-[9.5pt] uppercase tracking-wide text-neutral-900 border-b border-neutral-300 pb-1 mb-3">
                    Rilievi Visivi e Documentazione Fotografica:
                  </h3>
                  
                  {sopralluogo.rilievi[0] && (
                    <div className="text-[9.5pt]">
                      <p className="font-medium text-neutral-800 mb-2">&bull; {sopralluogo.rilievi[0].descrizione}</p>
                      {sopralluogo.rilievi[0].foto_urls && sopralluogo.rilievi[0].foto_urls.length > 0 && (
                        <div className="flex flex-wrap items-start gap-3">
                          {sopralluogo.rilievi[0].foto_urls.map((url, fIdx) => (
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
                  )}
                </div>

                {/* Rilievi fotografici successivi */}
                {sopralluogo.rilievi.slice(1).map((r, idx) => (
                  <div key={idx + 1} className="text-[9.5pt] avoid-break mt-4">
                    <p className="font-medium text-neutral-800 mb-2">&bull; {r.descrizione}</p>
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
                ))}
              </div>
            )}

            {/* 12. FIRMA DEL CSE (BLOCCO INDIVISIBILE) */}
            <div className="pt-6 mt-8 border-t border-neutral-300 flex justify-end avoid-break">
              <div className="text-center min-w-[260px]">
                <p className="font-bold text-[9.5pt] text-neutral-900 leading-none">
                  Il Coordinatore per la Sicurezza (CSE)
                </p>
                
                <div 
                  style={{ marginTop: `${timbroMarginMm}mm` }} 
                  className="flex items-center justify-center transition-all"
                >
                  {timbroFirma ? (
                    <img 
                      src={timbroFirma} 
                      alt="Timbro e Firma CSE" 
                      style={{ height: `${timbroHeightCm}cm`, width: 'auto' }}
                      className="max-w-[280px] object-contain mx-auto block"
                    />
                  ) : (
                    <div className="border-b border-neutral-400 w-48 mx-auto mt-6"></div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
};

export default VerbalePdfModal;