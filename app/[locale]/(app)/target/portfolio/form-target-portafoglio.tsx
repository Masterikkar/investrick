'use client'

import { useState, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatPercent, type LocaleFormato } from '@/lib/format'
import { traduciCategoria } from '@/lib/i18n-categorie'
import { CATEGORIE } from '@/lib/categorie'
import { salvaTargetPortafoglio } from './actions'

const stileCampoNumero: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  fontSize: 'var(--fs-form-label)',
}

export function FormTargetPortafoglio({
  percentualiIniziali,
}: {
  percentualiIniziali: Record<string, number>
}) {
  const t = useTranslations('FormTarget')
  const tPortafoglio = useTranslations('PaginaTargetPortafoglio')
  const tCategorie = useTranslations('Categorie')
  const locale = useLocale() as LocaleFormato
  const [percentuali, setPercentuali] = useState<Record<string, number>>(percentualiIniziali)

  const somma = useMemo(
    () => CATEGORIE.reduce((acc, cat) => acc + (percentuali[cat] ?? 0), 0),
    [percentuali]
  )

  const sommaOk = Math.abs(somma - 100) < 0.01
  const nessunTarget = somma === 0
  const puoSalvare = sommaOk || nessunTarget

  function handleChange(categoria: string, valore: string) {
    setPercentuali((prev) => ({ ...prev, [categoria]: valore === '' ? 0 : Number(valore) }))
  }

  return (
    <form
      action={salvaTargetPortafoglio}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480, color: 'var(--text-primary)' }}
    >
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-form-hint)', margin: 0 }}>
        {tPortafoglio('hintSomma')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {CATEGORIE.map((cat) => (
          <label key={cat} style={{ fontSize: 'var(--fs-form-label)' }}>
            {traduciCategoria(tCategorie, cat)}
            <input
              type="number"
              name={`percentuale_${cat}`}
              min="0"
              max="100"
              step="any"
              value={percentuali[cat] ?? 0}
              onChange={(e) => handleChange(cat, e.target.value)}
              style={stileCampoNumero}
            />
          </label>
        ))}
      </div>

      <div
        style={{
          fontSize: 'var(--fs-body)',
          color: sommaOk ? 'var(--success)' : nessunTarget ? 'var(--text-secondary)' : 'var(--danger)',
        }}
      >
        {t('labelSommaCategorie', { somma: formatPercent(somma, 2, false, locale) })}
        {nessunTarget ? tPortafoglio('notaNessunTarget') : !sommaOk ? tPortafoglio('erroreSomma') : ''}
      </div>

      <button
        type="submit"
        disabled={!puoSalvare}
        style={{
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          fontSize: 'var(--fs-button)',
          fontWeight: 500,
          cursor: puoSalvare ? 'pointer' : 'not-allowed',
          opacity: puoSalvare ? 1 : 0.4,
          alignSelf: 'flex-start',
        }}
      >
        {t('bottoneSalvaTarget')}
      </button>
    </form>
  )
}
