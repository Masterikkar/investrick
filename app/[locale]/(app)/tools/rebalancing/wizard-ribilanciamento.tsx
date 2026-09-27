'use client'

import { useTranslations } from 'next-intl'
import { Modale } from '@/components/modale'
import { IconaChiudi, IconaSpunta } from '@/components/icone'

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

// Finestra popup (via Modale, in modalità "layoutLibero": Modale si limita a
// overlay/Esc/clic-fuori/blocco scroll, il resto lo disegniamo qui) con tre
// fasce di sfondo via via più chiare — titolo (--bg-base, il più scuro),
// sidebar degli step (--bg-section), contenuto del passo corrente
// (--bg-surface, il più chiaro) — lo stesso principio di contrasto usato
// nella pagina delle Impostazioni, riletto per un popup che non ha una
// pagina dietro. L'ultimo passo mostra "Calcola" invece di "Avanti"; durante
// il calcolo la barra di caricamento sostituisce sidebar e footer.
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
  mostraAnnullaAccantoAvanti = false,
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
  // true nel caso "stai per sovrascrivere una simulazione": oltre
  // all'Annulla già presente in basso a sinistra (sempre visibile), ne
  // affianca uno secondo accanto ad Avanti/Calcola, dove l'occhio è già
  // puntato quando appare l'avviso in giallo.
  mostraAnnullaAccantoAvanti?: boolean
  children: React.ReactNode
}) {
  const t = useTranslations('PaginaRibilanciamento')
  const ultimoPasso = indiceCorrente === passi.length - 1

  return (
    <Modale aperto={aperto} onChiudi={onChiudi} larghezzaMassima={840} layoutLibero>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Barra del titolo — tono più scuro di tutto il resto del popup */}
        <div
          style={{
            height: 56,
            flexShrink: 0,
            background: 'var(--bg-base)',
            borderBottom: '1px solid var(--border-section)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
          }}
        >
          <h2 style={{ fontSize: 'var(--fs-h2)', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>{titolo}</h2>
          {!inCalcolo && (
            <button
              type="button"
              onClick={onChiudi}
              aria-label="Chiudi"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                lineHeight: 1,
                cursor: 'pointer',
                padding: 4,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <IconaChiudi />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', minHeight: 340 }}>
          {/* Sidebar degli step — tono intermedio */}
          <div
            style={{
              width: 200,
              flexShrink: 0,
              background: 'var(--bg-section)',
              borderRight: '1px solid var(--border-section)',
              padding: '16px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {passi.map((p, i) => {
              const stato = i < indiceCorrente ? 'fatto' : i === indiceCorrente ? 'corrente' : 'futuro'
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 10px',
                    background: stato === 'corrente' ? 'var(--primary)' : 'transparent',
                    color: stato === 'futuro' ? 'var(--text-secondary)' : stato === 'corrente' ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      flexShrink: 0,
                      border: `1.5px solid ${stato === 'corrente' ? 'rgba(255,255,255,0.6)' : stato === 'fatto' ? 'var(--primary-vivid)' : 'var(--border-default)'}`,
                      color: stato === 'fatto' ? 'var(--primary-vivid)' : 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {stato === 'fatto' ? <IconaSpunta /> : i + 1}
                  </span>
                  <span style={{ fontSize: 'var(--fs-body)', fontWeight: stato === 'corrente' ? 500 : 400 }}>{p.titolo}</span>
                </div>
              )
            })}
          </div>

          {/* Contenuto del passo — tono più chiaro, in primo piano */}
          <div
            style={{
              flex: 1,
              background: 'var(--bg-surface)',
              padding: '24px 28px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: inCalcolo ? 'center' : 'flex-start',
              alignItems: inCalcolo ? 'center' : 'stretch',
            }}
          >
            {inCalcolo ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 320,
                    height: 6,
                    background: 'var(--bg-section)',
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
              children
            )}
          </div>
        </div>

        {/* Piè di pagina — stesso tono scuro della barra del titolo */}
        {!inCalcolo && (
          <div
            style={{
              height: 64,
              flexShrink: 0,
              background: 'var(--bg-base)',
              borderTop: '1px solid var(--border-section)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
            }}
          >
            <button type="button" onClick={onChiudi} style={{ ...stileBottoneSecondario, background: 'transparent', border: 'none' }}>
              {t('bottoneAnnulla')}
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {indiceCorrente > 0 && (
                <button type="button" onClick={onIndietro} style={stileBottoneSecondario}>
                  {t('bottoneIndietro')}
                </button>
              )}
              {mostraAnnullaAccantoAvanti && (
                <button type="button" onClick={onChiudi} style={stileBottoneSecondario}>
                  {t('bottoneAnnulla')}
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
        )}
      </div>
    </Modale>
  )
}
