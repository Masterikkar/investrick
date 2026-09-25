import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { caricaGruppiReali } from '@/lib/gruppi'
import { PaginaGruppi } from '@/components/pagina-gruppi'

export default async function PacPage() {
  const t = await getTranslations('PaginaContenitore')
  const tContenitori = await getTranslations('Contenitori')
  const supabase = await createClient()
  const dati = await caricaGruppiReali(supabase, 'PAC', 'nome')

  return (
    <PaginaGruppi
      dati={dati}
      titolo={tContenitori('pac')}
      titoloElenco={t('titoloITuoiPac')}
      alertNessunGruppo={t('alertNessunPacRegistrato')}
      alertNessunGruppoConTarget={t('alertNessunPacConTarget')}
      hrefGruppo={(id) => `/pac/${id}`}
    />
  )
}
