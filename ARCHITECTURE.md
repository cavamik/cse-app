# Architettura del Sistema - CantierHub

**CantierHub** è l'hub gestionale di cantiere multi-ruolo progettato per professionisti tecnici (Architetti, Ingegneri, Geometri) che operano come **Coordinatori per la Sicurezza in fase di Esecuzione (CSE)** ai sensi del D.Lgs. 81/2008, **Direttori dei Lavori (DL)** o **Tecnici Incaricati di Rilievi e Perizie**.

L'applicazione adotta un'architettura **Offline-First**, consentendo la piena operatività sul campo anche in totale assenza di connettività mobile (es. interrati, gallerie, cantieri remoti), con sincronizzazione automatica bidirezionale non appena viene ristabilita la rete.

---

## 1. Stack Tecnologico

* **Frontend:** React 19, TypeScript, Vite 8
* **Styling & Icone:** Tailwind CSS v4, Lucide React
* **Compressione Immagini:** Canvas Pipeline WebP progressiva (~100 KB) con fallback JPEG (`utils/imageCompressor.ts`)
* **Archiviazione Locale (Offline-First):** IndexedDB tramite `idb-keyval` (cache anagrafiche e coda di sincronizzazione)
* **Backend & Storage Cloud:** Supabase (PostgreSQL relazionale e Object Storage bucket `foto-sopralluoghi`)
* **Linter & Type Checking:** Oxlint, TypeScript Compiler (`tsc`)

---

## 2. Ruoli e Tipologie di Atto (`TipoVerbale`)

L'applicazione supporta tre tipologie di atto formale tramite il tipo `TipoVerbale = 'CSE' | 'DL' | 'RILIEVO'`:

1. **CSE (Coordinamento Sicurezza - D.Lgs. 81/08):**
   * Verifica apprestamenti e dispositivi di sicurezza collettivi (ponteggi, scavi, quadri elettrici, DPI).
   * Lavorazioni in corso e interferenze tra imprese.
   * Prescrizioni di sicurezza con impresa destinataria e data di scadenza.
   * Sospensione immediata delle lavorazioni per pericolo grave e imminente (Art. 92 c.1 lett. f).
   * Verbale con formula formale di coordinamento e firma del CSE.

2. **DL (Direzione Lavori):**
   * Condizioni meteo e stato di operatività del cantiere.
   * Monitoraggio maestranze e operai presenti (per singola impresa e totale di cantiere).
   * Verifica avanzamento opere e rispondenza alle prescrizioni progettuali / capitolato.
   * Sezione dedicata per **Ordini di Servizio (OdS)** e disposizioni del Direttore dei Lavori.
   * Verbale di Direzione Lavori con firma del DL.

3. **RILIEVO (Fascicolo Fotografico & Stato di Fatto):**
   * Premesse e note tecniche generali del sopralluogo peritale o di rilievo.
   * Campo dedicato per ciascun rilievo: **Ambiente / Posizione** (es. *Piano 1°, Prospetto Nord, Vano Scala*) e **Quote / Misure / Note Tecniche** (es. *L=3.45m, H=2.70m, fessurazione passante*).
   * Impaginazione A4 a fascicolo fotografico con griglia ordinata e firma del Tecnico Incaricato.

### Funzione "Duplica come..." (DL <-> CSE)
Permette con un solo click di generare un verbale speculare (da DL a CSE o da CSE a DL) mantenendo invariati cantiere, data, ora, imprese presenti e lavorazioni in corso, azzerando le note di ruolo e le prescrizioni specifiche per non contaminare gli atti legali.

---

## 3. Mappa dei Componenti Attivi

