'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import * as XLSX from 'xlsx'
import { importaMovimentiLiquiditaBulk, type RigaImportLiquidita } from './actions'
import { IconaDownload } from '@/components/icone'

type StrumentoLiquidita = { id: string; nome: string }
type ContenitoreBase = { id: string; nome: string }

const TIPI_MOVIMENTO_VALIDI = ['Versamento', 'Prelievo', 'Interesse', 'Costo']

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

type RigaParsata = {
  numeroRiga: number
  errore: string | null
  data: string
  strumentoId: string | null
  tipoMovimento: string
  importo: number
  tassaTrattenuta: number
  contenitoreId: string | null
}

type Traduttore = (key: string, values?: Record<string, string | number>) => string

function elabora(
  righeExcel: Record<string, unknown>[],
  mappaStrumenti: Map<string, string>,
  mappaContenitori: Map<string, string>,
  t: Traduttore
): RigaParsata[] {
  return righeExcel.map((riga, idx) => {
    const numeroRiga = idx + 2
    const strumentoRaw = testoCella(riga['Strumento'])
    const tipoMovimentoRaw = testoCella(riga['Tipo movimento'])
    const contenitoreRaw = testoCella(riga['Contenitore'])

    const strumentoId = strumentoRaw ? mappaStrumenti.get(strumentoRaw.toLowerCase()) ?? null : null
    const data = parseDataCella(riga['Data'])
    const tipoMovimento = TIPI_MOVIMENTO_VALIDI.find((tm) => tm.toLowerCase() === tipoMovimentoRaw.toLowerCase()) ?? null
    const importo = parseNumeroCella(riga['Importo'], false)
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
    if (!strumentoRaw) errore = t('erroreStrumentoMancante')
    else if (!strumentoId) errore = t('erroreContoNonTrovato', { valore: strumentoRaw })
    else if (!data) errore = t('erroreDataNonValida', { valore: testoCella(riga['Data']) })
    else if (!tipoMovimento) errore = t('erroreTipoMovimentoNonRiconosciuto', { valore: tipoMovimentoRaw })
    else if (importo === null) errore = t('erroreImportoNonValido', { valore: testoCella(riga['Importo']) })
    else if (tassaTrattenuta === null) errore = t('erroreTassaNonValida', { valore: testoCella(riga['Tassa trattenuta']) })
    else if (contenitoreNonTrovato) errore = t('erroreContenitoreNonTrovato', { valore: contenitoreNonTrovato })

    return {
      numeroRiga,
      errore,
      data: data ?? '',
      strumentoId,
      tipoMovimento: tipoMovimento ?? '',
      importo: importo ?? 0,
      tassaTrattenuta: tassaTrattenuta ?? 0,
      contenitoreId,
    }
  })
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

export function ImportaExcelLiquidita({
  strumenti,
  contenitori,
}: {
  strumenti: StrumentoLiquidita[]
  contenitori: ContenitoreBase[]
}) {
  const t = useTranslations('PaginaGestioneTransazioni')
  const [righe, setRighe] = useState<RigaParsata[] | null>(null)
  const [risultato, setRisultato] = useState<{
    inserite: number
    errori: { riga: number; messaggio: string }[]
    avvisoRicostruzione?: string
  } | null>(null)
  const [importando, setImportando] = useState(false)
  const [erroreFile, setErroreFile] = useState<string | null>(null)

  const mappaStrumenti = new Map(strumenti.map((s) => [s.nome.toLowerCase(), s.id]))
  const mappaContenitori = new Map(contenitori.map((c) => [c.nome.toLowerCase(), c.id]))

  function gestisciFile(file: File) {
    setRisultato(null)
    setErroreFile(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const dati = e.target?.result
        if (!dati) throw new Error(t('erroreFileVuoto'))
        const workbook = XLSX.read(dati, { type: 'array', cellDates: true })
        const primoFoglio = workbook.SheetNames[0]
        if (!primoFoglio) throw new Error(t('erroreNessunFoglio'))
        const foglio = workbook.Sheets[primoFoglio]
        const righeGrezze = XLSX.utils.sheet_to_json<Record<string, unknown>>(foglio, { defval: '' })
        setRighe(elabora(righeGrezze, mappaStrumenti, mappaContenitori, t))
      } catch (err) {
        setErroreFile(err instanceof Error ? err.message : t('erroreLetturaFile'))
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const righeValide = (righe ?? []).filter((r) => !r.errore)
  const righeConErrore = (righe ?? []).filter((r) => r.errore)

  async function handleImporta() {
    if (!righe) return
    setImportando(true)
    const daInviare: RigaImportLiquidita[] = righeValide.map((r) => ({
      rigaOriginale: r.numeroRiga,
      data: r.data,
      strumentoId: r.strumentoId!,
      tipoMovimento: r.tipoMovimento,
      importo: r.importo,
      tassaTrattenuta: r.tassaTrattenuta,
      contenitoreId: r.contenitoreId,
    }))
    const esito = await importaMovimentiLiquiditaBulk(daInviare)
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
        <p style={{ margin: 0 }}>{t('dropzoneIstruzioniLiquidita')}</p>
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
          href="/template-transazioni-liquidita.xlsx"
          download
          className="link-interattivo"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <IconaDownload />
          {t('linkScaricaTemplate')}
        </a>
        <span style={{ color: 'var(--text-secondary)' }}>{t('avvisoContoDeveEsistere')}</span>
      </div>

      {risultato && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: risultato.errori.length === 0 ? 'var(--success)' : 'var(--warning)' }}>
            {t('risultatoTransazioniImportate', { inserite: risultato.inserite })}
            {risultato.errori.length > 0 && t('risultatoRigheNonImportate', { n: risultato.errori.length })}
          </p>
          {risultato.errori.length > 0 && (
            <ul style={{ fontSize: 'var(--fs-body)', color: 'var(--danger)' }}>
              {risultato.errori.map((e, i) => (
                <li key={i}>{t('rigaErrore', { n: e.riga, messaggio: e.messaggio })}</li>
              ))}
            </ul>
          )}
          {risultato.avvisoRicostruzione && (
            <p style={{ color: 'var(--warning)', fontSize: 'var(--fs-body)', marginTop: 8 }}>{risultato.avvisoRicostruzione}</p>
          )}
        </div>
      )}

      {righe && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 'var(--fs-body)' }}>
            {t('righeValideSuTotale', { valide: righeValide.length, totali: righe.length })}
            {righeConErrore.length > 0 && t('righeScartateErrori', { n: righeConErrore.length })}
          </p>

          {righeConErrore.length > 0 && (
            <ul style={{ fontSize: 'var(--fs-body)', color: 'var(--danger)', maxHeight: 160, overflowY: 'auto' }}>
              {righeConErrore.map((r) => (
                <li key={r.numeroRiga}>{t('rigaErrore', { n: r.numeroRiga, messaggio: r.errore ?? '' })}</li>
              ))}
            </ul>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={handleImporta}
              disabled={importando || righeValide.length === 0}
              style={{ ...stileBottonePrimario, opacity: importando || righeValide.length === 0 ? 0.6 : 1 }}
            >
              {importando ? t('statoImportazione') : t('bottoneImportaTransazioni', { n: righeValide.length })}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}