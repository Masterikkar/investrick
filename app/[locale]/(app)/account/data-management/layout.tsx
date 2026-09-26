import { getTranslations } from 'next-intl/server'
import { IconaAsset, IconaGruppi, IconaTransazioni, IconaImporta, IconaEsporta } from '@/components/icone'
import { BarraTab } from '../barra-tab'

export default async function DataManagementLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('Menu')
  const tGestioneTransazioni = await getTranslations('PaginaGestioneTransazioni')

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{t('account')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{t('gestioneDatabase')}</h1>

      <div style={{ display: 'flex', gap: 24, alignItems: 'stretch' }}>
        <BarraTab
          tab={[
            { href: '/account/data-management/asset', label: t('asset'), icona: <IconaAsset /> },
            { href: '/account/data-management/groups', label: t('gruppi'), icona: <IconaGruppi /> },
            { href: '/account/data-management/transactions', label: t('transazioni'), icona: <IconaTransazioni /> },
            { separatore: true },
            { href: '/account/data-management/import', label: tGestioneTransazioni('titoloImporta'), icona: <IconaImporta /> },
            { href: '/account/data-management/export', label: tGestioneTransazioni('titoloEsporta'), icona: <IconaEsporta /> },
          ]}
        />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      </div>
    </div>
  )
}
