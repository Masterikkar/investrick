'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import * as XLSX from 'xlsx'
import { esportaTransazioniFinanziarie, esportaTransazioniLiquidita } from './actions'

const COLONNE_FINANZIARIE = ['Data', 'ISIN', 'Ticker', 'Strumento', 'Operazione', 'Quantità', 'Prezzo unitario', 'Commissione', 'Tassa trattenuta', 'Contenitore']
const LARGHEZZE_FINANZIARIE = [12, 14, 10, 26, 20, 12, 14, 12, 14, 18].map((wch) => ({ wch }))

const COLONNE_LIQUIDITA = ['Data', 'Strumento', 'Tipo movimento', 'Importo', 'Tassa trattenuta', 'Contenitore']
const LARGHEZZE_LIQUIDITA = [12, 26, 16, 12, 14, 18].map((wch) => ({ wch }))

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
  const [scaricando, setScaricando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function handleScarica() {
    setScaricando(true)
    setErrore(null)
    try {
      const righe = await esportaTransazioniFinanziarie()
      const oggi = new Date().toISOString().slice(0, 10)
      const ws = XLSX.utils.json_to_sheet(righe, { header: COLONNE_FINANZIARIE })
      ws['!cols'] = LARGHEZZE_FINANZIARIE
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Transazioni finanziarie')
      XLSX.writeFile(wb, `transazioni-finanziarie-${oggi}.xlsx`)
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
  const [scaricando, setScaricando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function handleScarica() {
    setScaricando(true)
    setErrore(null)
    try {
      const righe = await esportaTransazioniLiquidita()
      const oggi = new Date().toISOString().slice(0, 10)
      const ws = XLSX.utils.json_to_sheet(righe, { header: COLONNE_LIQUIDITA })
      ws['!cols'] = LARGHEZZE_LIQUIDITA
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Transazioni liquidità')
      XLSX.writeFile(wb, `transazioni-liquidita-${oggi}.xlsx`)
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