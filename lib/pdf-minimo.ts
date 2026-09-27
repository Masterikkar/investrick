// Generatore PDF minimo, senza dipendenze esterne: costruisce a mano gli
// oggetti del formato PDF (catalogo, pagine, font standard, content stream)
// e li serializza in un Uint8Array scaricabile dal browser.
//
// Perché non una libreria (jsPDF, pdf-lib, ...): l'ambiente di sviluppo di
// questa sessione non ha accesso al registro npm (policy di rete del
// sandbox, stesso problema già annotato in precedenza per npm/cdn.sheetjs) —
// non era possibile installare né verificare una nuova dipendenza. Un
// generatore fatto in casa, testato riga per riga con qpdf/pdftotext/pypdf
// fuori dal browser, è la scelta più affidabile finché quella dipendenza non
// si potrà aggiungere e verificare con calma.
//
// Pensato per un vero "report da consegnare": banda di intestazione colorata
// (nome simulazione + sottotitolo + eventuale badge esito), sottotitoli di
// sezione con accento colorato, caselle di avviso colorate (stesso
// significato semantico di --warning/--success/--danger dell'app), tabelle
// con intestazione a bandiera piena e colonne a larghezza proporzionale al
// contenuto (una tabella con colonne uguali per forza mostrava intestazioni
// lunghe sovrapposte a quelle vicine), celle colorate per plus/minus, più
// pagine con piè di pagina (nome simulazione + numero pagina) se il
// contenuto eccede la prima. Font Helvetica/Helvetica-Bold standard (nessun
// embedding necessario), codifica WinAnsi (italiano, euro, trattini/ellissi).

// --- Codifica testo → WinAnsi (Windows-1252) ---
//
// WinAnsi coincide con Latin-1 per i codepoint 0xA0–0xFF (identico a
// Unicode in quell'intervallo) e per l'ASCII stampabile 0x20–0x7E; differisce
// solo nell'intervallo 0x80–0x9F, dove Latin-1 ha caratteri di controllo e
// WinAnsi ha simboli tipografici — qui mappiamo solo quelli che possono
// davvero comparire nei testi dell'app.
const MAPPA_WINANSI_SPECIALI: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x2030: 0x89, // ‰
  0x2039: 0x8b, // ‹
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201c: 0x93, // "
  0x201d: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // – (en dash)
  0x2014: 0x97, // — (em dash)
  0x2122: 0x99, // ™
  0x203a: 0x9b, // ›
  0x2212: 0x2d, // − (minus sign matematico, es. numeri negativi da Intl.NumberFormat) → trattino ASCII
}

function byteWinAnsi(codePoint: number): number {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return codePoint
  if (codePoint >= 0xa0 && codePoint <= 0xff) return codePoint
  const speciale = MAPPA_WINANSI_SPECIALI[codePoint]
  if (speciale !== undefined) return speciale
  return 0x3f // '?' — fallback per qualunque carattere fuori repertorio
}

function codificaWinAnsi(testo: string): Uint8Array {
  const bytes = new Uint8Array(testo.length)
  for (let i = 0; i < testo.length; i++) {
    bytes[i] = byteWinAnsi(testo.charCodeAt(i))
  }
  return bytes
}

function codificaAscii(testo: string): Uint8Array {
  const bytes = new Uint8Array(testo.length)
  for (let i = 0; i < testo.length; i++) bytes[i] = testo.charCodeAt(i) & 0xff
  return bytes
}

// Escape dei caratteri riservati dentro una stringa PDF "(...)"
function escapePdfString(bytes: Uint8Array): Uint8Array {
  const out: number[] = []
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c, b) // ( ) \
    else out.push(b)
  }
  return Uint8Array.from(out)
}

// --- Colori: stessa palette dei CSS custom properties dell'app
// (app/[locale]/globals.css), qui come terne RGB frazionarie 0–1 per gli
// operatori PDF `rg`/`RG`. Il report è pensato per essere stampato: sfondo
// pagina bianco, il colore primario dell'app resta l'accento forte
// (intestazione, tabelle), i colori semantici (successo/avviso/pericolo)
// hanno lo stesso significato che hanno a schermo.
type Rgb = readonly [number, number, number]

