'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatNumero } from '@/lib/format'
import { aggiornaSogliaRibilanciamento } from '@/app/[locale]/(app)/ribilanciamento/actions'

export function SogliaRibilanciamento({ sogliaIniziale }: { sogliaIniziale: number }) {
  const router = useRouter()
  const [inModifica, setInModifica] = useState(false)
  const [valore, setValore] = useState(String(sogliaIniziale))
  const [errore, setErrore] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSalva() {
    const numero = Number(valore)
    if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
      setErrore('Inserisci un numero tra 0 e 100.')
      return
    }
    setErrore(null)

    startTransition(async () => {
      const risultato = await aggiornaSogliaRibilanciamento(numero)
      if ('errore' in risultato) {
        setErrore(risultato.errore)
      } else {
        setInModifica(false)
        router.refresh()
      }
    })
  }

  function handleAnnulla() {
    setValore(String(sogliaIniziale))
    setErrore(null)
    setInModifica(false)
  }

  if (!inModifica) {
    return (
      <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>
        Soglia di alert: ±{formatNumero(sogliaIniziale, 2)} punti percentuali{' '}
        <button
          type="button"
          onClick={() => setInModifica(true)}
          className="link-dettaglio"
          style={{
            fontSize: 'var(--fs-card-link)',
            fontFamily: 'inherit',
            lineHeight: 'inherit',
            background: 'none',
            border: 'none',
            margin: 0,
            padding: 0,
            cursor: 'pointer',
            appearance: 'none',
          }}
        >
          → Modifica
        </button>
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>Soglia di alert: ±</span>
      <input
        type="number"
        min={0}
        max={100}
        step="any"
        value={valore}
        onChange={(e) => setValore(e.target.value)}
        disabled={pending}
        style={{
          width: 90,
          padding: '4px 8px',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-default)',
          fontSize: 'var(--fs-body)',
        }}
      />
      <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>punti percentuali</span>
      <button
        type="button"
        onClick={handleSalva}
        disabled={pending}
        style={{
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          padding: '4px 12px',
          fontSize: 'var(--fs-button-outline)',
          fontWeight: 500,
          cursor: pending ? 'default' : 'pointer',
          opacity: pending ? 0.6 : 1,
        }}
      >
        Salva
      </button>
      <button
        type="button"
        onClick={handleAnnulla}
        disabled={pending}
        style={{
          background: 'none',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-default)',
          padding: '4px 12px',
          fontSize: 'var(--fs-button-outline)',
          cursor: pending ? 'default' : 'pointer',
        }}
      >
        Annulla
      </button>
      {errore && <span style={{ color: 'var(--danger)', fontSize: 'var(--fs-form-hint)' }}>{errore}</span>}
    </div>
  )
}