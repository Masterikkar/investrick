import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { SezioneImpostazioni } from '../sezione-impostazioni'
import { FormEmail } from './form-email'
import { FormPassword } from './form-password'

export default async function InformazioniAccountPage() {
  const t = await getTranslations('PaginaAccount')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <>
      <SezioneImpostazioni titolo={t('titoloEmail')}>
        <FormEmail emailAttuale={user?.email ?? ''} emailInAttesa={user?.new_email ?? null} />
      </SezioneImpostazioni>
      <SezioneImpostazioni titolo={t('titoloPassword')}>
        <FormPassword />
      </SezioneImpostazioni>
    </>
  )
}
