# Sopralluoghi CSE

Applicazione per i verbali di sopralluogo del Coordinatore per l’esecuzione dei lavori (D.Lgs. 81/08). I dati restano nel browser del dispositivo.

## Avvio

```bash
npm install
npm run dev
```

Poi apri l’indirizzo indicato da Vite, in genere `http://localhost:5173`.

## Flusso

1. Archivio cantieri: crea o seleziona un cantiere e avvia un verbale.
2. Imprese presenti, anche con ruoli aggiunti al momento.
3. Apprestamenti e attrezzature, con la funzione specifica del sopralluogo.
4. Lavorazioni osservate, imprese esecutrici e fotografie.
5. Osservazioni, intervento correttivo, impresa destinataria e termine.
6. Prossime lavorazioni, interferenze e note per PSC / layout.
7. Riepilogo consultabile, stampabile o salvabile in PDF dal browser.

Dall’archivio si possono esportare e reimportare i dati in JSON.
