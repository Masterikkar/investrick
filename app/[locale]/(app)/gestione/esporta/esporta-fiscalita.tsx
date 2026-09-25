'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import * as XLSX from 'xlsx'
import { scriviColonnaDateExcel } from '@/lib/data-excel'
import { dataIsoOggi } from '@/lib/data-calendario'
import { esportaPlusMinusRealizzate, esportaPlusMinusNonRealizzate } from './actions'

const stileBottonePrimario: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  fontSize: 'var(--fs-button)',
  fontWeight: 500,
  cursor: 'pointer',
}

export function EsportaFiscalita() {
  const t = useTranslations('PaginaGestioneFiscalita')
  const [caricamento, setCaricamento] = useState<'realizzate' | 'non-realizzate' | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  async function esporta(tipo: 'realizzate' | 'non-realizzate') {
    setErrore(null)
    setCaricamento(tipo)
    try {
      const oggi = dataIsoOggi()
      if (tipo === 'realizzate') {
        const righe = await esportaPlusMinusRealizzate()
        const ws = XLSX.utils.json_to_sheet(righe)
        scriviColonnaDateExcel(ws, 'Data')
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Realizzate')
        XLSX.writeFile(wb, `plus-minus-realizzate-${oggi}.xlsx`)
      } else {
        const righe = await esportaPlusMinusNonRealizzate()
        const ws = XLSX.utils.json_to_sheet(righe)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Non realizzate')
        XLSX.writeFile(wb, `plus-minus-non-realizzate-${oggi}.xlsx`)
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : t('erroreGenerazioneFile'))
    } finally {
      setCaricamento(null)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => esporta('realizzate')}
        disabled={caricamento !== null}
        style={{ ...stileBottonePrimario, opacity: caricamento !== null ? 0.6 : 1 }}
      >
        {caricamento === 'realizzate' ? t('statoGenerazione') : t('bottoneEsportaRealizzate')}
      </button>
      <button
        type="button"
        onClick={() => esporta('non-realizzate')}
        disabled={caricamento !== null}
        style={{ ...stileBottonePrimario, opacity: caricamento !== null ? 0.6 : 1 }}
      >
        {caricamento === 'non-realizzate' ? t('statoGenerazione') : t('bottoneEsportaNonRealizzate')}
      </button>
      {errore && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', margin: 0 }}>{errore}</p>}
    </div>
  )
}