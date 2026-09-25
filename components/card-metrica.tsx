import { RippleLink } from '@/components/ripple-link'
import { InfoTooltip } from '@/components/info-tooltip'

export const stileCardMetrica: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 0,
  padding: 16,
  minWidth: 200,
}

export function CardMetrica({
  label,
  children,
  href,
  linkLabel,
  minWidth,
  info,
}: {
  label: string
  children: React.ReactNode
  href?: string
  linkLabel?: string
  minWidth?: number
  // Testo di un InfoTooltip accanto all'etichetta, per spiegare su che base è
  // calcolato il numero.
  info?: string
}) {
  return (
    <div style={minWidth ? { ...stileCardMetrica, minWidth } : stileCardMetrica}>
      <div style={{ fontSize: 'var(--fs-card-label)', color: 'var(--text-secondary)' }}>
        {label}
        {info && <InfoTooltip testo={info} />}
      </div>
      <div style={{ fontSize: 'var(--fs-card-value)', fontWeight: 500, marginTop: 4 }}>{children}</div>
      {href && linkLabel && (
        <RippleLink
          href={href}
          className="link-dettaglio"
          style={{ fontSize: 'var(--fs-card-link)', display: 'inline-block', marginTop: 6 }}
        >
          {linkLabel}
        </RippleLink>
      )}
    </div>
  )
}