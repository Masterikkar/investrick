'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
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
  const [caricamento, setCaricamento] = useState<'realizzate' | 'non-realizzate' | null>(null)
  const [errore, setErrore] = useState<string | null>(null)

  async function esporta(tipo: 'realizzate' | 'non-realizzate') {
    setErrore(null)
    setCaricamento(tipo)
    try {
      const oggi = new Date().toISOString().slice(0, 10)
      if (tipo === 'realizzate') {
        const righe = await esportaPlusMinusRealizzate()
        const ws = XLSX.utils.json_to_sheet(righe)
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
      setErrore(err instanceof Error ? err.message : 'Impossibile generare il file')
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
        {caricamento === 'realizzate' ? 'Generazione...' : 'Esporta realizzate (.xlsx)'}
      </button>
      <button
        type="button"
        onClick={() => esporta('non-realizzate')}
        disabled={caricamento !== null}
        style={{ ...stileBottonePrimario, opacity: caricamento !== null ? 0.6 : 1 }}
      >
        {caricamento === 'non-realizzate' ? 'Generazione...' : 'Esporta non realizzate (.xlsx)'}
      </button>
      {errore && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', margin: 0 }}>{errore}</p>}
    </div>
  )
}