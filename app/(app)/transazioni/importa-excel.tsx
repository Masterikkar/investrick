'use client'

import { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { creaAssetPerImport, importaTransazioniBulk, type RigaImport } from './actions'
import { OPERAZIONE_DA_ETICHETTA } from '@/lib/operazioni'
import { IconaDownload } from '@/components/icone'

type StrumentoBase = { id: string; isin: string | null; ticker: string | null; nome: string }
type ContenitoreBase = { id: string; nome: string }

function testoCella(v: unknown): string {
  return String(v ?? '').trim()
}

function parseNumeroCella(v: unknown, permettiVuoto: boolean): number | null {
  if (v === '' || v === null || v === undefined) return permettiVuoto ? 0 : null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const pulito = String(v).trim().replace(',', '.')
  if (pulito === '') return permettiVuoto ? 0 : null
  const n = Number(pulito)
  return Number.isFinite(n) ? n : null
}

const EPOCA_EXCEL_UTC = Date.UTC(1899, 11, 30)

function parseDataCella(v: unknown): string | null {
  if (v instanceof Date) {
    const anno = v.getUTCFullYear()
    const mese = v.getUTCMonth() + 1
    const giorno = v.getUTCDate()
    return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
  }
  if (typeof v === 'number') {
    const d = new Date(EPOCA_EXCEL_UTC + v * 86400000)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  const s = String(v ?? '').trim()
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const giorno = Number(m[1])
  const mese = Number(m[2])
  const anno = Number(m[3])
  const d = new Date(anno, mese - 1, giorno)
  if (d.getFullYear() !== anno || d.getMonth() !== mese - 1 || d.getDate() !== giorno) return null
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
}

type Identificatore = { tipo: 'isin' | 'ticker'; valore: string }

type RigaParsata = {
  numeroRiga: number
  errore: string | null
  data: string
  identificatore: Identificatore | null
  operazioneDb: string
  quantita: number
  prezzoUnitario: number
  commissione: number
  tassaTrattenuta: number
  contenitoreId: string | null
}

function elabora(righeExcel: Record<string, unknown>[], mappaContenitori: Map<string, string>): RigaParsata[] {
  return righeExcel.map((riga, idx) => {
    const numeroRiga = idx + 2
    const isinRaw = testoCella(riga['ISIN']).toUpperCase()
    const tickerRaw = testoCella(riga['Ticker']).toUpperCase()
    const operazioneRaw = testoCella(riga['Operazione'])
    const contenitoreRaw = testoCella(riga['Contenitore'])

    const identificatore: Identificatore | null = isinRaw
      ? { tipo: 'isin', valore: isinRaw }
      : tickerRaw
      ? { tipo: 'ticker', valore: tickerRaw }
      : null

    const data = parseDataCella(riga['Data'])
    const operazioneDb = OPERAZIONE_DA_ETICHETTA[operazioneRaw]
    const quantita = parseNumeroCella(riga['Quantità'], false)
    const prezzoUnitario = parseNumeroCella(riga['Prezzo unitario'], false)
    const commissione = parseNumeroCella(riga['Commissione'], true)
    const tassaTrattenuta = parseNumeroCella(riga['Tassa trattenuta'], true)

    let contenitoreId: string | null = null
    let contenitoreNonTrovato: string | null = null
    if (contenitoreRaw === '' || contenitoreRaw.toLowerCase() === 'diretto') {
      contenitoreId = null
    } else {
      const trovato = mappaContenitori.get(contenitoreRaw.toLowerCase())
      if (trovato) contenitoreId = trovato
      else contenitoreNonTrovato = contenitoreRaw
    }

    let errore: string | null = null
    if (!identificatore) errore = 'ISIN o Ticker mancante (serve almeno uno dei due)'
    else if (!data) errore = `data non valida: "${testoCella(riga['Data'])}"`
    else if (!operazioneDb) errore = `operazione non riconosciuta: "${operazioneRaw}"`
    else if (quantita === null || quantita <= 0) errore = `quantità non valida: "${testoCella(riga['Quantità'])}"`
    else if (prezzoUnitario === null || prezzoUnitario < 0) errore = `prezzo unitario non valido: "${testoCella(riga['Prezzo unitario'])}"`
    else if (commissione === null) errore = `commissione non valida: "${testoCella(riga['Commissione'])}"`
    else if (tassaTrattenuta === null) errore = `tassa trattenuta non valida: "${testoCella(riga['Tassa trattenuta'])}"`
    else if (contenitoreNonTrovato) errore = `contenitore non trovato: "${contenitoreNonTrovato}"`

    return {
      numeroRiga,
      errore,
      data: data ?? '',
      identificatore,
      operazioneDb: operazioneDb ?? '',
      quantita: quantita ?? 0,
      prezzoUnitario: prezzoUnitario ?? 0,
      commissione: commissione ?? 0,
      tassaTrattenuta: tassaTrattenuta ?? 0,
      contenitoreId,
    }
  })
}

const stileCampo: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
}

const stileBottonePrimario: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  fontSize: 'var(--fs-button)',
  fontWeight: 500,
  cursor: 'pointer',
}

