import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export type TipoTransazioni = 'finanziarie' | 'liquidita'

// Selettore della tabella mostrata nella pagina Transazioni. Vive nell'URL
// (?tipo=liquidita) così un refresh o un link riapre la tabella giusta; stesso
// aspetto dei pulsanti periodo dei grafici.
export async function SelettoreTipoTransazioni({ tipoAttivo }: { tipoAttivo: TipoTransazioni }) {
  const t = await getTranslations('Menu')

  const voci: { tipo: TipoTransazioni; label: string }[] = [
    { tipo: 'finanziarie', label: t('transazioniFinanziarie') },
    { tipo: 'liquidita', label: t('transazioniLiquidita') },
  ]

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {voci.map(({ tipo, label }) => {
        const attivo = tipo === tipoAttivo
        return (
          <Link
            key={tipo}
            href={`/account/data-management/transactions?tipo=${tipo}`}
            aria-current={attivo ? 'page' : undefined}
            style={{
              padding: '4px 10px',
              borderRadius: 0,
              border: '1px solid var(--border-default)',
              background: attivo ? 'var(--primary)' : 'var(--bg-surface)',
              color: attivo ? '#FFFFFF' : 'var(--text-secondary)',
              fontSize: 'var(--fs-period)',
              textDecoration: 'none',
            }}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
