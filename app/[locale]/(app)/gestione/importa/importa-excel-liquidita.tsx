'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import * as XLSX from 'xlsx'
import { dataIsoDaCellaExcel } from '@/lib/data-excel'
import { importaMovimentiLiquiditaBulk, type RigaImportLiquidita } from '../transazioni/actions'
import { IconaDownload } from '@/components/icone'
import type { LocaleFormato } from '@/lib/format'
import {
  COLONNE_EXCEL_LIQUIDITA,
  isContenitoreDirettoExcel,
  risolviIntestazioniExcel,
  TEMPLATE_EXCEL,
  type ColonnaExcelLiquidita,
} from '@/lib/i18n-intestazioni-excel'
import { tipoMovimentoLiquiditaDaEtichettaExcel } from '@/lib/i18n-tipi-movimento-liquidita'

type StrumentoLiquidita = { id: string; nome: string }
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
  intestazionePerColonna: Map<ColonnaExcelLiquidita, string>,
  mappaStrumenti: Map<string, string>,
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
    const cella = (colonna: ColonnaExcelLiquidita) => {
      const intestazione = intestazionePerColonna.get(colonna)
      return intestazione === undefined ? undefined : riga[intestazione]
    }
    const strumentoRaw = testoCella(cella('Strumento'))
    const tipoMovimentoRaw = testoCella(cella('Tipo movimento'))
    const contenitoreRaw = testoCella(cella('Contenitore'))

    const strumentoId = strumentoRaw ? mappaStrumenti.get(strumentoRaw.toLowerCase()) ?? null : null
    const data = dataIsoDaCellaExcel(cella('Data'), date1904)
    const tipoMovimento = tipoMovimentoLiquiditaDaEtichettaExcel(tipoMovimentoRaw) ?? null
    const importo = parseNumeroCella(cella('Importo'), false)
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
    if (!strumentoRaw) errore = t('erroreStrumentoMancante')
    else if (!strumentoId) errore = t('erroreContoNonTrovato', { valore: strumentoRaw })
    else if (!data) errore = t('erroreDataNonValida', { valore: testoCella(cella('Data')) })
    else if (!tipoMovimento) errore = t('erroreTipoMovimentoNonRiconosciuto', { valore: tipoMovimentoRaw })
    else if (importo === null) errore = t('erroreImportoNonValido', { valore: testoCella(cella('Importo')) })
    else if (tassaTrattenuta === null) errore = t('erroreTassaNonValida', { valore: testoCella(cella('Tassa trattenuta')) })
    else if (contenitoreNonTrovato) errore = t('erroreContenitoreNonTrovato', { valore: contenitoreNonTrovato })
    // Stesso vincolo del database (vincola_contenitore_no_personalizzato),
    // controllato qui per un errore di riga leggibile: un gruppo Personalizzato
    // non contiene movimenti.
    else if (contenitoreId !== null && tipoContenitore.get(contenitoreId) === 'Personalizzato')
      errore = t('erroreGruppoPersonalizzato', { valore: contenitoreRaw })

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
  const tGestioneStrumenti = useTranslations('PaginaGestioneStrumenti')
  const locale = useLocale() as LocaleFormato
  const [righe, setRighe] = useState<RigaParsata[] | null>(null)
  const [risultato, setRisultato] = useState<{
    inserite: number
    errori: { riga: number; messaggio: string }[]
    avvisoRicostruzione?: string
  } | null>(null)
  const [importando, setImportando] = useState(false)
  const [erroreFile, setErroreFile] = useState<string | null>(null)
  // Nome del file letto, per il registro dell'import (importazioni.nome_file).
  const [nomeFile, setNomeFile] = useState('')

  const mappaStrumenti = new Map(strumenti.map((s) => [s.nome.toLowerCase(), s.id]))
  const mappaContenitori = new Map(contenitori.map((c) => [c.nome.toLowerCase(), c.id]))
  const tipoContenitore = new Map(contenitori.map((c) => [c.id, c.tipo]))

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
        const { intestazionePerColonna, sconosciute, duplicate } = risolviIntestazioniExcel(intestazioni, COLONNE_EXCEL_LIQUIDITA)
        if (sconosciute.length > 0) throw new Error(t('erroreIntestazioniSconosciute', { elenco: sconosciute.join(', ') }))
        if (duplicate.length > 0) throw new Error(t('erroreIntestazioniDuplicate', { elenco: duplicate.join(', ') }))
        const righeGrezze = XLSX.utils.sheet_to_json<Record<string, unknown>>(foglio, { defval: '' })
        setRighe(elabora(righeGrezze, intestazionePerColonna, mappaStrumenti, mappaContenitori, tipoContenitore, date1904, t))
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
    // Nel registro dell'import contano anche le righe scartate in lettura.
    const scartate = righeConErrore.map((r) => ({ riga: r.numeroRiga, messaggio: r.errore! }))
    const esito = await importaMovimentiLiquiditaBulk(daInviare, { nomeFile, righeTotali: righe.length, scartate })
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
          href={TEMPLATE_EXCEL.liquidita[locale]}
          download
          className="link-interattivo"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <IconaDownload />
          {t('linkScaricaTemplate')}
        </a>
        <span style={{ color: 'var(--text-secondary)' }}>
          {t('avvisoContoDeveEsistere', { pagina: tGestioneStrumenti('titoloGestioneStrumenti') })}
        </span>
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