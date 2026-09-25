'use client'

import { useTranslations } from 'next-intl'

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

// Avvia la simulazione sul portafoglio intero: niente contenitore da scegliere,
// solo un tetto facoltativo al versamento.
export function FormSimulazionePortafoglio({ versamentoIniziale }: { versamentoIniziale?: string }) {
  const t = useTranslations('PaginaRibilanciamento')

  return (
    <form method="GET" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <input type="hidden" name="portafoglio" value="1" />
      <div style={{ minWidth: 240 }}>
        <label style={{ fontSize: 'var(--fs-form-label)' }}>
          {t('labelVersamentoMassimo')}
          <input
            type="number"
            name="versamento_portafoglio"
            step="any"
            min="0"
            defaultValue={versamentoIniziale}
            style={stileCampo}
          />
        </label>
      </div>
      <button type="submit" style={stileBottonePrimario}>
        {t('bottoneCalcola')}
      </button>
    </form>
  )
}
