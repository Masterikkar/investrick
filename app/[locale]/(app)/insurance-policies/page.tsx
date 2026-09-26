import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { caricaGruppiReali } from '@/lib/gruppi'
import { PaginaGruppi } from '@/components/pagina-gruppi'

export default async function PolizzePage() {
  const t = await getTranslations('PaginaContenitore')
  const tContenitori = await getTranslations('Contenitori')
  const supabase = await createClient()
  const dati = await caricaGruppiReali(supabase, 'Polizza', 'data_attivazione')

  return (
    <PaginaGruppi
      dati={dati}
      titolo={tContenitori('polizze')}
      titoloElenco={t('titoloLeTuePolizze')}
      alertNessunGruppo={t('alertNessunaPolizzaRegistrata')}
      alertNessunGruppoConTarget={t('alertNessunaPolizzaConTarget')}
      hrefGruppo={(id) => `/insurance-policies/${id}`}
      mostraDataAttivazione
    />
  )
}
