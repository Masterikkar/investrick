import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { NotificaDaParametro } from '@/components/notifica-da-parametro'
import { SezioneImpostazioni } from '../../settings/sezione-impostazioni'
import { FormContenitore, type ContenitoreModificabile } from './form-contenitore'
import { ListaContenitori } from './lista-contenitori'

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{
    successo_contenitore?: string
    errore_contenitore?: string
  }>
}) {
  const t = await getTranslations('PaginaGestioneStrumenti')
  const params = await searchParams
  const supabase = await createClient()

  const { data: contenitori } = await supabase
    .from('contenitori')
    .select('id, nome, tipo, data_attivazione, note, target_attivo')
    .order('nome')
    .returns<ContenitoreModificabile[]>()

  return (
    <>
      <SezioneImpostazioni titolo={t('titoloModificaContenitori')}>
        <ListaContenitori contenitori={contenitori ?? []} />
      </SezioneImpostazioni>

      <SezioneImpostazioni titolo={t('titoloCreaNuovoContenitore')}>
        {params.successo_contenitore === '1' && <NotificaDaParametro messaggio={t('successoContenitoreCreato')} />}
        {params.errore_contenitore === '1' && (
          <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-body)', marginBottom: 12 }}>
            {t('erroreGenerico')}
          </p>
        )}

        <FormContenitore />
      </SezioneImpostazioni>
    </>
  )
}