```
src/
├── main.tsx                      # Bootstrap dell'applicazione React (StrictMode)
├── App.tsx                       # Componente Root: gestione stato globale, tab attive, sincronizzazione,
│                                 # lifecycle blob URL, cancellazione a cascata storage/database, duplicazione ruolo
├── index.css                     # Stili globali e configurazione Tailwind CSS
│
├── components/
│   ├── Navbar.tsx                # Header CantierHub, badge stato rete, contatore pending e pulsante sync manuale
│   ├── Dashboard.tsx             # Scheda Cantieri Attivi (ordinata per ultimo sopralluogo) con statistiche
│   ├── ModalCantiere.tsx         # Creazione e modifica anagrafica cantiere (committente, DL, CSE, progettista)
│   ├── SopralluoghiView.tsx      # Registro cronologico verbali con filtro cantiere, pill filter per ruolo (Tutti, CSE, DL, Rilievo),
│   │                             # badge ruolo, azione "Duplica come..." e anteprime fotografiche
│   ├── ModalSopralluogo.tsx      # Editor universale di sopralluogo multi-ruolo:
│   │                             #  - Selezione ruolo (CSE, DL, RILIEVO) con lock di default in modifica e pulsante "Sblocca tipologia"
│   │                             #  - Cambio tipologia non distruttivo: preserva i dati di tutte le sezioni anche passando da un ruolo all'altro
│   │                             #  - Campi condizionali per ruolo (Meteo/OdS per DL; Note tecniche/Misure per RILIEVO; Apprestamenti/Prescrizioni per CSE)
│   │                             #  - Compressione WebP ~100 KB in tempo reale e staging Blob per storage offline
│   │                             #  - Anteprima PDF live prima del salvataggio
│   ├── ImpreseView.tsx           # Anagrafica operatori economici (imprese, lavoratori autonomi), filtro per cantiere,
│   │                             # email, associazione rapida e sezione "Verbali in cui è presente" con badge ruolo e azioni rapide (PDF/Modifica)
│   └── VerbalePdfModal.tsx       # Modale di stampa/export PDF A4 conforme per ruolo con logo studio,
│                                 # timbro professionale, margini regolabili e griglia fotografica adattiva
│
├── lib/
│   ├── supabaseClient.ts         # Inizializzazione del client Supabase
│   └── offlineStore.ts           # Motore Offline-First: cache IndexedDB, coda pending con Blob, sanitizzazione percorsi
│                                 # e sincronizzazione atomica a due fasi con validazione UUID
│
├── types/
│   └── index.ts                  # Tipi del dominio: TipoVerbale, Sopralluogo, Cantiere, Impresa, RilievoItem, ecc.
│
└── utils/
    ├── cantiereImprese.ts        # Helper associazione e scollegamento imprese per singolo cantiere e validazione email
    └── imageCompressor.ts        # Compressione WebP progressiva (~100 KB target) con orientamento EXIF e fallback JPEG
```

---

## 4. Schema del Database Supabase (PostgreSQL)

### Snippet di Migrazione SQL (da eseguire su Supabase SQL Editor se mancante)
```sql
ALTER TABLE sopralluoghi ADD COLUMN IF NOT EXISTS tipo_verbale text DEFAULT 'CSE';
ALTER TABLE sopralluoghi ADD COLUMN IF NOT EXISTS condizioni_meteo text;
ALTER TABLE sopralluoghi ADD COLUMN IF NOT EXISTS ordini_servizio text;
ALTER TABLE sopralluoghi ADD COLUMN IF NOT EXISTS operai_totali integer;
ALTER TABLE sopralluoghi ADD COLUMN IF NOT EXISTS note_tecniche text;

-- Collegamento Cantieri <-> Imprese e contatti email
ALTER TABLE imprese ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE cantieri ADD COLUMN IF NOT EXISTS imprese_ids text[] DEFAULT '{}';
```

### Tabella `sopralluoghi`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Identificativo univoco (PostgreSQL `gen_random_uuid()`) |
| `cantiere_id` | `uuid` (FK) | Riferimento al cantiere (`cantieri.id`) |
| `tipo_verbale` | `text` | `'CSE'`, `'DL'` o `'RILIEVO'` (default `'CSE'`) |
| `data` | `date` | Data del verbale (`YYYY-MM-DD`) |
| `ora` | `text` | Orario (es. `09:30`) |
| `condizioni_meteo` | `text` | Condizioni meteo e operatività cantiere (per DL) |
| `operai_totali` | `integer` | Numero totale maestranze presenti in cantiere (per DL) |
| `ordini_servizio` | `text` | Disposizioni e Ordini di Servizio impartiti (per DL) |
| `note_tecniche` | `text` | Note e premesse tecniche al rilievo (per RILIEVO) |
| `lavorazioni_in_corso` | `text` | Sintesi testuale delle lavorazioni in atto |
| `fasi_lavoro` | `jsonb` | Array `{ id, descrizione, impresa }` |
| `imprese_presenti` | `jsonb` | Array di stringhe formattate con ragione sociale e ruolo |
| `imprese_dettaglio` | `jsonb` | Array `{ nome, ruolo_cantiere, tipo, operai_presenti }` |
| `presenze` | `jsonb` | Oggetto convenuti `{ committente, dl, progettista, cse }` |
| `dispositivi_apprestamenti` | `jsonb` | Array `{ nome, selezionato, note }` (sicurezza CSE) |
| `argomenti_discussi` | `text` | Note e argomenti discussi durante il coordinamento (CSE) |
| `rilievi` | `jsonb` | Array `{ id, descrizione, foto_urls: string[], ambiente, quote_note, misura_1?, misura_2?, misura_3? }` |
| `prescrizioni_lista` | `jsonb` | Array `{ id, testo, impresa_destinataria, data_scadenza }` (CSE) |
| `sospensione_lavori` | `boolean` | Flag sospensione lavori per grave pericolo (CSE) |
| `motivo_sospensione` | `text` | Motivazione legale della sospensione (Art. 92 CSE) |
| `created_at` | `timestamptz` | Timestamp di creazione |

