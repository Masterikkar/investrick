'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { MenuSelect } from '@/components/menu-select'

const stileCampo: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '6px 10px',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
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

export function FormSimulazione({
  contenitoriDisponibili,
  contenitoreSelezionato,
  versamentoIniziale,
  commissioneIniziale,
  forzaIniziale,
}: {
  contenitoriDisponibili: [string, string][]
  contenitoreSelezionato?: string
  versamentoIniziale?: string
  commissioneIniziale?: string
  forzaIniziale: boolean
}) {
  const t = useTranslations('PaginaRibilanciamento')
  const tPaginaCosti = useTranslations('PaginaCosti')
  const [contenitoreId, setContenitoreId] = useState(contenitoreSelezionato ?? '')
  const [erroreContenitore, setErroreContenitore] = useState(false)

  const opzioniContenitore = [
    { value: '', label: t('optionSeleziona') },
    ...contenitoriDisponibili.map(([id, nome]) => ({ value: id, label: nome })),
  ]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!contenitoreId) {
      e.preventDefault()
      setErroreContenitore(true)
      return
    }
    setErroreContenitore(false)
  }

  return (
    <form
      method="GET"
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200 }}>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {tPaginaCosti('colonnaContenitore')}
            <div style={{ marginTop: 4 }}>
              <MenuSelect
                name="contenitore_id"
                value={contenitoreId}
                onChange={(v) => {
                  setContenitoreId(v)
                  if (v) setErroreContenitore(false)
                }}
                options={opzioniContenitore}
              />
            </div>
          </label>
          {erroreContenitore && (
            <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-form-hint)', margin: '4px 0 0' }}>
              {t('erroreSelezionaContenitore')}
            </p>
          )}
        </div>

        <div>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelVersamento')}
            <input
              type="number"
              name="versamento"
              step="any"
              min="0"
              defaultValue={versamentoIniziale}
              style={stileCampo}
            />
          </label>
        </div>

        <div>
          <label style={{ fontSize: 'var(--fs-form-label)' }}>
            {t('labelCommissioneVendita')}
            <input
              type="number"
              name="commissione_vendita"
              step="any"
              min="0"
              defaultValue={commissioneIniziale}
              style={stileCampo}
            />
          </label>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-form-label)' }}>
        <input type="checkbox" name="forza" value="1" defaultChecked={forzaIniziale} style={{ accentColor: 'var(--primary)' }} />
        {t('checkboxVendiInPerdita')}
      </label>

      <button type="submit" style={stileBottonePrimario}>
        {t('bottoneCalcola')}
      </button>
    </form>
  )
}