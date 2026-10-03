'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import * as XLSX from 'xlsx'
import { scriviColonnaDateExcel } from '@/lib/data-excel'
import { dataIsoOggi } from '@/lib/data-calendario'
import { esportaTransazioniFinanziarie, esportaTransazioniLiquidita } from '../transactions/actions'
import type { LocaleFormato } from '@/lib/format'
import { COLONNE_EXCEL_FINANZIARIE, COLONNE_EXCEL_LIQUIDITA, intestazioneExcel, type ColonnaExcel } from '@/lib/i18n-intestazioni-excel'
import { traduciOperazione } from '@/lib/i18n-tipi-operazione'
import { traduciTipoMovimentoLiquidita } from '@/lib/i18n-tipi-movimento-liquidita'

const LARGHEZZE_FINANZIARIE = [12, 14, 10, 26, 20, 12, 14, 12, 14, 18].map((wch) => ({ wch }))
const LARGHEZZE_LIQUIDITA = [12, 26, 16, 12, 14, 18].map((wch) => ({ wch }))

// Riscrive le righe (con chiavi italiane canoniche) con le intestazioni della
// lingua corrente; traduciValore permette di tradurre anche il contenuto di
// singole colonne.
function righeLocalizzate<C extends ColonnaExcel, R extends Record<C, unknown>>(
  righe: R[],
  colonne: readonly C[],
  locale: LocaleFormato,
  traduciValore: (colonna: C, valore: unknown) => unknown = (_, valore) => valore,
) {
  return righe.map((riga) =>
    Object.fromEntries(colonne.map((colonna) => [intestazioneExcel(colonna, locale), traduciValore(colonna, riga[colonna])])),
  )
}

const stileBottonePrimario: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  fontSize: 'var(--fs-button)',
  fontWeight: 500,
  cursor: 'pointer',
  alignSelf: 'flex-start',
}

export function EsportaTransazioniFinanziarie() {
  const t = useTranslations('PaginaGestioneTransazioni')
  const tGestioneFiscalita = useTranslations('PaginaGestioneFiscalita')
  const tTipiOperazione = useTranslations('TipiOperazione')
  const locale = useLocale() as LocaleFormato
  const [scaricando, setScaricando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function handleScarica() {
    setScaricando(true)
    setErrore(null)
    try {
      const righe = righeLocalizzate(await esportaTransazioniFinanziarie(), COLONNE_EXCEL_FINANZIARIE, locale, (colonna, valore) =>
        colonna === 'Operazione' ? traduciOperazione(tTipiOperazione, valore as string) : valore,
      )
      const oggi = dataIsoOggi()
      const ws = XLSX.utils.json_to_sheet(righe, { header: COLONNE_EXCEL_FINANZIARIE.map((c) => intestazioneExcel(c, locale)) })
      scriviColonnaDateExcel(ws, intestazioneExcel('Data', locale))
      ws['!cols'] = LARGHEZZE_FINANZIARIE
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, t('nomeFoglioExportFinanziarie'))
      XLSX.writeFile(wb, `${t('nomeFileExportFinanziarie')}-${oggi}.xlsx`)
    } catch (err) {
      setErrore(err instanceof Error ? err.message : tGestioneFiscalita('erroreGenerazioneFile'))
    } finally {
      setScaricando(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        type="button"
        onClick={handleScarica}
        disabled={scaricando}
        style={{ ...stileBottonePrimario, opacity: scaricando ? 0.6 : 1 }}
      >
        {scaricando ? t('statoPreparazione') : t('bottoneScaricaTransazioniFinanziarie')}
      </button>
      {errore && <p style={{ color: 'var(--danger)', margin: 0 }}>{errore}</p>}
    </div>
  )
}

export function EsportaTransazioniLiquidita() {
  const t = useTranslations('PaginaGestioneTransazioni')
  const tGestioneFiscalita = useTranslations('PaginaGestioneFiscalita')
  const tTipiMovimento = useTranslations('TipiMovimentoLiquidita')
  const locale = useLocale() as LocaleFormato
  const [scaricando, setScaricando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function handleScarica() {
    setScaricando(true)
    setErrore(null)
    try {
      const righe = righeLocalizzate(await esportaTransazioniLiquidita(), COLONNE_EXCEL_LIQUIDITA, locale, (colonna, valore) =>
        colonna === 'Tipo movimento' ? traduciTipoMovimentoLiquidita(tTipiMovimento, valore as string) : valore,
      )
      const oggi = dataIsoOggi()
      const ws = XLSX.utils.json_to_sheet(righe, { header: COLONNE_EXCEL_LIQUIDITA.map((c) => intestazioneExcel(c, locale)) })
      scriviColonnaDateExcel(ws, intestazioneExcel('Data', locale))
      ws['!cols'] = LARGHEZZE_LIQUIDITA
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, t('nomeFoglioExportLiquidita'))
      XLSX.writeFile(wb, `${t('nomeFileExportLiquidita')}-${oggi}.xlsx`)
    } catch (err) {
      setErrore(err instanceof Error ? err.message : tGestioneFiscalita('erroreGenerazioneFile'))
    } finally {
      setScaricando(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        type="button"
        onClick={handleScarica}
        disabled={scaricando}
        style={{ ...stileBottonePrimario, opacity: scaricando ? 0.6 : 1 }}
      >
        {scaricando ? t('statoPreparazione') : t('bottoneScaricaTransazioniLiquidita')}
      </button>
      {errore && <p style={{ color: 'var(--danger)', margin: 0 }}>{errore}</p>}
    </div>
  )
}