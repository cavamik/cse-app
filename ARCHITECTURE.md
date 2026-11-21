# Architettura del Sistema - CSE App (D.Lgs. 81/08)

Applicazione web per la gestione dei sopralluoghi, verifiche di sicurezza e verbali di coordinamento per il **Coordinatore per la Sicurezza in fase di Esecuzione (CSE)** ai sensi del D.Lgs. 81/2008.

---

## 1. Stack Tecnologico

* **Frontend:** React 19, TypeScript, Vite 8
* **Styling:** Tailwind CSS v4, Lucide React (iconografia)
* **Backend & Storage Cloud:** Supabase (PostgreSQL per il database relazionale e Object Storage per le fotografie dei rilievi)
* **Linter & Type Checking:** Oxlint, TypeScript Compiler (`tsc`)

---

## 2. Mappa dei Componenti Attivi

L'albero dei componenti è snello e centralizzato attorno a `src/App.tsx`:

```
src/
├── main.tsx                      # Bootstrap dell'applicazione React (StrictMode)
├── App.tsx                       # Componente Root: gestione stato globale, tab attive, query a Supabase
├── index.css                     # Stili globali e configurazione Tailwind CSS
│
├── components/
│   ├── Navbar.tsx                # Barra di navigazione (Cantieri Attivi, Sopralluoghi, Imprese) + Status Supabase
│   ├── Dashboard.tsx             # Scheda Cantieri Attivi con ordinamento per data ultimo sopralluogo
│   ├── ModalCantiere.tsx         # Modale anagrafica per la creazione di un nuovo cantiere
│   ├── SopralluoghiView.tsx      # Registro cronologico dei verbali con filtro cantiere ed espansione dettagli
│   ├── ModalSopralluogo.tsx      # Editor completo del sopralluogo:
│   │                             #  - Soggetti convenuti (Committente, DL, Progettista, CSE, Imprese)
│   │                             #  - Fasi lavorative in corso
│   │                             #  - Verifica apprestamenti e dispositivi
│   │                             #  - Rilievi descrittivi con upload/compressione foto
│   │                             #  - Prescrizioni con termini di adeguamento
│   │                             #  - Sospensione lavori (Art. 92 c.1 lett. f)
│   ├── ImpreseView.tsx           # Anagrafica imprese e lavoratori autonomi con storico cantieri e sopralluoghi
│   └── VerbalePdfModal.tsx       # Anteprima conforme per stampa e salvataggio in PDF (A4) con logo studio,
│                                 # timbro/firma e regolazione dinamica margini in millimetri
│
├── lib/
│   ├── supabaseClient.ts         # Inizializzazione del client Supabase con variabili d'ambiente
│   └── offlineStore.ts           # Motore Offline-First: cache IndexedDB (idb-keyval), coda verbali pendenti e sincronizzazione atomica
│
├── types/
│   └── index.ts                  # Interfacce TypeScript del dominio applicativo
│
└── utils/
    └── imageCompressor.ts        # Ridimensionamento automatico a 1280px e compressione JPEG (< 200 KB)
```

---

## 3. Schema del Database Supabase (PostgreSQL)

L'applicazione dialoga con le seguenti tabelle su Supabase:

### Tabella `cantieri`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Identificativo univoco del cantiere |
| `codice` | `text` | Codice progressivo (es. `CANT-XXXX`) |
| `denominazione` | `text` | Nome del cantiere o dei lavori |
| `indirizzo` | `text` | Indirizzo del cantiere |
| `committente` | `text` | Committente o Responsabile dei Lavori |
| `direttore_lavori`| `text` | Direttore dei Lavori (DL) |
| `progettista` | `text` | Progettista dell'opera |
| `cse` | `text` | Coordinatore per la Sicurezza in Esecuzione |
| `status` | `text` | Stato: `in_corso`, `sospeso`, `completato`, `programmato` |
| `created_at` | `timestamptz` | Data creazione record |

### Tabella `sopralluoghi`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Identificativo univoco del verbale |
| `cantiere_id` | `uuid` (FK) | Riferimento al cantiere |
| `data` | `date` | Data del sopralluogo (`YYYY-MM-DD`) |
| `ora` | `text` | Orario inizio sopralluogo (es. `09:30`) |
| `lavorazioni_in_corso` | `text` | Sintesi testuale delle lavorazioni in atto |
| `fasi_lavoro` | `jsonb` | Array di oggetti `{ id, descrizione, impresa }` |
| `imprese_presenti` | `jsonb` | Array di stringhe formattate con ragione sociale e ruolo |
| `imprese_dettaglio` | `jsonb` | Array di oggetti `{ nome, ruolo_cantiere, tipo }` |
| `presenze` | `jsonb` | Oggetto convenuti `{ committente, dl, progettista, cse }` |
| `dispositivi_apprestamenti` | `jsonb` | Array `{ nome, selezionato, note }` (ponteggi, scavi, trabattelli...) |
| `argomenti_discussi` | `text` | Note e argomenti della riunione di coordinamento |
| `rilievi` | `jsonb` | Array `{ id, descrizione, foto_urls: string[] }` |
| `prescrizioni_lista` | `jsonb` | Array `{ id, testo, impresa_destinataria, data_scadenza }` |
| `sospensione_lavori` | `boolean` | Flag attivazione sospensione (Art. 92 c.1 lett. f) |
| `motivo_sospensione` | `text` | Motivazione del pericolo grave e imminente riscontrato |
| `created_at` | `timestamptz` | Data creazione record |

