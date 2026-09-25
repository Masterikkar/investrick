import { useLocale } from 'next-intl'
import { formatPercent, type LocaleFormato } from '@/lib/format'
import { CardMetrica } from '@/components/card-metrica'

export function CardRendimento({
  rendimentoPct,
  variazioneOggi,
  label = 'Rendimento Live',
  etichettaOggi = 'Oggi',
  href,
  linkLabel,
  info,
}: {
  rendimentoPct: number | null
  variazioneOggi?: number | null
  label?: string
  etichettaOggi?: string
  href?: string
  linkLabel?: string
  info?: string
}) {
  const locale = useLocale() as LocaleFormato

  return (
    <CardMetrica label={label} href={href} linkLabel={linkLabel} info={info}>
      <span style={{ color: (rendimentoPct ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
        {rendimentoPct != null ? formatPercent(rendimentoPct, 2, true, locale) : '—'}
      </span>
      {variazioneOggi != null && (
        <span style={{ fontSize: 'var(--fs-card-link)', marginLeft: 6, color: 'var(--text-secondary)' }}>
          ({etichettaOggi}{' '}
          <span style={{ color: variazioneOggi >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatPercent(variazioneOggi, 2, true, locale)}
          </span>
          )
        </span>
      )}
    </CardMetrica>
  )
}