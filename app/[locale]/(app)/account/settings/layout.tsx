import { getTranslations } from 'next-intl/server'
import { IconaImpostazioni, IconaFiscalita } from '@/components/icone'
import { BarraTab } from '../barra-tab'

export default async function ImpostazioniLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('PaginaImpostazioni')
  const tMenu = await getTranslations('Menu')

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('account')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{t('titolo')}</h1>

      <div style={{ display: 'flex', gap: 24, alignItems: 'stretch' }}>
        <BarraTab
          tab={[
            { href: '/account/settings/app', label: t('tabApp'), icona: <IconaImpostazioni /> },
            { href: '/account/settings/tax', label: t('tabFiscalita'), icona: <IconaFiscalita /> },
          ]}
        />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      </div>
    </div>
  )
}
