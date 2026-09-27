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
// Copre solo ciò che serve per esportare il risultato di una simulazione:
// testo con a capo automatico, un titolo/sottotitolo, tabelle semplici con
// intestazione ed eventuale colonna numerica allineata a destra, più pagine
// se il contenuto eccede la prima. Font Helvetica/Helvetica-Bold standard
// (nessun embedding necessario, sempre disponibili in qualunque lettore
// PDF), con codifica WinAnsi: copre l'italiano (à, è, é, ì, ò, ù e
// maiuscole), l'euro e i trattini/ellissi che l'app usa nei testi.

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

type ColonnaTabella = { intestazione: string; allineaDestra?: boolean; larghezza?: number }

type ComandoTesto = { tipo: 'testo'; x: number; y: number; testo: string; dimensione: number; peso: PesoFont; grigio?: number }
type ComandoLinea = { tipo: 'linea'; x1: number; y1: number; x2: number; y2: number; grigio: number }
type Comando = ComandoTesto | ComandoLinea

const LARGHEZZA_PAGINA = 595.28 // A4 in punti
const ALTEZZA_PAGINA = 841.89
const MARGINE = 42

export class DocumentoPdf {
  private pagine: Comando[][] = [[]]
  private y = ALTEZZA_PAGINA - MARGINE
  private readonly larghezzaUtile = LARGHEZZA_PAGINA - MARGINE * 2

  private paginaCorrente(): Comando[] {
    return this.pagine[this.pagine.length - 1]
  }

  private nuovaPagina() {
    this.pagine.push([])
    this.y = ALTEZZA_PAGINA - MARGINE
  }

  // Garantisce almeno `altezza` punti liberi prima del margine inferiore,
  // aprendo una nuova pagina se necessario — così una tabella o un paragrafo
  // non vengono mai tagliati a metà tra il testo e il bordo del foglio.
  private garantisciSpazio(altezza: number) {
    if (this.y - altezza < MARGINE) this.nuovaPagina()
  }

  private testo(x: number, testo: string, dimensione: number, peso: PesoFont, grigio = 0) {
    this.paginaCorrente().push({ tipo: 'testo', x, y: this.y, testo, dimensione, peso, grigio })
  }

  private linea(x1: number, x2: number, grigio: number) {
    this.paginaCorrente().push({ tipo: 'linea', x1, y1: this.y, x2, y2: this.y, grigio })
  }

  spazio(altezza: number) {
    this.y -= altezza
  }

  titolo(testo: string) {
    this.garantisciSpazio(26)
    this.testo(MARGINE, testo, 18, 'grassetto')
    this.y -= 26
  }

  sottotitolo(testo: string) {
    this.garantisciSpazio(20)
    this.testo(MARGINE, testo, 13, 'grassetto')
    this.y -= 20
  }

  // Un paragrafo può andare a capo su più righe: ognuna prenota il proprio
  // spazio verticale (così una riga non finisce mai a cavallo di due pagine).
  paragrafo(testo: string, opzioni?: { grassetto?: boolean; dimensione?: number; grigio?: number }) {
    const dimensione = opzioni?.dimensione ?? 10.5
    const peso: PesoFont = opzioni?.grassetto ? 'grassetto' : 'normale'
    const righe = spezzaRighe(testo, this.larghezzaUtile, dimensione, peso)
    const altezzaRiga = dimensione * 1.35
    for (const riga of righe) {
      this.garantisciSpazio(altezzaRiga)
      this.testo(MARGINE, riga, dimensione, peso, opzioni?.grigio)
      this.y -= altezzaRiga
    }
  }

  lineaSeparatrice() {
    this.garantisciSpazio(10)
    this.y -= 4
    this.linea(MARGINE, LARGHEZZA_PAGINA - MARGINE, 0.75)
    this.y -= 6
  }

