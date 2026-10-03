'use client'

import { useTranslations } from 'next-intl'
import { Modale } from '@/components/modale'
import { IconaChiudi } from '@/components/icone'

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
  background: 'transparent',
  color: 'var(--text-primary)',
  border: 'none',
}

// Il risultato di una simulazione (appena calcolata o riaperta dallo storico)
// non appare più inline nella pagina — allungava la pagina e obbligava a
// scorrere fino in fondo per ritrovare "Ultime simulazioni". Stessa
// impalcatura a tre fasce di WizardRibilanciamento (titolo scuro, corpo
// chiaro, piè di pagina scuro), ma senza sidebar degli step: qui c'è un solo
// "passo", il risultato stesso. Il nome scelto per la simulazione è il
// titolo, così è sempre chiaro quale si sta guardando.
export function OverlayRisultatoSimulazione({
  aperto,
  onChiudi,
  nomeSimulazione,
  onEsportaPdf,
  children,
}: {
  aperto: boolean
  onChiudi: () => void
  nomeSimulazione: string
  onEsportaPdf: () => void
  children: React.ReactNode
}) {
  const t = useTranslations('PaginaRibilanciamento')

  return (
    <Modale aperto={aperto} onChiudi={onChiudi} larghezzaMassima={840} layoutLibero>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Barra del titolo — stesso tono scuro del wizard */}
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
            gap: 12,
          }}
        >
          <h2
            style={{
              fontSize: 'var(--fs-h2)',
              fontWeight: 500,
              margin: 0,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {nomeSimulazione}
          </h2>
          <button
            type="button"
            onClick={onChiudi}
            aria-label="Chiudi"
            style={{
              flexShrink: 0,
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
        </div>

        {/* Corpo del risultato — tono scuro (--bg-section, non --bg-surface
            del wizard): le Sezione al suo interno usano chiara per risultare
            più chiare del corpo che le ospita, invertito rispetto al resto
            dell'app. */}
        <div
          style={{
            background: 'var(--bg-section)',
            padding: '24px 28px',
            minWidth: 0,
          }}
        >
          {children}
        </div>

        {/* Piè di pagina — stesso tono scuro della barra del titolo */}
        <div
          style={{
            height: 64,
            flexShrink: 0,
            background: 'var(--bg-base)',
            borderTop: '1px solid var(--border-section)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '0 20px',
          }}
        >
          <button type="button" onClick={onChiudi} style={stileBottoneSecondario}>
            {t('bottoneChiudi')}
          </button>
          <button type="button" onClick={onEsportaPdf} style={stileBottonePrimario}>
            {t('bottoneSalvaPdf')}
          </button>
        </div>
      </div>
    </Modale>
  )
}