function RisolviStrumento({
  identificatore,
  tipiPerCategoria,
  onRisolto,
}: {
  identificatore: Identificatore
  tipiPerCategoria: Record<string, string[]>
  onRisolto: (identificatore: Identificatore, strumentoId: string) => void
}) {
  const categorie = Object.keys(tipiPerCategoria)
  const [categoria, setCategoria] = useState(categorie[0] ?? '')
  const [tipo, setTipo] = useState(tipiPerCategoria[categorie[0]]?.[0] ?? '')
  const [nome, setNome] = useState('')
  const [ticker, setTicker] = useState(identificatore.tipo === 'ticker' ? identificatore.valore : '')
  const [valuta, setValuta] = useState('EUR')
  const [codicePrezzo, setCodicePrezzo] = useState('')
  const [titoloDiStato, setTitoloDiStato] = useState(false)
  const [percentualeTitoliStato, setPercentualeTitoliStato] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const isObbligazioni = categoria === 'Obbligazioni'

  async function handleSalva() {
    if (!nome.trim()) {
      setErrore('Il nome è obbligatorio.')
      return
    }
    setSalvataggio(true)
    setErrore(null)
    const risultato = await creaAssetPerImport({
      categoria,
      tipo,
      nome,
      ticker,
      isin: identificatore.tipo === 'isin' ? identificatore.valore : '',
      valuta,
      codicePrezzo,
      titoloDiStato,
      percentualeTitoliStato: percentualeTitoliStato ? Number(percentualeTitoliStato) : null,
    })
    setSalvataggio(false)
    if ('errore' in risultato) {
      setErrore(risultato.errore)
      return
    }
    onRisolto(identificatore, risultato.id)
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--warning)', padding: 16, marginTop: 12, color: 'var(--text-primary)' }}>
      <div style={{ fontWeight: 500, marginBottom: 8 }}>
        {identificatore.tipo === 'isin'
          ? `ISIN sconosciuto: ${identificatore.valore}`
          : `Ticker sconosciuto (nessun ISIN nel file): ${identificatore.valore}`}
      </div>
      {errore && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{errore}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}>
        <label>
          Categoria
          <select
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value)
              setTipo(tipiPerCategoria[e.target.value]?.[0] ?? '')
            }}
            style={stileCampo}
          >
            {categorie.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={stileCampo}>
            {(tipiPerCategoria[categoria] ?? []).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Nome
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} style={stileCampo} />
        </label>
        <label>
          Ticker
          <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value)} style={stileCampo} />
        </label>
        <label>
          Valuta
          <input type="text" value={valuta} onChange={(e) => setValuta(e.target.value)} style={stileCampo} />
        </label>
        <label>
          Codice prezzo (EODHD)
          <input type="text" value={codicePrezzo} onChange={(e) => setCodicePrezzo(e.target.value)} style={stileCampo} />
        </label>
        {isObbligazioni && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={titoloDiStato} onChange={(e) => setTitoloDiStato(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
              Titolo di Stato
            </label>
            <label>
              % titoli di Stato (whitelist)
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={percentualeTitoliStato}
                onChange={(e) => setPercentualeTitoliStato(e.target.value)}
                style={stileCampo}
              />
            </label>
          </>
        )}
        <button
          type="button"
          onClick={handleSalva}
          disabled={salvataggio}
          style={{ ...stileBottonePrimario, alignSelf: 'flex-start', opacity: salvataggio ? 0.6 : 1 }}
        >
          {salvataggio ? 'Creazione...' : 'Crea asset'}
        </button>
      </div>
    </div>
  )
}

