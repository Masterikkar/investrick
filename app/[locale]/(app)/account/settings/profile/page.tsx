import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { profiloDaUtente } from '@/lib/profilo'
import { SezioneImpostazioni } from '../sezione-impostazioni'
import { FormProfilo } from './form-profilo'

export default async function ProfiloPage() {
  const t = await getTranslations('PaginaProfilo')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <SezioneImpostazioni titolo={t('titoloDatiPersonali')}>
      <FormProfilo iniziale={profiloDaUtente(user)} />
    </SezioneImpostazioni>
  )
}