  // Tabella semplice: intestazione in grassetto con riga sotto, poi le righe
  // dati separate da un filo sottile — stesso principio "flat" (niente
  // sfondo a zebra, niente arrotondamenti) usato nel resto dell'app.
  tabella(colonne: ColonnaTabella[], righe: string[][]) {
    const dimensione = 9.5
    const altezzaRiga = 14
    const padding = 4
    const larghezzeEsplicite = colonne.map((c) => c.larghezza)
    const larghezzaFissata = larghezzeEsplicite.reduce((acc: number, l) => acc + (l ?? 0), 0)
    const colonneAutomatiche = colonne.filter((_, i) => larghezzeEsplicite[i] === undefined).length
    const larghezzaAutomatica = colonneAutomatiche > 0 ? (this.larghezzaUtile - larghezzaFissata) / colonneAutomatiche : 0
    const larghezze = colonne.map((c) => c.larghezza ?? larghezzaAutomatica)

    const posizioniX: number[] = []
    let cursore = MARGINE
    for (const l of larghezze) {
      posizioniX.push(cursore)
      cursore += l
    }

    this.garantisciSpazio(altezzaRiga * 2)
    // Intestazione
    colonne.forEach((c, i) => {
      const x = c.allineaDestra ? posizioniX[i] + larghezze[i] - padding - larghezzaTesto(c.intestazione, dimensione, 'grassetto') : posizioniX[i] + padding
      this.testo(x, c.intestazione, dimensione, 'grassetto')
    })
    this.y -= 4
    this.linea(MARGINE, LARGHEZZA_PAGINA - MARGINE, 0.75)
    this.y -= altezzaRiga - 4

    for (const riga of righe) {
      // Ogni cella può andare a capo: l'altezza della riga di tabella è la
      // più alta fra tutte le sue celle.
      const righeCella = riga.map((valore, i) => spezzaRighe(valore, larghezze[i] - padding * 2, dimensione, 'normale'))
      const numeroRigheMax = Math.max(1, ...righeCella.map((r) => r.length))
      this.garantisciSpazio(numeroRigheMax * altezzaRiga + 4)

      for (let livello = 0; livello < numeroRigheMax; livello++) {
        riga.forEach((_, i) => {
          const testoLivello = righeCella[i][livello]
          if (testoLivello === undefined) return
          const colonna = colonne[i]
          const x = colonna.allineaDestra
            ? posizioniX[i] + larghezze[i] - padding - larghezzaTesto(testoLivello, dimensione, 'normale')
            : posizioniX[i] + padding
          this.testo(x, testoLivello, dimensione, 'normale')
        })
        this.y -= altezzaRiga
      }
      // this.y è ora subito sotto l'ultima riga di testo della cella: un
      // piccolo margine, il filo separatore, un altro margine prima della
      // riga successiva.
      this.y -= 2
      this.linea(MARGINE, LARGHEZZA_PAGINA - MARGINE, 0.9)
      this.y -= 3
    }
    this.y -= 6
  }

  // Serializza in bytes PDF validi: header, oggetti (catalogo, pagine, 2
  // font standard, una coppia pagina+content-stream per pagina), xref e
  // trailer con gli offset esatti calcolati durante la scrittura.
  bytes(): Uint8Array {
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

    const numeroPagine = this.pagine.length
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
    this.pagine.forEach((comandi, i) => {
      const contenutoParti: Uint8Array[] = []
      let contenutoLunghezza = 0
      const aggiungiContenuto = (b: Uint8Array) => {
        contenutoParti.push(b)
        contenutoLunghezza += b.length
      }
      const aggiungiContenutoAscii = (s: string) => aggiungiContenuto(codificaAscii(s))

      for (const comando of comandi) {
        if (comando.tipo === 'linea') {
          const grigio = comando.grigio
          aggiungiContenutoAscii(`q ${grigio.toFixed(3)} G 0.75 w ${comando.x1.toFixed(2)} ${comando.y1.toFixed(2)} m ${comando.x2.toFixed(2)} ${comando.y2.toFixed(2)} l S Q\n`)
        } else {
          const font = comando.peso === 'grassetto' ? '/F2' : '/F1'
          const grigio = comando.grigio ?? 0
          aggiungiContenutoAscii(`q ${grigio.toFixed(3)} g BT ${font} ${comando.dimensione} Tf ${comando.x.toFixed(2)} ${comando.y.toFixed(2)} Td (`)
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
