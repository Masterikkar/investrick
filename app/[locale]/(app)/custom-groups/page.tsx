import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { caricaGruppiPersonalizzati } from '@/lib/gruppi'
import { PaginaGruppi } from '@/components/pagina-gruppi'

// Gruppi Personalizzati: strumenti interi scelti a mano, per monitorarli
// insieme. Ogni card porta alla gestione dei membri del gruppo. Niente totali
// aggregati: uno strumento può stare in più gruppi e verrebbe contato due volte.
export default async function PersonalizzatiPage() {
  const t = await getTranslations('PaginaContenitore')
  const tContenitori = await getTranslations('Contenitori')
  const supabase = await createClient()
  const dati = await caricaGruppiPersonalizzati(supabase)

  return (
    <PaginaGruppi
      dati={dati}
      titolo={tContenitori('personalizzati')}
      titoloElenco={t('titoloITuoiPersonalizzati')}
      alertNessunGruppo={t('alertNessunPersonalizzatoRegistrato')}
      alertNessunGruppoConTarget={t('alertNessunPersonalizzatoConTarget')}
      hrefGruppo={(id) => `/custom-groups/${id}/members`}
      mostraTotaleAggregato={false}
    />
  )
}
