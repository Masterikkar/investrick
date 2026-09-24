import { getTranslations } from 'next-intl/server'
import { SezioneImpostazioni } from '../sezione-impostazioni'

export default async function ImpostazioniFiscalitaPage() {
  const t = await getTranslations('PaginaImpostazioni')

  return (
    <SezioneImpostazioni titolo={t('sezioneAliquote')}>
      <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>{t('placeholderFiscalita')}</div>
    </SezioneImpostazioni>
  )
}
