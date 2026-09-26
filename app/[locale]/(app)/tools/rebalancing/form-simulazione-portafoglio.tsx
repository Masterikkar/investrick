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
// solo un tetto facoltativo al versamento. Se non basta a comprare soltanto,
// la pagina propone da sé la vendita dalle categorie sovrappesate: gli stessi
// controlli di commissione e vincolo anti-minusvalenza della simulazione per
// gruppo si applicano anche qui (parametri condivisi nell'URL).
export function FormSimulazionePortafoglio({
  versamentoIniziale,
  commissioneIniziale,
  forzaIniziale,
}: {
  versamentoIniziale?: string
  commissioneIniziale?: string
  forzaIniziale: boolean
}) {
  const t = useTranslations('PaginaRibilanciamento')

  return (
    <form method="GET" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <input type="hidden" name="portafoglio" value="1" />
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
