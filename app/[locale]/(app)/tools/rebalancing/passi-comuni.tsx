'use client'

import { useTranslations } from 'next-intl'
import { Checkbox } from '@/components/checkbox'
import { NOME_SIMULAZIONE_MAX, MAX_SIMULAZIONI_STORICO, pulisciNomeSimulazione } from '@/lib/ribilanciamento-simulazione'

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

// Stesso stile "avviso non bloccante" già usato in form-asset.tsx
// (background superficie, bordo e testo in --warning): qui il messaggio è
// più lungo, quindi fs-body invece di fs-form-hint.
const stileAvviso: React.CSSProperties = {
  color: 'var(--warning)',
  background: 'var(--bg-surface)',
  border: '1px solid var(--warning)',
  padding: '10px 12px',
  margin: 0,
  fontSize: 'var(--fs-body)',
}

// Passo 1, condiviso da portafoglio e gruppo: un tetto facoltativo al
// versamento. Senza soglia il sistema versa esattamente il minimo
// necessario, senza valutare vendite né riscatti. Se lo storico per questo
// tipo/gruppo è già al tetto (MAX_SIMULAZIONI_STORICO), un avviso in giallo
// anticipa che la simulazione più vecchia verrà sovrascritta.
export function PassoSogliaVersamento({
  impostata,
  onCambiaImpostata,
  valore,
  onCambiaValore,
  numeroSimulazioniSalvate,
}: {
  impostata: boolean
  onCambiaImpostata: (v: boolean) => void
  valore: string
  onCambiaValore: (v: string) => void
  numeroSimulazioniSalvate: number
}) {
  const t = useTranslations('PaginaRibilanciamento')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {numeroSimulazioniSalvate >= MAX_SIMULAZIONI_STORICO && (
        <p style={stileAvviso}>{t('avvisoLimiteSimulazioni', { numero: MAX_SIMULAZIONI_STORICO })}</p>
      )}

      <Checkbox checked={impostata} onChange={onCambiaImpostata} label={t('domandaSogliaVersamento')} />

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

  return <Checkbox checked={valore} onChange={onCambia} label={t('checkboxVendiInPerdita')} />
}

// Ultimo passo, condiviso: il nome con cui la simulazione verrà salvata nello
// storico, prima di avviare davvero il calcolo. Filtro live (solo lettere,
// numeri e spazi, max NOME_SIMULAZIONE_MAX caratteri) — stessa regola
// applicata di nuovo lato server in salvaSimulazione, mai duplicata a mano.
export function PassoEsecuzione({ valore, onCambia }: { valore: string; onCambia: (v: string) => void }) {
  const t = useTranslations('PaginaRibilanciamento')
  const lunghezza = valore.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 340 }}>
      <label style={{ fontSize: 'var(--fs-form-label)' }}>
        {t('labelNomeSimulazione')}
        <input
          type="text"
          value={valore}
          onChange={(e) => onCambia(pulisciNomeSimulazione(e.target.value))}
          placeholder={t('placeholderNomeSimulazione')}
          maxLength={NOME_SIMULAZIONE_MAX}
          autoFocus
          style={stileCampo}
        />
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--fs-form-hint)', color: 'var(--text-muted)' }}>{t('hintNomeSimulazione')}</span>
        <span style={{ fontSize: 'var(--fs-form-hint)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginLeft: 12 }}>
          {lunghezza} / {NOME_SIMULAZIONE_MAX}
        </span>
      </div>
    </div>
  )
}
