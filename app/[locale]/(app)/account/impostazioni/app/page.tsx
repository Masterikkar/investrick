import { getTranslations } from 'next-intl/server'
import { SelettoreLingua } from './selettore-lingua'
import { SezioneImpostazioni } from '../sezione-impostazioni'

export default async function ImpostazioniAppPage() {
  const t = await getTranslations('PaginaImpostazioni')

  return (
    <SezioneImpostazioni titolo={t('sezioneLingua')}>
      <SelettoreLingua />
    </SezioneImpostazioni>
  )
}
