'use client'

import { useState, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import * as XLSX from 'xlsx'
import { dataIsoDaCellaExcel } from '@/lib/data-excel'
import { creaAssetPerImport, importaTransazioniBulk, type RigaImport } from '../transazioni/actions'
import { ETICHETTA_OPERAZIONE } from '@/lib/operazioni'
import { CHIAVE_TRADUZIONE_OPERAZIONE, operazioneDaEtichettaExcel } from '@/lib/i18n-tipi-operazione'
import {
  COLONNE_EXCEL_FINANZIARIE,
  isContenitoreDirettoExcel,
  risolviIntestazioniExcel,
  TEMPLATE_EXCEL,
  type ColonnaExcelFinanziaria,
} from '@/lib/i18n-intestazioni-excel'
import { IconaDownload } from '@/components/icone'
import type { LocaleFormato } from '@/lib/format'

type Traduttore = (key: string, values?: Record<string, string | number>) => string

type StrumentoBase = { id: string; isin: string | null; ticker: string | null; nome: string }
type ContenitoreBase = { id: string; nome: string; tipo: string }

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

function elabora(
  righeExcel: Record<string, unknown>[],
  intestazionePerColonna: Map<ColonnaExcelFinanziaria, string>,
  mappaContenitori: Map<string, string>,
  tipoContenitore: Map<string, string>,
  // Il file usa il sistema di date 1904 (vecchi Excel per Mac).
  date1904: boolean,
  t: Traduttore
): RigaParsata[] {
  return righeExcel.map((riga, idx) => {
    const numeroRiga = idx + 2
    // Le righe hanno come chiavi le intestazioni scritte nel file, in qualunque
    // lingua: si legge ogni colonna tramite la sua intestazione risolta.
    const cella = (colonna: ColonnaExcelFinanziaria) => {
      const intestazione = intestazionePerColonna.get(colonna)
      return intestazione === undefined ? undefined : riga[intestazione]
    }
    const isinRaw = testoCella(cella('ISIN')).toUpperCase()
    const tickerRaw = testoCella(cella('Ticker')).toUpperCase()
    const operazioneRaw = testoCella(cella('Operazione'))
    const contenitoreRaw = testoCella(cella('Contenitore'))

    const identificatore: Identificatore | null = isinRaw
      ? { tipo: 'isin', valore: isinRaw }
      : tickerRaw
      ? { tipo: 'ticker', valore: tickerRaw }
      : null

    const data = dataIsoDaCellaExcel(cella('Data'), date1904)
    const operazioneDb = operazioneDaEtichettaExcel(operazioneRaw)
    const quantita = parseNumeroCella(cella('Quantità'), false)
    const prezzoUnitario = parseNumeroCella(cella('Prezzo unitario'), false)
    const commissione = parseNumeroCella(cella('Commissione'), true)
    const tassaTrattenuta = parseNumeroCella(cella('Tassa trattenuta'), true)

    let contenitoreId: string | null = null
    let contenitoreNonTrovato: string | null = null
    if (contenitoreRaw === '' || isContenitoreDirettoExcel(contenitoreRaw)) {
      contenitoreId = null
    } else {
      const trovato = mappaContenitori.get(contenitoreRaw.toLowerCase())
      if (trovato) contenitoreId = trovato
      else contenitoreNonTrovato = contenitoreRaw
    }

    let errore: string | null = null
    if (!identificatore) errore = t('erroreIdentificatoreMancante')
    else if (!data) errore = t('erroreDataNonValida', { valore: testoCella(cella('Data')) })
    else if (!operazioneDb) errore = t('erroreOperazioneNonRiconosciuta', { valore: operazioneRaw })
    else if (quantita === null || quantita <= 0) errore = t('erroreQuantitaNonValida', { valore: testoCella(cella('Quantità')) })
    else if (prezzoUnitario === null || prezzoUnitario < 0) errore = t('errorePrezzoNonValido', { valore: testoCella(cella('Prezzo unitario')) })
    else if (commissione === null) errore = t('erroreCommissioneNonValida', { valore: testoCella(cella('Commissione')) })
    else if (tassaTrattenuta === null) errore = t('erroreTassaNonValida', { valore: testoCella(cella('Tassa trattenuta')) })
    else if (contenitoreNonTrovato) errore = t('erroreContenitoreNonTrovato', { valore: contenitoreNonTrovato })
    // Stesso vincolo del database (vincola_contenitore_no_personalizzato): un
    // gruppo Personalizzato non contiene transazioni.
    else if (contenitoreId !== null && tipoContenitore.get(contenitoreId) === 'Personalizzato')
      errore = t('erroreGruppoPersonalizzato', { valore: contenitoreRaw })
    // Stesso vincolo del database (vincola_scambio_solo_polizza), controllato qui
    // per dare un errore di riga leggibile invece del messaggio grezzo all'inserimento.
    else if (
      (operazioneDb === 'Scambio_cessione' || operazioneDb === 'Scambio_acquisizione') &&
      (contenitoreId === null || tipoContenitore.get(contenitoreId) !== 'Polizza')
    )
      errore = t('erroreScambioSenzaPolizza', { valore: contenitoreRaw || '—' })

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
  const t = useTranslations('PaginaGestioneTransazioni')
  const tPaginaGestioneStrumenti = useTranslations('PaginaGestioneStrumenti')
  const categorie = Object.keys(tipiPerCategoria)
  const [categoria, setCategoria] = useState(categorie[0] ?? '')
  const [tipo, setTipo] = useState(tipiPerCategoria[categorie[0]]?.[0] ?? '')
  const [nome, setNome] = useState('')
  const [ticker, setTicker] = useState(identificatore.tipo === 'ticker' ? identificatore.valore : '')
  const [valuta, setValuta] = useState('EUR')
  const [codicePrezzo, setCodicePrezzo] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function handleSalva() {
    if (!nome.trim()) {
      setErrore(t('erroreNomeObbligatorio'))
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
          ? t('erroreIsinSconosciuto', { valore: identificatore.valore })
          : t('erroreTickerSconosciuto', { valore: identificatore.valore })}
      </div>
      {errore && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{errore}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}>
        <label>
          {tPaginaGestioneStrumenti('labelCategoria')}
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
          {tPaginaGestioneStrumenti('labelNome')}
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} style={stileCampo} />
        </label>
        <label>
          {tPaginaGestioneStrumenti('labelTicker')}
          <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value)} style={stileCampo} />
        </label>
        <label>
          {tPaginaGestioneStrumenti('labelValuta')}
          <input type="text" value={valuta} onChange={(e) => setValuta(e.target.value)} style={stileCampo} />
        </label>
        <label>
          {tPaginaGestioneStrumenti('labelCodicePrezzo')}
          <input type="text" value={codicePrezzo} onChange={(e) => setCodicePrezzo(e.target.value)} style={stileCampo} />
        </label>
        <button
          type="button"
          onClick={handleSalva}
          disabled={salvataggio}
          style={{ ...stileBottonePrimario, alignSelf: 'flex-start', opacity: salvataggio ? 0.6 : 1 }}
        >
          {salvataggio ? t('statoCreazione') : tPaginaGestioneStrumenti('bottoneCreaAsset')}
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
  const t = useTranslations('PaginaGestioneTransazioni')
  const tTipiOperazione = useTranslations('TipiOperazione')
  const locale = useLocale() as LocaleFormato

  function etichettaOperazione(codice: string): string {
    const etichettaItaliana = ETICHETTA_OPERAZIONE[codice] ?? codice
    const chiave = CHIAVE_TRADUZIONE_OPERAZIONE[etichettaItaliana]
    return chiave ? tTipiOperazione(chiave) : etichettaItaliana
  }

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
  // Nome del file letto, per il registro dell'import (importazioni.nome_file).
  const [nomeFile, setNomeFile] = useState('')

  const mappaContenitori = useMemo(
    () => new Map(contenitori.map((c) => [c.nome.toLowerCase(), c.id])),
    [contenitori]
  )
  const tipoContenitore = useMemo(() => new Map(contenitori.map((c) => [c.id, c.tipo])), [contenitori])

  function gestisciFile(file: File) {
    setNomeFile(file.name)
    setRisultato(null)
    setErroreFile(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const dati = e.target?.result
        if (!dati) throw new Error(t('erroreFileVuoto'))
        // Senza cellDates le celle data arrivano come numero seriale Excel, da
        // convertire senza passare da un fuso orario (lib/data-excel.ts). Con
        // cellDates SheetJS crea un Date a mezzanotte locale, e in Italia il
        // giorno letto in UTC era quello prima.
        const workbook = XLSX.read(dati, { type: 'array' })
        const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904)
        const primoFoglio = workbook.SheetNames[0]
        if (!primoFoglio) throw new Error(t('erroreNessunFoglio'))
        const foglio = workbook.Sheets[primoFoglio]
        const intestazioni = XLSX.utils.sheet_to_json<unknown[]>(foglio, { header: 1, raw: false })[0] ?? []
        const { intestazionePerColonna, sconosciute, duplicate } = risolviIntestazioniExcel(intestazioni, COLONNE_EXCEL_FINANZIARIE)
        if (sconosciute.length > 0) throw new Error(t('erroreIntestazioniSconosciute', { elenco: sconosciute.join(', ') }))
        if (duplicate.length > 0) throw new Error(t('erroreIntestazioniDuplicate', { elenco: duplicate.join(', ') }))
        const righeGrezze = XLSX.utils.sheet_to_json<Record<string, unknown>>(foglio, { defval: '' })
        setRighe(elabora(righeGrezze, intestazionePerColonna, mappaContenitori, tipoContenitore, date1904, t))
      } catch (err) {
        setErroreFile(err instanceof Error ? err.message : t('erroreLetturaFile'))
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
    // Nel registro dell'import contano anche le righe mai inviate: formato
    // non valido, o strumento non ancora creato.
    const idPronte = new Set(righePronte.map((r) => r.numeroRiga))
    const scartate = [
      ...righeConErrore.map((r) => ({ riga: r.numeroRiga, messaggio: r.errore! })),
      ...righeValideFormato
        .filter((r) => !idPronte.has(r.numeroRiga))
        .map((r) => ({ riga: r.numeroRiga, messaggio: t('erroreStrumentoNonTrovatoImport', { valore: r.identificatore?.valore ?? '' }) })),
    ]
    const esito = await importaTransazioniBulk(daInviare, { nomeFile, righeTotali: righe.length, scartate })
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
        <p style={{ margin: 0 }}>{t('dropzoneIstruzioni')}</p>
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
          href={TEMPLATE_EXCEL.finanziarie[locale]}
          download
          className="link-interattivo"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <IconaDownload />
          {t('linkScaricaTemplate')}
        </a>
        <span style={{ color: 'var(--text-secondary)' }}>
          {t('hintCostoContantiManuale', { operazione: etichettaOperazione('Costo_contanti') })}
        </span>
      </div>

      {risultato && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: risultato.errori.length === 0 ? 'var(--success)' : 'var(--warning)' }}>
            {t('risultatoTransazioniImportate', { inserite: risultato.inserite })}
            {risultato.errori.length > 0 && t('risultatoRigheNonImportate', { n: risultato.errori.length })}
          </p>
          {risultato.errori.length > 0 && (
            <ul style={{ fontSize: 13, color: 'var(--danger)' }}>
              {risultato.errori.map((e, i) => (
                <li key={i}>{t('rigaErrore', { n: e.riga, messaggio: e.messaggio })}</li>
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
            {t('righeValideSuTotale', { valide: righeValideFormato.length, totali: righe.length })}
            {righeConErrore.length > 0 && t('righeScartateFormato', { n: righeConErrore.length })}
          </p>

          {righeConErrore.length > 0 && (
            <ul style={{ fontSize: 13, color: 'var(--danger)', maxHeight: 160, overflowY: 'auto' }}>
              {righeConErrore.map((r) => (
                <li key={r.numeroRiga}>{t('rigaErrore', { n: r.numeroRiga, messaggio: r.errore ?? '' })}</li>
              ))}
            </ul>
          )}

          {identificatoriDaRisolvere.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: 'var(--warning)' }}>
                {t('strumentiNonTrovatiIntro', { n: identificatoriDaRisolvere.length })}
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
              <p style={{ color: 'var(--success)', marginBottom: 16 }}>
                {t('tuttiStrumentiRisolti', { n: righePronte.length })}
              </p>
              <button
                type="button"
                onClick={handleImporta}
                disabled={importando || righePronte.length === 0}
                style={{ ...stileBottonePrimario, opacity: importando || righePronte.length === 0 ? 0.6 : 1 }}
              >
                {importando ? t('statoImportazione') : t('bottoneImportaTransazioni', { n: righePronte.length })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