### Tabella `imprese`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | `uuid` (PK) | Identificativo univoco dell'operatore economico |
| `cantiere_id` | `uuid` (FK nullable) | Cantiere primario di assegnazione |
| `ragione_sociale` | `text` | Ragione sociale o nominativo |
| `tipo` | `text` | `impresa` o `lavoratore_autonomo` |
| `p_iva` | `text` | Partita IVA / Codice Fiscale |
| `referente` / `referente_nome` | `text` | Preposto o Legale Rappresentante |
| `telefono` | `text` | Contatto telefonico |
| `ruolo` | `text` | Ruolo contrattuale |

### Tabella `impostazioni_studio`
| Campo | Tipo | Descrizione |
| :--- | :--- | :--- |
| `id` | `text` (PK) | Chiave (es. `'principale'`) |
| `logo_url` | `text` | URL immagine logo dello studio tecnico (SVG/PNG) |
| `timbro_url` | `text` | URL timbro e firma trasparente PNG |
| `margin_top_mm` | `numeric` | Margine superiore stampa in mm (default 10) |
| `margin_bottom_mm`| `numeric` | Margine inferiore stampa in mm (default 15) |
| `margin_lateral_mm`| `numeric` | Margine laterale stampa in mm (default 10) |
| `foto_height_cm` | `numeric` | Altezza standard foto nel verbale in cm |
| `timbro_height_cm`| `numeric` | Altezza timbro firma in cm |
| `timbro_margin_mm`| `numeric` | Offset verticale del timbro rispetto alla firma in mm |

---

## 4. Storage Bucket (`foto-sopralluoghi`)

I file fotografici e gli asset grafici sono archiviati su Supabase Storage nel bucket pubblico **`foto-sopralluoghi`**:
* **Fotografie rilievi:** `sopralluoghi/{cantiere_id}/{timestamp}_{random}.jpg`
* **Asset Studio Tecnico:** `studio/logo_studio_{timestamp}.{ext}` e `studio/timbro_{timestamp}.png`

Le immagini dei rilievi vengono compresse lato client (`utils/imageCompressor.ts`) garantendo un peso inferiore a 200 KB prima dell'invio.

---

## 5. Variabili d'Ambiente (`.env`)

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

---

## 6. Architettura Offline-First & Sincronizzazione (`src/lib/offlineStore.ts`)

Per garantire continuità operativa in cantiere in assenza di segnale mobile o Wi-Fi:

1. **Cache di Lettura Istantanea (IndexedDB):**
   * Tabelle `cantieri`, `imprese`, `sopralluoghi` e `impostazioni_studio` vengono salvate localmente ad ogni connessione online.
   * All'avvio, l'app legge subito da IndexedDB per garantire apertura immediata e compilazione verbali anche senza connessione.

2. **Coda `pending_sopralluoghi`:**
   * In caso di salvataggio offline o caduta improvvisa della linea durante l'upload, il verbale e i relativi `Blob` fotografici già compressi vengono archiviati nella coda `pending_sopralluoghi` in IndexedDB (`status: 'pending'`).
   * I verbali offline vengono mostrati nell'elenco con badge *"In attesa di sync"* e sono consultabili/stampabili subito in PDF tramite blob URL locali.

3. **Motore di Sincronizzazione Atomica:**
   * Ascolto automatico dell'evento `window.addEventListener('online')` + pulsante manuale *"Sincronizza ora"* nella Navbar e nella vista Sopralluoghi.
   * Lock anti-duplicazione per evitare sync concorrenti sovrapposte.
   * Flusso atomico per ciascun record:
     1. Impostazione `status = 'syncing'`.
     2. Upload preliminare di tutte le foto su Supabase Storage (`foto-sopralluoghi`). Se una foto fallisce, l'operazione abortisce e il record resta protetto in IndexedDB (`status: 'error'`).
     3. Solo se tutte le foto sono caricate con successo, esecuzione dell'upsert del record su `sopralluoghi`.
     4. A conferma avvenuta del database, rimozione dell'elemento dalla coda IndexedDB e aggiornamento automatico della UI.

