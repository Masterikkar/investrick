'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { IconaOcchio, IconaOcchioBarrato } from '@/components/icone'
import { stileCampo, stileErroreCampo, stileEtichetta } from '../../data-management/transactions/nuova-transazione'

// Campo password: nascosto di default, con un pulsante nel box per mostrarla.
export function CampoPassword({
  etichetta,
  valore,
  onCambia,
  autoComplete,
  errore,
  hint,
}: {
  etichetta: string
  valore: string
  onCambia: (valore: string) => void
  autoComplete: 'current-password' | 'new-password'
  errore?: string
  hint?: string
}) {
  const t = useTranslations('PaginaAccount')
  const id = useId()
  const [visibile, setVisibile] = useState(false)

  return (
    <div style={stileEtichetta}>
      <label htmlFor={id}>{etichetta}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={visibile ? 'text' : 'password'}
          value={valore}
          onChange={(e) => onCambia(e.target.value)}
          autoComplete={autoComplete}
          style={{ ...stileCampo, paddingRight: 38 }}
        />
        <button
          type="button"
          onClick={() => setVisibile((v) => !v)}
          aria-label={visibile ? t('nascondiPassword') : t('mostraPassword')}
          title={visibile ? t('nascondiPassword') : t('mostraPassword')}
          aria-pressed={visibile}
          style={{
            position: 'absolute',
            right: 4,
            // stileCampo ha marginTop: 4, quindi il centro del box è spostato di 2px.
            top: 'calc(50% + 2px)',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            background: 'none',
            border: 'none',
            color: visibile ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {visibile ? <IconaOcchioBarrato /> : <IconaOcchio />}
        </button>
      </div>
      {hint && !errore && (
        <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', marginTop: 4, display: 'block' }}>
          {hint}
        </small>
      )}
      {errore && <p style={stileErroreCampo}>{errore}</p>}
    </div>
  )
}
