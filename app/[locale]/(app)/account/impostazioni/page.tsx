import { getTranslations } from 'next-intl/server'
import { Sezione } from '@/components/sezione'
import { SelettoreLingua } from './selettore-lingua'

export default async function ImpostazioniPage() {
  const t = await getTranslations('PaginaImpostazioni')
  const tMenu = await getTranslations('Menu')

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-eyebrow)', color: 'var(--text-secondary)' }}>{tMenu('account')}</div>
      <h1 style={{ fontSize: 'var(--fs-h1)', marginTop: 4, marginBottom: 16, fontWeight: 500 }}>{t('titolo')}</h1>

      <Sezione>
        <SelettoreLingua />
      </Sezione>
    </div>
  )
}
