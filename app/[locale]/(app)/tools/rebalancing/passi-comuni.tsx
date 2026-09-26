'use client'

import { useTranslations } from 'next-intl'

const stileCampo: React.CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: 280,
  marginTop: 4,
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
}

// Passo 1, condiviso da portafoglio e gruppo: un tetto facoltativo al
// versamento. Senza soglia il sistema versa esattamente il minimo
// necessario, senza valutare vendite né riscatti.
export function PassoSogliaVersamento({
  impostata,
  onCambiaImpostata,
  valore,
  onCambiaValore,
}: {
  impostata: boolean
  onCambiaImpostata: (v: boolean) => void
  valore: string
  onCambiaValore: (v: string) => void
}) {
  const t = useTranslations('PaginaRibilanciamento')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-form-label)' }}>
        <input
          type="checkbox"
          checked={impostata}
          onChange={(e) => onCambiaImpostata(e.target.checked)}
          style={{ accentColor: 'var(--primary)' }}
        />
        {t('domandaSogliaVersamento')}
      </label>

      {impostata ? (
        <label style={{ fontSize: 'var(--fs-form-label)' }}>
          {t('labelSogliaVersamento')}
          <input
            type="number"
            step="any"
            min="0"
            value={valore}
            onChange={(e) => onCambiaValore(e.target.value)}
            autoFocus
            style={stileCampo}
          />
        </label>
      ) : (
        <p style={{ fontSize: 'var(--fs-card-link)', color: 'var(--text-secondary)', margin: 0 }}>
          {t('hintSogliaVersamentoAssente')}
        </p>
      )}
    </div>
  )
}

// Passo 2, condiviso: commissione stimata per ogni vendita simulata.
export function PassoCommissioniVendita({ valore, onCambia }: { valore: string; onCambia: (v: string) => void }) {
  const t = useTranslations('PaginaRibilanciamento')

  return (
    <label style={{ fontSize: 'var(--fs-form-label)' }}>
      {t('labelCommissioneVendita')}
      <input type="number" step="any" min="0" value={valore} onChange={(e) => onCambia(e.target.value)} autoFocus style={stileCampo} />
    </label>
  )
}

// Passo 3, condiviso: vendere anche in perdita, ignorando il vincolo anti-minusvalenza.
export function PassoVendiInPerdita({ valore, onCambia }: { valore: boolean; onCambia: (v: boolean) => void }) {
  const t = useTranslations('PaginaRibilanciamento')

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-form-label)' }}>
      <input type="checkbox" checked={valore} onChange={(e) => onCambia(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
      {t('checkboxVendiInPerdita')}
    </label>
  )
}