### Tabella `cantieri`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Identificativo univoco del cantiere |
| `codice` | `text` | Codice cantiere (es. `CANT-001`) |
| `denominazione` | `text` | Nome dei lavori / cantiere |
| `indirizzo` | `text` | Ubicazione cantiere |
| `committente` | `text` | Committente o Responsabile dei Lavori |
| `direttore_lavori`| `text` | Direttore dei Lavori incaricato |
| `progettista` | `text` | Progettista architettonico/strutturale |
| `cse` | `text` | Coordinatore per la Sicurezza |
| `imprese_ids` | `text[]` | Array di ID delle imprese associate al cantiere (DEFAULT '{}') |
| `status` | `text` | `in_corso`, `sospeso`, `completato`, `programmato` |
| `created_at` | `timestamptz` | Data di creazione |

### Tabella `imprese`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Identificativo univoco |
| `cantiere_id` | `uuid` (FK nullable) | Cantiere di riferimento |
| `ragione_sociale` | `text` | Denominazione sociale o nominativo |
| `tipo` | `text` | `impresa` o `lavoratore_autonomo` |
| `p_iva` | `text` | Partita IVA o Codice Fiscale |
| `email` | `text` | Indirizzo email di contatto dell'operatore economico |
| `referente` | `text` | Preposto o Legale Rappresentante |
| `telefono` | `text` | Recapito telefonico |
| `ruolo` | `text` | Ruolo contrattuale |

### Tabella `impostazioni_studio`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | `text` (PK) | Chiave primaria (default `'principale'`) |
| `logo_url` | `text` | URL logo dello studio tecnico |
| `timbro_url` | `text` | URL timbro e firma trasparente |
| `margin_top_mm` | `numeric` | Margine superiore stampa in mm (default 10) |
| `margin_bottom_mm`| `numeric` | Margine inferiore stampa in mm (default 15) |
| `margin_lateral_mm`| `numeric` | Margine laterale stampa in mm (default 10) |
| `foto_height_cm` | `numeric` | Altezza standard fotografie in cm |
| `timbro_height_cm`| `numeric` | Altezza timbro firma in cm |
| `timbro_margin_mm`| `numeric` | Offset verticale del timbro rispetto alla firma in mm |

---

## 5. Storage Fotografico (`foto-sopralluoghi`)

Tutti i file fotografici sono archiviati su Supabase Storage nel bucket pubblico **`foto-sopralluoghi`**:
* **Percorso standard:** `sopralluoghi/{cantiere_id}/{timestamp}_{random}.webp` (o `.jpg` su browser legacy).
* **Compressione WebP progressiva:** Le immagini caricate da smartphone o fotocamera vengono automaticamente ridimensionate e compresse a circa **100 KB** (`imageCompressor.ts`), velocizzando il caricamento su reti 3G/4G di cantiere e minimizzando l'ingombro su storage e IndexedDB.

---

## 6. Architettura Offline-First & Motore di Sincronizzazione

1. **Cache di Lettura Istantanea:**
   * All'avvio, l'applicazione visualizza immediatamente i dati salvati in IndexedDB (`idb-keyval`).
   * Quando la rete è disponibile, aggiorna silenziosamente la cache locale in background.
2. **Salvataggio Locale Trasparente:**
   * Se l'utente salva un verbale in assenza di rete, questo viene registrato nella coda `pending_sopralluoghi` con i relativi `Blob` binari delle foto già compresse in WebP.
   * L'utente riceve un avviso chiaro e il verbale compare subito nel registro con badge visivo arancione *"In attesa di sync"*.
3. **Sincronizzazione Atomica:**
   * Il motore si attiva automaticamente al ritorno della rete (`window.addEventListener('online')`) o su richiesta manuale dell'utente ("Sincronizza ora").
   * Lock anti-duplicazione per evitare corse critiche.
   * **Fase 1:** Caricamento delle foto su Supabase Storage con sanitizzazione percorsi e MIME type `image/webp`. Se anche una sola foto fallisce, l'operazione si arresta senza inviare dati parziali al DB.
   * **Fase 2:** Invio del record completo a PostgreSQL (con eliminazione sicura del `tempId` e delega della generazione UUID al database).
   * **Fase 3:** Rimozione dell'elemento dalla coda IndexedDB e aggiornamento dell'interfaccia utente.
4. **Eliminazione a cascata:**
   * Quando un verbale viene eliminato, tutte le fotografie associate caricate su Supabase Storage vengono rimosse fisicamente dal bucket per non lasciare file orfani.