export function ImportaExcel({
  strumenti,
  contenitori,
  tipiPerCategoria,
}: {
  strumenti: StrumentoBase[]
  contenitori: ContenitoreBase[]
  tipiPerCategoria: Record<string, string[]>
}) {
  const [righe, setRighe] = useState<RigaParsata[] | null>(null)
  const [mappaIsin, setMappaIsin] = useState<Map<string, string>>(
    () => new Map(strumenti.filter((s): s is StrumentoBase & { isin: string } => !!s.isin).map((s) => [s.isin.toUpperCase(), s.id]))
  )
  const [mappaTicker, setMappaTicker] = useState<Map<string, string>>(
    () => new Map(strumenti.filter((s): s is StrumentoBase & { ticker: string } => !!s.ticker).map((s) => [s.ticker.toUpperCase(), s.id]))
  )
  const [risultato, setRisultato] = useState<{ inserite: number; errori: { riga: number; messaggio: string }[]; avvisoRicostruzione?: string } | null>(null)
  const [importando, setImportando] = useState(false)
  const [erroreFile, setErroreFile] = useState<string | null>(null)

  const mappaContenitori = useMemo(
    () => new Map(contenitori.map((c) => [c.nome.toLowerCase(), c.id])),
    [contenitori]
  )

  function gestisciFile(file: File) {
    setRisultato(null)
    setErroreFile(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const dati = e.target?.result
        if (!dati) throw new Error('File vuoto')
        const workbook = XLSX.read(dati, { type: 'array', cellDates: true })
        const primoFoglio = workbook.SheetNames[0]
        if (!primoFoglio) throw new Error('Nessun foglio trovato nel file')
        const foglio = workbook.Sheets[primoFoglio]
        const righeGrezze = XLSX.utils.sheet_to_json<Record<string, unknown>>(foglio, { defval: '' })
        setRighe(elabora(righeGrezze, mappaContenitori))
      } catch (err) {
        setErroreFile(err instanceof Error ? err.message : 'Impossibile leggere il file')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function trovaStrumentoId(identificatore: Identificatore): string | undefined {
    return identificatore.tipo === 'isin' ? mappaIsin.get(identificatore.valore) : mappaTicker.get(identificatore.valore)
  }

  const righeValideFormato = (righe ?? []).filter((r) => !r.errore)
  const righeConErrore = (righe ?? []).filter((r) => r.errore)

  const identificatoriDaRisolvere = useMemo(() => {
    const mappa = new Map<string, Identificatore>()
    for (const r of righeValideFormato) {
      if (r.identificatore && trovaStrumentoId(r.identificatore) === undefined) {
        mappa.set(`${r.identificatore.tipo}:${r.identificatore.valore}`, r.identificatore)
      }
    }
    return Array.from(mappa.values())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [righeValideFormato, mappaIsin, mappaTicker])

  const righePronte = righeValideFormato.filter((r) => r.identificatore && trovaStrumentoId(r.identificatore) !== undefined)

  function handleRisolto(identificatore: Identificatore, strumentoId: string) {
    if (identificatore.tipo === 'isin') {
      setMappaIsin((prev) => new Map(prev).set(identificatore.valore, strumentoId))
    } else {
      setMappaTicker((prev) => new Map(prev).set(identificatore.valore, strumentoId))
    }
  }

  async function handleImporta() {
    if (!righe) return
    setImportando(true)
    const daInviare: RigaImport[] = righePronte.map((r) => ({
      rigaOriginale: r.numeroRiga,
      data: r.data,
      strumentoId: trovaStrumentoId(r.identificatore!)!,
      operazione: r.operazioneDb,
      quantita: r.quantita,
      prezzoUnitario: r.prezzoUnitario,
      commissione: r.commissione,
      tassaTrattenuta: r.tassaTrattenuta,
      contenitoreId: r.contenitoreId,
    }))
    const esito = await importaTransazioniBulk(daInviare)
    setImportando(false)
    setRisultato(esito)
    setRighe(null)
  }

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) gestisciFile(file)
        }}
        style={{
          maxWidth: 640,
          border: '2px dashed var(--border-default)',
          background: 'var(--bg-surface)',
          padding: 24,
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 'var(--fs-body)',
        }}
      >
        <p style={{ margin: 0 }}>Trascina qui il file Excel (.xlsx) delle transazioni, oppure</p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) gestisciFile(file)
          }}
          style={{ marginTop: 8 }}
        />
      </div>

      {erroreFile && <p style={{ color: 'var(--danger)', marginTop: 8 }}>{erroreFile}</p>}

      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 'var(--fs-body)', flexWrap: 'wrap', alignItems: 'center' }}>
        <a
          href="/template-transazioni.xlsx"
          download
          className="link-interattivo"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <IconaDownload />
          Scarica template vuoto
        </a>
        <span style={{ color: 'var(--text-secondary)' }}>
          &quot;Costo (in contanti)&quot; va inserito manualmente qui sotto — non è supportato dal file Excel. Per le crypto,
          lascia ISIN vuoto e usa Ticker.
        </span>
      </div>

      {risultato && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: risultato.errori.length === 0 ? 'var(--success)' : 'var(--warning)' }}>
            {risultato.inserite} transazioni importate.
            {risultato.errori.length > 0 && ` ${risultato.errori.length} righe non importate:`}
          </p>
          {risultato.errori.length > 0 && (
            <ul style={{ fontSize: 13, color: 'var(--danger)' }}>
              {risultato.errori.map((e, i) => (
                <li key={i}>Riga {e.riga}: {e.messaggio}</li>
              ))}
            </ul>
          )}
          {risultato.avvisoRicostruzione && (
            <p style={{ color: 'var(--warning)', fontSize: 13, marginTop: 8 }}>{risultato.avvisoRicostruzione}</p>
          )}
        </div>
      )}

      {righe && (
        <div style={{ marginTop: 16 }}>
          <p>
            {righeValideFormato.length} righe valide su {righe.length} lette dal file.
            {righeConErrore.length > 0 && ` ${righeConErrore.length} scartate per errori di formato.`}
          </p>

          {righeConErrore.length > 0 && (
            <ul style={{ fontSize: 13, color: 'var(--danger)', maxHeight: 160, overflowY: 'auto' }}>
              {righeConErrore.map((r) => (
                <li key={r.numeroRiga}>Riga {r.numeroRiga}: {r.errore}</li>
              ))}
            </ul>
          )}

          {identificatoriDaRisolvere.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: 'var(--warning)' }}>
                {identificatoriDaRisolvere.length} strumenti non trovati nel database — crea l&apos;asset per ciascuno prima di poter importare:
              </p>
              {identificatoriDaRisolvere.map((id) => (
                <RisolviStrumento
                  key={`${id.tipo}:${id.valore}`}
                  identificatore={id}
                  tipiPerCategoria={tipiPerCategoria}
                  onRisolto={handleRisolto}
                />
              ))}
            </div>
          )}

          {identificatoriDaRisolvere.length === 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: 'var(--success)' }}>
                Tutti gli strumenti sono risolti. Pronte da importare: {righePronte.length} transazioni.
              </p>
              <button
                type="button"
                onClick={handleImporta}
                disabled={importando || righePronte.length === 0}
                style={{ ...stileBottonePrimario, opacity: importando || righePronte.length === 0 ? 0.6 : 1 }}
              >
                {importando ? 'Importazione...' : `Importa ${righePronte.length} transazioni`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}