function hex(valore: string): Rgb {
  const n = parseInt(valore.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export const PALETTE = {
  primario: hex('#4C5FE0'),
  primarioVivido: hex('#7C8CFF'),
  primarioChiaro: hex('#E4E7FB'), // per la riga sotto l'intestazione dei sottotitoli
  successo: hex('#1F9D5F'), // leggermente più scuro di --success: su carta bianca resta leggibile
  successoChiaro: hex('#E3F8ED'),
  pericolo: hex('#D6383D'),
  pericoloChiaro: hex('#FBE7E8'),
  avviso: hex('#B87816'), // --warning scurito: su sfondo bianco l'originale è poco leggibile
  avvisoChiaro: hex('#FBF0DD'),
  testo: hex('#1C2033'),
  testoSecondario: hex('#5B6178'),
  testoMuto: hex('#9198AD'),
  bianco: hex('#FFFFFF'),
  riga: hex('#DEE1EC'),
  sottotitoloSuBanda: hex('#C7CEFA'),
} as const

export type Tono = 'normale' | 'secondario' | 'successo' | 'pericolo' | 'avviso'

function coloreTono(tono: Tono | undefined): Rgb {
  switch (tono) {
    case 'secondario':
      return PALETTE.testoSecondario
    case 'successo':
      return PALETTE.successo
    case 'pericolo':
      return PALETTE.pericolo
    case 'avviso':
      return PALETTE.avviso
    default:
      return PALETTE.testo
  }
}

function coloreToneChiaro(tono: 'successo' | 'pericolo' | 'avviso'): Rgb {
  return tono === 'successo' ? PALETTE.successoChiaro : tono === 'pericolo' ? PALETTE.pericoloChiaro : PALETTE.avvisoChiaro
}

function coloreToneSolido(tono: 'successo' | 'pericolo' | 'avviso'): Rgb {
  return tono === 'successo' ? PALETTE.successo : tono === 'pericolo' ? PALETTE.pericolo : PALETTE.avviso
}

// --- Larghezze dei glifi Helvetica / Helvetica-Bold (unità per 1000, come
// da metriche standard Adobe AFM dei 14 font di base) — solo per i caratteri
// che possono comparire nei testi dell'app (ASCII stampabile + lettere
// accentate italiane + simboli usati: €, — – … ° ± ×). Un fallback fisso
// copre qualunque altro carattere: un a-capo o un allineamento leggermente
// impreciso su un carattere raro non è un problema, un file non valido lo
// sarebbe.
const LARGHEZZA_FALLBACK = 556

const LARGHEZZE_HELVETICA: Record<number, number> = {
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556, 56: 556, 57: 556,
  58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556, 64: 1015,
  65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 73: 278, 74: 500,
  75: 667, 76: 556, 77: 833, 78: 722, 79: 778, 80: 667, 81: 778, 82: 722, 83: 667, 84: 611,
  85: 722, 86: 667, 87: 944, 88: 667, 89: 667, 90: 611,
  91: 278, 92: 278, 93: 278, 94: 469, 95: 556, 96: 333,
  97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556, 104: 556, 105: 222, 106: 222,
  107: 500, 108: 222, 109: 833, 110: 556, 111: 556, 112: 556, 113: 556, 114: 333, 115: 500, 116: 278,
  117: 556, 118: 500, 119: 722, 120: 500, 121: 500, 122: 500,
  123: 334, 124: 260, 125: 334, 126: 584,
  0xb0: 400, 0xb1: 584, 0xd7: 584, // ° ± ×
  0xe0: 556, 0xe8: 556, 0xe9: 556, 0xec: 222, 0xf2: 556, 0xf9: 556, // à è é ì ò ù
  0xc0: 667, 0xc8: 667, 0xc9: 667, 0xcc: 278, 0xd2: 778, 0xd9: 722, // À È É Ì Ò Ù
  0x20ac: 556, 0x2014: 1000, 0x2013: 556, 0x2026: 1000, // € — – …
}

const LARGHEZZE_HELVETICA_BOLD: Record<number, number> = {
  32: 278, 33: 333, 34: 474, 35: 556, 36: 556, 37: 889, 38: 722, 39: 238,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556, 56: 556, 57: 556,
  58: 333, 59: 333, 60: 584, 61: 584, 62: 584, 63: 611, 64: 975,
  65: 722, 66: 722, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778, 72: 722, 73: 278, 74: 556,
  75: 722, 76: 611, 77: 833, 78: 722, 79: 778, 80: 667, 81: 778, 82: 722, 83: 667, 84: 611,
  85: 722, 86: 667, 87: 944, 88: 667, 89: 667, 90: 611,
  91: 333, 92: 278, 93: 333, 94: 584, 95: 556, 96: 333,
  97: 556, 98: 611, 99: 556, 100: 611, 101: 556, 102: 333, 103: 611, 104: 611, 105: 278, 106: 278,
  107: 556, 108: 278, 109: 889, 110: 611, 111: 611, 112: 611, 113: 611, 114: 389, 115: 556, 116: 333,
  117: 611, 118: 556, 119: 778, 120: 556, 121: 556, 122: 500,
  123: 389, 124: 280, 125: 389, 126: 584,
  0xb0: 400, 0xb1: 584, 0xd7: 584,
  0xe0: 556, 0xe8: 556, 0xe9: 556, 0xec: 278, 0xf2: 611, 0xf9: 611,
  0xc0: 722, 0xc8: 667, 0xc9: 667, 0xcc: 278, 0xd2: 778, 0xd9: 722,
  0x20ac: 556, 0x2014: 1000, 0x2013: 556, 0x2026: 1000,
}

export type PesoFont = 'normale' | 'grassetto'

function larghezzaCarattere(codePoint: number, peso: PesoFont): number {
  const tabella = peso === 'grassetto' ? LARGHEZZE_HELVETICA_BOLD : LARGHEZZE_HELVETICA
  return tabella[codePoint] ?? LARGHEZZA_FALLBACK
}

export function larghezzaTesto(testo: string, dimensione: number, peso: PesoFont = 'normale'): number {
  let totale = 0
  for (let i = 0; i < testo.length; i++) totale += larghezzaCarattere(testo.charCodeAt(i), peso)
  return (totale / 1000) * dimensione
}

// A-capo semplice per parole: spezza sugli spazi, spezza anche una singola
// parola più larga della colonna (es. un nome titolo lunghissimo) carattere
// per carattere, così non sfora mai la larghezza disponibile.
function spezzaRighe(testo: string, larghezzaMassima: number, dimensione: number, peso: PesoFont): string[] {
  if (testo === '') return ['']
  const parole = testo.split(' ')
  const righe: string[] = []
  let corrente = ''

  function spezzaParolaLunga(parola: string) {
    let pezzo = ''
    for (const carattere of parola) {
      const candidato = pezzo + carattere
      if (pezzo !== '' && larghezzaTesto(candidato, dimensione, peso) > larghezzaMassima) {
        righe.push(pezzo)
        pezzo = carattere
      } else {
        pezzo = candidato
      }
    }
    return pezzo
  }

  for (const parola of parole) {
    const candidato = corrente === '' ? parola : `${corrente} ${parola}`
    if (larghezzaTesto(candidato, dimensione, peso) <= larghezzaMassima) {
      corrente = candidato
      continue
    }
    if (corrente !== '') righe.push(corrente)
    if (larghezzaTesto(parola, dimensione, peso) > larghezzaMassima) {
      corrente = spezzaParolaLunga(parola)
    } else {
      corrente = parola
    }
  }
  if (corrente !== '' || righe.length === 0) righe.push(corrente)
  return righe
}

// --- Costruzione del documento ---

export type ColonnaTabella = { intestazione: string; allineaDestra?: boolean; larghezza?: number }
// Una cella può essere semplice testo, oppure un testo con un tono
// (successo/pericolo) per i valori che a schermo sono colorati — es. una
// plusvalenza/minusvalenza.
export type CellaTabella = string | { testo: string; tono?: 'successo' | 'pericolo' }

function testoCella(c: CellaTabella): string {
  return typeof c === 'string' ? c : c.testo
}
function coloreCella(c: CellaTabella): Rgb {
  if (typeof c === 'string' || !c.tono) return PALETTE.testo
  return coloreTono(c.tono)
}

type ComandoTesto = { tipo: 'testo'; x: number; y: number; testo: string; dimensione: number; peso: PesoFont; colore: Rgb }
type ComandoLinea = { tipo: 'linea'; x1: number; y1: number; x2: number; y2: number; colore: Rgb; spessore: number }
type ComandoRettangolo = { tipo: 'rettangolo'; x: number; y: number; larghezza: number; altezza: number; colore: Rgb }
type Comando = ComandoTesto | ComandoLinea | ComandoRettangolo

const LARGHEZZA_PAGINA = 595.28 // A4 in punti
const ALTEZZA_PAGINA = 841.89
const MARGINE = 42
// Spazio riservato in basso per il piè di pagina (linea + "Nome — Pagina X
// di Y"): garantisciSpazio non lascia mai scrivere sopra questa soglia.
const ZONA_FOOTER = 46

export class DocumentoPdf {
  private pagine: Comando[][] = [[]]
  private y = ALTEZZA_PAGINA - MARGINE
  private readonly larghezzaUtile = LARGHEZZA_PAGINA - MARGINE * 2
  // Nome mostrato nel piè di pagina di ogni pagina: impostato da
  // intestazioneReport, così il documento resta identificabile anche
  // separato dalla prima pagina.
  private titoloFooter = ''

  private paginaCorrente(): Comando[] {
    return this.pagine[this.pagine.length - 1]
  }

  private nuovaPagina() {
    this.pagine.push([])
    this.y = ALTEZZA_PAGINA - MARGINE
  }

  // Garantisce almeno `altezza` punti liberi prima della zona del piè di
  // pagina, aprendo una nuova pagina se necessario — così una tabella o un
  // paragrafo non vengono mai tagliati a metà, né finiscono sopra al footer.
  private garantisciSpazio(altezza: number) {
    if (this.y - altezza < ZONA_FOOTER) this.nuovaPagina()
  }

  private testo(x: number, y: number, testo: string, dimensione: number, peso: PesoFont, colore: Rgb = PALETTE.testo) {
    this.paginaCorrente().push({ tipo: 'testo', x, y, testo, dimensione, peso, colore })
  }

  private linea(x1: number, x2: number, y: number, colore: Rgb = PALETTE.riga, spessore = 0.75) {
    this.paginaCorrente().push({ tipo: 'linea', x1, y1: y, x2, y2: y, colore, spessore })
  }

  // x/yAlto = angolo superiore sinistro nel nostro sistema di riferimento
  // (this.y scende scorrendo la pagina) — internamente si converte nella
  // coordinata PDF (angolo inferiore sinistro + altezza).
  private rettangolo(x: number, yAlto: number, larghezza: number, altezza: number, colore: Rgb) {
    this.paginaCorrente().push({ tipo: 'rettangolo', x, y: yAlto - altezza, larghezza, altezza, colore })
  }

  spazio(altezza: number) {
    this.y -= altezza
  }

  // Banda di intestazione a piena pagina (bordo a bordo): nome della
  // simulazione, sottotitolo (tipo + data) e un badge opzionale con l'esito
  // (Raggiunto/Parziale/Non raggiunto/Insufficiente) — stessa informazione e
  // stessi colori della mini-card "Ultime simulazioni" a schermo. Va
  // chiamata una sola volta, come primo elemento del documento.
  intestazioneReport(titolo: string, sottotitolo: string, distintivo?: { testo: string; tono: 'successo' | 'avviso' | 'pericolo' }) {
    this.titoloFooter = titolo || 'Investrick'

    const dimTitolo = 19
    const dimSottotitolo = 10.5
    const padSuperiore = 26
    const padInferiore = 22
    const eyebrowH = 20

    const larghezzaBadge = distintivo ? larghezzaTesto(distintivo.testo, 9, 'grassetto') + 20 : 0
    const larghezzaTitoloDisponibile = this.larghezzaUtile - (distintivo ? larghezzaBadge + 16 : 0)
    const righeTitolo = spezzaRighe(titolo, Math.max(larghezzaTitoloDisponibile, 120), dimTitolo, 'grassetto').slice(0, 2)
    const altezzaRigaTitolo = dimTitolo * 1.28

    const altezzaBanda =
      padSuperiore + eyebrowH + righeTitolo.length * altezzaRigaTitolo + 6 + dimSottotitolo * 1.3 + padInferiore

    this.rettangolo(0, ALTEZZA_PAGINA, LARGHEZZA_PAGINA, altezzaBanda, PALETTE.primario)

    // Eyebrow — piccola etichetta sopra il titolo, come su un vero report.
    this.testo(MARGINE, ALTEZZA_PAGINA - padSuperiore, 'INVESTRICK · REPORT DI RIBILANCIAMENTO', 8.5, 'grassetto', PALETTE.primarioVivido)

    let yTitolo = ALTEZZA_PAGINA - padSuperiore - eyebrowH
    for (const riga of righeTitolo) {
      this.testo(MARGINE, yTitolo, riga, dimTitolo, 'grassetto', PALETTE.bianco)
      yTitolo -= altezzaRigaTitolo
    }

    this.testo(MARGINE, yTitolo - 4, sottotitolo, dimSottotitolo, 'normale', PALETTE.sottotitoloSuBanda)

    if (distintivo) {
      const altezzaPillola = 22
      const yPillola = ALTEZZA_PAGINA - padSuperiore - 4
      const xPillola = LARGHEZZA_PAGINA - MARGINE - larghezzaBadge
      this.rettangolo(xPillola, yPillola, larghezzaBadge, altezzaPillola, coloreToneSolido(distintivo.tono))
      this.testo(xPillola + 10, yPillola - altezzaPillola + 7.5, distintivo.testo, 9, 'grassetto', PALETTE.bianco)
    }

    this.y = ALTEZZA_PAGINA - altezzaBanda - 26
  }

  // Titolo di sezione: testo in blu primario con un piccolo accento colorato
  // sotto, al posto del semplice grassetto nero — separa visivamente le
  // sezioni di un report lungo (vendite, riscatti, tabella soluzione, ...).
  sottotitolo(testo: string) {
    this.garantisciSpazio(30)
    this.testo(MARGINE, this.y, testo, 13, 'grassetto', PALETTE.primario)
    this.y -= 9
    this.rettangolo(MARGINE, this.y + 4, 26, 2.6, PALETTE.primario)
    this.y -= 14
  }

  // Un paragrafo può andare a capo su più righe: ognuna prenota il proprio
  // spazio verticale (così una riga non finisce mai a cavallo di due
  // pagine). `tono` colora il testo come farebbe --warning/--success/
  // --danger a schermo (es. i messaggi di esito della simulazione).
  paragrafo(testo: string, opzioni?: { grassetto?: boolean; dimensione?: number; tono?: Tono }) {
    const dimensione = opzioni?.dimensione ?? 10.5
    const peso: PesoFont = opzioni?.grassetto ? 'grassetto' : 'normale'
    const colore = coloreTono(opzioni?.tono)
    const righe = spezzaRighe(testo, this.larghezzaUtile, dimensione, peso)
    const altezzaRiga = dimensione * 1.35
    for (const riga of righe) {
      this.garantisciSpazio(altezzaRiga)
      this.testo(MARGINE, this.y, riga, dimensione, peso, colore)
      this.y -= altezzaRiga
    }
  }

  // Casella di avviso: stessa idea della fascia gialla/rossa/verde usata nel
  // wizard e nella pagina risultato (sfondo tenue, testo in grassetto nel
  // colore del tono, più una barra piena sul bordo sinistro).
  casella(testo: string, tono: 'successo' | 'pericolo' | 'avviso') {
    const dimensione = 10.5
    const padOrizzontale = 14
    const padVerticale = 10
    const barraLarghezza = 4
    const xTesto = MARGINE + barraLarghezza + padOrizzontale
    const larghezzaTestoDisponibile = this.larghezzaUtile - barraLarghezza - padOrizzontale * 2
    const righe = spezzaRighe(testo, larghezzaTestoDisponibile, dimensione, 'grassetto')
    const altezzaRiga = dimensione * 1.35
    const altezzaBox = padVerticale * 2 + righe.length * altezzaRiga

    this.garantisciSpazio(altezzaBox + 8)
    const boxTop = this.y

    this.rettangolo(MARGINE, boxTop, this.larghezzaUtile, altezzaBox, coloreToneChiaro(tono))
    this.rettangolo(MARGINE, boxTop, barraLarghezza, altezzaBox, coloreToneSolido(tono))

    let cursore = boxTop - padVerticale - dimensione * 0.85
    for (const riga of righe) {
      this.testo(xTesto, cursore, riga, dimensione, 'grassetto', coloreToneSolido(tono))
      cursore -= altezzaRiga
    }

    this.y = boxTop - altezzaBox - 10
  }

  lineaSeparatrice() {
    this.garantisciSpazio(10)
    this.y -= 4
    this.linea(MARGINE, LARGHEZZA_PAGINA - MARGINE, this.y, PALETTE.riga)
    this.y -= 6
  }

  // Tabella con intestazione a bandiera piena (sfondo blu primario, testo
  // bianco) e colonne a larghezza proporzionale al contenuto, non tutte
  // uguali. Due categorie fra le colonne automatiche: quelle allineate a
  // destra (di norma numeri/valute/percentuali) prendono per intero la
  // larghezza che serve al loro valore più lungo e non si comprimono mai —
  // un importo che va a capo a metà cifra è illeggibile — mentre la colonna
  // di testo libero (di norma la prima: strumento/asset/polizza) si prende
  // quel che resta e può invece spezzare il nome su più righe.
  tabella(colonne: ColonnaTabella[], righe: CellaTabella[][]) {
    const dimensione = 9.5
    const dimensioneHeader = 8.5
    const altezzaRiga = 14
    const altezzaRigaHeader = 12
    const padding = 6

    const larghezzeEsplicite = colonne.map((c) => c.larghezza)
    const larghezzaFissata = larghezzeEsplicite.reduce((acc: number, l) => acc + (l ?? 0), 0)

    // Larghezza "desiderata" di ogni colonna automatica: la più lunga fra
    // intestazione e celle.
    const desiderata = colonne.map((c, i) => {
      if (larghezzeEsplicite[i] !== undefined) return 0
      const larghezzaIntestazione = larghezzaTesto(c.intestazione.toUpperCase(), dimensioneHeader, 'grassetto')
      const larghezzaMaxCella = righe.reduce((max, r) => Math.max(max, larghezzaTesto(testoCella(r[i] ?? ''), dimensione, 'normale')), 0)
      // +0.5pt di margine oltre al padding: senza questo, quando
      // l'intestazione è il termine dominante del max() il giro
      // larghezza→(-padding)→larghezza nel wrapping dell'header può perdere
      // l'ultimo bit per arrotondamento in virgola mobile e far scattare un
      // a-capo indesiderato proprio al confine esatto (es. "PESO" / "FINALE"
      // anche se "PESO FINALE" ci starebbe su una riga sola).
      return Math.max(larghezzaIntestazione, larghezzaMaxCella) + padding * 2 + 0.5
    })

    const indiciStretti = colonne.map((_, i) => i).filter((i) => larghezzeEsplicite[i] === undefined && colonne[i].allineaDestra)
    const indiciLiberi = colonne.map((_, i) => i).filter((i) => larghezzeEsplicite[i] === undefined && !colonne[i].allineaDestra)
    const larghezzaStretti = indiciStretti.reduce((acc, i) => acc + desiderata[i], 0)
    const larghezzaResiduaLiberi = Math.max(this.larghezzaUtile - larghezzaFissata - larghezzaStretti, 0)
    const desiderataLiberi = indiciLiberi.reduce((acc, i) => acc + desiderata[i], 0)

    const larghezze = colonne.map((c, i) => {
      if (larghezzeEsplicite[i] !== undefined) return larghezzeEsplicite[i] as number
      if (c.allineaDestra) return desiderata[i]
      return desiderataLiberi > 0
        ? (desiderata[i] / desiderataLiberi) * larghezzaResiduaLiberi
        : larghezzaResiduaLiberi / (indiciLiberi.length || 1)
    })

    const posizioniX: number[] = []
    let cursoreX = MARGINE
    for (const l of larghezze) {
      posizioniX.push(cursoreX)
      cursoreX += l
    }

    // Intestazione: sfondo pieno colore primario, testo bianco maiuscolo,
    // può andare a capo su più righe come le celle dati.
    const righeHeaderPerColonna = colonne.map((c, i) => spezzaRighe(c.intestazione.toUpperCase(), larghezze[i] - padding * 2, dimensioneHeader, 'grassetto'))
    const numeroRigheHeader = Math.max(1, ...righeHeaderPerColonna.map((r) => r.length))
    const padVerticaleHeader = 6
    const altezzaHeader = numeroRigheHeader * altezzaRigaHeader + padVerticaleHeader * 2

    this.garantisciSpazio(altezzaHeader + altezzaRiga * 2)
    const headerTop = this.y
    this.rettangolo(MARGINE, headerTop, this.larghezzaUtile, altezzaHeader, PALETTE.primario)
    colonne.forEach((c, i) => {
      let cursoreY = headerTop - padVerticaleHeader - dimensioneHeader * 0.85
      for (const riga of righeHeaderPerColonna[i]) {
        const x = c.allineaDestra
          ? posizioniX[i] + larghezze[i] - padding - larghezzaTesto(riga, dimensioneHeader, 'grassetto')
          : posizioniX[i] + padding
        this.testo(x, cursoreY, riga, dimensioneHeader, 'grassetto', PALETTE.bianco)
        cursoreY -= altezzaRigaHeader
      }
    })
    // +4pt oltre al bordo della fascia colorata: la y di un testo è la sua
    // baseline, quindi senza questo margine la parte alta delle cifre della
    // prima riga (l'ascendente) risalirebbe dentro il rettangolo blu
    // dell'intestazione — impercettibile su testo scuro, ben visibile sulle
    // celle rosse/verdi per il contrasto col blu.
    this.y = headerTop - altezzaHeader - 4

    for (const riga of righe) {
      // Ogni cella può andare a capo: l'altezza della riga di tabella è la
      // più alta fra tutte le sue celle.
      const righeCella = riga.map((valore, i) => spezzaRighe(testoCella(valore), larghezze[i] - padding * 2, dimensione, 'normale'))
      const numeroRigheMax = Math.max(1, ...righeCella.map((r) => r.length))
      this.garantisciSpazio(numeroRigheMax * altezzaRiga + 4)

      // y calcolata dal livello, non da this.y decrementato dentro il ciclo:
      // altrimenti la seconda colonna di uno stesso livello finirebbe più in
      // basso della prima (this.y sarebbe già stato decrementato da lei).
      const rigaTop = this.y
      for (let livello = 0; livello < numeroRigheMax; livello++) {
        const y = rigaTop - livello * altezzaRiga
        riga.forEach((valore, i) => {
          const testoLivello = righeCella[i][livello]
          if (testoLivello === undefined) return
          const colonna = colonne[i]
          const x = colonna.allineaDestra
            ? posizioniX[i] + larghezze[i] - padding - larghezzaTesto(testoLivello, dimensione, 'normale')
            : posizioniX[i] + padding
          this.testo(x, y, testoLivello, dimensione, 'normale', coloreCella(valore))
        })
      }
      this.y = rigaTop - numeroRigheMax * altezzaRiga
      this.y -= 2
      this.linea(MARGINE, LARGHEZZA_PAGINA - MARGINE, this.y, PALETTE.riga)
      this.y -= 5
    }
    this.y -= 4
  }

  // Serializza in bytes PDF validi: header, oggetti (catalogo, pagine, 2
  // font standard, una coppia pagina+content-stream per pagina), xref e
  // trailer con gli offset esatti calcolati durante la scrittura. Il piè di
  // pagina (linea + nome simulazione + numero pagina) si genera qui, non
  // durante il layout: solo a questo punto si conosce il numero totale di
  // pagine.
  bytes(): Uint8Array<ArrayBuffer> {
    const numeroPagine = this.pagine.length
    const yLineaFooter = 34
    const yTestoFooter = 20
    const dimFooter = 8

    const pagineConFooter: Comando[][] = this.pagine.map((comandi, i) => {
      const numero = `Pagina ${i + 1} di ${numeroPagine}`
      const larghezzaNumero = larghezzaTesto(numero, dimFooter, 'normale')
      const footer: Comando[] = [
        { tipo: 'linea', x1: MARGINE, y1: yLineaFooter, x2: LARGHEZZA_PAGINA - MARGINE, y2: yLineaFooter, colore: PALETTE.riga, spessore: 0.75 },
        { tipo: 'testo', x: MARGINE, y: yTestoFooter, testo: this.titoloFooter || 'Investrick', dimensione: dimFooter, peso: 'normale', colore: PALETTE.testoMuto },
        {
          tipo: 'testo',
          x: LARGHEZZA_PAGINA - MARGINE - larghezzaNumero,
          y: yTestoFooter,
          testo: numero,
          dimensione: dimFooter,
          peso: 'normale',
          colore: PALETTE.testoMuto,
        },
      ]
      return [...comandi, ...footer]
    })

    const parti: Uint8Array[] = []
    let lunghezza = 0
    const offsets: number[] = [0] // indice 0 non usato (l'oggetto 0 del PDF è sempre libero)

    function scrivi(bytes: Uint8Array) {
      parti.push(bytes)
      lunghezza += bytes.length
    }
    function scriviAscii(testo: string) {
      scrivi(codificaAscii(testo))
    }
    function iniziaOggetto(numero: number) {
      offsets[numero] = lunghezza
      scriviAscii(`${numero} 0 obj\n`)
    }
    function chiudiOggetto() {
      scriviAscii('endobj\n')
    }

    const primoOggettoPagina = 5 // 1=Catalog 2=Pages 3=F1 4=F2
    const numeroOggettoPagina = (i: number) => primoOggettoPagina + i * 2
    const numeroOggettoContenuto = (i: number) => primoOggettoPagina + i * 2 + 1
    const totaleOggetti = primoOggettoPagina + numeroPagine * 2 - 1

    scriviAscii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

    // 1: Catalog
    iniziaOggetto(1)
    scriviAscii('<< /Type /Catalog /Pages 2 0 R >>\n')
    chiudiOggetto()

    // 2: Pages
    iniziaOggetto(2)
    const kids = Array.from({ length: numeroPagine }, (_, i) => `${numeroOggettoPagina(i)} 0 R`).join(' ')
    scriviAscii(`<< /Type /Pages /Kids [ ${kids} ] /Count ${numeroPagine} >>\n`)
    chiudiOggetto()

    // 3, 4: font standard
    iniziaOggetto(3)
    scriviAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n')
    chiudiOggetto()
    iniziaOggetto(4)
    scriviAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n')
    chiudiOggetto()

    // Pagine + content stream
    pagineConFooter.forEach((comandi, i) => {
      const contenutoParti: Uint8Array[] = []
      let contenutoLunghezza = 0
      const aggiungiContenuto = (b: Uint8Array) => {
        contenutoParti.push(b)
        contenutoLunghezza += b.length
      }
      const aggiungiContenutoAscii = (s: string) => aggiungiContenuto(codificaAscii(s))
      const rgb = (c: Rgb) => c.map((v) => v.toFixed(3)).join(' ')

      for (const comando of comandi) {
        if (comando.tipo === 'linea') {
          aggiungiContenutoAscii(
            `q ${rgb(comando.colore)} RG ${comando.spessore.toFixed(2)} w ${comando.x1.toFixed(2)} ${comando.y1.toFixed(2)} m ${comando.x2.toFixed(2)} ${comando.y2.toFixed(2)} l S Q\n`
          )
        } else if (comando.tipo === 'rettangolo') {
          aggiungiContenutoAscii(
            `q ${rgb(comando.colore)} rg ${comando.x.toFixed(2)} ${comando.y.toFixed(2)} ${comando.larghezza.toFixed(2)} ${comando.altezza.toFixed(2)} re f Q\n`
          )
        } else {
          const font = comando.peso === 'grassetto' ? '/F2' : '/F1'
          aggiungiContenutoAscii(`q ${rgb(comando.colore)} rg BT ${font} ${comando.dimensione} Tf ${comando.x.toFixed(2)} ${comando.y.toFixed(2)} Td (`)
          aggiungiContenuto(escapePdfString(codificaWinAnsi(comando.testo)))
          aggiungiContenutoAscii(') Tj ET Q\n')
        }
      }

      const numPagina = numeroOggettoPagina(i)
      const numContenuto = numeroOggettoContenuto(i)

      iniziaOggetto(numPagina)
      scriviAscii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGHEZZA_PAGINA} ${ALTEZZA_PAGINA}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${numContenuto} 0 R >>\n`
      )
      chiudiOggetto()

      iniziaOggetto(numContenuto)
      scriviAscii(`<< /Length ${contenutoLunghezza} >>\nstream\n`)
      for (const p of contenutoParti) scrivi(p)
      scriviAscii('\nendstream\n')
      chiudiOggetto()
    })

    // xref
    const inizioXref = lunghezza
    scriviAscii(`xref\n0 ${totaleOggetti + 1}\n`)
    scriviAscii('0000000000 65535 f \n')
    for (let n = 1; n <= totaleOggetti; n++) {
      scriviAscii(`${offsets[n].toString().padStart(10, '0')} 00000 n \n`)
    }
    scriviAscii(`trailer\n<< /Size ${totaleOggetti + 1} /Root 1 0 R >>\nstartxref\n${inizioXref}\n%%EOF`)

    const risultato = new Uint8Array(lunghezza)
    let cursore = 0
    for (const p of parti) {
      risultato.set(p, cursore)
      cursore += p.length
    }
    return risultato
  }
}

// Avvia il download nel browser: Blob + <a download>, stesso schema già
// usato per gli export Excel della sezione Gestione dati.
export function scaricaPdf(doc: DocumentoPdf, nomeFile: string) {
  const blob = new Blob([doc.bytes()], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeFile
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
