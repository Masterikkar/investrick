'use client'

import { useTranslations } from 'next-intl'
import { Modale } from '@/components/modale'

export type PassoWizard = { id: string; titolo: string }

const stileBottone: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 'var(--fs-button)',
  fontWeight: 500,
  cursor: 'pointer',
}

const stileBottonePrimario: React.CSSProperties = {
  ...stileBottone,
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
}

const stileBottoneSecondario: React.CSSProperties = {
  ...stileBottone,
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
}

// Finestra popup overlay (safe-center, via Modale) con una sidebar di step a
// sinistra — grigio quelli ancora da compiere, in evidenza quello in corso,
// in colore standard quelli superati — e il contenuto del passo corrente a
// destra. L'ultimo passo mostra "Calcola" invece di "Avanti"; durante il
// calcolo la barra di caricamento sostituisce il contenuto.
export function WizardRibilanciamento({
  aperto,
  onChiudi,
  titolo,
  passi,
  indiceCorrente,
  onIndietro,
  onAvanti,
  onCalcola,
  inCalcolo,
  puoAvanzare = true,
  children,
}: {
  aperto: boolean
  onChiudi: () => void
  titolo: string
  passi: PassoWizard[]
  indiceCorrente: number
  onIndietro: () => void
  onAvanti: () => void
  onCalcola: () => void
  inCalcolo: boolean
  puoAvanzare?: boolean
  children: React.ReactNode
}) {
  const t = useTranslations('PaginaRibilanciamento')
  const ultimoPasso = indiceCorrente === passi.length - 1

  return (
    <Modale aperto={aperto} onChiudi={onChiudi} titolo={titolo} mostraChiusura={!inCalcolo} larghezzaMassima={760}>
      <div style={{ display: 'flex', gap: 24, minHeight: 320 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 180, flexShrink: 0 }}>
          {passi.map((p, i) => {
            const stato = i < indiceCorrente ? 'fatto' : i === indiceCorrente ? 'corrente' : 'futuro'
            return (
              <div
                key={p.id}
                style={{
                  padding: '8px 10px',
                  fontSize: 'var(--fs-body)',
                  color:
                    stato === 'futuro' ? 'var(--text-secondary)' : stato === 'corrente' ? '#fff' : 'var(--text-primary)',
                  background: stato === 'corrente' ? 'var(--primary)' : 'transparent',
                  fontWeight: stato === 'corrente' ? 500 : 400,
                }}
              >
                {i + 1}. {p.titolo}
              </div>
            )
          })}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
          {inCalcolo ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 16 }}>
              <div
                style={{
                  width: '100%',
                  maxWidth: 320,
                  height: 6,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  overflow: 'hidden',
                }}
              >
                <div className="barra-caricamento-riempimento" />
              </div>
              <p style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 0 }}>
                {t('caricamentoSimulazione')}
              </p>
            </div>
          ) : (
            <>
              <div>{children}</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                <button type="button" onClick={onChiudi} style={stileBottoneSecondario}>
                  {t('bottoneAnnulla')}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  {indiceCorrente > 0 && (
                    <button type="button" onClick={onIndietro} style={stileBottoneSecondario}>
                      {t('bottoneIndietro')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={ultimoPasso ? onCalcola : onAvanti}
                    disabled={!puoAvanzare}
                    style={{ ...stileBottonePrimario, opacity: puoAvanzare ? 1 : 0.6, cursor: puoAvanzare ? 'pointer' : 'default' }}
                  >
                    {ultimoPasso ? t('bottoneCalcola') : t('bottoneAvanti')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Modale>
  )
}
