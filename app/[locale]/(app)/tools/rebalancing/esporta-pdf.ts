// Esportazione in PDF del risultato di una simulazione di ribilanciamento
// (portafoglio o gruppo). Stesso principio di storico-simulazioni.tsx
// (RigaStoricoVista): chi chiama traduce il proprio risultato tipizzato in
// una manciata di "sezioni" generiche — questo modulo non conosce le
// differenze fra portafoglio e gruppo, sa solo disegnarle nel PDF con
// lib/pdf-minimo.ts. Restano fuori dal PDF solo la barra di scorrimento
// "quota nei PAC" (interattiva, non ha senso su carta: si esportano
// entrambi gli estremi come due tabelle separate) e le poche righe di
// notazione UI (bordi, hover) che non hanno equivalente su carta.

import { DocumentoPdf, scaricaPdf, type Tono, type CellaTabella } from '@/lib/pdf-minimo'

// Alcuni messaggi (es. messaggioBudgetPortafoglio, messaggioPoolReinvestire)
// contengono un tag <strong> e vanno letti con t.rich, non t(): sullo
// schermo diventa un <strong>, qui basta il testo piatto. t.rich, quando il
// callback del tag restituisce i chunk invariati (senza avvolgerli in JSX),
// produce una stringa oppure un array di stringhe a seconda di quante parti
// compone il messaggio — questa funzione appiattisce entrambi i casi.
export function testoDaRich(nodo: unknown): string {
  if (nodo === null || nodo === undefined) return ''
  if (Array.isArray(nodo)) return nodo.map(testoDaRich).join('')
  return String(nodo)
}

export type ColonnaPdf = { intestazione: string; allineaDestra?: boolean }

export type SezionePdf =
  | { tipo: 'sottotitolo'; testo: string }
  | { tipo: 'paragrafo'; testo: string; grassetto?: boolean; tono?: Tono }
  // Casella colorata (avviso/successo/pericolo): stessa fascia colorata che
  // a schermo segnala l'esito della simulazione (--warning/--success/
  // --danger), non un semplice paragrafo.
  | { tipo: 'casella'; testo: string; tono: 'successo' | 'pericolo' | 'avviso' }
  | { tipo: 'tabella'; colonne: ColonnaPdf[]; righe: CellaTabella[][] }
  | { tipo: 'lista'; voci: string[] }
  | { tipo: 'separatore' }
  | { tipo: 'spazio'; altezza: number }

export type ContenutoPdfSimulazione = {
  nome: string
  // Es. "Portafoglio — 27/09/2026, 11:45" — già formattato dal chiamante,
  // che conosce la locale.
  sottotitolo: string
  // Badge dell'esito (Raggiunto/Parziale/Non raggiunto/Insufficiente),
  // mostrato nella banda di intestazione: stesso testo e stesso significato
  // del badge della mini-card "Ultime simulazioni" a schermo.
  distintivo?: { testo: string; tono: 'successo' | 'avviso' | 'pericolo' }
  sezioni: SezionePdf[]
}

export function esportaSimulazionePdf(contenuto: ContenutoPdfSimulazione) {
  const doc = new DocumentoPdf()
  doc.intestazioneReport(contenuto.nome, contenuto.sottotitolo, contenuto.distintivo)

  for (const sezione of contenuto.sezioni) {
    switch (sezione.tipo) {
      case 'sottotitolo':
        doc.sottotitolo(sezione.testo)
        break
      case 'paragrafo':
        doc.paragrafo(sezione.testo, { grassetto: sezione.grassetto, tono: sezione.tono })
        break
      case 'casella':
        doc.casella(sezione.testo, sezione.tono)
        break
      case 'tabella':
        doc.tabella(sezione.colonne, sezione.righe)
        break
      case 'lista':
        for (const voce of sezione.voci) doc.paragrafo(`•  ${voce}`)
        break
      case 'separatore':
        doc.lineaSeparatrice()
        break
      case 'spazio':
        doc.spazio(sezione.altezza)
        break
    }
  }

  // Nome file dal nome della simulazione: già filtrato a lettere/numeri/spazi
  // da pulisciNomeSimulazione a monte, qui basta sostituire gli spazi.
  const base = contenuto.nome.trim().replace(/\s+/g, '-') || 'simulazione'
  scaricaPdf(doc, `${base}.pdf`)
}
